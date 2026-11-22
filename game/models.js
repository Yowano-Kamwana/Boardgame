// Procedural 3D miniatures for Rootbound, modelled on the concept art.
import * as THREE from 'three';

// ------------------------------------------------------------ sculpted figures (Tripo GLBs)
const figureCache = {};
let reportProblem = () => {};
let loadedOnce = false;
export const onFigureProblem = (fn) => { reportProblem = fn; };
// Loads a figure, scales it to stand `height` tall (or, with fitMax, to that largest
// dimension) with its feet at y=0, facing +z.
// A sculpted figure in the game's own format (see tools/tofigure.mjs): quantized geometry in a
// plain JS module plus WebP texture files. It needs no WebAssembly, data: or blob: URLs, which a
// sandboxed page may refuse. `url` is like "assets/figures/mushy.js?v=22"; the Low graphics
// setting asks for "assets/figures/lite/mushy.js?..." and gets the smaller textures.
const texLoader = new THREE.TextureLoader();
const sculptCache = {};
function loadSculpt(url) {
  const lite = url.includes('/figures/lite/');
  const geoUrl = url.replace('/figures/lite/', '/figures/');
  const [file, query = ''] = geoUrl.split('?');
  const name = file.split('/').pop().replace(/\.js$/, '');
  const dir = file.slice(0, file.lastIndexOf('/') + 1) + (lite ? 'lite/' : '');
  const tex = (k, srgb) => new Promise((res) => texLoader.load(`${dir}${name}-${k}.webp${query ? '?' + query : ''}`, (t) => {
    t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t);
  }, undefined, () => res(null)));
  return sculptCache[url] ||= Promise.all([import(new URL(geoUrl, document.baseURI).href), tex('c', true), tex('n'), tex('r')]).then(([mod, map, normalMap, rm]) => {
    const { meta, data } = mod;
    const bin = atob(data); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    let o = 0; const take = (n) => { const b = bytes.buffer.slice(o, o + n); o += n; return b; };
    const qp = new Uint16Array(take(meta.sizes[0]), 0, meta.v * 3);
    const qn = new Int8Array(take(meta.sizes[1]), 0, meta.v * 4);
    const qu = new Uint16Array(take(meta.sizes[2]), 0, meta.v * 2);
    const qi = meta.i32 ? new Uint32Array(take(meta.sizes[3]), 0, meta.i) : new Uint16Array(take(meta.sizes[3]), 0, meta.i);
    const pos = new Float32Array(meta.v * 3), nrm = new Float32Array(meta.v * 3), uv = new Float32Array(meta.v * 2);
    for (let i = 0; i < meta.v; i++) {
      for (let a = 0; a < 3; a++) {
        pos[i * 3 + a] = meta.min[a] + (qp[i * 3 + a] / 65535) * (meta.max[a] - meta.min[a]);
        nrm[i * 3 + a] = qn[i * 4 + a] / 127;
      }
      for (let a = 0; a < 2; a++) uv[i * 2 + a] = meta.umin[a] + (qu[i * 2 + a] / 65535) * (meta.umax[a] - meta.umin[a]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(qi, 1));
    const mat = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap: rm, metalnessMap: rm, roughness: 1, metalness: 1, side: THREE.DoubleSide });
    if (!rm) { mat.roughness = 0.8; mat.metalness = 0; }
    const mesh = new THREE.Mesh(geo, mat);
    const scene = new THREE.Group(); scene.add(mesh);
    return { scene };
  });
}

export function loadFigure(url, height = 0.86, fitMax = false) {
  const key = url + (fitMax ? '|max' : '') + height;
  const source = loadSculpt(url);
  figureCache[key] ||= source.then((g) => {
    const root = g.scene;
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = height / (fitMax ? Math.max(size.x, size.y, size.z) : size.y);
    root.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    const wrap = new THREE.Group();
    wrap.add(root);
    if (!loadedOnce) { loadedOnce = true; reportProblem('loaded', url); }
    return wrap;
  });
  figureCache[key].catch((e) => { console.error('Figure failed to load:', url, e); reportProblem('figure', url, e); });
  return figureCache[key].then((w) => w.clone(true));
}

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...o });
const glow = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
// Lathe profiles must run bottom→top for outward-facing surfaces.
const lathe = (pts, seg = 28) => {
  const p = pts[0][1] > pts[pts.length - 1][1] ? pts.slice().reverse() : pts;
  return new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), seg);
};

let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
export function glowSprite(color, size = 1, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.set(size, size, size);
  return s;
}

// ------------------------------------------------------------ Mushroomfolk
function capSpots(group, capGeoRadius, capY, color, count = 7, lift = 0.0) {
  const mat = std(color, { roughness: 0.6 });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (i % 2) * 0.3;
    const ring = i % 3 === 0 ? 0.45 : 0.78;
    const r = capGeoRadius * ring;
    const h = Math.sqrt(Math.max(0, 1 - ring * ring)) * 0.12 + lift;
    const s = mesh(new THREE.SphereGeometry(0.035 + (i % 2) * 0.012, 10, 8), mat, Math.cos(a) * r, capY + h, Math.sin(a) * r);
    s.scale.y = 0.35;
    s.lookAt(0, capY - 0.4, 0);
    group.add(s);
  }
}

// The coloured player base every Mushroomfolk stands on.
export function makeBase(def) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.06, 36), std(def.base, { metalness: 0.35, roughness: 0.45 }), 0, 0.03, 0));
  const rim = mesh(new THREE.TorusGeometry(0.285, 0.012, 8, 40), std('#d8b45a', { metalness: 0.8, roughness: 0.3 }), 0, 0.06, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  return g;
}

export function makeMushroomfolk(id, def) {
  const g = new THREE.Group();
  const skin = std('#ead6b8', { roughness: 0.85 });
  const leather = std('#5a3a22');
  // base
  const base = mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.06, 36), std(def.base, { metalness: 0.35, roughness: 0.45 }), 0, 0.03, 0);
  g.add(base);
  const rim = mesh(new THREE.TorusGeometry(0.285, 0.012, 8, 40), std('#d8b45a', { metalness: 0.8, roughness: 0.3 }), 0, 0.06, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  // boots + body
  for (const x of [-0.07, 0.07]) g.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.1, 12), leather, x, 0.11, 0.01));
  const robe = id === 'morella';
  const bodyPts = robe
    ? [[0, 0.06], [0.19, 0.07], [0.17, 0.2], [0.13, 0.33], [0.1, 0.4], [0, 0.41]]
    : [[0, 0.13], [0.13, 0.14], [0.17, 0.22], [0.15, 0.33], [0.1, 0.4], [0, 0.41]];
  g.add(mesh(lathe(bodyPts), std(def.tunic)));
  const belt = mesh(new THREE.TorusGeometry(0.162, 0.018, 8, 30), leather, 0, 0.24, 0);
  belt.rotation.x = Math.PI / 2;
  g.add(belt);
  // arms
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), std(def.tunic), s * 0.17, 0.28, 0.02);
    arm.rotation.z = s * 0.5;
    g.add(arm);
    g.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), skin, s * 0.21, 0.22, 0.04));
  }
  // head
  g.add(mesh(new THREE.SphereGeometry(0.13, 24, 18), skin, 0, 0.5, 0.01));
  const eye = std('#1b120c', { roughness: 0.2 });
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.021, 10, 8), eye, s * 0.045, 0.5, 0.125));
    const cheek = mesh(new THREE.SphereGeometry(0.022, 10, 8), std('#e59a8a'), s * 0.075, 0.47, 0.105);
    cheek.scale.z = 0.4;
    g.add(cheek);
  }
  // cap
  const capY = 0.57;
  let capR = 0.34;
  if (id === 'sporewick') {
    capR = 0.31;
    g.add(mesh(lathe([[0, capY + 0.3], [0.08, capY + 0.25], [0.2, capY + 0.12], [0.31, capY], [0.28, capY - 0.035], [0, capY - 0.02]]), std(def.cap)));
    // goggles
    const brass = std('#b8893a', { metalness: 0.8, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const ring = mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 20), brass, s * 0.05, 0.51, 0.125);
      g.add(ring);
      g.add(mesh(new THREE.CircleGeometry(0.035, 16), std('#5fd6c8', { metalness: 0.4, roughness: 0.1, emissive: '#1d6a63', emissiveIntensity: 0.6 }), s * 0.05, 0.51, 0.13));
    }
    capSpots(g, 0.22, capY + 0.08, def.spots, 6, 0.04);
  } else {
    const h = id === 'morella' ? 0.2 : 0.16;
    g.add(mesh(lathe([[0, capY + h], [0.12, capY + h * 0.92], [0.24, capY + h * 0.65], [capR, capY + 0.02], [capR - 0.02, capY - 0.03], [0.12, capY - 0.02], [0, capY - 0.01]]), std(def.cap, { roughness: 0.55 })));
    capSpots(g, capR, capY, def.spots, id === 'mushy' ? 8 : 6);
  }
  const gills = mesh(new THREE.RingGeometry(0.09, capR - 0.03, 30), std('#e7d3b0', { side: THREE.DoubleSide }), 0, capY - 0.025, 0);
  gills.rotation.x = Math.PI / 2;
  g.add(gills);
  // backpack + bedroll
  g.add(mesh(new THREE.BoxGeometry(0.22, 0.22, 0.12), leather, 0, 0.3, -0.16));
  const roll = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 14), std('#8c6a45'), 0, 0.43, -0.17);
  roll.rotation.z = Math.PI / 2;
  g.add(roll);
  // props
  const wood = std('#6b4a2b');
  if (id === 'mushy') {
    const staff = mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.75, 8), wood, 0.24, 0.42, 0.06);
    staff.rotation.z = -0.08;
    g.add(staff);
    addLantern(g, -0.23, 0.18, 0.07);
  } else if (id === 'bramblecap') {
    const bow = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.28), wood, 0.22, 0.26, 0.12);
    g.add(bow);
    const limb = mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 16, Math.PI), wood, 0.22, 0.26, 0.24);
    limb.rotation.x = Math.PI / 2;
    g.add(limb);
    const coil = mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 18), std('#b79a62'), -0.17, 0.27, -0.05);
    coil.rotation.y = Math.PI / 2;
    g.add(coil);
  } else if (id === 'morella') {
    const staff = mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.82, 8), std('#3c2a1d'), 0.24, 0.45, 0.06);
    g.add(staff);
    const orb = mesh(new THREE.SphereGeometry(0.055, 16, 12), glow('#58c8ff', 2.4), 0.24, 0.88, 0.06);
    g.add(orb);
    const halo = glowSprite('#58c8ff', 0.5, 0.9);
    halo.position.set(0.24, 0.88, 0.06);
    g.add(halo);
    g.userData.orb = orb;
  } else if (id === 'thorncap') {
    const shield = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.035, 20), std('#7a5a33', { roughness: 0.6 }), -0.23, 0.28, 0.08);
    shield.rotation.z = Math.PI / 2;
    shield.rotation.y = -0.4;
    g.add(shield);
    const boss = mesh(new THREE.SphereGeometry(0.045, 12, 8), std('#c9a75a', { metalness: 0.8, roughness: 0.3 }), -0.25, 0.28, 0.1);
    g.add(boss);
    const thorn = std('#3b5a2a');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const t = mesh(new THREE.ConeGeometry(0.018, 0.08, 5), thorn, -0.25, 0.28 + Math.sin(a) * 0.11, 0.08 + Math.cos(a) * 0.11);
      t.rotation.x = a;
      g.add(t);
    }
    const spear = mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.85, 8), std('#6b4a2b'), 0.24, 0.44, 0.06);
    g.add(spear);
    g.add(mesh(new THREE.ConeGeometry(0.035, 0.1, 6), std('#c8c8c8', { metalness: 0.8, roughness: 0.3 }), 0.24, 0.9, 0.06));
  } else if (id === 'sporewick') {
    const flask = mesh(new THREE.SphereGeometry(0.06, 16, 12), glow('#6dff9a', 1.6), 0.23, 0.22, 0.09);
    g.add(flask);
    g.add(mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.06, 10), std('#cfe9d6', { transparent: true, opacity: 0.8 }), 0.23, 0.29, 0.09));
    const fl = glowSprite('#6dff9a', 0.35, 0.8);
    fl.position.set(0.23, 0.22, 0.09);
    g.add(fl);
    addLantern(g, -0.22, 0.2, 0.0);
  }
  g.userData.kind = 'player';
  return g;
}

function addLantern(g, x, y, z) {
  const brass = std('#7a5a2a', { metalness: 0.6, roughness: 0.4 });
  g.add(mesh(new THREE.BoxGeometry(0.07, 0.09, 0.07), glow('#ffb347', 1.8), x, y, z));
  g.add(mesh(new THREE.ConeGeometry(0.055, 0.04, 4), brass, x, y + 0.065, z));
  const l = glowSprite('#ffae42', 0.45, 0.85);
  l.position.set(x, y, z);
  g.add(l);
}

// ------------------------------------------------------------ Monsters
const BLIGHT = '#ff3d9a';

export function monsterBase(boss) {
  const g = new THREE.Group();
  const r = boss ? 0.42 : 0.3;
  g.add(mesh(new THREE.CylinderGeometry(r, r + 0.03, 0.06, 36), std('#1a0f17', { roughness: 0.5 }), 0, 0.03, 0));
  const ring = mesh(new THREE.TorusGeometry(r, 0.014, 8, 40), glow(BLIGHT, 1.5), 0, 0.065, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  return g;
}
function eyes(g, x, y, z, spread, color = BLIGHT, size = 0.024) {
  for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(size, 10, 8), glow(color, 3), x + s * spread, y, z));
  const sp = glowSprite(color, 0.25, 0.9);
  sp.position.set(x, y, z + 0.02);
  g.add(sp);
}

export function makeMonster(kind) {
  const boss = kind === 'root-king';
  const g = monsterBase(boss);
  const fur = std('#4a2c40', { roughness: 0.85, emissive: '#3d0d2c', emissiveIntensity: 0.55 });
  if (kind === 'corrupted-wolf') {
    const body = mesh(new THREE.CapsuleGeometry(0.11, 0.3, 6, 12), fur, 0, 0.3, -0.02);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    for (const [x, z] of [[-0.08, 0.13], [0.08, 0.13], [-0.08, -0.17], [0.08, -0.17]])
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.22, 8), fur, x, 0.15, z));
    const head = mesh(new THREE.SphereGeometry(0.1, 16, 12), fur, 0, 0.38, 0.24);
    head.scale.set(1, 0.9, 1.1);
    g.add(head);
    const snout = mesh(new THREE.ConeGeometry(0.06, 0.15, 10), fur, 0, 0.35, 0.36);
    snout.rotation.x = Math.PI / 2;
    g.add(snout);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.03, 0.09, 6), fur, s * 0.06, 0.48, 0.22);
      g.add(ear);
    }
    for (let i = 0; i < 6; i++) {
      const sp = mesh(new THREE.ConeGeometry(0.022, 0.1 - i * 0.008, 6), glow('#c42478', 0.8), 0, 0.42, 0.14 - i * 0.07);
      sp.rotation.x = -0.4;
      g.add(sp);
    }
    const tail = mesh(new THREE.ConeGeometry(0.04, 0.22, 8), fur, 0, 0.36, -0.3);
    tail.rotation.x = -2.2;
    g.add(tail);
    eyes(g, 0, 0.4, 0.32, 0.04);
  } else if (kind === 'blighted-mushroom') {
    g.add(mesh(lathe([[0, 0.06], [0.14, 0.07], [0.12, 0.2], [0.1, 0.3], [0.09, 0.36], [0, 0.37]]), std('#c9a7b8')));
    g.add(mesh(lathe([[0, 0.62], [0.16, 0.58], [0.3, 0.46], [0.33, 0.38], [0.29, 0.34], [0, 0.35]]), std('#8e2a63', { roughness: 0.5 })));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = i % 2 ? 0.2 : 0.27;
      g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), glow(BLIGHT, 2), Math.cos(a) * r, i % 2 ? 0.55 : 0.47, Math.sin(a) * r));
    }
    g.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), std('#1a0712'), 0, 0.21, 0.08));
    for (let i = 0; i < 6; i++) {
      const t = mesh(new THREE.ConeGeometry(0.012, 0.04, 5), std('#f2e8d8'), -0.05 + i * 0.02, 0.255, 0.13);
      t.rotation.x = Math.PI;
      g.add(t);
    }
    eyes(g, 0, 0.3, 0.1, 0.045);
    const sp = glowSprite(BLIGHT, 0.9, 0.35);
    sp.position.y = 0.45;
    g.add(sp);
  } else if (kind === 'shadow-stalker') {
    const body = mesh(new THREE.SphereGeometry(0.2, 18, 14), std('#2c2236', { roughness: 0.9, emissive: '#1d0f2e', emissiveIntensity: 0.6 }), 0, 0.36, -0.02);
    body.scale.set(0.9, 1, 1.3);
    g.add(body);
    for (const [x, z] of [[-0.12, 0.12], [0.12, 0.12], [-0.12, -0.16], [0.12, -0.16]]) {
      const leg = mesh(new THREE.CylinderGeometry(0.03, 0.018, 0.32, 8), std('#2c2236', { emissive: '#1d0f2e', emissiveIntensity: 0.5 }), x, 0.17, z);
      leg.rotation.x = z > 0 ? -0.2 : 0.2;
      g.add(leg);
    }
    g.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), std('#2c2236', { emissive: '#1d0f2e', emissiveIntensity: 0.5 }), 0, 0.46, 0.22));
    const bark = std('#2b1e18');
    for (const s of [-1, 1]) {
      const a = mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.3, 6), bark, s * 0.08, 0.64, 0.18);
      a.rotation.z = -s * 0.5;
      g.add(a);
      const b = mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.14, 6), bark, s * 0.16, 0.7, 0.2);
      b.rotation.z = s * 0.4;
      g.add(b);
      const c = mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.12, 6), bark, s * 0.06, 0.78, 0.15);
      c.rotation.z = -s * 0.1;
      g.add(c);
    }
    eyes(g, 0, 0.47, 0.31, 0.04, '#ff4466');
    const mist = glowSprite('#6a3aa0', 1.1, 0.35);
    mist.position.y = 0.3;
    g.add(mist);
  } else if (kind === 'crystal-husk') {
    const shell = std('#4a2f63', { roughness: 0.5, emissive: '#26103d', emissiveIntensity: 0.6 });
    const body = mesh(new THREE.SphereGeometry(0.17, 16, 12), shell, 0, 0.26, -0.03);
    body.scale.set(1.1, 0.75, 1.3);
    g.add(body);
    g.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), shell, 0, 0.24, 0.2));
    for (let i = 0; i < 8; i++) {
      const s = i < 4 ? -1 : 1;
      const z = -0.15 + (i % 4) * 0.1;
      const upper = mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.22, 6), shell, s * 0.2, 0.3, z);
      upper.rotation.z = s * 1.0;
      g.add(upper);
      const lower = mesh(new THREE.CylinderGeometry(0.015, 0.008, 0.26, 6), shell, s * 0.32, 0.15, z);
      lower.rotation.z = -s * 0.35;
      g.add(lower);
    }
    const crys = glow('#a46bff', 1.3);
    crys.transparent = true;
    crys.opacity = 0.92;
    for (const [x, y, z, h, rx, rz] of [[0, 0.42, -0.05, 0.3, 0, 0], [0.08, 0.38, -0.12, 0.2, 0.3, -0.4], [-0.08, 0.37, -0.1, 0.22, 0.2, 0.4], [0.03, 0.36, 0.06, 0.16, -0.3, -0.2]]) {
      const c = mesh(new THREE.OctahedronGeometry(1, 0), crys, x, y, z);
      c.scale.set(0.05, h / 2, 0.05);
      c.rotation.set(rx, 0, rz);
      g.add(c);
    }
    eyes(g, 0, 0.26, 0.28, 0.035, '#d36bff');
  } else if (kind === 'root-king') {
    const bark = std('#4a3326', { roughness: 0.9, emissive: '#2a0a18', emissiveIntensity: 0.5 });
    g.add(mesh(lathe([[0, 0.06], [0.36, 0.07], [0.28, 0.18], [0.24, 0.45], [0.26, 0.75], [0.2, 0.95], [0, 1.0]], 18), bark));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const root = mesh(new THREE.ConeGeometry(0.05, 0.45, 6), bark, Math.cos(a) * 0.32, 0.1, Math.sin(a) * 0.32);
      root.rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3);
      g.add(root);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const br = mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.55, 6), bark, Math.cos(a) * 0.2, 1.05, Math.sin(a) * 0.2);
      br.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
      g.add(br);
    }
    for (let i = 0; i < 5; i++) {
      const crack = mesh(new THREE.BoxGeometry(0.015, 0.25, 0.01), glow(BLIGHT, 2.2), -0.12 + i * 0.06, 0.4 + (i % 2) * 0.15, 0.255);
      crack.rotation.z = (i - 2) * 0.25;
      g.add(crack);
    }
    eyes(g, 0, 0.72, 0.25, 0.08, '#ff2d55', 0.04);
    g.add(mesh(new THREE.SphereGeometry(0.07, 12, 8), std('#050203'), 0, 0.58, 0.22));
    const aura = glowSprite(BLIGHT, 2.2, 0.35);
    aura.position.y = 0.6;
    g.add(aura);
  }
  const rimGlow = glowSprite(BLIGHT, boss ? 2.2 : 1.3, 0.22);
  rimGlow.position.y = boss ? 0.7 : 0.35;
  g.add(rimGlow);
  if (boss) g.scale.setScalar(1.25);
  g.userData.kind = 'monster';
  return g;
}

// ------------------------------------------------------------ Dice
function faceCanvas(draw, bg = '#efe2c4', ink = '#3a2614') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(80,50,20,0.55)';
  g.lineWidth = 6;
  g.strokeRect(8, 8, 112, 112);
  g.fillStyle = ink;
  g.strokeStyle = ink;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const drawSword = (g, x, y, s = 1, rot = -0.6) => {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.beginPath(); g.moveTo(0, -38); g.lineTo(6, -28); g.lineTo(6, 14); g.lineTo(-6, 14); g.lineTo(-6, -28); g.closePath(); g.fill();
  g.fillRect(-16, 14, 32, 6); g.fillRect(-4, 20, 8, 16); g.beginPath(); g.arc(0, 40, 6, 0, Math.PI * 2); g.fill();
  g.restore();
};
const RISK_DRAW = {
  hit: (g) => drawSword(g, 64, 64, 1.15),
  double: (g) => { drawSword(g, 50, 64, 1, -0.5); drawSword(g, 78, 64, 1, 0.5); },
  shield: (g) => {
    g.fillStyle = '#2e5b7a';
    g.beginPath(); g.moveTo(64, 20); g.lineTo(100, 32); g.quadraticCurveTo(98, 86, 64, 108); g.quadraticCurveTo(30, 86, 28, 32); g.closePath(); g.fill();
    g.fillStyle = '#efe2c4'; g.fillRect(60, 36, 8, 56); g.fillRect(44, 52, 40, 8);
  },
  wound: (g) => {
    g.fillStyle = '#a3192d';
    g.beginPath(); g.moveTo(64, 18); g.bezierCurveTo(88, 52, 96, 70, 96, 82); g.arc(64, 82, 32, 0, Math.PI); g.bezierCurveTo(32, 70, 40, 52, 64, 18); g.fill();
  },
  panic: (g) => {
    g.fillStyle = '#8a3fb3';
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 26 : 48; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.fill();
    g.fillStyle = '#efe2c4'; g.fillRect(59, 38, 10, 32); g.beginPath(); g.arc(64, 84, 6, 0, Math.PI * 2); g.fill();
  },
};
const ARROW_ANGLE = [0, 60, 120, 180, 240, 300];
function drawNumber(n) {
  return (g) => {
    g.font = '700 64px "Cinzel", Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 64, 70);
    g.save(); g.translate(64, 64); g.rotate((ARROW_ANGLE[n - 1] * Math.PI) / 180);
    g.beginPath(); g.moveTo(0, -56); g.lineTo(8, -44); g.lineTo(-8, -44); g.closePath(); g.fill();
    g.restore();
  };
}

// Box faces in three.js order: +x, -x, +y, -y, +z, -z.
const FACE_UP = [
  new THREE.Euler(0, 0, Math.PI / 2), new THREE.Euler(0, 0, -Math.PI / 2), new THREE.Euler(0, 0, 0),
  new THREE.Euler(Math.PI, 0, 0), new THREE.Euler(-Math.PI / 2, 0, 0), new THREE.Euler(Math.PI / 2, 0, 0),
];
const RISK_ON_FACE = ['hit', 'double', 'shield', 'wound', 'panic', 'hit'];

export function makeDie(kind) {
  const values = kind === 'risk' ? RISK_ON_FACE : [1, 2, 3, 4, 5, 6];
  const mats = values.map((v) => new THREE.MeshStandardMaterial({
    map: faceCanvas(kind === 'risk' ? RISK_DRAW[v] : drawNumber(v), kind === 'risk' ? '#e9dcc0' : '#f1dfb3', kind === 'risk' ? '#3a2614' : '#6b1f45'),
    roughness: 0.55,
  }));
  const geo = new THREE.BoxGeometry(0.46, 0.46, 0.46, 2, 2, 2);
  const die = new THREE.Mesh(geo, mats);
  die.castShadow = true;
  die.userData.faceFor = (value) => {
    const idx = values.findIndex((v, i) => v === value && (kind !== 'risk' || value !== 'hit' || i === 0));
    return new THREE.Quaternion().setFromEuler(FACE_UP[idx]);
  };
  return die;
}

// A painted-style portrait for characters without concept art yet: renders the miniature once.
export function portraitDataURL(id, def) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  r.setSize(320, 336, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6d8b8');
  scene.add(new THREE.HemisphereLight('#fff1d6', '#6b5a3a', 1.6));
  const key = new THREE.DirectionalLight('#ffe2b0', 2.2);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);
  const mini = makeMushroomfolk(id, def);
  scene.add(mini);
  const cam = new THREE.PerspectiveCamera(30, 320 / 336, 0.1, 20);
  cam.position.set(0.35, 0.62, 1.85);
  cam.lookAt(0, 0.45, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/jpeg', 0.9);
  r.dispose();
  return url;
}
