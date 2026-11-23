import {
  Input,
  Output,
  BlobSource,
  ALL_FORMATS,
  BufferTarget,
  WebMOutputFormat,
  OggOutputFormat,
  Quality,
  Conversion,
} from "mediabunny";

// Work locally and keep the original if a browser cannot preserve every track.
export async function compressMedia(file, video, limit, progress, signal) {
  if ((!window.AudioEncoder && !video) || (video && !window.VideoEncoder))
    return null;
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });
  let conversion;
  const cancel = () => {
    if (conversion) void conversion.cancel().catch(() => {});
  };
  try {
    const [pictures, sounds] = await Promise.all([
      input.getVideoTracks(),
      input.getAudioTracks(),
    ]);
    if (
      (video ? pictures.length !== 1 : pictures.length !== 0) ||
      sounds.length > 1 ||
      (!video && !sounds.length)
    )
      return null;
    const duration = await input.computeDuration();
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 1200 ||
      signal?.aborted
    )
      return null;
    const rate = Math.floor((limit * 8 * 0.9) / duration);
    const audioRate = Math.min(128000, video ? 96000 : rate);
    if (video ? rate - audioRate < 280000 : audioRate < 64000) return null;
    const target = new BufferTarget(),
      output = new Output({
        format: video ? new WebMOutputFormat() : new OggOutputFormat(),
        target,
      });
    let picture = { discard: true };
    if (video) {
      const [w, h] = await Promise.all([
        pictures[0].getDisplayWidth(),
        pictures[0].getDisplayHeight(),
      ]);
      const fit = Math.min(1, 1280 / Math.max(w, h));
      picture = {
        width: Math.max(2, 2 * Math.round((w * fit) / 2)),
        height: Math.max(2, 2 * Math.round((h * fit) / 2)),
        fit: "contain",
        codec: "vp9",
        quality: new Quality({
          bitrate: Math.min(1800000, rate - (sounds.length ? audioRate : 0)),
        }),
      };
    }
    conversion = await Conversion.init({
      input,
      output,
      video: picture,
      audio: {
        codec: "opus",
        sampleRate: 48000,
        quality: new Quality({ bitrate: audioRate }),
      },
    });
    if (
      !conversion.isValid ||
      conversion.discardedTracks.length ||
      signal?.aborted
    )
      return null;
    conversion.onProgress = (p) => progress?.(Math.floor(p * 100));
    target.on("write", ({ end }) => {
      if (end > Math.min(limit, file.size)) cancel();
    });
    signal?.addEventListener("abort", cancel, { once: true });
    await conversion.execute();
    if (!target.buffer || target.buffer.byteLength >= file.size) return null;
    const mime = video ? "video/webm" : "audio/ogg";
    return {
      blob: new Blob([target.buffer], { type: mime }),
      extension: video ? "webm" : "ogg",
      mime,
    };
  } catch {
    return null;
  } finally {
    signal?.removeEventListener("abort", cancel);
    input.dispose();
  }
}
