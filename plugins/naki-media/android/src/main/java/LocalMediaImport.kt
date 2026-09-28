package com.nakiplay.media

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.provider.OpenableColumns
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

internal class LocalMediaImport(private val context: Context) {
    fun copy(source: String, destinationPath: String): Map<String, Any> {
        val destination = File(destinationPath).canonicalFile
        // Tauri PathPlugin.getDataDir returns dataDir, not filesDir.
        val mediaRoot = File(context.dataDir, "media").canonicalFile
        require(destination.parentFile == mediaRoot && destination.extension == "importing") {
            "O destino da importação não pertence à biblioteca."
        }
        require(!destination.exists()) { "A cópia de importação já existe." }
        val uri = Uri.parse(source)
        var displayName = ""
        var duration = 0L
        try {
            val input = when (uri.scheme) {
                "content" -> {
                    displayName = runCatching {
                        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                            if (cursor.moveToFirst()) cursor.getString(0) else null
                        }
                    }.getOrNull().orEmpty()
                    context.contentResolver.openInputStream(uri)
                }
                "file" -> File(requireNotNull(uri.path)).inputStream()
                null -> File(source).inputStream()
                else -> throw IllegalArgumentException("Selecione um arquivo pelo botão Escolher arquivos.")
            } ?: throw IllegalStateException("O aplicativo de origem não disponibilizou o arquivo. Salve-o em Downloads e selecione novamente.")
            input.use { stream -> destination.outputStream().use { ImportSupport.copy(stream, it) } }
            val extractor = MediaExtractor()
            val mimes = try {
                extractor.setDataSource(destination.absolutePath)
                require(extractor.trackCount > 0) { "O arquivo não contém faixas de mídia legíveis." }
                (0 until extractor.trackCount).map { index ->
                    val format = extractor.getTrackFormat(index)
                    if (format.containsKey(MediaFormat.KEY_DURATION)) duration = maxOf(duration, format.getLong(MediaFormat.KEY_DURATION) / 1_000_000)
                    format.getString(MediaFormat.KEY_MIME).orEmpty()
                }
            } finally { extractor.release() }
            val converted = ImportSupport.needsAudioConversion(mimes)
            if (converted) convertAudio(destination)
            return mapOf("name" to displayName, "durationSeconds" to duration, "converted" to converted)
        } catch (error: Exception) {
            destination.delete()
            if (error is SecurityException) throw IllegalStateException("Sem permissão para ler esse arquivo. Selecione-o novamente ou salve uma cópia em Downloads.", error)
            throw error
        }
    }

    private fun convertAudio(source: File) {
        // Offline initialization only: importing a personal file never needs internet.
        YoutubeDL.getInstance().init(context)
        FFmpeg.getInstance().init(context)
        val output = File(source.path + ".m4a")
        val nativeDir = context.applicationInfo.nativeLibraryDir
        val packages = File(context.noBackupFilesDir, "youtubedl-android/packages")
        val builder = ProcessBuilder(listOf(File(nativeDir, "libffmpeg.so").path) + ImportSupport.audioArguments(source.path, output.path))
            .redirectErrorStream(true)
        builder.environment()["LD_LIBRARY_PATH"] = listOf("python", "ffmpeg").joinToString(":") { File(packages, "$it/usr/lib").path }
        builder.environment()["TMPDIR"] = context.cacheDir.path
        var process: Process? = null
        try {
            process = builder.start()
            val running = process
            // Drain output concurrently, retaining only a small diagnostic tail.
            val tail = StringBuffer()
            val reader = thread(isDaemon = true, name = "naki-import-output") {
                runCatching { running.inputStream.bufferedReader().useLines { lines ->
                    lines.forEach { line -> synchronized(tail) {
                        tail.append(line.take(400)).append('\n')
                        if (tail.length > 1200) tail.delete(0, tail.length - 1200)
                    } }
                } }
            }
            check(running.waitFor(10, TimeUnit.MINUTES)) { "A conversão demorou demais. Tente um arquivo menor." }
            reader.join(1000)
            check(running.exitValue() == 0 && output.length() > 0) {
                "Não foi possível preparar o áudio compatível. O original pode estar incompleto ou protegido."
            }
            check(output.renameTo(source)) { "Não foi possível finalizar a cópia compatível." }
        } finally {
            process?.destroy()
            output.delete()
        }
    }
}
