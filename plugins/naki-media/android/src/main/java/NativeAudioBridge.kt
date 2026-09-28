package com.nakiplay.media

import android.app.Activity
import android.content.ComponentName
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionResult
import androidx.media3.session.SessionToken
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import com.google.common.util.concurrent.ListenableFuture
import java.io.File
import java.util.concurrent.Executors

/** The Activity owns only this controller; the Service owns playback and the audio queue. */
@UnstableApi
class NativeAudioBridge(private val activity: Activity) {
    private val handler = Handler(Looper.getMainLooper())
    private val context = activity.applicationContext
    private val inspectionWorker = Executors.newSingleThreadExecutor()
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var destroyed = false

    fun execute(invoke: Invoke) {
        val args = try { invoke.parseArgs(AudioCommandArgs::class.java) }
        catch (error: Exception) { invoke.reject("NAKI_AUDIO_INVALID_COMMAND: comando de áudio inválido."); return }
        if (args.action == "inspect") {
            inspectionWorker.execute {
                try { invoke.resolveObject(mapOf("items" to inspect(args))) }
                catch (error: Exception) { invoke.reject(error.message ?: "NAKI_AUDIO_INSPECTION_FAILED") }
            }
            return
        }
        handler.post {
            if (destroyed) { invoke.reject("NAKI_AUDIO_CONTROLLER_CLOSED: reabra o aplicativo."); return@post }
            try {
                var future = controllerFuture
                if (future == null || future.isCancelled) {
                    future = MediaController.Builder(context, SessionToken(context, ComponentName(context, NakiAudioService::class.java)))
                        .buildAsync()
                    controllerFuture = future
                }
                val connection = future
                connection.addListener({
                    if (destroyed) { invoke.reject("NAKI_AUDIO_CONTROLLER_CLOSED"); return@addListener }
                    try {
                        val controller = connection.get()
                        if (!controller.isConnected) {
                            controllerFuture = null
                            MediaController.releaseFuture(connection)
                            invoke.reject("NAKI_AUDIO_DISCONNECTED: toque em reproduzir para reconectar.")
                            return@addListener
                        }
                        val result = controller.sendCustomCommand(NakiAudioService.COMMAND, args.bundle())
                        result.addListener({
                            try {
                                val response = result.get()
                                val json = response.extras.getString("snapshot")
                                if (response.resultCode == SessionResult.RESULT_SUCCESS && json != null) invoke.resolve(JSObject(json))
                                else invoke.reject(response.extras.getString("error") ?: "NAKI_AUDIO_COMMAND_FAILED: não foi possível controlar o áudio.")
                            } catch (error: Exception) { invoke.reject("NAKI_AUDIO_COMMAND_FAILED: tente reproduzir novamente.") }
                        }, ContextCompat.getMainExecutor(context))
                    } catch (error: Exception) {
                        controllerFuture = null
                        MediaController.releaseFuture(connection)
                        invoke.reject("NAKI_AUDIO_CONNECTION_FAILED: não foi possível iniciar o player nativo. Reabra o aplicativo.")
                    }
                }, ContextCompat.getMainExecutor(context))
            } catch (error: Exception) {
                invoke.reject("NAKI_AUDIO_CONNECTION_FAILED: não foi possível iniciar o player nativo.")
            }
        }
    }

    private fun inspect(args: AudioCommandArgs): List<Map<String, Any>> {
        require(args.queue.orEmpty().size <= AudioPlaybackPolicy.MAX_QUEUE_ITEMS) { "NAKI_AUDIO_QUEUE_LIMIT" }
        val root = File(context.dataDir, "media")
        return args.items().map { item ->
            try {
                val file = AudioPlaybackPolicy.privateFile(root, item.path)
                val extractor = MediaExtractor()
                try {
                    extractor.setDataSource(file.path)
                    var durationMs = 0L
                    var hasVideo = false
                    var hasAudio = false
                    for (index in 0 until extractor.trackCount) {
                        val format = extractor.getTrackFormat(index)
                        val mime = format.getString(MediaFormat.KEY_MIME).orEmpty()
                        hasVideo = hasVideo || mime.startsWith("video/")
                        hasAudio = hasAudio || mime.startsWith("audio/")
                        if (format.containsKey(MediaFormat.KEY_DURATION)) durationMs = maxOf(durationMs, format.getLong(MediaFormat.KEY_DURATION) / 1000)
                    }
                    require(hasAudio || hasVideo) { "NAKI_AUDIO_NO_TRACKS: o arquivo não contém faixas de mídia legíveis." }
                    mapOf("id" to item.id, "hasVideo" to hasVideo, "durationMs" to durationMs)
                } finally { extractor.release() }
            } catch (error: Exception) {
                // Do not guess an unsupported container is audio: the caller must surface this error.
                mapOf("id" to item.id, "hasVideo" to false, "durationMs" to 0L,
                    "error" to (error.message?.takeIf { it.startsWith("NAKI_") } ?: "NAKI_AUDIO_INSPECTION_FAILED: o Android não conseguiu identificar as faixas deste arquivo. Importe-o novamente."))
            }
        }
    }

    fun destroy() {
        handler.post {
            destroyed = true
            controllerFuture?.let { MediaController.releaseFuture(it) }
            controllerFuture = null
            // Never stop/release the Service player when the Activity goes to the background.
            inspectionWorker.shutdown()
        }
    }
}
