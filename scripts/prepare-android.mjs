import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const buildFile = resolve('backend/gen/android/app/build.gradle.kts')

if (!existsSync(buildFile)) {
  console.error('Projeto Android ainda não foi criado. Execute pnpm android:init primeiro.')
  process.exit(1)
}

const current = readFileSync(buildFile, 'utf8')
if (current.includes('jniLibs.useLegacyPackaging = true')) {
  console.log('Empacotamento Android já preparado para o motor de mídia.')
  process.exit(0)
}

const marker = /android \{\r?\n/
if (!marker.test(current)) {
  console.error('Não foi possível localizar o bloco android no projeto gerado.')
  process.exit(1)
}

const prepared = current.replace(
  marker,
  (match) => `${match}    packaging {\n        jniLibs.useLegacyPackaging = true\n    }\n`,
)
writeFileSync(buildFile, prepared)
console.log('Empacotamento Android preparado para Python e FFmpeg nativos.')
