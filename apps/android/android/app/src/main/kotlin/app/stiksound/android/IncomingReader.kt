package app.stiksound.android

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap

/** Reads files shared to StikSound ("Share" from the gallery, a file manager or WhatsApp). */
object IncomingReader {
    /** Matches LIMITS.MAX_VIDEO_BYTES in packages/core/src/domain/limits.ts. */
    const val MAX_INCOMING_BYTES = 100 * 1024 * 1024

    data class Item(val kind: String, val bytes: ByteArray, val mime: String, val name: String)

    private val AUDIO_EXT = setOf("mp3", "wav", "ogg", "oga", "opus", "m4a", "aac")
    private val STICKER_EXT = setOf("png", "jpg", "jpeg", "webp", "gif", "mp4", "mov", "m4v", "webm")
    private val URL_REGEX = Regex("""https?://[^\s<>"']+""", RegexOption.IGNORE_CASE)

    /** "sticker" for images and video clips, "audio" for sounds, null when StikSound can't use it. */
    fun classify(mime: String?, name: String): String? {
        val ext = name.substringAfterLast('.', "").lowercase()
        val m = mime?.lowercase().orEmpty()
        return when {
            m.startsWith("audio/") || ext in AUDIO_EXT -> "audio"
            m.startsWith("image/") || m.startsWith("video/") || ext in STICKER_EXT -> "sticker"
            else -> null
        }
    }

    /** First http(s) link in shared text, e.g. "Mira esto https://www.myinstants.com/es/instant/x/". */
    fun extractUrl(text: String): String? = URL_REGEX.find(text)?.value?.trimEnd('.', ',', ')', ']')

    fun read(resolver: ContentResolver, uri: Uri, fallbackMime: String?): Item {
        val name = displayName(resolver, uri) ?: uri.lastPathSegment ?: "shared"
        val mime = resolver.getType(uri)
            ?: MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substringAfterLast('.', "").lowercase())
            ?: fallbackMime
            ?: "application/octet-stream"
        val kind = classify(mime, name) ?: throw BridgeException("unsupported-image", "unsupported type $mime")
        val bytes = resolver.openInputStream(uri)?.use {
            MyInstantsFetcher.readLimited(it, MAX_INCOMING_BYTES)
        } ?: throw BridgeException("unsupported-image", "could not open $uri")
        return Item(kind, bytes, mime, name)
    }

    private fun displayName(resolver: ContentResolver, uri: Uri): String? = try {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    } catch (_: Exception) {
        null
    }
}
