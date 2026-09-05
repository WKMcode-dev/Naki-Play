import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const buildFile = resolve('backend/gen/android/app/build.gradle.kts')
const manifestFile = resolve('backend/gen/android/app/src/main/AndroidManifest.xml')
const activityFile = resolve('backend/gen/android/app/src/main/java/com/nakiplay/player/MainActivity.kt')

if (![buildFile, manifestFile, activityFile].every(existsSync)) {
  console.error('Projeto Android ainda não foi criado. Execute pnpm android:init primeiro.')
  process.exit(1)
}

const buildSource = readFileSync(buildFile, 'utf8')
if (!buildSource.includes('jniLibs.useLegacyPackaging = true')) {
  const marker = /android \{\r?\n/
  if (!marker.test(buildSource)) {
    console.error('Não foi possível localizar o bloco android no projeto gerado.')
    process.exit(1)
  }

  const prepared = buildSource.replace(
    marker,
    (match) => `${match}    packaging {\n        jniLibs.useLegacyPackaging = true\n    }\n`,
  )
  writeFileSync(buildFile, prepared)
}

const activitySource = `package com.nakiplay.player

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { _, insets ->
      val safeInsetTypes =
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      val safeInsets = insets.getInsets(safeInsetTypes)
      content.setPadding(safeInsets.left, safeInsets.top, safeInsets.right, safeInsets.bottom)
      WindowInsetsCompat.Builder(insets)
        .setInsets(safeInsetTypes, Insets.NONE)
        .build()
    }
    ViewCompat.requestApplyInsets(content)
  }
}
`
if (readFileSync(activityFile, 'utf8').replaceAll('\r\n', '\n') !== activitySource) {
  writeFileSync(activityFile, activitySource)
}

const manifestSource = readFileSync(manifestFile, 'utf8')
let preparedManifest = manifestSource
if (/android:windowSoftInputMode="[^"]*"/.test(preparedManifest)) {
  preparedManifest = preparedManifest.replace(
    /android:windowSoftInputMode="[^"]*"/,
    'android:windowSoftInputMode="adjustResize"',
  )
} else {
  preparedManifest = preparedManifest.replace(
    /(\s*<activity\r?\n)/,
    (match) => `${match}            android:windowSoftInputMode="adjustResize"\n`,
  )
}
if (!preparedManifest.includes('android:windowSoftInputMode="adjustResize"')) {
  console.error('Não foi possível preparar o redimensionamento da Activity Android.')
  process.exit(1)
}
if (preparedManifest !== manifestSource) writeFileSync(manifestFile, preparedManifest)

console.log('Android preparado para mídia nativa e áreas seguras do sistema.')
