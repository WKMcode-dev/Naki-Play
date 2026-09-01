import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'

if (process.platform !== 'win32' || process.arch !== 'x64') {
  console.error('A preparação automática atual suporta Windows x64.')
  process.exit(1)
}

const target = 'x86_64-pc-windows-msvc'
const binaryDir = resolve('plugins/naki-media/binaries')
const temporaryDir = join(binaryDir, '.downloads')
const markerFile = join(binaryDir, '.desktop-tools.json')
const versions = {
  schema: 1,
  ytDlp: '2026.08.19',
  deno: '2.9.5',
  ffmpeg: 'yt-dlp-latest-gpl',
}
const outputFiles = {
  ytDlp: join(binaryDir, `yt-dlp-${target}.exe`),
  deno: join(binaryDir, `deno-${target}.exe`),
  ffmpeg: join(binaryDir, `ffmpeg-${target}.exe`),
  ffprobe: join(binaryDir, `ffprobe-${target}.exe`),
}

async function sha256(file) {
  const hash = createHash('sha256')
  const data = await readFile(file)
  hash.update(data)
  return hash.digest('hex')
}

async function download(url, destination) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Naki-Play-build/0.1' },
    redirect: 'follow',
  })
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar ${basename(destination)}: HTTP ${response.status}`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
}

async function checksumFrom(url, fileName) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Naki-Play-build/0.1' },
    redirect: 'follow',
  })
  if (!response.ok) throw new Error(`Falha ao consultar checksum de ${fileName}: HTTP ${response.status}`)
  const content = await response.text()
  const line = content.split(/\r?\n/).find((candidate) => candidate.trim().endsWith(fileName))
  const hash = line?.trim().match(/^([a-f\d]{64})/i)?.[1]
    ?? content.trim().match(/^[a-f\d]{64}/i)?.[0]
    ?? content.match(/Hash\s*:\s*([a-f\d]{64})/i)?.[1]
  if (!hash || !/^[a-f\d]{64}$/i.test(hash)) {
    throw new Error(`Checksum oficial não encontrado para ${fileName}`)
  }
  return hash.toLowerCase()
}

async function verifiedDownload(url, checksumUrl, destination) {
  const fileName = basename(new URL(url).pathname)
  const expected = await checksumFrom(checksumUrl, fileName)
  await download(url, destination)
  const actual = await sha256(destination)
  if (actual !== expected) {
    throw new Error(`A verificação de integridade falhou para ${fileName}`)
  }
}

async function findFile(directory, fileName) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) return path
    if (entry.isDirectory()) {
      const nested = await findFile(path, fileName)
      if (nested) return nested
    }
  }
}

async function cacheIsValid() {
  if (!existsSync(markerFile) || Object.values(outputFiles).some((file) => !existsSync(file))) return false
  try {
    const marker = JSON.parse(await readFile(markerFile, 'utf8'))
    if (JSON.stringify(marker.versions) !== JSON.stringify(versions)) return false
    for (const [name, file] of Object.entries(outputFiles)) {
      if (await sha256(file) !== marker.hashes[name]) return false
    }
    return true
  } catch {
    return false
  }
}

await mkdir(binaryDir, { recursive: true })
if (await cacheIsValid()) {
  console.log('Motor desktop já está preparado e verificado.')
  process.exit(0)
}

await rm(temporaryDir, { recursive: true, force: true })
await mkdir(temporaryDir, { recursive: true })

try {
  console.log('Baixando e verificando yt-dlp…')
  const ytDlpUrl = `https://github.com/yt-dlp/yt-dlp/releases/download/${versions.ytDlp}/yt-dlp.exe`
  const ytDlpFile = join(temporaryDir, 'yt-dlp.exe')
  await verifiedDownload(
    ytDlpUrl,
    `https://github.com/yt-dlp/yt-dlp/releases/download/${versions.ytDlp}/SHA2-256SUMS`,
    ytDlpFile,
  )
  await copyFile(ytDlpFile, outputFiles.ytDlp)

  console.log('Baixando e verificando Deno…')
  const denoArchiveName = 'deno-x86_64-pc-windows-msvc.zip'
  const denoUrl = `https://github.com/denoland/deno/releases/download/v${versions.deno}/${denoArchiveName}`
  const denoArchive = join(temporaryDir, denoArchiveName)
  await verifiedDownload(denoUrl, `${denoUrl}.sha256sum`, denoArchive)
  const denoExtracted = join(temporaryDir, 'deno')
  await mkdir(denoExtracted)
  execFileSync('tar', ['-xf', denoArchive, '-C', denoExtracted], { stdio: 'ignore' })
  const denoFile = await findFile(denoExtracted, 'deno.exe')
  if (!denoFile) throw new Error('deno.exe não foi encontrado no pacote oficial')
  await copyFile(denoFile, outputFiles.deno)

  console.log('Baixando e verificando FFmpeg/FFprobe…')
  const ffmpegArchiveName = 'ffmpeg-master-latest-win64-gpl.zip'
  const ffmpegBase = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest'
  const ffmpegArchive = join(temporaryDir, ffmpegArchiveName)
  await verifiedDownload(
    `${ffmpegBase}/${ffmpegArchiveName}`,
    `${ffmpegBase}/checksums.sha256`,
    ffmpegArchive,
  )
  const ffmpegExtracted = join(temporaryDir, 'ffmpeg')
  await mkdir(ffmpegExtracted)
  execFileSync('tar', ['-xf', ffmpegArchive, '-C', ffmpegExtracted], { stdio: 'ignore' })
  const ffmpegFile = await findFile(ffmpegExtracted, 'ffmpeg.exe')
  const ffprobeFile = await findFile(ffmpegExtracted, 'ffprobe.exe')
  if (!ffmpegFile || !ffprobeFile) throw new Error('FFmpeg/FFprobe não foram encontrados no pacote oficial')
  await copyFile(ffmpegFile, outputFiles.ffmpeg)
  await copyFile(ffprobeFile, outputFiles.ffprobe)

  const hashes = {}
  for (const [name, file] of Object.entries(outputFiles)) hashes[name] = await sha256(file)
  await writeFile(markerFile, `${JSON.stringify({ versions, hashes }, null, 2)}\n`)
  console.log('Motor desktop preparado e verificado com sucesso.')
} finally {
  await rm(temporaryDir, { recursive: true, force: true })
}
