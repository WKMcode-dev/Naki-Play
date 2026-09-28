import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const root = new URL('../', import.meta.url)
const binary = name => fileURLToPath(new URL(`plugins/naki-media/binaries/${name}-x86_64-pc-windows-msvc.exe`, root))
const downloader = binary('yt-dlp')
const ffmpeg = binary('ffmpeg')
const ffprobe = binary('ffprobe')

test('combined WebM fallback produces the MP4 Android expects; audio still produces MP3', {
  skip: process.platform !== 'win32' || ![downloader, ffmpeg, ffprobe].every(existsSync),
  timeout: 60_000,
}, async () => {
  const source = await readFile(new URL('plugins/naki-media/android/src/main/java/NakiMediaPlugin.kt', root), 'utf8')
  assert.match(source, /addOption\("--recode-video", "mp4"\)/)
  const directory = await mkdtemp(join(tmpdir(), 'naki-output-test-'))
  const limits = { timeout: 20_000, windowsHide: true, maxBuffer: 256 * 1024 }
  let server
  try {
    const input = join(directory, 'fixture.webm')
    await execute(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=10', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '1', '-c:v', 'libvpx-vp9', '-c:a', 'libopus', input], limits)
    const bytes = await readFile(input)
    server = createServer((_request, response) => response.writeHead(200, {
      'Content-Type': 'video/webm', 'Content-Length': bytes.length,
    }).end(bytes))
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const url = `http://127.0.0.1:${server.address().port}/fixture.webm`
    const common = ['--ignore-config', '--no-cache-dir', '--no-playlist', '--proxy', '', '--ffmpeg-location', ffmpeg]
    // Reproduce the old failure: merge-output-format does nothing for a combined stream.
    await execute(downloader, [...common, '--merge-output-format', 'mp4', '-o', join(directory, 'old.%(ext)s'), url], limits)
    assert.equal(existsSync(join(directory, 'old.mp4')), false)
    assert.equal(existsSync(join(directory, 'old.webm')), true)
    for (const [extension, options] of [
      ['mp4', ['--merge-output-format', 'mp4', '--recode-video', 'mp4']],
      ['mp3', ['-f', 'bestaudio/best', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '192K']],
    ]) {
      await execute(downloader, [...common, ...options, '-o', join(directory, `${extension}.%(ext)s`), url], limits)
      const output = join(directory, `${extension}.${extension}`)
      assert.ok((await stat(output)).size > 0)
      const { stdout } = await execute(ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', output], limits)
      const streams = JSON.parse(stdout).streams
      assert.ok(streams.some(stream => stream.codec_type === 'audio'))
      assert.equal(streams.some(stream => stream.codec_type === 'video'), extension === 'mp4')
    }
  } finally {
    if (server) {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
    await rm(directory, { recursive: true, force: true })
  }
})
