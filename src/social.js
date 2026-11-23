import * as T from "three";
import { client } from "./backend.js";
export function joinVisitors(room, scene, position, yaw, onStatus) {
  const id = crypto.randomUUID(),
    avatars = new Map(),
    members = new Set();
  const channel = client.channel("gallery:" + room, {
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
  function send() {
    if (active)
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
        }
      for (const [key, values] of Object.entries(state)) {
        if (!avatars.has(key)) update(values[0]);
      }
      onStatus("En compañía · " + members.size);
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
  return {
    tick(time, dt) {
      for (const a of avatars.values())
        a.group.position.lerp(a.to, 1 - Math.exp(-10 * dt));
      if (
        active &&
        time - lastTime > 350 &&
        (Math.abs(position.x - lastX) + Math.abs(position.z - lastZ) > 0.08 ||
          Math.abs(yaw() - lastYaw) > 0.16)
      ) {
        lastTime = time;
        lastX = position.x;
        lastZ = position.z;
        lastYaw = yaw();
        send();
      }
    },
    dispose() {
      disposed = true;
      active = false;
      void client.removeChannel(channel);
      for (const a of avatars.values()) scene.remove(a.group);
      bodyGeo.dispose();
      headGeo.dispose();
      mat.dispose();
    },
  };
}
