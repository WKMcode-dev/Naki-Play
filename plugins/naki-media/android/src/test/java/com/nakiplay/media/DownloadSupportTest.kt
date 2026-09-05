package com.nakiplay.media

import org.junit.Assert.*
import org.junit.Test

class DownloadSupportTest {
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
