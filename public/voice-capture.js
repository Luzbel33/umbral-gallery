/* Resample speech to 8 kHz µ-law in bounded packets. Audio never reaches the output. */
class GalleryMicrophone extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Uint8Array(6000);
    this.length = 0;
    this.phase = 0;
    this.sum = 0;
    this.samples = 0;
    this.port.onmessage = () => {
      this.flush();
      this.port.postMessage("done");
    };
  }
  flush() {
    if (this.length) {
      const data = this.buffer.slice(0, this.length);
      this.port.postMessage(data, [data.buffer]);
      this.length = 0;
    }
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const sample of input) {
      this.sum += sample;
      this.samples++;
      this.phase += 8000;
      if (this.phase < sampleRate) continue;
      this.phase -= sampleRate;
      const v = Math.max(-1, Math.min(1, this.sum / this.samples));
      this.sum = 0;
      this.samples = 0;
      const c = (Math.sign(v) * Math.log1p(255 * Math.abs(v))) / Math.log(256);
      this.buffer[this.length++] = Math.round((c + 1) * 127.5);
      if (this.length === this.buffer.length) this.flush();
    }
    return true;
  }
}
registerProcessor("gallery-microphone", GalleryMicrophone);
