package com.nakiplay.media

import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest

internal object ExtractorInstallPolicy {
    private fun dateVersion(value: String?): List<Int>? = value?.trim()?.let {
        Regex("^(\\d{4})\\.(\\d{2})\\.(\\d{2})(?:\\D|$|\\.)").find(it)
            ?.groupValues?.drop(1)?.map(String::toInt)
    }

    fun shouldInstall(installed: String?, bundled: String): Boolean {
        val candidate = requireNotNull(dateVersion(bundled)) { "Versão empacotada inválida" }
        val current = dateVersion(installed) ?: return installed.isNullOrBlank()
        for (index in candidate.indices) {
            if (candidate[index] != current[index]) return candidate[index] > current[index]
        }
        return false // Preserve same-day nightly builds and newer installed engines.
    }

    fun copyVerified(input: InputStream, output: OutputStream, expected: String) {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(64 * 1024)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            output.write(buffer, 0, count)
            digest.update(buffer, 0, count)
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
        check(actual == expected) { "O extrator incluído no aplicativo está corrompido" }
    }
}
