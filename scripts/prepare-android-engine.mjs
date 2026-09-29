import { createHash } from 'node:crypto'
import { readFile, writeFile, rename, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const resource = new URL('../plugins/naki-media/android/src/main/res/raw/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('naki_engine.json', resource), 'utf8'))
const target = new URL('naki_ytdlp', resource)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

export async function prepareAndroidEngine() {
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(manifest.version) || !/^[a-f0-9]{64}$/.test(manifest.sha256)) {
    throw new Error('Manifesto do extrator Android inválido')
  }
  const existing = await readFile(target).catch(() => null)
  if (existing && hash(existing) === manifest.sha256) {
    console.log(`Extrator Android ${manifest.version} incluído e verificado.`)
    return
  }
  const response = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${manifest.version}/yt-dlp`, {
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`Falha ao preparar extrator Android: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (hash(bytes) !== manifest.sha256) throw new Error('Checksum do extrator Android não confere')
  const temporary = new URL('naki_ytdlp.tmp', resource)
  try {
    await writeFile(temporary, bytes)
    await rename(temporary, target)
  } finally {
    await rm(temporary, { force: true })
  }
  console.log(`Extrator Android ${manifest.version} preparado.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareAndroidEngine()
