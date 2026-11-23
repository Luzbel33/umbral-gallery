import { client } from "./backend.js";
import { failure } from "./ui.js";
export async function joinMeeting(room, position, update, ended) {
  const { data: seat, error } = await client.rpc("join_gallery_visit", {
    room_key: room,
  });
  if (error) throw error;
  if (!seat)
    throw Error(
      "Se completó el cupo social. Podés explorar y volver a intentar.",
    );
  const {
    data: { session },
  } = await client.auth.getSession();
  let closed = false,
    timer = null,
    after = 0,
    messages = [],
    peers = [],
    mount = null,
    voice = null,
    failures = 0,
    voiceLoading = false;
  let peerCount = 0;
  function refresh() {
    if (!mount) return;
    mount.querySelector("[data-count]").textContent =
      `Grupo ${seat.instance} · ${peers.length || 1} de 6${failures ? " · Reconectando…" : ""}`;
    const log = mount.querySelector("[data-log]");
    const signature = after + "-" + messages.length;
    if (log.dataset.last !== signature) {
      const follow = log.scrollHeight - log.scrollTop - log.clientHeight < 45;
      log.replaceChildren(
        ...messages.map((m) => {
          const item = document.createElement("p"),
            name = document.createElement("strong");
          name.textContent = m.nick;
          item.append(name, document.createTextNode(m.body));
          return item;
        }),
      );
      if (!messages.length)
        log.textContent = "Todavía no hay mensajes en este grupo.";
      log.dataset.last = signature;
      if (follow) log.scrollTop = log.scrollHeight;
    }
  }
  async function poll() {
    if (closed) return;
    try {
      const p = position(),
        r = await client.rpc("gallery_snapshot", {
          lease: seat.ticket,
          px: Math.round(p.x * 20) / 20,
          pz: Math.round(p.z * 20) / 20,
          angle: Math.round((p.a % (2 * Math.PI)) * 20) / 20,
          since_id: after,
        });
      if (closed) return;
      if (r.error) throw r.error;
      if (!r.data) {
        api.dispose();
        ended();
        return;
      }
      failures = 0;
      peers = r.data.peers;
      peerCount = peers.length;
      if (r.data.messages.length) {
        messages = [...messages, ...r.data.messages].slice(-40);
        after = messages.at(-1).id;
      }
      messages = messages.filter(
        (m) => Date.parse(m.created_at) > Date.now() - 900000,
      );
      update(
        peers.filter((p) => p.id !== seat.peer),
        peerCount,
      );
      refresh();
    } catch {
      if (!closed) {
        failures++;
        refresh();
      }
    } finally {
      if (!closed)
        timer = setTimeout(
          poll,
          document.hidden
            ? 12000
            : failures
              ? Math.min(8000, 1500 * failures)
              : peerCount > 1
                ? 1300
                : 2100,
        );
    }
  }
  const api = {
    peer: seat.peer,
    instance: seat.instance,
    mount(root, login) {
      voice?.dispose();
      voice = null;
      mount = root;
      root.innerHTML = `<div class="conversation-heading"><h3>Conversación</h3><span data-count></span></div><div class="chat-log" role="log" aria-live="polite" aria-label="Mensajes del grupo" data-log></div>
  ${session ? '<form class="chat-form"><label class="sr-only" for="chat-message">Mensaje</label><input id="chat-message" autocomplete="off" maxlength="400" required placeholder="Escribí al grupo…"><button class="primary">Enviar</button></form><div class="voice-controls"><button class="secondary" data-listen>Activar voz</button><button class="secondary speak" data-talk disabled>Mantené para hablar</button></div><small>La voz se comparte con tu grupo mientras mantenés presionado. Los mensajes se ven durante 15 minutos.</small>' : '<p>Podés leer como visitante. <button class="text-btn" data-login>Ingresá para escribir y hablar.</button></p>'}
  <p data-feedback role="status" class="form-status"></p>`;
      refresh();
      if (!session) {
        root.querySelector("[data-login]").onclick = login;
        return;
      }
      const form = root.querySelector("form"),
        feedback = root.querySelector("[data-feedback]");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const input = form.querySelector("input"),
          msg = input.value.trim();
        if (!msg) return;
        const btn = form.querySelector("button");
        btn.disabled = true;
        try {
          const r = await client.rpc("gallery_say", {
            lease: seat.ticket,
            message: msg,
          });
          if (r.error) throw r.error;
          input.value = "";
          feedback.textContent = "";
        } catch (e) {
          feedback.textContent = failure(e);
        } finally {
          btn.disabled = false;
        }
      };
      const listen = root.querySelector("[data-listen]");
      listen.onclick = async () => {
        if (voiceLoading) return;
        if (voice) {
          voice.dispose();
          voice = null;
          listen.textContent = "Activar voz";
          return;
        }
        voiceLoading = true;
        listen.disabled = true;
        try {
          const { connectVoice } = await import("./voice.js");
          const v = await connectVoice(seat, root);
          if (closed || root !== mount || !root.isConnected) v.dispose();
          else {
            voice = v;
            listen.textContent = "Silenciar voz";
            feedback.textContent = "Voz conectada. El micrófono está apagado.";
          }
        } catch (e) {
          feedback.textContent = failure(e);
        } finally {
          voiceLoading = false;
          listen.disabled = false;
        }
      };
    },
    unmount() {
      mount = null;
      voice?.dispose();
      voice = null;
    },
    dispose() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      api.unmount();
      void Promise.resolve(
        client.rpc("leave_gallery_visit", { lease: seat.ticket }),
      ).catch(() => {});
    },
  };
  void poll();
  return api;
}
