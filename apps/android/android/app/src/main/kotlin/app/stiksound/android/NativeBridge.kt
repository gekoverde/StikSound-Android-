package app.stiksound.android

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONException
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Message channel exposed to the page as `window.StikSoundNative`
 * (see apps/android/src/native-bridge.ts for the other end).
 *
 * WebViewCompat.addWebMessageListener only injects the object into frames whose origin matches
 * [ORIGIN], so no other page can reach these operations. Nothing here runs JS from native code.
 */
class NativeBridge(
    private val blobs: BlobStore,
    private val host: Host,
) : WebViewCompat.WebMessageListener {

    interface Host {
        fun saveToDownloads(name: String, mime: String, bytes: ByteArray): String
        fun stageForShare(name: String, bytes: ByteArray): File
        fun launchShare(file: File, mime: String)

        /** Shows the RECORD_AUDIO dialog if needed; calls back on the UI thread. */
        fun requestMicrophone(onResult: (granted: Boolean, canAskAgain: Boolean) -> Unit)
        fun openAppSettings()
    }

    private val main = Handler(Looper.getMainLooper())
    private val worker: ExecutorService = Executors.newFixedThreadPool(2)
    private val fetcher = MyInstantsFetcher()

    /** The page's channel, known after its "hello". Native-initiated events need it. */
    private var channel: JavaScriptReplyProxy? = null
    private val pendingEvents = ArrayDeque<String>()

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy,
    ) {
        if (!isMainFrame || sourceOrigin.toString().trimEnd('/') != ORIGIN) return
        val request = try {
            JSONObject(message.data ?: return)
        } catch (_: JSONException) {
            return
        }
        val id = request.optString("id")
        when (request.optString("op")) {
            "hello" -> {
                channel = replyProxy
                reply(replyProxy, id) { JSONObject() }
                while (pendingEvents.isNotEmpty()) replyProxy.postMessage(pendingEvents.removeFirst())
            }
            "fetchMyInstants" -> background(replyProxy, id) {
                val bytes = fetcher.fetch(request.getString("url"))
                JSONObject().put("blobId", blobs.put(bytes, "application/octet-stream", "myinstants"))
            }
            "uploadChunk" -> reply(replyProxy, id) {
                val chunk = Base64.decode(request.getString("data"), Base64.DEFAULT)
                blobs.appendUpload(request.getString("uploadId"), chunk)
                JSONObject()
            }
            "save" -> background(replyProxy, id) {
                val bytes = blobs.finishUpload(request.getString("uploadId"))
                val path = host.saveToDownloads(request.getString("name"), mimeOf(request), bytes)
                JSONObject().put("path", path)
            }
            "share" -> background(replyProxy, id) {
                val bytes = blobs.finishUpload(request.getString("uploadId"))
                val file = host.stageForShare(request.getString("name"), bytes)
                val mime = mimeOf(request)
                main.post { host.launchShare(file, mime) }
                JSONObject()
            }
            "requestMicrophone" -> host.requestMicrophone { granted, canAskAgain ->
                sendReply(replyProxy, id, JSONObject().put("granted", granted).put("canAskAgain", canAskAgain), null)
            }
            "openAppSettings" -> reply(replyProxy, id) {
                host.openAppSettings()
                JSONObject()
            }
            else -> sendReply(replyProxy, id, null, "native-error: unknown operation")
        }
    }

    /** Sends a file or link that arrived through "Share to StikSound" to the page. */
    fun pushIncomingBlob(kind: String, bytes: ByteArray, mime: String, name: String) {
        val blobId = blobs.put(bytes, mime, name)
        pushEvent(JSONObject().put("event", "incoming").put("kind", kind).put("blobId", blobId).put("name", name))
    }

    fun pushIncomingUrl(url: String) {
        pushEvent(JSONObject().put("event", "incoming").put("kind", "url").put("url", url))
    }

    fun shutdown() {
        worker.shutdownNow()
    }

    private fun pushEvent(event: JSONObject) {
        main.post {
            val text = event.toString()
            channel?.postMessage(text) ?: pendingEvents.addLast(text)
        }
    }

    private fun mimeOf(request: JSONObject): String {
        val mime = request.optString("mime")
        return if (MIME.matches(mime)) mime else "application/octet-stream"
    }

    private fun background(proxy: JavaScriptReplyProxy, id: String, work: () -> JSONObject) {
        worker.execute { reply(proxy, id, work) }
    }

    private fun reply(proxy: JavaScriptReplyProxy, id: String, work: () -> JSONObject) {
        try {
            sendReply(proxy, id, work(), null)
        } catch (e: BridgeException) {
            sendReply(proxy, id, null, e.message)
        } catch (e: Exception) {
            sendReply(proxy, id, null, "encode-failed: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    private fun sendReply(proxy: JavaScriptReplyProxy, id: String, result: JSONObject?, error: String?) {
        val payload = JSONObject().put("id", id).put("ok", error == null)
        if (result != null) payload.put("result", result)
        if (error != null) payload.put("error", error)
        val text = payload.toString()
        // JavaScriptReplyProxy must be used on the UI thread.
        if (Looper.myLooper() == Looper.getMainLooper()) proxy.postMessage(text) else main.post { proxy.postMessage(text) }
    }

    companion object {
        const val ORIGIN = "https://appassets.androidplatform.net"
        private val MIME = Regex("^[a-z]+/[a-z0-9.+-]+$")
    }
}
