import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeWavBuffer } from '../wav-encoder.mjs';

function readString(view, offset, length) {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(view.getUint8(offset + i));
  }
  return str;
}

test('WAV Header: RIFF, WAVE, fmt, and data chunk structure', () => {
  const left = [new Float32Array([0.0, 0.5, -0.5, 0.0])];
  const buffer = encodeWavBuffer(left, [], 44100, false);
  const view = new DataView(buffer);

  assert.equal(readString(view, 0, 4), 'RIFF');
  assert.equal(view.getUint32(4, true), buffer.byteLength - 8);
  assert.equal(readString(view, 8, 4), 'WAVE');
  assert.equal(readString(view, 12, 4), 'fmt ');
  assert.equal(view.getUint32(16, true), 16); // PCM chunk size
  assert.equal(view.getUint16(20, true), 1);  // AudioFormat 1 = uncompressed PCM
  assert.equal(readString(view, 36, 4), 'data');
  assert.equal(view.getUint32(40, true), 4 * 2); // 4 samples * 2 bytes
});

test('Mono encoding: channel count, sample rate, bit depth, byte rate', () => {
  const sampleRate = 48000;
  const numSamples = 480; // 10ms of audio
  const chunk = new Float32Array(numSamples);
  const buffer = encodeWavBuffer([chunk], [], sampleRate, false);
  const view = new DataView(buffer);

  assert.equal(view.getUint16(22, true), 1); // 1 channel
  assert.equal(view.getUint32(24, true), sampleRate); // 48000 Hz
  assert.equal(view.getUint32(28, true), sampleRate * 1 * 2); // Byte rate = 96000
  assert.equal(view.getUint16(32, true), 2); // BlockAlign = 2
  assert.equal(view.getUint16(34, true), 16); // 16 bits
  assert.equal(buffer.byteLength, 44 + (numSamples * 2));
});

test('Stereo encoding: interleaving channels correctly', () => {
  const sampleRate = 44100;
  // Distinct left and right channel values
  const leftChunk = new Float32Array([0.25, -0.25, 0.5]);
  const rightChunk = new Float32Array([0.75, -0.75, 1.0]);

  const buffer = encodeWavBuffer([leftChunk], [rightChunk], sampleRate, true);
  const view = new DataView(buffer);

  assert.equal(view.getUint16(22, true), 2); // 2 channels (stereo)
  assert.equal(view.getUint32(28, true), sampleRate * 2 * 2); // Byte rate
  assert.equal(view.getUint16(32, true), 4); // Block align (2 channels * 2 bytes)

  const pcm = new Int16Array(buffer, 44, 6);
  // Expected values: L0, R0, L1, R1, L2, R2
  assert.equal(pcm[0], Math.round(0.25 * 0x7FFF));
  assert.equal(pcm[1], Math.round(0.75 * 0x7FFF));
  assert.equal(pcm[2], Math.round(-0.25 * 0x8000));
  assert.equal(pcm[3], Math.round(-0.75 * 0x8000));
  assert.equal(pcm[4], Math.round(0.5 * 0x7FFF));
  assert.equal(pcm[5], 0x7FFF); // 1.0 clamped to max int16
});

test('Clipping: samples exceeding [-1.0, 1.0] are safely clamped', () => {
  const leftChunk = new Float32Array([2.5, -3.0]);
  const buffer = encodeWavBuffer([leftChunk], [], 44100, false);
  const pcm = new Int16Array(buffer, 44, 2);

  assert.equal(pcm[0], 0x7FFF);  // Clamped to +32767
  assert.equal(pcm[1], -0x8000); // Clamped to -32768
});

test('Duration and byte size calculation', () => {
  const sampleRate = 44100;
  const oneSecondSamples = 44100;
  const chunk = new Float32Array(oneSecondSamples);
  const buffer = encodeWavBuffer([chunk], [], sampleRate, false);

  const durationSec = (buffer.byteLength - 44) / (sampleRate * 2);
  assert.equal(durationSec, 1.0);
  assert.equal(buffer.byteLength, 44 + 88200);
});
