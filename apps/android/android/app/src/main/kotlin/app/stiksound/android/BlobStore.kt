package app.stiksound.android

import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * In-memory hand-off area between Kotlin and the web page.
 *
 * - Bytes going to JS (shared files, MyInstants downloads) are parked under a random id and served
 *   once, by [pathHandler], at https://appassets.androidplatform.net/blob/<id>.
 * - Bytes coming from JS (exports) arrive as base64 chunks under an upload id.
 */
class BlobStore {
    data class Blob(val bytes: ByteArray, val mime: String, val name: String)

    private val blobs = ConcurrentHashMap<String, Blob>()
    private val uploads = ConcurrentHashMap<String, ByteArrayOutputStream>()

    fun put(bytes: ByteArray, mime: String, name: String): String {
        val id = UUID.randomUUID().toString()
        blobs[id] = Blob(bytes, mime, name)
        return id
    }

    /** One-shot read: a blob disappears once the page has fetched it. */
    fun take(id: String): Blob? = blobs.remove(id)

    fun appendUpload(uploadId: String, chunk: ByteArray) {
        require(UPLOAD_ID.matches(uploadId)) { "invalid upload id" }
        val stream = uploads.getOrPut(uploadId) { ByteArrayOutputStream() }
        if (stream.size() + chunk.size > MAX_UPLOAD_BYTES) {
            uploads.remove(uploadId)
            throw BridgeException("file-too-large", "export exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB")
        }
        stream.write(chunk)
    }

    fun finishUpload(uploadId: String): ByteArray =
        uploads.remove(uploadId)?.toByteArray()
            ?: throw BridgeException("encode-failed", "nothing was uploaded")

    val pathHandler = WebViewAssetLoader.PathHandler { path ->
        val blob = take(path.trimEnd('/')) ?: return@PathHandler null
        WebResourceResponse(
            blob.mime,
            null,
            200,
            "OK",
            mapOf("Cache-Control" to "no-store"),
            ByteArrayInputStream(blob.bytes),
        )
    }

    companion object {
        /** Exports are small videos or a project ZIP; the ZIP is capped at 100 MB by the core. */
        const val MAX_UPLOAD_BYTES = 110 * 1024 * 1024
        private val UPLOAD_ID = Regex("^[A-Za-z0-9-]{8,64}$")
    }
}
