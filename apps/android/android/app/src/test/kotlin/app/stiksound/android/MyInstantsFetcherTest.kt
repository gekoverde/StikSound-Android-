package app.stiksound.android

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL

/** Mirrors packages/providers/test/myinstants.test.ts so the Android policy matches the other clients. */
class MyInstantsFetcherTest {

    private fun assertRejected(code: String, block: () -> Unit) {
        try {
            block()
            fail("expected $code")
        } catch (e: BridgeException) {
            assertEquals(code, e.code)
        }
    }

    @Test
    fun acceptsOnlyHttpsMyInstantsHosts() {
        MyInstantsPolicy.validateUrl("https://www.myinstants.com/en/instant/airhorn/")
        MyInstantsPolicy.validateUrl("  https://MyInstants.com/media/sounds/a.mp3 ")
        MyInstantsPolicy.validateUrl("https://www.myinstants.com:443/media/sounds/a.mp3")

        assertRejected("url-rejected") { MyInstantsPolicy.validateUrl("http://www.myinstants.com/en/instant/airhorn/") }
        assertRejected("url-rejected") { MyInstantsPolicy.validateUrl("https://www.myinstants.com@evil.example/a.mp3") }
        assertRejected("url-rejected") { MyInstantsPolicy.validateUrl("https://www.myinstants.com:8443/en/instant/a/") }
        assertRejected("url-rejected") { MyInstantsPolicy.validateUrl("https://127.0.0.1/media/sounds/a.mp3") }
        assertRejected("url-rejected") { MyInstantsPolicy.validateUrl("https://evil.example/media/sounds/a.mp3") }
        assertRejected("url-rejected") { MyInstantsPolicy.validateUrl("https://myinstants.com.evil.example/a.mp3") }
        assertRejected("url-rejected") { MyInstantsPolicy.validateUrl("not a url") }
        assertRejected("url-rejected") { MyInstantsPolicy.validateUrl("") }
    }

    @Test
    fun flagsPrivateAndReservedAddresses() {
        val blocked = listOf(
            "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
            "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1",
        )
        for (ip in blocked) assertTrue(ip, MyInstantsPolicy.isDisallowedIp(InetAddress.getByName(ip)))

        val allowed = listOf("104.21.32.1", "172.32.0.1", "100.128.0.1", "2606:4700::6810:1")
        for (ip in allowed) assertFalse(ip, MyInstantsPolicy.isDisallowedIp(InetAddress.getByName(ip)))
    }

    private class FakeConnection(
        url: URL,
        private val status: Int,
        private val headers: Map<String, String> = emptyMap(),
        private val body: ByteArray = ByteArray(0),
        private val declaredLength: Long = -1,
    ) : HttpURLConnection(url) {
        override fun connect() {}
        override fun disconnect() {}
        override fun usingProxy() = false
        override fun getResponseCode() = status
        override fun getHeaderField(name: String?): String? = headers[name]
        override fun getContentLengthLong() = declaredLength
        override fun getInputStream(): InputStream = ByteArrayInputStream(body)
    }

    private val publicDns: (String) -> List<InetAddress> = { listOf(InetAddress.getByName("104.21.32.1")) }

    @Test
    fun followsAllowedRedirectAndReturnsBody() {
        val requested = mutableListOf<String>()
        val fetcher = MyInstantsFetcher(publicDns) { url ->
            requested += url.toString()
            if (url.path.endsWith("old.mp3")) {
                FakeConnection(url, 301, mapOf("Location" to "/media/sounds/new.mp3"))
            } else {
                FakeConnection(url, 200, body = byteArrayOf(1, 2, 3))
            }
        }
        assertArrayEquals(byteArrayOf(1, 2, 3), fetcher.fetch("https://www.myinstants.com/media/sounds/old.mp3"))
        assertEquals("https://www.myinstants.com/media/sounds/new.mp3", requested.last())
    }

    @Test
    fun rejectsRedirectsToOtherHostsOrPlainHttp() {
        val toLocal = MyInstantsFetcher(publicDns) { url -> FakeConnection(url, 302, mapOf("Location" to "http://127.0.0.1/secret")) }
        assertRejected("url-rejected") { toLocal.fetch("https://www.myinstants.com/media/sounds/test.mp3") }

        val toEvil = MyInstantsFetcher(publicDns) { url -> FakeConnection(url, 302, mapOf("Location" to "https://evil.example/audio.mp3")) }
        assertRejected("url-rejected") { toEvil.fetch("https://www.myinstants.com/media/sounds/test.mp3") }
    }

    @Test
    fun stopsAfterTwoRedirects() {
        val loop = MyInstantsFetcher(publicDns) { url -> FakeConnection(url, 302, mapOf("Location" to "/media/sounds/again.mp3")) }
        assertRejected("url-rejected") { loop.fetch("https://www.myinstants.com/media/sounds/test.mp3") }
    }

    @Test
    fun rejectsHostsResolvingToPrivateAddresses() {
        var opened = false
        val rebinding = MyInstantsFetcher({ listOf(InetAddress.getByName("192.168.0.10")) }) { url ->
            opened = true
            FakeConnection(url, 200)
        }
        assertRejected("url-rejected") { rebinding.fetch("https://www.myinstants.com/media/sounds/test.mp3") }
        assertFalse("must not connect", opened)
    }

    @Test
    fun capsResponseSize() {
        val declared = MyInstantsFetcher(publicDns) { url -> FakeConnection(url, 200, declaredLength = 26L * 1024 * 1024) }
        assertRejected("file-too-large") { declared.fetch("https://www.myinstants.com/media/sounds/big.mp3") }

        val streamed = MyInstantsFetcher(publicDns) { url -> FakeConnection(url, 200, body = ByteArray(MyInstantsPolicy.MAX_BYTES + 1)) }
        assertRejected("file-too-large") { streamed.fetch("https://www.myinstants.com/media/sounds/big.mp3") }
    }

    @Test
    fun mapsHttpErrorsToRemoteUnavailable() {
        val notFound = MyInstantsFetcher(publicDns) { url -> FakeConnection(url, 404) }
        assertRejected("remote-unavailable") { notFound.fetch("https://www.myinstants.com/media/sounds/missing.mp3") }
    }
}
