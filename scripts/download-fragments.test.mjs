import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const root = new URL('../', import.meta.url)
const strictOption = '--abort-on-unavailable-fragments'
const downloader = fileURLToPath(new URL('plugins/naki-media/binaries/yt-dlp-x86_64-pc-windows-msvc.exe', root))

// These source contracts connect the black-box test below to both app requests.
for (const [platform, path, start, end] of [
  ['Android', 'plugins/naki-media/android/src/main/java/NakiMediaPlugin.kt', 'fun download(invoke:', 'fun cancel(invoke:'],
  ['Windows', 'plugins/naki-media/src/desktop.rs', 'pub fn download(', 'pub fn cancel('],
]) {
  test(`${platform} rejects a missing fragment instead of accepting incomplete media`, async () => {
    const source = await readFile(new URL(path, root), 'utf8')
    const startIndex = source.indexOf(start)
    const endIndex = source.indexOf(end, startIndex)
    assert.ok(startIndex >= 0 && endIndex > startIndex, 'download request boundaries found')
    const request = source.slice(startIndex, endIndex)
    assert.ok(request.includes(`"${strictOption}"`))
    assert.doesNotMatch(request, /"--(?:skip-unavailable-fragments|no-abort-on-unavailable-fragments)"/)
  })
}

test('local HLS: a missing fragment succeeds by default but fails with the app policy', {
  skip: process.platform !== 'win32' || !existsSync(downloader),
  timeout: 45_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'naki-fragment-test-'))
  // Deliberately opaque segment bytes: this checks transfer completeness, not decoding.
  // No real media or external service is accessed, and postprocessing is disabled.
  const firstFragment = Buffer.from('synthetic-first-fragment')
  const manifest = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:5\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:5,\nfirst.ts\n#EXTINF:5,\nmissing.ts\n#EXT-X-ENDLIST\n'
  const server = createServer((request, response) => {
    if (request.url === '/fixture.m3u8') {
      response.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' }).end(manifest)
    } else if (request.url === '/first.ts') {
      response.writeHead(200, { 'Content-Type': 'video/mp2t' }).end(firstFragment)
    } else {
      response.writeHead(404).end('Missing synthetic fragment')
    }
  })
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const url = `http://127.0.0.1:${server.address().port}/fixture.m3u8`
    const options = [
      '--ignore-config', '--no-cache-dir', '--no-progress', '--no-warnings',
      '--socket-timeout', '3', '--retries', '0', '--fragment-retries', '0',
      '--concurrent-fragments', '1', '--hls-prefer-native', '--fixup', 'never',
      '--no-part', '--proxy', '',
    ]
    const defaultPath = join(directory, 'default.ts')
    const strictPath = join(directory, 'strict.ts')
    const limits = { timeout: 15_000, windowsHide: true, maxBuffer: 128 * 1024 }
    await execute(downloader, [...options, '-o', defaultPath, '--', url], limits)
    assert.deepEqual(await readFile(defaultPath), firstFragment, 'default policy silently accepts only the available part')
    await assert.rejects(
      execute(downloader, [...options, strictOption, '-o', strictPath, '--', url], limits),
      (error) => {
        assert.equal(error.code, 1, 'download must fail rather than time out or crash')
        assert.match(error.stderr, /fragment|404/i)
        return true
      },
    )
    // Naki's existing Rust error path removes partial job files; this test checks the engine signal.
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})
