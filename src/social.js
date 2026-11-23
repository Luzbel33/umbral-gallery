import { t } from "./i18n.js";
import * as T from "three";
import { joinMeeting } from "./meeting.js";
export async function joinVisitors(
  room,
  scene,
  position,
  yaw,
  onStatus,
  onEnd,
  roomScale = 1,
) {
  const avatars = new Map(),
    body = new T.CapsuleGeometry(0.18, 0.65, 3, 8),
    head = new T.SphereGeometry(0.15, 10, 8),
    mat = new T.MeshStandardMaterial({ color: 0xc6dda2, roughness: 0.65 });
  let dirty = false;
  function clear() {
    for (const p of avatars.values()) scene.remove(p.obj);
    avatars.clear();
    body.dispose();
    head.dispose();
    mat.dispose();
  }
  let meeting;
  try {
    meeting = await joinMeeting(
      room,
      () => ({
        x: position.x / roomScale,
        z: position.z / roomScale,
        a: yaw(),
      }),
      (peers, count) => {
        const ids = new Set(peers.map((p) => p.id));
        for (const [id, p] of avatars)
          if (!ids.has(id)) {
            scene.remove(p.obj);
            avatars.delete(id);
            dirty = true;
          }
        for (const p of peers) {
          let a = avatars.get(p.id);
          if (!a) {
            const obj = new T.Group(),
              b = new T.Mesh(body, mat),
              h = new T.Mesh(head, mat);
            b.position.y = 0.88;
            h.position.y = 1.48;
            obj.add(b, h);
            obj.position.set(p.x * roomScale, 0, p.z * roomScale);
            scene.add(obj);
            a = { obj, to: new T.Vector3() };
            avatars.set(p.id, a);
            dirty = true;
          }
          a.to.set(p.x * roomScale, 0, p.z * roomScale);
          if (a.obj.rotation.y !== p.a) {
            a.obj.rotation.y = p.a;
            dirty = true;
          }
        }
        onStatus(`${t("En compañía ·")} ` + count);
      },
      () => {
        clear();
        onEnd();
      },
    );
  } catch (e) {
    clear();
    throw e;
  }
  return {
    mount: meeting.mount,
    unmount: meeting.unmount,
    tick(time, dt) {
      let changed = dirty;
      dirty = false;
      for (const a of avatars.values())
        if (a.obj.position.distanceToSquared(a.to) > 0.0001) {
          a.obj.position.lerp(a.to, 1 - Math.exp(-4 * dt));
          changed = true;
        }
      return changed;
    },
    dispose() {
      meeting.dispose();
      clear();
    },
  };
}
