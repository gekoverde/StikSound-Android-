package app.stiksound.android

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.net.URI
import java.net.URL

/**
 * Error surfaced to the web layer. `code` uses the StikSound error catalog names
 * (`url-rejected`, `file-too-large`, `remote-unavailable`) so the JS side can map them.
 */
class BridgeException(val code: String, detail: String) : Exception("$code: $detail")

/**
 * Line-for-line port of the desktop policy in apps/desktop/src-tauri/src/lib.rs
 * (`validate_myinstants_url`, `is_disallowed_ip`) and of packages/providers/src/url-policy.ts.
 */
object MyInstantsPolicy {
    val ALLOWED_HOSTS = setOf("www.myinstants.com", "myinstants.com")
    const val MAX_BYTES = 25 * 1024 * 1024
    const val MAX_REDIRECTS = 2
    const val TIMEOUT_MS = 20_000

    fun validateUrl(raw: String): URI {
        val parsed = try {
            URI(raw.trim())
        } catch (_: Exception) {
            throw BridgeException("url-rejected", "malformed URL")
        }
        if (!parsed.isAbsolute || parsed.isOpaque) {
            throw BridgeException("url-rejected", "malformed URL")
        }
        if (!"https".equals(parsed.scheme, ignoreCase = true)) {
            throw BridgeException("url-rejected", "only https allowed")
        }
        if (parsed.rawUserInfo != null) {
            throw BridgeException("url-rejected", "userinfo forbidden")
        }
        if (parsed.port != -1 && parsed.port != 443) {
            throw BridgeException("url-rejected", "non-443 port forbidden")
        }
        val host = parsed.host?.lowercase() ?: throw BridgeException("url-rejected", "missing host")
        if (host !in ALLOWED_HOSTS) {
            throw BridgeException("url-rejected", "host not allowed ($host)")
        }
        return parsed
    }

    fun isDisallowedIp(addr: InetAddress): Boolean {
        return when (addr) {
            is Inet4Address -> {
                val octets = addr.address
                val a = octets[0].toInt() and 0xff
                val b = octets[1].toInt() and 0xff
                addr.isLoopbackAddress ||
                    addr.isSiteLocalAddress || // 10/8, 172.16/12, 192.168/16
                    addr.isLinkLocalAddress ||
                    addr.isAnyLocalAddress ||
                    addr.isMulticastAddress ||
                    a == 0 ||
                    (a == 100 && b in 64..127) || // CGNAT
                    a >= 224 // multicast, reserved, broadcast
            }
            is Inet6Address -> {
                val first = addr.address[0].toInt() and 0xff
                addr.isLoopbackAddress ||
                    addr.isAnyLocalAddress ||
                    addr.isMulticastAddress ||
                    addr.isLinkLocalAddress ||
                    addr.isSiteLocalAddress ||
                    (first and 0xfe) == 0xfc // ULA fc00::/7
            }
            else -> true
        }
    }
}

/**
 * Downloads a MyInstants page or sound. Redirects are followed by hand so every hop is
 * revalidated, DNS answers are checked against private ranges, and the body is capped.
 */
class MyInstantsFetcher(
    private val resolve: (String) -> List<InetAddress> = { host -> InetAddress.getAllByName(host).toList() },
    private val open: (URL) -> HttpURLConnection = { url -> url.openConnection() as HttpURLConnection },
) {
    fun fetch(rawUrl: String): ByteArray {
        var current = MyInstantsPolicy.validateUrl(rawUrl)

        for (hop in 0..MyInstantsPolicy.MAX_REDIRECTS) {
            val host = current.host ?: throw BridgeException("url-rejected", "missing host")
            val addresses = try {
                resolve(host)
            } catch (e: Exception) {
                throw BridgeException("remote-unavailable", "DNS failed (${e.message})")
            }
            if (addresses.isEmpty()) {
                throw BridgeException("remote-unavailable", "DNS returned no addresses")
            }
            if (addresses.any { MyInstantsPolicy.isDisallowedIp(it) }) {
                throw BridgeException("url-rejected", "private or reserved IP address")
            }

            val conn = try {
                open(current.toURL())
            } catch (e: IOException) {
                throw BridgeException("remote-unavailable", e.message ?: "connection failed")
            }
            try {
                conn.instanceFollowRedirects = false
                conn.connectTimeout = MyInstantsPolicy.TIMEOUT_MS
                conn.readTimeout = MyInstantsPolicy.TIMEOUT_MS
                conn.useCaches = false
                conn.requestMethod = "GET"
                conn.setRequestProperty("User-Agent", USER_AGENT)

                val status = try {
                    conn.responseCode
                } catch (e: IOException) {
                    throw BridgeException("remote-unavailable", e.message ?: "request failed")
                }

                if (status in 300..399) {
                    if (hop == MyInstantsPolicy.MAX_REDIRECTS) {
                        throw BridgeException("url-rejected", "too many redirects")
                    }
                    val location = conn.getHeaderField("Location")
                        ?: throw BridgeException("url-rejected", "missing redirect location")
                    val next = try {
                        current.resolve(location.trim())
                    } catch (_: Exception) {
                        throw BridgeException("url-rejected", "invalid redirect location")
                    }
                    current = MyInstantsPolicy.validateUrl(next.toString())
                    continue
                }

                if (status !in 200..299) {
                    throw BridgeException("remote-unavailable", "HTTP $status")
                }
                if (conn.contentLengthLong > MyInstantsPolicy.MAX_BYTES) {
                    throw BridgeException("file-too-large", "remote response exceeds 25 MB")
                }
                return try {
                    conn.inputStream.use { readLimited(it, MyInstantsPolicy.MAX_BYTES) }
                } catch (e: BridgeException) {
                    throw e
                } catch (e: IOException) {
                    throw BridgeException("remote-unavailable", e.message ?: "read failed")
                }
            } finally {
                conn.disconnect()
            }
        }
        throw BridgeException("url-rejected", "redirect limit exceeded")
    }

    companion object {
        const val USER_AGENT = "Mozilla/5.0 (Linux; Android) StikSound/1.1"

        fun readLimited(input: InputStream, maxBytes: Int): ByteArray {
            val out = ByteArrayOutputStream()
            val buffer = ByteArray(64 * 1024)
            var total = 0
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                total += read
                if (total > maxBytes) {
                    throw BridgeException("file-too-large", "remote body exceeds ${maxBytes / (1024 * 1024)} MB")
                }
                out.write(buffer, 0, read)
            }
            return out.toByteArray()
        }
    }
}
