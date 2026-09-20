/**
 * Pure JavaScript PCM WAV Encoder
 *
 * Encodes Float32Array channel audio buffers to standard 16-bit uncompressed PCM WAV.
 */

export function encodeWavBuffer(leftChunks, rightChunks = [], sampleRate = 44100, isStereo = false) {
  const numChannels = isStereo ? 2 : 1;
  let totalLength = 0;
  for (let i = 0; i < leftChunks.length; i++) {
    totalLength += leftChunks[i].length;
  }

  const leftMerged = new Float32Array(totalLength);
  let offset = 0;
  for (let i = 0; i < leftChunks.length; i++) {
    leftMerged.set(leftChunks[i], offset);
    offset += leftChunks[i].length;
  }

  let rightMerged = null;
  if (isStereo) {
    rightMerged = new Float32Array(totalLength);
    offset = 0;
    for (let i = 0; i < rightChunks.length; i++) {
      rightMerged.set(rightChunks[i], offset);
      offset += rightChunks[i].length;
    }
  }

  // Interleave channels & convert Float32 [-1.0, 1.0] to Int16
  const numSamples = totalLength * numChannels;
  const pcmBuffer = new Int16Array(numSamples);

  let pcmIndex = 0;
  for (let i = 0; i < totalLength; i++) {
    // Left channel with hard clipping clamp
    let sL = Math.max(-1, Math.min(1, leftMerged[i]));
    pcmBuffer[pcmIndex++] = sL < 0 ? Math.round(sL * 0x8000) : Math.round(sL * 0x7FFF);

    if (isStereo) {
      let sR = rightMerged ? Math.max(-1, Math.min(1, rightMerged[i])) : sL;
      pcmBuffer[pcmIndex++] = sR < 0 ? Math.round(sR * 0x8000) : Math.round(sR * 0x7FFF);
    }
  }

  const dataByteLength = pcmBuffer.length * 2;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  function writeString(v, off, str) {
    for (let j = 0; j < str.length; j++) {
      v.setUint8(off + j, str.charCodeAt(j));
    }
  }

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true); // ChunkSize (total size - 8)
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16-bit)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  const pcmByteView = new Uint8Array(pcmBuffer.buffer);
  const wavUint8 = new Uint8Array(buffer, 44);
  wavUint8.set(pcmByteView);

  return buffer;
}
