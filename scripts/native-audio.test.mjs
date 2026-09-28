// Real React hooks, mocked Android IPC. This does NOT test an Android decoder.
// Setup: npm install --prefix .tools/hook-tests --no-save --package-lock=false --ignore-scripts react-test-renderer@19.2.8
// Run: node --experimental-vm-modules --test scripts/native-audio.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const React = require('../.tools/hook-tests/node_modules/react')
const { create, act } = require('../.tools/hook-tests/node_modules/react-test-renderer')
const ts = require('../frontend/node_modules/typescript')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const audio = id => ({ id, hasVideo: false, durationMs: 223000 })
const idle = () => ({ queueIds: [], positionMs: 0, durationMs: 0, playing: false, playWhenReady: false, state: 'idle', repeatOne: false, shuffle: false })

async function harness({ enabled = true, currentId = 'a', playing = true, descriptions = { a: audio('a'), b: audio('b') }, initialStatus } = {}) {
  const calls = []
  const timers = new Set()
  const listeners = new Set()
  const document = { hidden: false, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) }
  const engine = { status: initialStatus || idle(), intercept: undefined }
  const invoke = async (_name, { request }) => {
    calls.push(structuredClone(request))
    if (engine.intercept) await engine.intercept(request)
    if (request.action === 'inspect') return { items: request.trackIds.map(id => descriptions[id]) }
    const s = engine.status
    switch (request.action) {
      case 'load': {
        s.queueIds = [...request.trackIds]
        const target = request.currentId ?? (s.queueIds.includes(s.trackId) ? s.trackId : s.queueIds[0])
        if (target !== s.trackId) { s.trackId = target; s.positionMs = 0 }
        s.durationMs = 223000
        if (request.playing !== undefined) s.playWhenReady = request.playing
        s.repeatOne = request.repeatOne ?? s.repeatOne
        s.shuffle = request.shuffle ?? s.shuffle
        if (s.state !== 'error' && s.state !== 'ended') s.state = 'ready'
        break
      }
      case 'clear': engine.status = idle(); break
      case 'seek': s.positionMs = request.positionMs; break
      case 'next': s.trackId = s.queueIds[(s.queueIds.indexOf(s.trackId) + 1) % s.queueIds.length]; s.positionMs = 0; s.playWhenReady = true; break
      case 'previous': s.trackId = s.queueIds[(s.queueIds.indexOf(s.trackId) + s.queueIds.length - 1) % s.queueIds.length]; s.positionMs = 0; s.playWhenReady = true; break
    }
    engine.status.playing = engine.status.playWhenReady && engine.status.state === 'ready'
    return structuredClone(engine.status)
  }
  const context = vm.createContext({ console, document, window: { setInterval: fn => { timers.add(fn); return fn }, clearInterval: fn => timers.delete(fn) } })
  const modules = new Map()
  function synthetic(name, exports) {
    const mod = new vm.SyntheticModule(Object.keys(exports), function () {
      Object.entries(exports).forEach(([key, value]) => this.setExport(key, value))
    }, { context })
    modules.set(name, mod)
  }
  synthetic('react', React)
  synthetic('../services/nativeLibrary', { runningOnAndroid: () => enabled })
  synthetic('@tauri-apps/api/core', { invoke })
  function source(name, path) {
    const output = ts.transpileModule(readFileSync(resolve(path), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    const mod = new vm.SourceTextModule(output, { context, identifier: name })
    modules.set(name, mod)
    return mod
  }
  source('../services/nativeAudio', 'frontend/src/services/nativeAudio.ts')
  const mod = source('hook', 'frontend/src/hooks/useAndroidAudio.ts')
  await mod.link(name => {
    assert.ok(modules.has(name), `unmocked import ${name}`)
    return modules.get(name)
  })
  await mod.evaluate()
  let value, options, update, renderer
  function Harness() {
    const [state, setState] = React.useState({
      tracks: Object.keys(descriptions).map(id => ({ id, fileName: `${id}.webm`, filePath: `/private/media/${id}.webm`, title: id, artist: '' })),
      queueIds: Object.keys(descriptions), currentId, playing, libraryReady: true,
      settings: { volume: 0.82, repeatMode: 'off', shuffleEnabled: false, autoplay: true },
    })
    options = state
    update = changes => setState(prev => ({ ...prev, ...(typeof changes === 'function' ? changes(prev) : changes) }))
    value = mod.namespace.useAndroidAudio({ ...state,
      onTrack: id => setState(prev => prev.currentId === id ? prev : { ...prev, currentId: id }),
      onPlaying: flag => setState(prev => prev.playing === flag ? prev : { ...prev, playing: flag }),
      onQueue: ids => setState(prev => ({ ...prev, queueIds: ids })),
    })
    return null
  }
  const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(resolve => setImmediate(resolve)) }) }
  await act(async () => { renderer = create(React.createElement(Harness)) })
  await flush()
  return { calls, engine, document,
    get value() { return value }, get options() { return options },
    change: async changes => { await act(async () => update(changes)); await flush() },
    perform: async fn => { await act(async () => fn(value)); await flush() },
    poll: async () => { await act(async () => timers.forEach(fn => fn())); await flush() },
    flush, dispose: async () => { await act(async () => renderer.unmount()) },
    segment: modules.get('../services/nativeAudio').namespace.audioSegment,
  }
}

test('desktop/browser never starts the Android service', async () => {
  const h = await harness({ enabled: false })
  assert.equal(h.calls.length, 0)
  assert.equal(h.value.active, false)
  await h.dispose()
})

test('audio-only WebM uses native playback; options and metadata preserve position', async () => {
  const h = await harness()
  assert.equal(h.value.active, true)
  assert.equal(h.value.hasVideo, false)
  assert.equal(h.value.waiting, false)
  h.engine.status.positionMs = 93000
  await h.change(s => ({ settings: { ...s.settings, volume: 0, repeatMode: 'one', shuffleEnabled: true } }))
  assert.equal(h.engine.status.positionMs, 93000)
  assert.equal(h.calls.at(-1).currentId, undefined)
  assert.equal(h.calls.at(-1).playing, undefined)
  assert.equal(h.calls.at(-1).volume, 0)
  assert.equal(h.engine.status.repeatOne, true)
  await h.change(s => ({ tracks: s.tracks.map(t => ({ ...t, title: `${t.id} renamed` })) }))
  assert.equal(h.engine.status.positionMs, 93000)
  await h.change({ playing: false })
  assert.equal(h.engine.status.playWhenReady, false)
  await h.change({ playing: true })
  assert.equal(h.engine.status.playWhenReady, true)
  await h.perform(v => v.seek(175.5))
  assert.equal(h.engine.status.positionMs, 175500)
  await h.dispose()
})

test('reattaches to an existing session and its queue without resetting the song', async () => {
  const h = await harness({ initialStatus: { ...idle(), trackId: 'b', queueIds: ['b'], positionMs: 132000, durationMs: 223000, state: 'ready', playWhenReady: true } })
  assert.equal(h.options.currentId, 'b')
  assert.deepEqual([...h.options.queueIds], ['b'])
  assert.equal(h.engine.status.positionMs, 132000)
  assert.equal(h.options.playing, true)
  await h.dispose()
})

test('native auto-next and notification pause are reflected without restarting; no hidden polling', async () => {
  const h = await harness()
  h.document.hidden = true
  const before = h.calls.length
  h.engine.status.trackId = 'b'
  h.engine.status.positionMs = 62000
  await h.poll()
  assert.equal(h.calls.length, before)
  h.document.hidden = false
  await h.poll()
  assert.equal(h.options.currentId, 'b')
  assert.equal(h.engine.status.positionMs, 62000)
  h.engine.status.playWhenReady = false
  await h.poll()
  assert.equal(h.options.playing, false)
  await h.perform(v => assert.equal(v.adjacent(-1), true))
  assert.equal(h.options.currentId, 'a')
  assert.equal(h.options.playing, true)
  await h.dispose()
})

test('native failures stop UI playback and do not trigger a playing=true retry', async () => {
  const h = await harness()
  h.engine.status.state = 'error'
  h.engine.status.error = 'NAKI_AUDIO_ERROR_CODE_DECODING_FAILED'
  const before = h.calls.length
  await h.poll()
  assert.equal(h.options.playing, false)
  assert.match(h.value.error, /DECODING_FAILED/)
  assert.ok(h.calls.slice(before).every(call => call.playing !== true))
  await h.dispose()
})

test('mixed queue stops at video boundary; video pause/volume do not clear/reload its element', async () => {
  const h = await harness({ descriptions: { a: audio('a'), v: { id: 'v', hasVideo: true, durationMs: 5000 }, b: audio('b') } })
  assert.deepEqual([...h.engine.status.queueIds], ['a'])
  h.engine.status.state = 'ended'
  await h.poll()
  assert.equal(h.options.currentId, 'v')
  assert.equal(h.value.hasVideo, true)
  assert.equal(h.value.active, false)
  assert.equal(h.value.waiting, false)
  const before = h.calls.length
  await h.change(s => ({ playing: false, settings: { ...s.settings, volume: 0.4 } }))
  assert.equal(h.calls.length, before)
  await h.change({ currentId: 'b', playing: true })
  assert.deepEqual([...h.engine.status.queueIds], ['b'])
  await h.dispose()
})

test('unavailable file is isolated and reported, and queue files are released before deletion', async () => {
  const h = await harness({ descriptions: { a: audio('a'), b: { ...audio('b'), error: 'arquivo ausente' } } })
  assert.deepEqual([...h.engine.status.queueIds], ['a'])
  await h.change({ currentId: 'b' })
  assert.equal(h.value.error, 'arquivo ausente')
  assert.equal(h.options.playing, false)
  await h.dispose()
  const h2 = await harness()
  await h2.perform(v => v.releaseTrack('b'))
  assert.deepEqual([...h2.engine.status.queueIds], ['a'])
  await h2.perform(v => v.releaseTrack('a'))
  assert.equal(h2.engine.status.trackId, undefined)
  await h2.dispose()
})

test('a delayed native response cannot replace a newer user selection', async () => {
  const h = await harness()
  let release
  h.engine.intercept = request => request.action === 'load' && request.volume === 0.4 ? new Promise(resolve => { release = resolve }) : undefined
  await h.change(s => ({ settings: { ...s.settings, volume: 0.4 } }))
  await h.change(s => ({ currentId: 'b', settings: { ...s.settings, volume: 0.6 } }))
  assert.equal(h.options.currentId, 'b')
  await act(async () => release())
  await h.flush()
  assert.equal(h.options.currentId, 'b')
  assert.equal(h.engine.status.trackId, 'b')
  await h.dispose()
})
