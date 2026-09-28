package com.nakiplay.media

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class AudioPlaybackPolicyTest {
    @get:Rule val temporary = TemporaryFolder()

    private fun mediaFile(root: File, name: String): File = File(root, name).apply { writeBytes(byteArrayOf(1, 2, 3)) }

    @Test fun acceptsOnlyReadableNonemptyFilesInsidePrivateMediaRoot() {
        val root = temporary.newFolder("media")
        val audio = mediaFile(root, "faixa.mp3.mpeg")
        assertEquals(audio.canonicalFile, AudioPlaybackPolicy.privateFile(root, audio.path))
        val outside = mediaFile(temporary.root, "secret.txt")
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.privateFile(root, outside.path) }
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.privateFile(root, File(root, "../secret.txt").path) }
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.privateFile(root, "https://youtube.com/watch?v=a") }
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.privateFile(root, "content://provider/file") }
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.privateFile(root, "relative.mp3") }
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.privateFile(root, File(root, "absent.mp3").path) }
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.privateFile(root, File(root, "empty.mp3").apply { createNewFile() }.path) }
    }

    @Test fun validatesWholeQueueAndRejectsDuplicateIds() {
        val root = temporary.newFolder("media")
        val file = mediaFile(root, "faixa.m4a")
        val track = AudioQueueItem("one", file.path, "title", "artist")
        assertEquals(listOf(track.copy(path = file.canonicalPath)), AudioPlaybackPolicy.validate(root, listOf(track)))
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.validate(root, listOf(track, track)) }
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.validate(root, listOf(track, AudioQueueItem("two", "/outside.mp3"))) }
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.validate(root, listOf(track.copy(id = ""))) }
    }

    @Test fun currentIdentitySurvivesReorderMetadataAndOptionsChanges() {
        val first = AudioQueueItem("a", "/media/a.m4a", "Original")
        val second = AudioQueueItem("b", "/media/b.m4a")
        val updated = first.copy(title = "Renamed", artist = "Updated")
        assertEquals(first.key, updated.key)
        assertEquals(1, AudioPlaybackPolicy.selectedIndex(listOf(second, updated), null, first))
        assertEquals(0, AudioPlaybackPolicy.selectedIndex(listOf(second, updated), "b", first))
        assertEquals(0, AudioPlaybackPolicy.selectedIndex(listOf(second), null, first))
        assertThrows(IllegalArgumentException::class.java) { AudioPlaybackPolicy.selectedIndex(listOf(second), "missing", first) }
        assertEquals(-1, AudioPlaybackPolicy.selectedIndex(emptyList(), null, first))
    }

    @Test fun repeatCurrentOverridesAutoplayPauseWithoutEnablingRepeatAll() {
        assertFalse(AudioPlaybackPolicy.pauseAtEnd(autoplay = true, repeatOne = false))
        assertTrue(AudioPlaybackPolicy.pauseAtEnd(autoplay = false, repeatOne = false))
        assertFalse(AudioPlaybackPolicy.pauseAtEnd(autoplay = false, repeatOne = true))
        assertFalse(AudioPlaybackPolicy.pauseAtEnd(autoplay = true, repeatOne = true))
    }
}
