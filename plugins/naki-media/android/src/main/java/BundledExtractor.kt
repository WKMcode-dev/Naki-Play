package com.nakiplay.media

import android.content.Context
import android.util.AtomicFile
import com.yausername.youtubedl_android.YoutubeDL
import org.json.JSONObject
import java.io.File

internal object BundledExtractor {
    // Called by the single engine worker, after initialization and before network requests.
    fun installIfOlder(context: Context, installed: String?): String? {
        val manifest = context.resources.openRawResource(R.raw.naki_engine).bufferedReader().use {
            JSONObject(it.readText())
        }
        val version = manifest.getString("version")
        if (!ExtractorInstallPolicy.shouldInstall(installed, version)) return null
        val target = File(context.noBackupFilesDir,
            "${YoutubeDL.baseName}/${YoutubeDL.ytdlpDirName}/${YoutubeDL.ytdlpBin}")
        val atomic = AtomicFile(target)
        val output = atomic.startWrite()
        try {
            context.resources.openRawResource(R.raw.naki_ytdlp).use { input ->
                ExtractorInstallPolicy.copyVerified(input, output, manifest.getString("sha256"))
            }
            atomic.finishWrite(output)
        } catch (error: Exception) {
            atomic.failWrite(output)
            throw error
        }
        return version
    }
}
