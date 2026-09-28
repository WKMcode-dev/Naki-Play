package com.nakiplay.media

import java.io.InputStream
import java.io.OutputStream

internal object ImportSupport {
    fun needsAudioConversion(mimes: List<String>): Boolean =
        mimes.none { it.startsWith("video/") } &&
            mimes.any { it == "audio/opus" || it == "audio/vorbis" }

    fun copy(source: InputStream, destination: OutputStream): Long {
        val copied = source.copyTo(destination, 64 * 1024)
        require(copied > 0) { "O arquivo está vazio. Baixe o original novamente." }
        return copied
    }

    fun audioArguments(input: String, output: String): List<String> = listOf(
        "-nostdin", "-hide_banner", "-v", "error", "-xerror", "-n",
        "-protocol_whitelist", "file,pipe", "-threads", "1", "-i", input,
        "-map", "0:a:0", "-vn", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000",
        "-threads", "1", "-movflags", "+faststart", "-f", "ipod", output,
    )
}
