package app.stiksound.android

import android.content.ContentValues
import android.content.Context
import android.os.Environment
import android.provider.MediaStore
import java.io.File

/** Writes exports to Download/StikSound or stages them for the share sheet. */
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

    fun saveToDownloads(context: Context, rawName: String, mime: String, bytes: ByteArray): String {
        val name = safeFileName(rawName)
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name)
            put(MediaStore.MediaColumns.MIME_TYPE, mime)
            put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/$SUBFOLDER")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw BridgeException("encode-failed", "could not create the file in Downloads")
        try {
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
                ?: throw BridgeException("encode-failed", "could not open the file in Downloads")
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            throw e
        }
        return "${Environment.DIRECTORY_DOWNLOADS}/$SUBFOLDER/$name"
    }

    /** Only the latest export is kept in cache/share, the one folder the FileProvider exposes. */
    fun stageForShare(context: Context, rawName: String, bytes: ByteArray): File {
        val dir = File(context.cacheDir, "share").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        return File(dir, safeFileName(rawName)).apply { writeBytes(bytes) }
    }
}
