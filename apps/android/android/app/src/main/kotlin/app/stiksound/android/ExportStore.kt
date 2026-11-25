package app.stiksound.android

import android.content.ContentValues
import android.content.Context
import android.provider.MediaStore
import java.io.File

/** Writes exports to the gallery or Downloads, or stages them for the share sheet. */
object ExportStore {
    private const val SUBFOLDER = "StikSound"

    /** Same rule as the desktop clipboard command: keep [A-Za-z0-9._-], replace the rest. */
    fun safeFileName(raw: String): String {
        val base = raw.substringAfterLast('/').substringAfterLast('\\')
        val cleaned = base
            .map { c -> if ((c in 'a'..'z') || (c in 'A'..'Z') || (c in '0'..'9') || c == '.' || c == '-' || c == '_') c else '_' }
            .joinToString("")
            .trimStart('.')
            .take(120)
        return cleaned.ifEmpty { "stiksound" }
    }

    /** Where an export lands. Videos and images go to the gallery so WhatsApp's own pickers see them. */
    // Literal names equal Environment.DIRECTORY_MOVIES / _PICTURES / _DOWNLOADS (kept literal so JVM tests run).
    enum class Destination(val relativeDir: String) {
        GALLERY_VIDEO("Movies/$SUBFOLDER"),
        GALLERY_IMAGE("Pictures/$SUBFOLDER"),
        DOWNLOADS("Download/$SUBFOLDER"),
    }

    fun destinationFor(mime: String): Destination = when {
        mime.startsWith("video/") -> Destination.GALLERY_VIDEO
        mime.startsWith("image/") -> Destination.GALLERY_IMAGE
        else -> Destination.DOWNLOADS
    }

    /**
     * MP4/WebM -> Movies/StikSound (Gallery), WebP -> Pictures/StikSound, ZIP -> Download/StikSound.
     * The gallery matters: WhatsApp's "Create sticker" only lists photos and videos from there.
     */
    fun saveExport(context: Context, rawName: String, mime: String, bytes: ByteArray): String {
        val name = safeFileName(rawName)
        val destination = destinationFor(mime)
        val collection = when (destination) {
            Destination.GALLERY_VIDEO -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
            Destination.GALLERY_IMAGE -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            Destination.DOWNLOADS -> MediaStore.Downloads.EXTERNAL_CONTENT_URI
        }
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name)
            put(MediaStore.MediaColumns.MIME_TYPE, mime)
            put(MediaStore.MediaColumns.RELATIVE_PATH, destination.relativeDir)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val uri = resolver.insert(collection, values)
            ?: throw BridgeException("encode-failed", "could not create the file in ${destination.relativeDir}")
        try {
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
                ?: throw BridgeException("encode-failed", "could not open the file in ${destination.relativeDir}")
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            throw e
        }
        return "${destination.relativeDir}/$name"
    }

    /** Only the latest export is kept in cache/share, the one folder the FileProvider exposes. */
    fun stageForShare(context: Context, rawName: String, bytes: ByteArray): File {
        val dir = File(context.cacheDir, "share").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        return File(dir, safeFileName(rawName)).apply { writeBytes(bytes) }
    }
}
