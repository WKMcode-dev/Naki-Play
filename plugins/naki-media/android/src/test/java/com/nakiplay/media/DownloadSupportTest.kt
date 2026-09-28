package com.nakiplay.media

import org.junit.Assert.*
import org.junit.Test

class DownloadSupportTest {
    @Test fun distinguishesExtractorCompatibilityFromRestrictedContent() {
        assertTrue(DownloadSupport.failure("No supported JavaScript runtime could be found", null, false).contains("JavaScript"))
        assertTrue(DownloadSupport.failure("n challenge solving failed", null, false).contains("JavaScript"))
        assertTrue(DownloadSupport.failure("Requested format is not available", null, false).contains("outra qualidade"))
        assertTrue(DownloadSupport.failure("Sign in to confirm your age", null, false).contains("exige login"))
        assertTrue(DownloadSupport.failure("Cannot run program /data/user/0/test", null, false).contains("iniciar o motor"))
        // Concrete transport failures must remain the primary diagnosis.
        assertTrue(DownloadSupport.failure("challenge solving failed\nHTTP Error 403", null, false).contains("HTTP 403"))
        assertTrue(DownloadSupport.failure("failed to initialize\nNo space left on device", null, false).contains("sem espaço"))
    }
    @Test fun recognizesDnsAcrossAndroidErrorVariants() {
        for (error in listOf("[Errno 7] No address associated with hostname", "Unable to resolve host youtube.com", "java.net.UnknownHostException", "Temporary failure in name resolution", "Name or service not known")) {
            val result = DownloadSupport.failure(error, "test", false)
            assertTrue(result.contains("DNS"))
            assertTrue(result.contains("Wi-Fi"))
        }
        assertTrue(DownloadSupport.failure("NAKI_OFFLINE", null, false).contains("conexão ativa"))
    }

    @Test fun repeatedDiagnosticsStayBounded() {
        val error = (1..100).joinToString("\n") { "WARNING No address associated with hostname https://private.test/?secret=123" }
        val result = DownloadSupport.failure(error, "test", false)
        assertFalse(result.contains("secret"))
        assertTrue(result.length < 1300)
    }
    private val day = 24L * 60 * 60 * 1000

    @Test fun checksAgainWithoutRestartingAndBacksOffAfterFailure() {
        assertTrue(DownloadSupport.shouldCheckUpdate(day * 3, day, 0))
        assertFalse(DownloadSupport.shouldCheckUpdate(day * 3, 0, day * 3 - 1000))
        assertTrue(DownloadSupport.shouldCheckUpdate(day * 3, 0, day * 3 - 16 * 60 * 1000))
        assertFalse(DownloadSupport.shouldCheckUpdate(day * 3, day * 3 - 1000, 0))
        assertTrue(DownloadSupport.shouldCheckUpdate(1000, day * 3, day * 3))
    }

    @Test fun explains403WithoutClaimingPremiumIsRequired() {
        val result = DownloadSupport.failure("ERROR: unable to download video data: HTTP Error 403: Forbidden", "test", false)
        assertTrue(result.contains("O Naki não exige Premium"))
        assertTrue(result.contains("HTTP 403"))
        assertTrue(result.contains("Extrator Android: test"))
    }

    @Test fun redactsSignedUrlsAndReportsUpdateFailure() {
        val result = DownloadSupport.failure("403: Forbidden https://example.test/media?token=secret /data/user/0/private", null, true)
        assertFalse(result.contains("secret"))
        assertFalse(result.contains("/data/user"))
        assertTrue(result.contains("atualização do extrator falhou"))
    }

    @Test fun distinguishesRateLimitsSpaceAndTimeout() {
        assertTrue(DownloadSupport.failure("HTTP Error 429", null, false).contains("Aguarde"))
        assertTrue(DownloadSupport.failure("No space left on device", null, false).contains("sem espaço"))
        assertTrue(DownloadSupport.failure("request timed out", null, false).contains("conexão"))
    }
}
