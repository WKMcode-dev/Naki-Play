package com.nakiplay.media

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream

class ImportSupportTest {
    @Test fun convertsAudioOpusButNeverDiscardsVideo() {
        for (mime in listOf("audio/opus", "audio/vorbis")) {
            assertTrue(ImportSupport.needsAudioConversion(listOf(mime)))
            for (video in listOf("video/avc", "video/vp9", "video/x-vnd.on2.vp8", "video/hevc")) {
                assertFalse(ImportSupport.needsAudioConversion(listOf(video, mime)))
            }
        }
        for (mime in listOf("audio/mpeg", "audio/mp4a-latm", "audio/flac", "audio/raw")) {
            assertFalse(ImportSupport.needsAudioConversion(listOf(mime)))
        }
    }

    @Test fun copiesProvidersWithUnknownLengthAndSmallReads() {
        for (size in listOf(1, 1024, 65536, 200000)) {
            val data = ByteArray(size) { (it % 251).toByte() }
            val input = object : ByteArrayInputStream(data) {
                override fun available() = 0
                override fun read(buffer: ByteArray, offset: Int, length: Int): Int = super.read(buffer, offset, minOf(length, 7))
            }
            val output = ByteArrayOutputStream()
            assertEquals(size.toLong(), ImportSupport.copy(input, output))
            assertArrayEquals(data, output.toByteArray())
        }
    }

    @Test fun rejectsEmptyAndPropagatesProviderFailures() {
        assertThrows(IllegalArgumentException::class.java) { ImportSupport.copy(ByteArrayInputStream(byteArrayOf()), ByteArrayOutputStream()) }
        assertThrows(IOException::class.java) {
            ImportSupport.copy(object : InputStream() { override fun read(): Int = throw IOException("provider disconnected") }, ByteArrayOutputStream())
        }
    }

    @Test fun conversionIsBoundedOfflineAndKeepsPathsAsSingleArguments() {
        val path = "/private/áudio com espaços.mp3.mpeg"
        val args = ImportSupport.audioArguments(path, "/private/output.m4a")
        assertTrue(args.contains(path))
        assertEquals("file,pipe", args[args.indexOf("-protocol_whitelist") + 1])
        assertEquals("1", args[args.indexOf("-threads") + 1])
        assertTrue(args.contains("-xerror"))
        assertTrue(args.contains("aac"))
    }
}
