package com.nakiplay.media

internal object DownloadSupport {
    private const val DAY = 24L * 60 * 60 * 1000
    private const val RETRY_DELAY = 15L * 60 * 1000

    fun shouldCheckUpdate(now: Long, lastSuccess: Long, lastAttempt: Long): Boolean {
        val due = lastSuccess == 0L || now < lastSuccess || now - lastSuccess >= DAY
        val allowed = lastAttempt == 0L || now < lastAttempt || now - lastAttempt >= RETRY_DELAY
        return due && allowed
    }

    fun failure(message: String, version: String?, updateFailed: Boolean): String {
        val reason = when {
            Regex("(?i)(HTTP(?: Error)?\\s*403|403: Forbidden)").containsMatchIn(message) ->
                "A origem recusou o acesso ao arquivo (HTTP 403). Isso não comprova falta de YouTube Premium. O Naki não exige Premium, mas não contorna restrições de acesso da origem."
            Regex("(?i)(HTTP(?: Error)?\\s*429|too many requests)").containsMatchIn(message) ->
                "A origem limitou as solicitações (HTTP 429). Aguarde antes de tentar novamente."
            message.contains("No space left", ignoreCase = true) ->
                "O dispositivo está sem espaço para salvar ou converter o arquivo."
            message.contains("timed out", ignoreCase = true) ->
                "A conexão demorou demais para responder. Confira a conexão e tente novamente."
            else -> "Não foi possível concluir o processamento deste link."
        }
        // Do not expose signed media URLs or local paths in user-shared diagnostics.
        val detail = message.replace(Regex("https?://\\S+"), "[link omitido]")
            .replace(Regex("/(?:data|storage)/\\S+"), "[caminho omitido]")
            .takeLast(1200)
        val update = if (updateFailed) " A verificação de atualização do extrator falhou; o motor instalado foi mantido." else ""
        return "$reason$update\nExtrator Android: ${version ?: "versão não informada"}.\nDetalhe: $detail"
    }
}
