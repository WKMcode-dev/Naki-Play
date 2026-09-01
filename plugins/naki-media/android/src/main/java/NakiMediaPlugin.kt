package com.nakiplay.media

import android.app.Activity
import android.net.Uri
import androidx.appcompat.app.AppCompatActivity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import com.yausername.youtubedl_android.mapper.VideoInfo
import java.io.File
import java.util.concurrent.Executors

@InvokeArg
class AnalyzeArgs {
    lateinit var url: String
}

@InvokeArg
class DownloadArgs {
    lateinit var url: String
    lateinit var destinationStem: String
    lateinit var jobId: String
    lateinit var optionId: String
    lateinit var title: String
    lateinit var author: String
    var durationSeconds: Long = 0
    lateinit var onEvent: Channel
}

@InvokeArg
class CancelArgs {
    lateinit var jobId: String
}

data class MediaFormatChoice(
    val id: String,
    val kind: String,
    val container: String,
    val quality: String,
    val label: String,
)

data class MediaAnalysis(
    val id: String,
    val title: String,
    val author: String,
    val thumbnailUrl: String?,
    val durationSeconds: Long,
    val webpageUrl: String,
    val provider: String,
    val formats: List<MediaFormatChoice>,
)

data class DownloadResponse(
    val filePath: String,
    val fileName: String,
    val title: String,
    val author: String,
    val durationSeconds: Long,
)

@TauriPlugin
class NakiMediaPlugin(private val activity: Activity) : Plugin(activity) {
    companion object {
        private const val UPDATE_INTERVAL_MS = 7L * 24 * 60 * 60 * 1000
    }

    private val worker = Executors.newCachedThreadPool()

    @Volatile
    private var initialized = false

    @Synchronized
    private fun ensureInitialized() {
        if (initialized) return
        val context = activity.applicationContext
        YoutubeDL.getInstance().init(context)
        val preferences = context.getSharedPreferences("naki-media", Activity.MODE_PRIVATE)
        val lastUpdate = preferences.getLong("yt-dlp-last-update", 0)
        if (System.currentTimeMillis() - lastUpdate >= UPDATE_INTERVAL_MS) {
            try {
                YoutubeDL.getInstance().updateYoutubeDL(context, YoutubeDL.UpdateChannel._STABLE)
                preferences.edit().putLong("yt-dlp-last-update", System.currentTimeMillis()).apply()
            } catch (_: Exception) {
                // The bundled engine remains available when the device is offline.
            }
        }
        FFmpeg.getInstance().init(context)
        initialized = true
    }

    private fun validateUrl(value: String): String {
        val url = value.trim()
        val parsed = Uri.parse(url)
        if ((parsed.scheme != "https" && parsed.scheme != "http") || parsed.host.isNullOrBlank()) {
            throw IllegalArgumentException("Cole um link válido começando com https:// ou http://")
        }
        if (!parsed.userInfo.isNullOrBlank()) {
            throw IllegalArgumentException("Links com usuário ou senha não são aceitos")
        }
        return url
    }

    private fun analysisFormats(info: VideoInfo): List<MediaFormatChoice> {
        val maxHeight = info.formats
            ?.asSequence()
            ?.filter { it.height > 0 && it.vcodec != "none" }
            ?.maxOfOrNull { it.height }
            ?: info.height
        val standardHeights = listOf(144, 240, 360, 480, 720, 1080, 1440, 2160)
        val videoHeights = standardHeights.filter { it <= maxHeight }
        val audio = listOf(128, 192, 256, 320).map { bitrate ->
            MediaFormatChoice(
                id = "audio-$bitrate",
                kind = "audio",
                container = "mp3",
                quality = bitrate.toString(),
                label = "MP3 · $bitrate kbps",
            )
        }
        val video = videoHeights.map { height ->
            MediaFormatChoice(
                id = "video-$height",
                kind = "video",
                container = "mp4",
                quality = height.toString(),
                label = "MP4 · ${height}p",
            )
        }
        return audio + video
    }

    private fun sendPreparing(args: DownloadArgs, message: String) {
        val data = JSObject()
        data.put("message", message)
        val event = JSObject()
        event.put("event", "preparing")
        event.put("data", data)
        args.onEvent.send(event)
    }

    private fun sendProgress(
        args: DownloadArgs,
        progress: Float,
        etaSeconds: Long,
        message: String,
    ) {
        val data = JSObject()
        data.put("progress", progress.toDouble().coerceIn(0.0, 100.0))
        data.put("etaSeconds", etaSeconds.coerceAtLeast(0))
        data.put("message", message.takeLast(240))
        val event = JSObject()
        event.put("event", "progress")
        event.put("data", data)
        args.onEvent.send(event)
    }

    private fun sendConverting(args: DownloadArgs) {
        val data = JSObject()
        data.put("message", "Finalizando e convertendo o arquivo…")
        val event = JSObject()
        event.put("event", "converting")
        event.put("data", data)
        args.onEvent.send(event)
    }

    private fun sendFinished(args: DownloadArgs, filePath: String) {
        val data = JSObject()
        data.put("filePath", filePath)
        val event = JSObject()
        event.put("event", "finished")
        event.put("data", data)
        args.onEvent.send(event)
    }

    @Command
    fun analyze(invoke: Invoke) {
        val args = invoke.parseArgs(AnalyzeArgs::class.java)
        worker.execute {
            try {
                ensureInitialized()
                val url = validateUrl(args.url)
                val request = YoutubeDLRequest(url)
                    .addOption("--no-playlist")
                    .addOption("--no-warnings")
                val info = YoutubeDL.getInstance().getInfo(request)
                invoke.resolveObject(
                    MediaAnalysis(
                        id = info.id ?: url,
                        title = info.title ?: info.fulltitle ?: "Mídia sem título",
                        author = info.uploader ?: "Criador não informado",
                        thumbnailUrl = info.thumbnail,
                        durationSeconds = info.duration.toLong(),
                        webpageUrl = info.webpageUrl ?: url,
                        provider = info.extractorKey ?: info.extractor ?: "web",
                        formats = analysisFormats(info),
                    )
                )
            } catch (error: Exception) {
                invoke.reject(error.message ?: "Não foi possível analisar esse link")
            }
        }
    }

    @Command
    fun download(invoke: Invoke) {
        val args = invoke.parseArgs(DownloadArgs::class.java)
        worker.execute {
            try {
                ensureInitialized()
                val url = validateUrl(args.url)
                val match = Regex("^(audio|video)-(\\d+)$").matchEntire(args.optionId)
                    ?: throw IllegalArgumentException("Escolha de formato inválida")
                val kind = match.groupValues[1]
                val quality = match.groupValues[2].toInt()
                if (kind == "audio" && quality !in listOf(128, 192, 256, 320)) {
                    throw IllegalArgumentException("Qualidade de áudio inválida")
                }
                if (kind == "video" && quality !in listOf(144, 240, 360, 480, 720, 1080, 1440, 2160)) {
                    throw IllegalArgumentException("Qualidade de vídeo inválida")
                }

                val destination = File(args.destinationStem).absoluteFile
                destination.parentFile?.mkdirs()
                sendPreparing(args, "Preparando o download…")

                val request = YoutubeDLRequest(url)
                    .addOption("--no-playlist")
                    .addOption("--newline")
                    .addOption("--no-mtime")
                    .addOption("--no-warnings")
                    .addOption("--embed-metadata")
                    .addOption("-o", "${destination.absolutePath}.%(ext)s")

                val extension: String
                if (kind == "audio") {
                    extension = "mp3"
                    request
                        .addOption("-f", "bestaudio/best")
                        .addOption("--extract-audio")
                        .addOption("--audio-format", "mp3")
                        .addOption("--audio-quality", "${quality}K")
                } else {
                    extension = "mp4"
                    request
                        .addOption(
                            "-f",
                            "bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best[height<=${quality}]/best[ext=mp4]/best",
                        )
                        .addOption("--merge-output-format", "mp4")
                }

                YoutubeDL.getInstance().execute(request, args.jobId) { progress, eta, line ->
                    if (line.contains("Merger") || line.contains("ExtractAudio")) {
                        sendConverting(args)
                    } else {
                        sendProgress(args, progress, eta, line)
                    }
                }

                val output = File("${destination.absolutePath}.$extension")
                if (!output.isFile || output.length() == 0L) {
                    throw IllegalStateException("O processamento terminou sem gerar o arquivo esperado")
                }
                sendFinished(args, output.absolutePath)
                invoke.resolveObject(
                    DownloadResponse(
                        filePath = output.absolutePath,
                        fileName = "${args.title}.$extension",
                        title = args.title,
                        author = args.author,
                        durationSeconds = args.durationSeconds,
                    )
                )
            } catch (error: Exception) {
                invoke.reject(error.message ?: "O download não pôde ser concluído")
            }
        }
    }

    @Command
    fun cancel(invoke: Invoke) {
        val args = invoke.parseArgs(CancelArgs::class.java)
        try {
            invoke.resolveObject(mapOf("cancelled" to YoutubeDL.getInstance().destroyProcessById(args.jobId)))
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Não foi possível cancelar o download")
        }
    }

    override fun onDestroy(activity: AppCompatActivity) {
        worker.shutdownNow()
        super.onDestroy(activity)
    }
}
