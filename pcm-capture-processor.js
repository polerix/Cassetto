/**
 * Cassetto AudioWorklet Processor
 *
 * Captures raw PCM Float32 audio samples from the audio input thread
 * without blocking the main UI thread (replacing deprecated ScriptProcessorNode).
 */

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = true;
    this.port.onmessage = (event) => {
      if (event.data && event.data.command === 'setRecording') {
        this.isRecording = Boolean(event.data.recording);
      }
    };
  }

  process(inputs) {
    if (!this.isRecording) return true;

    const input = inputs[0];
    if (input && input.length > 0) {
      const channel0 = input[0];
      const channel1 = input.length > 1 ? input[1] : null;

      if (channel0 && channel0.length > 0) {
        this.port.postMessage({
          left: new Float32Array(channel0),
          right: channel1 && channel1.length > 0 ? new Float32Array(channel1) : null,
        });
      }
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
