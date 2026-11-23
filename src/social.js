import * as T from "three";
import { client } from "./backend.js";
export async function joinVisitors(
  room,
  scene,
  position,
  yaw,
  onStatus,
  onEnd,
) {
  const { data: seat, error } = await client.rpc("join_gallery_visit", {
    room_key: room,
  });
  if (error)
    throw Error("La presencia no está disponible. Podés seguir caminando.");
  if (!seat)
    throw Error(
      "Se llenaron los lugares en compañía. Tu recorrido individual sigue disponible.",
    );
  const id = crypto.randomUUID(),
    avatars = new Map(),
    members = new Set();
  const channel = client.channel("gallery:" + room + ":" + seat.instance, {
    config: { presence: { key: id }, broadcast: { self: false } },
  });
  const bodyGeo = new T.CapsuleGeometry(0.17, 0.61, 3, 8),
    headGeo = new T.SphereGeometry(0.14, 10, 8),
    mat = new T.MeshStandardMaterial({ color: 0xd0e1a7, roughness: 0.6 });
  let active = false,
    disposed = false,
    lastTime = 0,
    lastX = Infinity,
    lastZ = Infinity,
    lastYaw = Infinity;
  const payload = () => ({
    id,
    x: Math.round(position.x * 20) / 20,
    z: Math.round(position.z * 20) / 20,
    a: Math.round(yaw() * 20) / 20,
  });
  let changed = false;
  function send() {
    if (active && members.size > 1)
      void channel.send({
        type: "broadcast",
        event: "move",
        payload: payload(),
      });
  }
  function update(p) {
    if (
      !p ||
      p.id === id ||
      !members.has(p.id) ||
      ![p.x, p.z, p.a].every(Number.isFinite) ||
      Math.abs(p.x) > 8 ||
      Math.abs(p.z) > 9
    )
      return;
    let a = avatars.get(p.id);
    if (!a) {
      if (avatars.size >= 12) return;
      const group = new T.Group();
      const b = new T.Mesh(bodyGeo, mat),
        h = new T.Mesh(headGeo, mat);
      b.position.y = 0.82;
      h.position.y = 1.45;
      group.add(b, h);
      scene.add(group);
      group.position.set(p.x, 0, p.z);
      a = { group, to: new T.Vector3() };
      avatars.set(p.id, a);
    }
    a.to.set(p.x, 0, p.z);
    a.group.rotation.y = p.a;
    changed = true;
  }
  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      members.clear();
      Object.keys(state).forEach((k) => members.add(k));
      for (const [key, a] of avatars)
        if (!members.has(key)) {
          scene.remove(a.group);
          avatars.delete(key);
          changed = true;
        }
      for (const [key, values] of Object.entries(state)) {
        if (!avatars.has(key)) update(values[0]);
      }
      if (!disposed) onStatus("En compañía · " + members.size);
    })
    .on("presence", { event: "join" }, send)
    .on("broadcast", { event: "move" }, ({ payload: p }) => update(p))
    .subscribe(async (status) => {
      if (disposed) return;
      active = status === "SUBSCRIBED";
      if (active) {
        const result = await channel.track(payload());
        if (result !== "ok") onStatus("Presencia sin conexión");
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      )
        onStatus("Sin conexión · recorrido individual");
    });
  const renew = setInterval(async () => {
    const result = await client.rpc("renew_gallery_visit", {
      lease: seat.ticket,
    });
    if (!disposed && (result.error || !result.data)) {
      session.dispose();
      onEnd();
    }
  }, 45000);
  const session = {
    tick(time, dt) {
      let moving = changed;
      changed = false;
      for (const a of avatars.values()) {
        if (a.group.position.distanceToSquared(a.to) > 0.00001) {
          a.group.position.lerp(a.to, 1 - Math.exp(-10 * dt));
          moving = true;
        }
      }
      if (
        active &&
        time - lastTime > 500 &&
        (Math.abs(position.x - lastX) + Math.abs(position.z - lastZ) > 0.08 ||
          Math.abs(yaw() - lastYaw) > 0.16)
      ) {
        lastTime = time;
        lastX = position.x;
        lastZ = position.z;
        lastYaw = yaw();
        send();
      }
      return moving;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(renew);
      void Promise.resolve(
        client.rpc("leave_gallery_visit", { lease: seat.ticket }),
      ).catch(() => {});
      active = false;
      void client.removeChannel(channel);
      for (const a of avatars.values()) scene.remove(a.group);
      bodyGeo.dispose();
      headGeo.dispose();
      mat.dispose();
    },
  };
  return session;
}
