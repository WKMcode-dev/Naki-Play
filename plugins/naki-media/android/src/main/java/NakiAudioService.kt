package com.nakiplay.media

import android.app.PendingIntent
import android.net.Uri
import android.os.Bundle
import android.os.Process
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionError
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject
import org.json.JSONArray
import java.io.File

/** Local audio playback independent of WebView rendering, JavaScript timers and Activity lifecycle. */
@UnstableApi
class NakiAudioService : MediaSessionService() {
    companion object {
        val COMMAND = SessionCommand("com.nakiplay.media.AUDIO_COMMAND", Bundle.EMPTY)
    }

    private var session: MediaSession? = null
    private lateinit var player: ExoPlayer
    private var autoplay = true
    private var pausedAtBoundary = false

    override fun onCreate() {
        super.onCreate()
        player = ExoPlayer.Builder(this)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build()
        player.addListener(object : Player.Listener {
            override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
                pausedAtBoundary = !playWhenReady && reason == Player.PLAY_WHEN_READY_CHANGE_REASON_END_OF_MEDIA_ITEM
            }
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                pausedAtBoundary = false
            }
        })
        val builder = MediaSession.Builder(this, player).setCallback(Callback())
        packageManager.getLaunchIntentForPackage(packageName)?.let { intent ->
            builder.setSessionActivity(PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
        session = builder.build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
        if (controllerInfo.uid == Process.myUid() || controllerInfo.isTrusted) session else null

    override fun onDestroy() {
        session?.release()
        session = null
        player.release()
        super.onDestroy()
    }

    // MediaSessionService's default onTaskRemoved keeps ongoing playback alive. Do not tie it to
    // Activity.onPause/onStop, and do not start a second player when the Activity is recreated.
    private inner class Callback : MediaSession.Callback {
        override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): MediaSession.ConnectionResult {
            val ownApp = controller.uid == Process.myUid()
            if (!ownApp && !controller.isTrusted) return MediaSession.ConnectionResult.reject()
            val sessionCommands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
            if (ownApp) sessionCommands.add(COMMAND)
            val playerCommands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
                .remove(Player.COMMAND_SET_MEDIA_ITEM)
                .remove(Player.COMMAND_CHANGE_MEDIA_ITEMS)
                .build()
            // System/headset controls can play, pause and seek, but cannot open arbitrary files or
            // network URIs. Only our same-UID custom command can replace the validated queue.
            return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                .setAvailableSessionCommands(sessionCommands.build())
                .setAvailablePlayerCommands(playerCommands)
                .build()
        }

        override fun onCustomCommand(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            customCommand: SessionCommand,
            args: Bundle,
        ): ListenableFuture<SessionResult> {
            if (controller.uid != Process.myUid() || customCommand.customAction != COMMAND.customAction) {
                return Futures.immediateFuture(SessionResult(SessionError.ERROR_PERMISSION_DENIED))
            }
            val result = try {
                execute(args)
                SessionResult(SessionResult.RESULT_SUCCESS, Bundle().apply { putString("snapshot", snapshot().toString()) })
            } catch (error: Exception) {
                val message = error.message?.takeIf { it.startsWith("NAKI_AUDIO_") }
                    ?: "NAKI_AUDIO_COMMAND_FAILED: o player nativo não conseguiu executar a ação. Tente novamente."
                SessionResult(SessionError.ERROR_BAD_VALUE, Bundle().apply { putString("error", message) })
            }
            return Futures.immediateFuture(result)
        }
    }

    private fun execute(args: Bundle) {
        when (args.getString("action", "status")) {
            "load" -> load(args)
            "play" -> {
                require(player.mediaItemCount > 0) { "NAKI_AUDIO_EMPTY_QUEUE: selecione uma música." }
                if (player.playbackState == Player.STATE_ENDED || pausedAtBoundary) player.seekToDefaultPosition()
                pausedAtBoundary = false
                if (player.playbackState == Player.STATE_IDLE) player.prepare()
                player.play()
            }
            "pause" -> { pausedAtBoundary = false; player.pause() }
            "seek" -> {
                require(args.containsKey("positionMs")) { "NAKI_AUDIO_INVALID_POSITION: posição ausente." }
                pausedAtBoundary = false
                player.seekTo(args.getLong("positionMs").coerceAtLeast(0))
            }
            "next" -> {
                pausedAtBoundary = false
                if (player.hasNextMediaItem()) player.seekToNextMediaItem()
                else if (player.mediaItemCount > 0) player.seekToDefaultPosition(0)
                if (player.mediaItemCount > 0) { if (player.playbackState == Player.STATE_IDLE) player.prepare(); player.play() }
            }
            "previous" -> {
                pausedAtBoundary = false
                if (player.hasPreviousMediaItem()) player.seekToPreviousMediaItem()
                else if (player.mediaItemCount > 0) player.seekToDefaultPosition(player.mediaItemCount - 1)
                if (player.mediaItemCount > 0) { if (player.playbackState == Player.STATE_IDLE) player.prepare(); player.play() }
            }
            "options" -> applyOptions(args)
            "clear" -> { pausedAtBoundary = false; player.stop(); player.clearMediaItems() }
            "status" -> Unit
            else -> throw IllegalArgumentException("NAKI_AUDIO_INVALID_COMMAND: ação desconhecida.")
        }
    }

    private fun currentItem(): AudioQueueItem? = player.currentMediaItem?.let { item ->
        AudioQueueItem(item.mediaId, item.localConfiguration?.uri?.path.orEmpty())
    }

    @Suppress("DEPRECATION")
    private fun load(args: Bundle) {
        require(args.containsKey("queue")) { "NAKI_AUDIO_EMPTY_QUEUE: a fila não foi informada." }
        val raw = args.getParcelableArrayList<Bundle>("queue").orEmpty().map { item ->
            AudioQueueItem(item.getString("id").orEmpty(), item.getString("path").orEmpty(), item.getString("title").orEmpty(), item.getString("artist").orEmpty())
        }
        val queue = AudioPlaybackPolicy.validate(File(dataDir, "media"), raw)
        val oldCurrent = currentItem()
        val targetIndex = AudioPlaybackPolicy.selectedIndex(queue, args.getString("currentId"), oldCurrent)
        validateOptions(args)
        if (queue.isEmpty()) {
            player.stop()
            player.clearMediaItems()
            applyOptions(args)
            return
        }
        val target = queue[targetIndex]
        val preserveCurrent = oldCurrent?.key == target.key
        val oldPosition = player.currentPosition
        val previouslyPlaying = player.playWhenReady
        // Move existing items rather than setMediaItems(...): replacing the entire list rebuilds
        // the current source and can interrupt a playing track on every catalog/UI update.
        queue.forEachIndexed { index, item ->
            val matchingIndex = (index until player.mediaItemCount).firstOrNull { existing ->
                val media = player.getMediaItemAt(existing)
                media.mediaId == item.id && media.localConfiguration?.uri?.path == item.path
            }
            if (matchingIndex == null) player.addMediaItem(index, mediaItem(item))
            else {
                if (matchingIndex != index) player.moveMediaItem(matchingIndex, index)
                val existing = player.getMediaItemAt(index)
                val updated = mediaItem(item)
                // Media3's replaceMediaItem preserves playback when only metadata changes.
                if (existing.mediaMetadata != updated.mediaMetadata) player.replaceMediaItem(index, updated)
            }
        }
        if (player.mediaItemCount > queue.size) player.removeMediaItems(queue.size, player.mediaItemCount)
        if (!preserveCurrent || currentItem()?.key != target.key) {
            pausedAtBoundary = false
            player.seekTo(targetIndex, if (preserveCurrent) oldPosition else args.getLong("positionMs", 0).coerceAtLeast(0))
        }
        applyOptions(args)
        if (args.getBoolean("playing", false) && (player.playbackState == Player.STATE_ENDED || pausedAtBoundary)) {
            player.seekToDefaultPosition()
            pausedAtBoundary = false
        }
        // An error snapshot causes the UI to echo playing=false. Do not silently retry that
        // broken file just because a catalog/options update arrived after the error.
        if (player.playbackState == Player.STATE_IDLE && (player.playerError == null || args.getBoolean("playing", false))) player.prepare()
        player.playWhenReady = if (args.containsKey("playing")) args.getBoolean("playing") else previouslyPlaying
    }

    private fun mediaItem(item: AudioQueueItem): MediaItem = MediaItem.Builder()
        .setMediaId(item.id)
        .setUri(Uri.fromFile(File(item.path)))
        .setMediaMetadata(MediaMetadata.Builder().setTitle(item.title.ifBlank { "Música importada" }).setArtist(item.artist).build())
        .build()

    private fun validateOptions(args: Bundle) {
        if (args.containsKey("volume")) require(args.getFloat("volume").isFinite()) { "NAKI_AUDIO_INVALID_VOLUME: volume inválido." }
    }

    private fun applyOptions(args: Bundle) {
        validateOptions(args)
        if (args.containsKey("volume")) player.volume = args.getFloat("volume").coerceIn(0f, 1f)
        if (args.containsKey("repeatOne")) player.repeatMode = if (args.getBoolean("repeatOne")) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
        if (args.containsKey("shuffle")) player.shuffleModeEnabled = args.getBoolean("shuffle")
        if (args.containsKey("autoplay")) autoplay = args.getBoolean("autoplay")
        player.pauseAtEndOfMediaItems = AudioPlaybackPolicy.pauseAtEnd(autoplay, player.repeatMode == Player.REPEAT_MODE_ONE)
    }

    private fun snapshot(): JSONObject = JSONObject().apply {
        player.currentMediaItem?.mediaId?.let { put("trackId", it) }
        put("queueIds", JSONArray((0 until player.mediaItemCount).map { player.getMediaItemAt(it).mediaId }))
        put("positionMs", player.currentPosition.coerceAtLeast(0))
        put("durationMs", player.duration.takeIf { it != C.TIME_UNSET && it >= 0 } ?: 0L)
        put("playing", player.isPlaying)
        put("playWhenReady", player.playWhenReady)
        put("repeatOne", player.repeatMode == Player.REPEAT_MODE_ONE)
        put("shuffle", player.shuffleModeEnabled)
        val error = player.playerError
        put("state", when {
            error != null -> "error"
            pausedAtBoundary -> "ended"
            player.playbackState == Player.STATE_BUFFERING -> "buffering"
            player.playbackState == Player.STATE_READY -> "ready"
            player.playbackState == Player.STATE_ENDED -> "ended"
            else -> "idle"
        })
        if (error != null) put("error", playbackError(error))
    }

    private fun playbackError(error: PlaybackException): String {
        val detail = when {
            error.errorCodeName.contains("IO_FILE_NOT_FOUND") -> "O arquivo não está mais disponível. Importe-o novamente."
            error.errorCodeName.contains("IO_NO_PERMISSION") -> "O Android não permitiu ler a cópia da biblioteca. Importe o arquivo novamente."
            error.errorCodeName.contains("PARSING") -> "O conteúdo está incompleto ou o contêiner não pôde ser lido. Importe novamente o arquivo original."
            error.errorCodeName.contains("DECOD") -> "O decodificador de áudio deste Android recusou a faixa. Importe o original para criar uma cópia compatível."
            error.errorCodeName.contains("AUDIO_TRACK") -> "A saída de áudio do Android falhou. Reconecte o fone ou tente reproduzir novamente."
            else -> "A reprodução nativa foi interrompida. Tente novamente e compartilhe este código se persistir."
        }
        return "NAKI_AUDIO_${error.errorCodeName} (${error.errorCode}): $detail"
    }
}
