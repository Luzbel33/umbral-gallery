let context;
const nodes = new WeakMap();
export async function visualize(audio) {
  if (audio.paused || !audio.isConnected) return;
  const canvas = audio.closest(".sound-work")?.querySelector("canvas");
  if (!canvas || !window.AudioContext) return;
  context ??= new AudioContext();
  await context.resume();
  if (audio.paused || !audio.isConnected) return;
  let entry = nodes.get(audio);
  if (!entry) {
    const source = context.createMediaElementSource(audio),
      analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    entry = { source, analyser, frame: 0, on: false };
    nodes.set(audio, entry);
    const stop = () => {
      cancelAnimationFrame(entry.frame);
      entry.frame = 0;
      if (entry.on) {
        source.disconnect();
        analyser.disconnect();
        entry.on = false;
      }
    };
    audio.addEventListener("pause", stop);
    audio.addEventListener("ended", stop);
  }
  if (entry.on) return;
  entry.source.connect(entry.analyser);
  entry.analyser.connect(context.destination);
  entry.on = true;
  const g = canvas.getContext("2d"),
    values = new Uint8Array(entry.analyser.frequencyBinCount);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function draw() {
    entry.analyser.getByteFrequencyData(values);
    g.clearRect(0, 0, 320, 68);
    for (let i = 0; i < 54; i++) {
      const h = 2 + values[Math.floor(i * 1.7)] * 0.2;
      g.fillStyle = i < 28 ? "#dbb88c" : "#d9a26e";
      g.fillRect(i * 6, 34 - h / 2, 3, h);
    }
    if (!still && !audio.paused && canvas.isConnected)
      entry.frame = requestAnimationFrame(draw);
  }
  draw();
}
