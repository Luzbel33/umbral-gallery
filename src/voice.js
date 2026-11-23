import { client } from "./backend.js";
export async function connectVoice(seat, host) {
  const talk = host.querySelector("[data-talk]"),
    status = host.querySelector("[data-feedback]");
  const ctx = new AudioContext();
  await ctx.resume();
  let dead = false,
    pressed = false,
    attempt = 0,
    capture = null,
    stream = null,
    source = null,
    gate = false,
    finishTimer = null,
    nextPlay = 0,
    queue = Promise.resolve(),
    pending = 0,
    lastPacket = 0,
    starting = false;
  const events = new AbortController();
  const on = (target, type, handler) =>
    target.addEventListener(type, handler, { signal: events.signal });
  const say = (operation, packet = "") =>
    client.rpc("gallery_voice", { lease: seat.ticket, operation, packet });
  const channel = client.channel("voice:" + seat.peer, {
    config: { private: true },
  });
  const dispose = () => {
    if (dead) return;
    dead = true;
    release();
    void Promise.resolve(say("mute")).catch(() => {});
    events.abort();
    talk.disabled = true;
    void client.removeChannel(channel);
    void ctx.close().catch(() => {});
  };
  function play({ payload: p }) {
    if (
      dead ||
      ctx.state !== "running" ||
      p.from === seat.peer ||
      typeof p.audio !== "string" ||
      p.audio.length > 8540
    )
      return;
    try {
      const bytes = atob(p.audio);
      if (!bytes.length) return;
      const buf = ctx.createBuffer(1, bytes.length, 8000),
        d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const value = bytes.charCodeAt(i) / 127.5 - 1;
        d[i] =
          (Math.sign(value) * Math.expm1(Math.abs(value) * Math.log(256))) /
          255;
      }
      if (nextPlay > ctx.currentTime + 1.9) return;
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.connect(ctx.destination);
      nextPlay = Math.max(ctx.currentTime + 0.06, nextPlay);
      node.start(nextPlay);
      nextPlay += buf.duration;
      status.textContent =
        "Habla " + String(p.nick || "un visitante").slice(0, 48);
    } catch {}
  }
  function enqueue(bytes) {
    if (!bytes.length || pending >= 2 || dead) return;
    const packet = btoa(String.fromCharCode(...bytes));
    pending++;
    queue = queue
      .then(async () => {
        const wait = 460 - (performance.now() - lastPacket);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (dead) return;
        lastPacket = performance.now();
        const r = await client.functions.invoke("gallery-voice", {
          body: { lease: seat.ticket, audio: packet },
        });
        if (r.error) throw r.error;
      })
      .catch(() => {
        status.textContent = "Se interrumpió el envío de voz.";
      })
      .finally(() => pending--);
  }
  function release() {
    pressed = false;
    attempt++;
    clearTimeout(finishTimer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    source?.disconnect();
    source = null;
    talk.classList.remove("transmitting");
    talk.textContent = "Mantené para hablar";
    const rec = capture;
    capture = null;
    if (rec) {
      talk.disabled = true;
      status.textContent = "Micrófono apagado.";
    }
    const finish = () => {
      if (!gate) return;
      gate = false;
      if (!dead) talk.disabled = true;
      queue = queue
        .then(() => say("end"))
        .catch(() => {})
        .finally(() => {
          if (!dead) talk.disabled = false;
        });
    };
    if (rec) {
      rec.port.postMessage("flush");
      setTimeout(() => {
        rec.disconnect();
        finish();
      }, 90);
    } else finish();
  }
  async function start() {
    if (dead || pressed || starting || talk.disabled) return;
    pressed = true;
    starting = true;
    const n = ++attempt;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !ctx.audioWorklet)
        throw Error("Este navegador no ofrece micrófono para la galería.");
      await ctx.resume();
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
      if (dead || !pressed || n !== attempt) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = mic;
      const r = await say("begin");
      if (r.error || !r.data)
        throw Error("La voz está ocupada. Probá de nuevo en unos segundos.");
      if (dead || !pressed || n !== attempt) {
        await say("end");
        return;
      }
      gate = true;
      source = ctx.createMediaStreamSource(mic);
      capture = new AudioWorkletNode(ctx, "gallery-microphone", {
        numberOfOutputs: 0,
      });
      capture.port.onmessage = (e) => {
        if (e.data instanceof Uint8Array) enqueue(e.data);
      };
      source.connect(capture);
      talk.classList.add("transmitting");
      talk.textContent = "Hablando · soltá para cortar";
      status.textContent = "Micrófono activo.";
      finishTimer = setTimeout(release, 13500);
    } catch (e) {
      status.textContent =
        e.name === "NotAllowedError"
          ? "El micrófono necesita permiso del navegador."
          : e.message;
      release();
    } finally {
      starting = false;
    }
  }
  try {
    await ctx.audioWorklet.addModule(
      import.meta.env.BASE_URL + "voice-capture.js",
    );
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("No se pudo conectar la voz.")),
        10000,
      );
      channel.on("broadcast", { event: "audio" }, play).subscribe((s) => {
        if (s === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(s)) {
          clearTimeout(timeout);
          reject(Error("El canal de voz no está disponible."));
          if (!dead) {
            talk.disabled = true;
            release();
          }
        }
      });
    });
  } catch (e) {
    dispose();
    throw e;
  }
  const listening = await say("listen");
  if (listening.error || !listening.data) {
    dispose();
    throw Error("No se pudo activar la escucha.");
  }
  talk.disabled = false;
  on(talk, "pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    talk.setPointerCapture(e.pointerId);
    void start();
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    on(talk, event, () => {
      if (pressed) release();
    });
  on(talk, "keydown", (e) => {
    if ([" ", "Enter"].includes(e.key)) {
      e.preventDefault();
      if (!e.repeat) void start();
    }
  });
  on(talk, "keyup", (e) => {
    if ([" ", "Enter"].includes(e.key)) {
      e.preventDefault();
      release();
    }
  });
  on(window, "blur", release);
  on(document, "visibilitychange", () => {
    if (document.hidden) release();
  });
  return { dispose };
}
