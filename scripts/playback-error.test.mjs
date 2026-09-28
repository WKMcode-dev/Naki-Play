import { test } from 'node:test'
import assert from 'node:assert/strict'
import { playbackErrorMessage } from '../frontend/src/services/playbackError.ts'

test('autoplay is not misreported as incompatible codec', () => {
  assert.match(playbackErrorMessage(undefined, 'NotAllowedError'), /automática/)
})
test('changing the track does not produce an error notice', () => {
  assert.equal(playbackErrorMessage(undefined, 'AbortError'), undefined)
  assert.equal(playbackErrorMessage(1), undefined)
})
test('distinguishes reading, decoding and unsupported sources', () => {
  assert.match(playbackErrorMessage(2), /ler a mídia/)
  assert.match(playbackErrorMessage(3), /decodificar/)
  assert.match(playbackErrorMessage(4), /formato real/)
})
