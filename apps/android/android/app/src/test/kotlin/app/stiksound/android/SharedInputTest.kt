package app.stiksound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SharedInputTest {

    @Test
    fun classifiesSharedFiles() {
        assertEquals("sticker", IncomingReader.classify("image/png", "a.png"))
        assertEquals("sticker", IncomingReader.classify("image/gif", "a.gif"))
        assertEquals("sticker", IncomingReader.classify("video/mp4", "clip.mp4"))
        assertEquals("sticker", IncomingReader.classify(null, "clip.MOV"))
        assertEquals("audio", IncomingReader.classify("audio/mpeg", "a.mp3"))
        assertEquals("audio", IncomingReader.classify("application/octet-stream", "voice.opus"))
        assertNull(IncomingReader.classify("application/pdf", "doc.pdf"))
    }

    @Test
    fun extractsFirstLinkFromSharedText() {
        assertEquals(
            "https://www.myinstants.com/es/instant/bruh-12345/",
            IncomingReader.extractUrl("Mira esto: https://www.myinstants.com/es/instant/bruh-12345/ jaja"),
        )
        assertEquals("https://www.myinstants.com/x/", IncomingReader.extractUrl("(https://www.myinstants.com/x/)."))
        assertNull(IncomingReader.extractUrl("sin enlace"))
    }

    @Test
    fun sanitizesExportNames() {
        assertEquals("sticker_10s.mp4", ExportStore.safeFileName("sticker 10s.mp4"))
        assertEquals("passwd", ExportStore.safeFileName("../../etc/passwd"))
        assertEquals("evil.mp4", ExportStore.safeFileName("C:\\x\\evil.mp4"))
        assertEquals("stiksound", ExportStore.safeFileName("..."))
        assertEquals("_and_.zip", ExportStore.safeFileName("ñandú.zip"))
    }
}
