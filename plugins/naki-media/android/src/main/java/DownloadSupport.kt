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
            Regex("(?i)(no address associated with hostname|name or service not known|temporary failure in name resolution|unable to resolve host|unknownhostexception|nodename nor servname)").containsMatchIn(message) ->
                "O celular não conseguiu localizar o endereço do servidor (DNS). Não é erro do formato do arquivo nem falta de Premium. Abra o mesmo link no navegador desse celular e teste outra conexão (Wi-Fi ou dados móveis). Confira se o Android permite internet para o Naki e se há DNS privado, VPN ou filtro de rede interferindo."
            message.contains("NAKI_OFFLINE") ->
                "O Android não informou uma conexão ativa para o Naki. Conecte-se ao Wi-Fi ou aos dados móveis e tente novamente. Arquivos locais podem ser importados sem internet."
            Regex("(?i)(HTTP(?: Error)?\\s*403|403: Forbidden)").containsMatchIn(message) ->
                "A origem recusou o acesso ao arquivo (HTTP 403). Isso não comprova falta de YouTube Premium. O Naki não exige Premium, mas não contorna restrições de acesso da origem."
            Regex("(?i)(HTTP(?: Error)?\\s*429|too many requests)").containsMatchIn(message) ->
                "A origem limitou as solicitações (HTTP 429). Aguarde antes de tentar novamente."
            message.contains("No space left", ignoreCase = true) ->
                "O dispositivo está sem espaço para salvar ou converter o arquivo."
            message.contains("timed out", ignoreCase = true) ->
                "A conexão demorou demais para responder. Confira a conexão e tente novamente."
            Regex("(?i)(no supported javascript runtime|challenge solving failed|n challenge solving failed)").containsMatchIn(message) ->
                "O motor não conseguiu processar o JavaScript desta origem. Atualize o Naki e tente novamente com internet para verificar a atualização do extrator."
            message.contains("Requested format is not available", ignoreCase = true) ->
                "A origem não disponibilizou o formato solicitado. Analise o link novamente e tente outra qualidade. Se persistir, atualize o Naki."
            Regex("(?i)(sign in|login required|private video|members.only|not available in your country)").containsMatchIn(message) ->
                "A origem exige login ou restringiu este conteúdo. Este link não pode ser baixado pelo Naki sem acesso autorizado compatível."
            Regex("(?i)(cannot run program|failed to initialize|dlopen failed|exec format error)").containsMatchIn(message) ->
                "Não foi possível iniciar o motor no Android. Confira o espaço livre e instale uma versão do Naki compatível com o aparelho por cima da atual, preservando a biblioteca."
            else -> "Não foi possível concluir o processamento deste link."
        }
        // Do not expose signed media URLs or local paths in user-shared diagnostics.
        val detail = message.replace(Regex("https?://\\S+"), "[link omitido]")
            .replace(Regex("/(?:data|storage)/\\S+"), "[caminho omitido]")
            .lineSequence().distinct().toList().takeLast(4).joinToString("\n").takeLast(700)
        val update = if (updateFailed) " A verificação de atualização do extrator falhou; o motor instalado foi mantido." else ""
        return "$reason$update\nExtrator Android: ${version ?: "versão não informada"}.\nDetalhe: $detail"
    }
}
