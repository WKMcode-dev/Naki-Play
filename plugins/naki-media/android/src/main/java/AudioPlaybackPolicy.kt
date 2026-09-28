package com.nakiplay.media

import java.io.File

internal data class AudioQueueItem(
    val id: String,
    val path: String,
    val title: String = "",
    val artist: String = "",
) {
    val key: Pair<String, String> get() = id to path
}

/** Pure policy, shared by the native bridge and service. Never accepts network/content URIs. */
internal object AudioPlaybackPolicy {
    const val MAX_QUEUE_ITEMS = 2000

    fun privateFile(root: File, path: String): File {
        require(path.isNotBlank() && File(path).isAbsolute) {
            "NAKI_AUDIO_INVALID_PATH: selecione um arquivo da biblioteca."
        }
        val file = File(path).canonicalFile
        require(file.parentFile == root.canonicalFile) {
            "NAKI_AUDIO_INVALID_PATH: o arquivo não pertence à biblioteca privada."
        }
        require(file.isFile && file.canRead() && file.length() > 0) {
            "NAKI_AUDIO_FILE_UNAVAILABLE: o arquivo está vazio, ausente ou não pode ser lido. Importe-o novamente."
        }
        return file
    }

    fun validate(root: File, queue: List<AudioQueueItem>): List<AudioQueueItem> {
        require(queue.size <= MAX_QUEUE_ITEMS) { "NAKI_AUDIO_QUEUE_LIMIT: a fila excede 2000 músicas." }
        require(queue.all { it.id.isNotBlank() && it.id.length <= 200 }) {
            "NAKI_AUDIO_INVALID_ID: a fila contém uma identificação inválida."
        }
        require(queue.map { it.id }.distinct().size == queue.size) {
            "NAKI_AUDIO_DUPLICATE_ID: a fila contém músicas duplicadas."
        }
        // Validate every item before making ANY changes to the running player.
        return queue.map { item ->
            item.copy(path = privateFile(root, item.path).path, title = item.title.take(500), artist = item.artist.take(500))
        }
    }

    fun selectedIndex(queue: List<AudioQueueItem>, requestedId: String?, current: AudioQueueItem?): Int {
        if (queue.isEmpty()) {
            require(requestedId.isNullOrBlank()) { "NAKI_AUDIO_INVALID_ID: a música não está na fila." }
            return -1
        }
        if (requestedId != null) {
            val index = queue.indexOfFirst { it.id == requestedId }
            require(index >= 0) { "NAKI_AUDIO_INVALID_ID: a música não está na fila." }
            return index
        }
        return queue.indexOfFirst { it.key == current?.key }.takeIf { it >= 0 } ?: 0
    }

    fun pauseAtEnd(autoplay: Boolean, repeatOne: Boolean): Boolean = !autoplay && !repeatOne
}
