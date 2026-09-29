package com.nakiplay.media

import java.io.ByteArrayOutputStream
import org.junit.Assert.*
import org.junit.Test

class ExtractorInstallPolicyTest {
    @Test fun upgradesOldAndMissingEngineWithoutNetwork() {
        assertTrue(ExtractorInstallPolicy.shouldInstall("2025.11.12", "2026.08.19"))
        assertTrue(ExtractorInstallPolicy.shouldInstall(null, "2026.08.19"))
    }
    @Test fun preservesCurrentNewerAndCustomVersions() {
        for (version in listOf("2026.08.19", "2026.08.19.123456", "2026.09.01", "custom-build")) {
            assertFalse(version, ExtractorInstallPolicy.shouldInstall(version, "2026.08.19"))
        }
    }
    @Test fun acceptsVerifiedBytes() {
        val output = ByteArrayOutputStream()
        ExtractorInstallPolicy.copyVerified("abc".byteInputStream(), output,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        assertEquals("abc", output.toString("UTF-8"))
    }
    @Test(expected = IllegalStateException::class)
    fun rejectsCorruptedBytesBeforeCommit() {
        ExtractorInstallPolicy.copyVerified("damaged".byteInputStream(), ByteArrayOutputStream(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }
}
