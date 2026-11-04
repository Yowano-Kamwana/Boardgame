// Board atmosphere: corruption veins, biome particles, fog over the unknown, dust puffs and
// contact shadows. Everything here is decoration and can be switched off.
import * as THREE from 'three';

const rand = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export const hashKey = (k) => { let h = 2166136261; for (const c of k) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return Math.abs(h) || 1; };

// ------------------------------------------------------------ corruption veins
// Branching veins that creep in from the tile's edge. A few variants are drawn once and reused.
const veinCache = [];
export function veinTexture(variant) {
  const i = variant % 6;
  if (veinCache[i]) return veinCache[i];
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = rand(9301 + i * 7919);
  g.lineCap = 'round';
  const branch = (x, y, ang, len, w, depth) => {
    let cx = x, cy = y;
    const steps = Math.ceil(len / 8);
    g.beginPath(); g.moveTo(cx, cy);
    for (let s = 0; s < steps; s++) {
      ang += (rnd() - 0.5) * 0.7;
      cx += Math.cos(ang) * 8; cy += Math.sin(ang) * 8;
      g.lineTo(cx, cy);
      if (depth < 4 && rnd() < 0.09) {
        g.lineWidth = w; g.stroke();
        branch(cx, cy, ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), len * (0.35 + rnd() * 0.3), w * 0.65, depth + 1);
        g.beginPath(); g.moveTo(cx, cy);
      }
    }
    g.lineWidth = w; g.stroke();
  };
  const roots = 3 + Math.floor(rnd() * 2);
  const start = rnd() * Math.PI * 2;
  for (let r = 0; r < roots; r++) {
    const a = start + (r / roots) * Math.PI * 1.2 + rnd() * 0.4;
    const x = S / 2 + Math.cos(a) * S * 0.46, y = S / 2 + Math.sin(a) * S * 0.4;
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.shadowColor = '#fff'; g.shadowBlur = 14;
    branch(x, y, a + Math.PI + (rnd() - 0.5) * 0.6, S * (0.45 + rnd() * 0.25), 9, 0);
  }
  g.shadowBlur = 0;
  // a softer bloom where the veins meet
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.3);
  grd.addColorStop(0, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  veinCache[i] = t;
  return t;
}

// ------------------------------------------------------------ soft round textures
function radial(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
let blobTex, dotTex, cloudTex;
export const blobTexture = () => (blobTex ||= radial([[0, 'rgba(0,0,0,0.55)'], [0.55, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]));
const dotTexture = () => (dotTex ||= radial([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']], 64));
function cloudTexture() {
  if (cloudTex) return cloudTex;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = rand(4242);
  for (let i = 0; i < 26; i++) {
    const x = S * (0.2 + rnd() * 0.6), y = S * (0.2 + rnd() * 0.6), r = S * (0.12 + rnd() * 0.18);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(235,228,215,0.22)'); grd.addColorStop(1, 'rgba(235,228,215,0)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
  }
  return (cloudTex = new THREE.CanvasTexture(c));
}

// A dark soft disc under a figure so it sits on the tile.
export function makeBlob(size = 0.7) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.renderOrder = 1;
  return m;
}

// Low mist lying over an unexplored tile: flat, so it never hides the board.
const fogGeo = new THREE.PlaneGeometry(2.1, 2.1);
export function makeFog(seed) {
  const g = new THREE.Group();
  const rnd = rand(seed);
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(fogGeo, new THREE.MeshBasicMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0.26 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((rnd() - 0.5) * 0.3, 0.16 + i * 0.1, (rnd() - 0.5) * 0.3);
    m.userData.phase = rnd() * 6.28;
    m.renderOrder = 4;
    g.add(m);
  }
  return g;
}

// ------------------------------------------------------------ biome particles
// One small shader point cloud; each particle belongs to a tile and loops its own motion.
const KINDS = {
  forest:    { color: [0.85, 1.0, 0.45], n: 6, size: 0.09, rise: 0.02, drift: 0.35, blink: true, low: 0.15, high: 0.7 },
  swamp:     { color: [0.65, 0.9, 0.85], n: 5, size: 0.07, rise: 0.18, drift: 0.05, blink: false, low: 0.05, high: 0.45 },
  highlands: { color: [1.0, 1.0, 1.0], n: 7, size: 0.06, rise: -0.22, drift: 0.2, blink: false, low: 0.05, high: 1.1 },
  crystal:   { color: [0.8, 0.6, 1.0], n: 6, size: 0.08, rise: 0.04, drift: 0.1, blink: true, low: 0.1, high: 0.6 },
  corrupted: { color: [1.0, 0.25, 0.6], n: 6, size: 0.08, rise: 0.12, drift: 0.12, blink: false, low: 0.05, high: 0.8 },
  workshop:  { color: [1.0, 0.65, 0.25], n: 10, size: 0.07, rise: 0.35, drift: 0.1, blink: false, low: 0.3, high: 1.4 },
  blight:    { color: [1.0, 0.3, 0.65], n: 4, size: 0.07, rise: 0.15, drift: 0.1, blink: false, low: 0.05, high: 0.7 },
};
const MAX = 900;

export function createParticles(scene) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), alpha = new Float32Array(MAX), size = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { map: { value: dotTexture() }, scale: { value: 600 } },
    vertexShader: `attribute float alpha; attribute float size; attribute vec3 color; varying float vA; varying vec3 vC;
      uniform float scale;
      void main() { vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC;
      void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);
  let parts = [];

  function sync(list) { // list: [{ x, z, kind }]
    parts = [];
    for (const tile of list) {
      const k = KINDS[tile.kind];
      if (!k) continue;
      const rnd = rand(hashKey(`${tile.x},${tile.z},${tile.kind}`));
      for (let i = 0; i < k.n && parts.length < MAX; i++)
        parts.push({ k, ox: tile.x, oz: tile.z, dx: (rnd() - 0.5) * 1.4, dz: (rnd() - 0.5) * 1.2, ph: rnd() * 10, sp: 0.6 + rnd() * 0.8 });
    }
    geo.setDrawRange(0, parts.length);
  }
  function update(time) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], k = p.k;
      const life = ((time * p.sp * 0.25 + p.ph) % 1 + 1) % 1;       // 0..1 loop
      const h = k.rise >= 0 ? k.low + life * (k.high - k.low) : k.high - life * (k.high - k.low);
      const wob = Math.sin(time * p.sp + p.ph * 3) * k.drift;
      pos[i * 3] = p.ox + p.dx + wob * 0.6;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = p.oz + p.dz + Math.cos(time * p.sp * 0.8 + p.ph) * k.drift * 0.6;
      const fade = Math.sin(Math.PI * life);
      alpha[i] = (k.blink ? Math.max(0, Math.sin(time * 2.4 * p.sp + p.ph * 5)) : 1) * fade * 0.9;
      size[i] = k.size;
      col[i * 3] = k.color[0]; col[i * 3 + 1] = k.color[1]; col[i * 3 + 2] = k.color[2];
    }
    geo.attributes.position.needsUpdate = geo.attributes.alpha.needsUpdate = true;
    geo.attributes.size.needsUpdate = geo.attributes.color.needsUpdate = true;
  }
  return { points, sync, update, setVisible: (v) => { points.visible = v; } };
}

// A puff of earthy dust when a tile lands.
export function makeDust() {
  const g = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: '#b89a70', transparent: true, depthWrite: false, opacity: 0.5 }));
    const a = (i / 10) * Math.PI * 2;
    s.userData.dir = new THREE.Vector3(Math.cos(a), 0.25, Math.sin(a));
    s.scale.setScalar(0.25);
    g.add(s);
  }
  return g;
}
