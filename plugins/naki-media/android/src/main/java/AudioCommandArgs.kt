package com.nakiplay.media

import android.os.Bundle
import app.tauri.annotation.InvokeArg

@InvokeArg
class AudioQueueArgs {
    var id: String = ""
    var path: String = ""
    var title: String = ""
    var artist: String = ""
}

@InvokeArg
class AudioCommandArgs {
    var action: String = "status"
    var queue: List<AudioQueueArgs>? = null
    var currentId: String? = null
    var positionMs: Long? = null
    var playing: Boolean? = null
    var volume: Float? = null
    var repeatOne: Boolean? = null
    var shuffle: Boolean? = null
    var autoplay: Boolean? = null

    internal fun items(): List<AudioQueueItem> = queue.orEmpty().map {
        AudioQueueItem(it.id, it.path, it.title, it.artist)
    }

    internal fun bundle(): Bundle = Bundle().apply {
        putString("action", action)
        queue?.let { list ->
            putParcelableArrayList("queue", ArrayList(list.map { item -> Bundle().apply {
                putString("id", item.id)
                putString("path", item.path)
                putString("title", item.title)
                putString("artist", item.artist)
            } }))
        }
        currentId?.let { putString("currentId", it) }
        positionMs?.let { putLong("positionMs", it) }
        playing?.let { putBoolean("playing", it) }
        volume?.let { putFloat("volume", it) }
        repeatOne?.let { putBoolean("repeatOne", it) }
        shuffle?.let { putBoolean("shuffle", it) }
        autoplay?.let { putBoolean("autoplay", it) }
    }
}
