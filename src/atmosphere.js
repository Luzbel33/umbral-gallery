import * as T from "three";

// A single translucent point batch localizes dust to the window or projector light.
export function lightDust(scene, room) {
  const g = new T.BufferGeometry(),
    positions = [];
  let seed = 47;
  const random = () =>
    (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
  const count = room === "patio" ? 46 : 28;
  const center = room === "estratos" ? 4.8 : room === "frecuencia" ? -2.9 : 0;
  for (let i = 0; i < count; i++)
    positions.push(
      center + (random() - 0.5) * 5,
      0.65 + random() * 3.13,
      -4.9 + random() * 7.7,
    );
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  const mat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `uniform float uTime; varying float opacity;
      void main(){vec3 p=position;float a=p.x*2.5+p.z;
      p.x+=.11*sin(a+uTime*.20);p.y+=.09*sin(a*2.+uTime*.27);
      vec4 mv=modelViewMatrix*vec4(p,1.);
      gl_Position=projectionMatrix*mv;gl_PointSize=clamp(5./max(1.,-mv.z),1.25,3.);
      opacity=(.11+.17*pow(.5+.5*sin(a+uTime*.28),3.))*smoothstep(.1,1.2,-mv.z);}`,
    fragmentShader: `varying float opacity;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(1.,.89,.68,opacity*(1.-smoothstep(.12,.5,d)));}`,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const object = new T.Points(g, mat);
  scene.add(object);
  let last = -Infinity;
  return {
    tick(time) {
      if (time - last < 110) return false;
      last = time;
      mat.uniforms.uTime.value = time * 0.001;
      return true;
    },
    dispose() {
      scene.remove(object);
      g.dispose();
      mat.dispose();
    },
  };
}
