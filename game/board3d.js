// The 3D tabletop: tiles, miniatures, dice, camera.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeMushroomfolk, makeMonster, makeDie, glowSprite, makeBase, loadFigure, monsterBase } from './models.js?v=18';
import { BIOMES, CHARACTERS, DIRS, MONSTERS } from './data.js?v=18';
import { allKeys, parse, useBoard, boardRadius } from './engine.js?v=18';
import { veinTexture, hashKey, makeBlob, makeFog, createParticles, makeDust } from './atmosphere.js?v=18';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

const R = 1;          // hex radius (center → corner)
const H = 0.16;       // tile thickness
const GAP = 1.045;
const SQ3 = Math.sqrt(3);

export function hexPos(k) {
  const [q, r] = parse(k);
  return new THREE.Vector3(1.5 * R * q * GAP, 0, SQ3 * R * (r + q / 2) * GAP);
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function hexShape(r = R) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}
function capGeometry(r = R) {
  const g = new THREE.ShapeGeometry(hexShape(r));
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * r) + 0.5, pos.getY(i) / (SQ3 * r) + 0.5);
  return g;
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 1024, 0);
  grd.addColorStop(0, '#3a2213'); grd.addColorStop(0.5, '#4a2c18'); grd.addColorStop(1, '#38200f');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * 1024, w = 1 + Math.random() * 2.5;
    g.strokeStyle = `rgba(${20 + Math.random() * 30},${10 + Math.random() * 15},5,${0.08 + Math.random() * 0.18})`;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x / 140 + i) * 6 + Math.sin(x / 33 + i * 3) * 1.5);
    g.stroke();
  }
  for (let i = 0; i < 7; i++) { // planks
    g.fillStyle = 'rgba(10,5,2,0.55)'; g.fillRect(0, i * 146 + 140, 1024, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.anisotropy = 8;
  return t;
}

function labelSprite(text, { color = '#fff4d6', bg = 'rgba(25,14,8,0.82)', size = 0.36 } = {}) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(28, 24, 200, 80, 40); g.fill();
  g.font = '700 54px "Cinzel", Georgia, serif';
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(size * 2, size, 1);
  s.renderOrder = 10;
  return s;
}

function hpSprite(hp, max) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const w = Math.min(36, 220 / max);
  const x0 = 128 - (w * max) / 2;
  for (let i = 0; i < max; i++) {
    g.fillStyle = i < hp ? '#ff3d9a' : 'rgba(40,20,30,0.7)';
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(x0 + i * w + 3, 18, w - 6, 26, 6); g.fill(); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(0.9, 0.225, 1);
  s.renderOrder = 11;
  return s;
}

export function createBoard(container, { assetBase = 'assets/', onHexClick, onHexHover, atmosphere = true, quality = 'high' } = {}) {
  // atmosphere: veins pulse, particles, fog, dust. quality 'high': glow + miniature blur, full figures.
  const opts = { atmosphere, quality };
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.quality === 'high' ? 2 : 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120d09');
  scene.fog = new THREE.Fog('#120d09', 18, 42);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(0, 8.6, 11.2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 26;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = 1.22;
  controls.screenSpacePanning = false;
  controls.target.set(0, 0, 0.9);
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  // lights
  const hemi = new THREE.HemisphereLight('#ffe7c2', '#2a1a10', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd9a0', 2.4);
  sun.position.set(-6, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(opts.quality === 'high' ? 2048 : 1024, opts.quality === 'high' ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const hearth = new THREE.PointLight('#ffa040', 6, 6, 1.6);
  hearth.position.set(0, 1.4, 0);
  scene.add(hearth);
  const LIGHT = {
    day: { hemi: '#ffe7c2', hemiI: 0.9, sun: '#ffd9a0', sunI: 2.4, bg: '#120d09', exp: 1.05 },
    night: { hemi: '#7d8fd6', hemiI: 0.35, sun: '#9fb4ff', sunI: 0.75, bg: '#070912', exp: 0.95 },
  };

  // table
  const table = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.82 }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -H / 2 - 0.001;
  table.receiveShadow = true;
  scene.add(table);

  // post-processing (high quality): a soft glow on bright things and a miniature-style blur at the edges
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.86);
  composer.addPass(bloom);
  const hBlur = new ShaderPass(HorizontalTiltShiftShader), vBlur = new ShaderPass(VerticalTiltShiftShader);
  hBlur.uniforms.r.value = vBlur.uniforms.r.value = 0.5;
  composer.addPass(hBlur); composer.addPass(vBlur);
  composer.addPass(new OutputPass());

  // atmosphere layers
  const particles = createParticles(scene);
  const dusts = new Set();

  // textures
  const loader = new THREE.TextureLoader();
  const texCache = {};
  const tex = (path) => {
    if (!texCache[path]) {
      const t = loader.load(assetBase + path);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texCache[path] = t;
    }
    return texCache[path];
  };
  const backMat = new THREE.MeshStandardMaterial({ map: tex('tiles/back.jpg'), roughness: 0.9 });
  const capGeo = capGeometry();
  const sideGeo = new THREE.CylinderGeometry(R, R, H, 6, 1, true, Math.PI / 2);
  const outlineGeo = (() => {
    const s = hexShape(R * 0.97);
    s.holes.push(hexShape(R * 0.86));
    return new THREE.ShapeGeometry(s);
  })();

  const tiles = {};
  const tileRoot = new THREE.Group();
  scene.add(tileRoot);

  function frontMaterial(t) {
    const path = t.biome === 'workshop' ? 'tiles/workshop.jpg' : `tiles/${t.biome}_${t.art}.jpg`;
    return new THREE.MeshStandardMaterial({ map: tex(path), roughness: 0.78 });
  }
  function sideColor(t, revealed) {
    if (!revealed) return new THREE.Color('#5c3c22');
    return new THREE.Color('#4a3020').lerp(new THREE.Color(BIOMES[t.biome].hue), 0.55);
  }

  function buildTile(k, t) {
    const g = new THREE.Group();
    g.position.copy(hexPos(k));
    // laid by hand: each tile sits a touch off-true
    const hk = hashKey(k);
    g.rotation.y = ((hk % 1000) / 1000 - 0.5) * 0.05;
    g.position.x += (((hk >> 10) % 100) / 100 - 0.5) * 0.03;
    g.position.z += (((hk >> 17) % 100) / 100 - 0.5) * 0.03;
    const flip = new THREE.Group();
    g.add(flip);
    const sideMat = new THREE.MeshStandardMaterial({ color: sideColor(t, t.revealed), roughness: 0.7 });
    const side = new THREE.Mesh(sideGeo, sideMat);
    side.castShadow = side.receiveShadow = true;
    flip.add(side);
    const front = new THREE.Mesh(capGeo, frontMaterial(t));
    front.rotation.x = -Math.PI / 2;
    front.position.y = H / 2 + 0.001;
    front.receiveShadow = true;
    flip.add(front);
    const back = new THREE.Mesh(capGeo, backMat);
    back.rotation.x = Math.PI / 2;
    back.position.y = -H / 2 - 0.001;
    back.receiveShadow = true;
    flip.add(back);
    // biome hue rim on the top face, so biomes read at a glance (as asked for the printed tiles)
    const rimMat = new THREE.MeshBasicMaterial({ color: BIOMES[t.biome].hue, transparent: true, opacity: 0.55 });
    const rim = new THREE.Mesh(outlineGeo, rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = H / 2 + 0.004;
    rim.scale.setScalar(1.0);
    flip.add(rim);
    flip.rotation.x = t.revealed ? 0 : Math.PI;
    [side, front, back].forEach((m) => { m.userData.key = k; });
    // corruption: dark rot and glowing veins creeping across the tile (hidden until corrupted)
    const blight = new THREE.Group();
    blight.visible = false;
    const vtex = veinTexture(hk);
    const rot = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({ map: vtex, color: '#1a0414', transparent: true, opacity: 0.7, depthWrite: false }));
    rot.rotation.set(-Math.PI / 2, 0, (hk % 6) * (Math.PI / 3));
    rot.position.y = H / 2 + 0.005;
    rot.scale.setScalar(1.06);
    const veins = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({ map: vtex, color: '#ff3da0', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    veins.rotation.copy(rot.rotation);
    veins.position.y = H / 2 + 0.007;
    const haze = glowSprite('#ff2f92', 1.4, 0.16);
    haze.position.y = 0.3;
    blight.add(rot, veins, haze);
    blight.userData.veins = veins;
    g.add(blight);
    // mist over the unknown
    const fog = makeFog(hk);
    fog.visible = !t.revealed && opts.atmosphere;
    g.add(fog);
    // harvest markers
    // snare marker
    const trap = new THREE.Group();
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 24), new THREE.MeshStandardMaterial({ color: '#b79a62', roughness: 0.9 }));
    rope.rotation.x = Math.PI / 2;
    rope.position.set(-0.45, H / 2 + 0.03, 0.35);
    trap.add(rope);
    for (let i = 0; i < 3; i++) {
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.22, 6), new THREE.MeshStandardMaterial({ color: '#5a3a22' }));
      const a = (i / 3) * Math.PI * 2;
      stake.position.set(-0.45 + Math.cos(a) * 0.16, H / 2 + 0.1, 0.35 + Math.sin(a) * 0.16);
      stake.castShadow = true;
      trap.add(stake);
    }
    trap.visible = false;
    g.add(trap);
    const harvest = new THREE.Group();
    g.add(harvest);
    // move highlight
    const hl = new THREE.Mesh(outlineGeo, new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.0, depthWrite: false }));
    hl.rotation.x = -Math.PI / 2;
    hl.position.y = H / 2 + 0.02;
    hl.scale.setScalar(1.02);
    g.add(hl);
    tileRoot.add(g);
    const obj = { k, g, flip, side, sideMat, front, rim, blight, fog, harvest, trap, hl, label: null, data: { ...t } };
    tiles[k] = obj;
    return obj;
  }

  function setHarvest(obj, level) {
    obj.harvest.clear();
    for (let i = 0; i < Math.min(level, 3); i++) {
      const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14),
        new THREE.MeshStandardMaterial({ color: i === 0 ? '#9a7b2f' : i === 1 ? '#8a5226' : '#5b2f20', roughness: 0.6 }));
      const a = Math.PI * (1.25 + i * 0.16);
      leaf.position.set(Math.cos(a) * 0.68, H / 2 + 0.03, Math.sin(a) * 0.68);
      leaf.castShadow = true;
      obj.harvest.add(leaf);
    }
  }

  function syncTile(k, t, animateFlip = false) {
    let obj = tiles[k];
    if (!obj) obj = buildTile(k, t);
    if (obj.data.art !== t.art || obj.data.biome !== t.biome) obj.front.material = frontMaterial(t);
    if (!animateFlip) obj.flip.rotation.x = t.revealed ? 0 : Math.PI;
    obj.sideMat.color.copy(sideColor(t, t.revealed));
    obj.rim.visible = t.revealed && t.biome !== 'workshop';
    obj.blight.visible = !!t.corrupted;
    obj.front.material.color.set(t.corrupted && t.biome !== 'corrupted' ? '#a8909c' : '#ffffff'); // corruption drains colour
    obj.fog.visible = !t.revealed && opts.atmosphere;
    obj.trap.visible = !!t.trap;
    if (obj.data.harvest !== t.harvest) setHarvest(obj, t.harvest);
    obj.data = { ...t };
  }

  async function flipTile(k) {
    const obj = tiles[k];
    if (!obj || obj.flip.rotation.x === 0) return;
    obj.sideMat.color.copy(sideColor(obj.data, true));
    await tween(700, (t) => {
      const e = ease(t);
      obj.flip.rotation.x = Math.PI * (1 - e);
      obj.flip.position.y = Math.sin(Math.PI * e) * 0.9;
    });
    obj.flip.position.y = 0;
    obj.rim.visible = obj.data.biome !== 'workshop';
    obj.fog.visible = false;
    if (opts.atmosphere) {
      const d = makeDust();
      d.position.copy(obj.g.position).setY(H / 2 + 0.05);
      d.userData.start = performance.now();
      scene.add(d);
      dusts.add(d);
    }
  }

  // ---------------- pieces
  const pieces = {};    // char → group
  const monsters = {};  // id → { g, hp }
  const pieceRoot = new THREE.Group();
  scene.add(pieceRoot);
  const activeRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.52, 40), new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  activeRing.rotation.x = -Math.PI / 2;
  activeRing.visible = false;
  scene.add(activeRing);

  function slotOffset(i, n, kind) {
    if (n <= 1) return kind === 'monster' ? new THREE.Vector3(0.22, 0, -0.18) : new THREE.Vector3(0, 0, 0.12);
    const a = (i / n) * Math.PI * 2 + (kind === 'monster' ? Math.PI : 0.4);
    const rr = kind === 'monster' ? 0.45 : n > 2 ? 0.5 : 0.38;
    return new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr);
  }
  function placeFor(state, kind, id) {
    if (kind === 'player') {
      const p = state.players.find((x) => x.char === id);
      const here = state.players.filter((x) => x.at === p.at);
      const mons = state.monsters.filter((m) => m.at === p.at).length;
      const off = slotOffset(here.indexOf(p), here.length + (mons ? 1 : 0), 'player');
      return hexPos(p.at).add(off).setY(H / 2);
    }
    const m = state.monsters.find((x) => x.id === id);
    const here = state.monsters.filter((x) => x.at === m.at);
    const pl = state.players.filter((x) => x.at === m.at).length;
    const off = here.length > 1 || pl ? slotOffset(here.indexOf(m), Math.max(2, here.length), 'monster') : new THREE.Vector3(0, 0, 0);
    return hexPos(m.at).add(off).setY(H / 2);
  }

  // Swap a monster's simple figure for its sculpted model once loaded (keeps its health pips).
  function upgradeMonster(o, kind) {
    const def = MONSTERS[kind];
    if (!def.model) return;
    loadFigure(assetBase + modelPath(def.model), def.size || 0.8, true).then((fig) => {
      if (!o.g.parent) return; // defeated before it finished loading
      o.g.clear();
      o.g.add(makeBlob(0.9));
      o.g.add(monsterBase(!!def.boss));
      fig.rotation.y = def.turn || 0;
      fig.position.y = 0.06;
      o.g.add(fig);
      const halo = glowSprite('#ff3d9a', 1.2, 0.18);
      halo.position.y = 0.35;
      o.g.add(halo);
      if (o.hpS) o.g.add(o.hpS);
    }).catch(() => { /* keep the simple figure */ });
  }

  // Low quality uses the light figures in models/lite/.
  const modelPath = (m) => (opts.quality === 'high' ? m : m.replace('models/', 'models/lite/'));

  function syncPieces(state) {
    for (const p of state.players || []) {
      let g = pieces[p.char];
      if (!g) {
        g = makeMushroomfolk(p.char, CHARACTERS[p.char]);
        g.add(makeBlob(0.8));
        g.scale.setScalar(1.15);
        pieces[p.char] = g;
        pieceRoot.add(g);
        const def = CHARACTERS[p.char];
        // Swap the simple figure for the sculpted one once it has loaded.
        if (def.model) loadFigure(assetBase + modelPath(def.model)).then((fig) => {
          const old = pieces[p.char];
          const ng = new THREE.Group();
          ng.add(makeBlob(0.8));
          ng.add(makeBase(def));
          fig.rotation.y = def.turn || 0; // each figure's own yaw, so it faces the players
          fig.position.y = 0.06;
          ng.add(fig);
          ng.scale.copy(old.scale);
          ng.position.copy(old.position);
          ng.rotation.copy(old.rotation);
          ng.userData = { ...old.userData };
          delete ng.userData.orb;
          pieceRoot.remove(old);
          pieceRoot.add(ng);
          pieces[p.char] = ng;
        }).catch(() => { /* keep the simple figure */ });
      }
      if (!g.userData.moving) g.position.copy(placeFor(state, 'player', p.char));
      g.rotation.z = p.lost ? Math.PI / 2.2 : 0;
      g.position.y = p.lost ? H / 2 + 0.12 : g.position.y;
      g.userData.lost = p.lost;
    }
    const live = new Set((state.monsters || []).map((m) => m.id));
    for (const [id, o] of Object.entries(monsters)) if (!live.has(id)) { pieceRoot.remove(o.g); delete monsters[id]; }
    for (const m of state.monsters || []) {
      let o = monsters[m.id];
      if (!o) {
        const g = makeMonster(m.kind);
        g.scale.multiplyScalar(1.3);
        o = monsters[m.id] = { g, hp: -1, hpS: null };
        pieceRoot.add(g);
        upgradeMonster(o, m.kind);
      }
      if (o.hp !== m.hp) {
        if (o.hpS) o.g.remove(o.hpS);
        o.hpS = hpSprite(m.hp, m.maxHp);
        o.hpS.position.y = m.kind === 'root-king' ? 1.5 : 0.82;
        o.g.add(o.hpS);
        o.hp = m.hp;
      }
      if (!o.g.userData.moving) o.g.position.copy(placeFor(state, 'monster', m.id));
    }
    const act = state.phase === 'playing' && state.players?.[state.turn];
    activeRing.visible = !!act;
    activeRing.userData.char = act ? act.char : null;
  }

  async function hop(g, from, to, height = 0.55, ms = 380) {
    g.userData.moving = true;
    const dir = to.clone().sub(from);
    if (dir.lengthSq() > 0.0001) g.rotation.y = Math.atan2(dir.x, dir.z);
    await tween(ms, (t) => {
      const e = ease(t);
      g.position.lerpVectors(from, to, e);
      g.position.y = from.y + Math.sin(Math.PI * t) * height;
    });
    g.position.copy(to);
    g.userData.moving = false;
  }

  // ---------------- dice
  const diceRoot = new THREE.Group();
  scene.add(diceRoot);
  async function rollDice(kind, faces, at, ms = 950) {
    diceRoot.clear();
    const center = at instanceof THREE.Vector3 ? at.clone().setY(0) : at ? hexPos(at) : controls.target.clone();
    const dice = faces.map((f, i) => {
      const d = makeDie(kind);
      const off = (i - (faces.length - 1) / 2) * 0.48;
      d.userData.target = center.clone().add(new THREE.Vector3(off + 0.55, H / 2 + 0.23, 0.6));
      d.userData.final = d.userData.faceFor(f).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.5));
      d.userData.spin = new THREE.Vector3(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7);
      d.position.copy(d.userData.target).add(new THREE.Vector3(-0.6 + Math.random() * 1.2, 2.4, 1.2));
      diceRoot.add(d);
      return d;
    });
    const start = dice.map((d) => d.position.clone());
    await tween(ms, (t) => {
      dice.forEach((d, i) => {
        const e = 1 - Math.pow(1 - t, 3);
        d.position.lerpVectors(start[i], d.userData.target, e);
        d.position.y = d.userData.target.y + Math.abs(Math.cos(t * Math.PI * 2.5)) * (1 - t) * 1.6;
        if (t < 0.7) {
          d.rotation.x += d.userData.spin.x * 0.016; d.rotation.y += d.userData.spin.y * 0.016; d.rotation.z += d.userData.spin.z * 0.016;
        } else d.quaternion.slerp(d.userData.final, (t - 0.7) / 0.3);
      });
    });
    dice.forEach((d) => d.quaternion.copy(d.userData.final));
  }
  function clearDice() { diceRoot.clear(); }

  // ---------------- highlights & picking
  let highlighted = {};
  function setHighlights(map) {
    for (const o of Object.values(tiles)) {
      o.hl.material.opacity = 0;
      if (o.label) { o.g.remove(o.label); o.label = null; }
    }
    highlighted = map || {};
    for (const [k, v] of Object.entries(highlighted)) {
      const o = tiles[k];
      if (!o) continue;
      o.hl.material.opacity = 0.85;
      o.hl.material.color.set(v.hurt ? '#ff5a7a' : v.unknown ? '#9fd8ff' : '#ffd36b');
      o.label = labelSprite(v.unknown ? '?' : String(v.cost) + (v.hurt ? ' \u2620' : ''), { size: 0.3, bg: v.hurt ? 'rgba(130,10,40,0.9)' : undefined });
      o.label.position.set(0, 0.35, -0.55);
      o.g.add(o.label);
    }
  }

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null, hoverKey = null;
  function pickKey(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(tileRoot.children, true);
    const h = hits.find((x) => x.object.userData.key);
    return h ? h.object.userData.key : null;
  }
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    const k = pickKey(e);
    if (k && onHexClick) onHexClick(k);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    const k = pickKey(e);
    if (k !== hoverKey) {
      if (hoverKey && tiles[hoverKey] && highlighted[hoverKey]) tiles[hoverKey].hl.material.opacity = 0.85;
      hoverKey = k;
      if (k && tiles[k] && highlighted[k]) tiles[k].hl.material.opacity = 1;
      renderer.domElement.style.cursor = k && highlighted[k] ? 'pointer' : 'grab';
      if (onHexHover) onHexHover(k);
    }
  });

  // ---------------- tweening + render loop
  const tweens = new Set();
  function tween(ms, fn) {
    return new Promise((resolve) => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = Math.min(ms, 120);
      tweens.add({ start: performance.now(), ms, fn, resolve });
    });
  }
  let lightTarget = LIGHT.day;
  const clock = new THREE.Clock();
  function frame() {
    const now = performance.now();
    for (const tw of [...tweens]) {
      const t = Math.min(1, (now - tw.start) / tw.ms);
      tw.fn(t);
      if (t >= 1) { tweens.delete(tw); tw.resolve(); }
    }
    const time = clock.getElapsedTime();
    // ease lights toward day/night
    hemi.color.lerp(new THREE.Color(lightTarget.hemi), 0.03);
    hemi.intensity += (lightTarget.hemiI - hemi.intensity) * 0.03;
    sun.color.lerp(new THREE.Color(lightTarget.sun), 0.03);
    sun.intensity += (lightTarget.sunI - sun.intensity) * 0.03;
    scene.background.lerp(new THREE.Color(lightTarget.bg), 0.03);
    scene.fog.color.copy(scene.background);
    hearth.intensity = 5 + Math.sin(time * 7) * 0.4 + Math.sin(time * 13) * 0.25;
    for (const o of Object.values(tiles)) {
      if (o.blight.visible) o.blight.userData.veins.material.opacity = opts.atmosphere ? 0.55 + Math.sin(time * 1.6 + o.g.position.x * 1.7) * 0.35 : 0.75;
      if (o.fog.visible) for (const f of o.fog.children) {
        f.position.x = Math.sin(time * 0.15 + f.userData.phase) * 0.12;
        f.rotation.z = time * 0.04 + f.userData.phase;
        f.material.opacity = 0.24 + Math.sin(time * 0.4 + f.userData.phase) * 0.07;
      }
    }
    if (opts.atmosphere) particles.update(time);
    for (const d of dusts) {
      const t = Math.min(1, (performance.now() - d.userData.start) / 900);
      for (const s of d.children) {
        s.position.copy(s.userData.dir).multiplyScalar(0.2 + ease(t) * 0.9);
        s.scale.setScalar(0.25 + t * 0.5);
        s.material.opacity = 0.5 * (1 - t);
      }
      if (t >= 1) { scene.remove(d); dusts.delete(d); }
    }
    if (activeRing.visible && pieces[activeRing.userData.char]) {
      const g = pieces[activeRing.userData.char];
      activeRing.position.set(g.position.x, H / 2 + 0.012, g.position.z);
      activeRing.material.opacity = 0.55 + Math.sin(time * 3) * 0.3;
      if (!g.userData.moving && !g.userData.lost) g.position.y = H / 2 + Math.abs(Math.sin(time * 2.4)) * 0.05;
    }
    for (const g of Object.values(pylons)) g.userData.crystal.rotation.y = time * 0.8;
    for (const g of Object.values(questFlags)) g.userData.flag.rotation.y = Math.sin(time * 2 + g.position.x) * 0.35;
    for (const g of Object.values(pieces)) if (g.userData.orb) g.userData.orb.material.emissiveIntensity = 2 + Math.sin(time * 3) * 0.6;
    // keep the camera over the table
    const t = controls.target;
    const lim = boardRadius() > 3 ? 9.5 : 7;
    t.x = Math.max(-lim, Math.min(lim, t.x)); t.z = Math.max(-lim, Math.min(lim, t.z)); t.y = 0;
    controls.update();
    if (opts.quality === 'high') composer.render(); else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    hBlur.uniforms.h.value = 1.6 / w;
    vBlur.uniforms.v.value = 1.6 / h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  requestAnimationFrame(frame);

  // ---------------- public API
  let current = null;
  // Outpost camps: a little tent, a lantern and a pennant in the builder's colour.
  const outposts = {};
  function makeOutpost(by) {
    const g = new THREE.Group();
    const canvas = new THREE.MeshStandardMaterial({ color: '#d8c49a', roughness: 0.9 });
    const tent = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 4), canvas);
    tent.rotation.y = Math.PI / 4;
    tent.position.y = 0.15;
    tent.castShadow = true;
    g.add(tent);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), new THREE.MeshStandardMaterial({ color: '#5a3a22' }));
    pole.position.set(0.2, 0.25, 0.05);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: CHARACTERS[by]?.base || '#d9a441', side: THREE.DoubleSide }));
    flag.position.set(0.28, 0.44, 0.05);
    g.add(flag);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.05), new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ffb347', emissiveIntensity: 1.8 }));
    lamp.position.set(-0.17, 0.05, 0.12);
    g.add(lamp);
    const halo = glowSprite('#ffae42', 0.5, 0.8);
    halo.position.copy(lamp.position);
    g.add(halo);
    return g;
  }
  function syncOutposts(state) {
    const want = state.outposts || {};
    for (const [k, g] of Object.entries(outposts)) if (!want[k]) { scene.remove(g); delete outposts[k]; }
    for (const [k, o] of Object.entries(want)) {
      if (outposts[k]) continue;
      const g = makeOutpost(o.by);
      g.position.copy(hexPos(k)).add(new THREE.Vector3(-0.45, H / 2, -0.35));
      scene.add(g);
      outposts[k] = g;
    }
  }


  // Quest banners: a gold pennant on a pole, glowing, over each active quest marker.
  const questFlags = {};
  function syncQuests(state) {
    const want = {};
    for (const q of state.quest?.active || []) if (q.at && !q.carrier) want[q.at] = q;
    for (const [k, g] of Object.entries(questFlags)) if (!want[k]) { scene.remove(g); delete questFlags[k]; }
    for (const k of Object.keys(want)) {
      if (questFlags[k]) continue;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.75, 8), new THREE.MeshStandardMaterial({ color: '#6b4a2b' }));
      pole.position.y = 0.375; pole.castShadow = true; g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshStandardMaterial({ color: '#e0b45a', emissive: '#a8741c', emissiveIntensity: 0.9, side: THREE.DoubleSide }));
      flag.position.set(0.16, 0.62, 0); g.add(flag);
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshStandardMaterial({ color: '#ffe7a8', emissive: '#ffcf6b', emissiveIntensity: 2 }));
      tip.position.y = 0.8; g.add(tip);
      const halo = glowSprite('#ffd36b', 0.9, 0.6); halo.position.y = 0.62; g.add(halo);
      g.position.copy(hexPos(k)).add(new THREE.Vector3(0.45, H / 2, 0.3));
      g.userData.flag = flag;
      scene.add(g);
      questFlags[k] = g;
    }
  }

  const pylons = {};
  function syncPylons(state) {
    const want = new Set(state.finale?.pylons || []);
    for (const [k, g] of Object.entries(pylons)) if (!want.has(k)) { scene.remove(g); delete pylons[k]; }
    for (const k of want) {
      if (pylons[k]) continue;
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: '#7fd8ff', emissive: '#2aa8ff', emissiveIntensity: 1.6, roughness: 0.2, transparent: true, opacity: 0.9 });
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat);
      c.scale.set(0.12, 0.5, 0.12);
      c.position.set(0.5, H / 2 + 0.55, -0.3);
      c.castShadow = true;
      g.add(c);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 6), new THREE.MeshStandardMaterial({ color: '#8a6a3a', metalness: 0.6, roughness: 0.4 }));
      base.position.set(0.5, H / 2 + 0.06, -0.3);
      g.add(base);
      const halo = glowSprite('#58c8ff', 1.4, 0.55);
      halo.position.set(0.5, H / 2 + 0.6, -0.3);
      g.add(halo);
      g.position.copy(hexPos(k));
      g.userData.crystal = c;
      scene.add(g);
      pylons[k] = g;
    }
  }

  function syncParticles(state) {
    particles.setVisible(opts.atmosphere);
    if (!opts.atmosphere || !state.tiles) return;
    const list = [];
    for (const [k, t] of Object.entries(state.tiles)) if (t.revealed) {
      const p = hexPos(k);
      list.push({ x: p.x, z: p.z, kind: t.corrupted && t.biome !== 'corrupted' ? 'blight' : t.biome });
    }
    particles.sync(list);
  }

  // Decks on the table's edge: Discovery, Weather and Night. Drawing lifts the top card.
  const deckRoot = new THREE.Group();
  scene.add(deckRoot);
  const decks = {};
  function cardBack(label, c1, c2) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 360;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 256, 360);
    grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    g.fillStyle = grd; g.fillRect(0, 0, 256, 360);
    g.strokeStyle = '#e0b45a'; g.lineWidth = 8; g.strokeRect(12, 12, 232, 336);
    g.lineWidth = 2; g.strokeRect(24, 24, 208, 312);
    g.beginPath(); g.arc(128, 160, 46, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(128, 160); g.lineTo(128 + Math.cos(a) * (i % 2 ? 30 : 58), 160 + Math.sin(a) * (i % 2 ? 30 : 58)); g.stroke(); }
    g.fillStyle = '#f3d48a'; g.font = '700 30px "Cinzel", Georgia, serif'; g.textAlign = 'center';
    g.fillText(label, 128, 290);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function buildDecks() {
    deckRoot.clear();
    const x = boardRadius() > 3 ? 8.3 : 6.6;
    const defs = [['discovery', 'Discovery', '#3b2a12', '#6b4a1e'], ['weather', 'Weather', '#1e3a4a', '#3d6a7a'], ['night', 'Night', '#141a3a', '#2c3466']];
    defs.forEach(([id, label, c1, c2], i) => {
      const back = new THREE.MeshStandardMaterial({ map: cardBack(label, c1, c2), roughness: 0.7 });
      const edge = new THREE.MeshStandardMaterial({ color: '#e9dcc0', roughness: 0.9 });
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 1.26), [edge, edge, back, edge, edge, edge]);
      stack.position.set(x, -H / 2 + 0.09, -1.6 + i * 1.6);
      stack.rotation.y = -0.12 + i * 0.08;
      stack.castShadow = stack.receiveShadow = true;
      deckRoot.add(stack);
      decks[id] = { stack, back };
    });
  }
  async function drawCard(kind) {
    const d = decks[kind];
    if (!d || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.26), new THREE.MeshStandardMaterial({ map: d.back.map, side: THREE.DoubleSide }));
    card.rotation.x = -Math.PI / 2;
    const from = d.stack.position.clone().setY(0.2);
    const to = camera.position.clone().lerp(controls.target, 0.55);
    card.position.copy(from);
    scene.add(card);
    await tween(420, (t) => {
      const e = ease(t);
      card.position.lerpVectors(from, to, e);
      card.position.y += Math.sin(Math.PI * t) * 0.8;
      card.rotation.x = -Math.PI / 2 + e * Math.PI * 0.9;
    });
    scene.remove(card);
    card.geometry.dispose(); card.material.dispose();
  }

  function setOptions(next) {
    const reload = next.quality && next.quality !== opts.quality;
    Object.assign(opts, next);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.quality === 'high' ? 2 : 1.25));
    resize();
    if (current) {
      for (const o of Object.values(tiles)) o.fog.visible = !o.data.revealed && opts.atmosphere;
      syncParticles(current);
      if (reload) { // swap figures to the matching detail level
        for (const g of Object.values(pieces)) pieceRoot.remove(g);
        for (const o of Object.values(monsters)) pieceRoot.remove(o.g);
        for (const k of Object.keys(pieces)) delete pieces[k];
        for (const k of Object.keys(monsters)) delete monsters[k];
        syncPieces(current);
      }
    }
  }

  function setState(state) {
    current = state;
    if (!state.tiles) return;
    useBoard(state);
    controls.maxDistance = boardRadius() > 3 ? 34 : 26;
    if (deckRoot.userData.r !== boardRadius()) { buildDecks(); deckRoot.userData.r = boardRadius(); }
    for (const k of allKeys()) syncTile(k, state.tiles[k]);
    syncPieces(state);
    lightTarget = LIGHT.day; // night lighting is off for now (LIGHT.night kept for later)
    syncPylons(state);
    syncOutposts(state);
    syncParticles(state);
    syncQuests(state);
  }

  // Replays one action's events, then lands on the final state.
  async function play(events, finalState, hooks = {}) {
    for (const e of events) {
      if (hooks.onEvent) await hooks.onEvent(e);
      if (e.t === 'reveal') {
        const obj = tiles[e.at];
        if (obj) {
          obj.data = { ...obj.data, biome: e.biome, art: e.art, revealed: true };
          obj.front.material = frontMaterial(obj.data);
          await flipTile(e.at);
        }
      } else if (e.t === 'move') {
        const g = pieces[e.who];
        if (!g) continue;
        for (const k of e.path) {
          const to = hexPos(k).setY(H / 2);
          await hop(g, g.position.clone(), to, e.panic ? 0.3 : 0.55, e.panic ? 260 : 360);
        }
      } else if (e.t === 'monsterMove') {
        const o = monsters[e.id];
        if (!o) continue;
        for (const st of e.steps) {
          await rollDice('move', [st.roll], o.g.position, 620);
          if (hooks.onMonsterStep) hooks.onMonsterStep(e, st);
          const from = o.g.position.clone();
          if (st.blocked) {
            const d = DIRS[st.roll - 1];
            const nudge = from.clone().add(new THREE.Vector3(d.dq * 0.25, 0, (d.dr + d.dq / 2) * 0.25));
            await hop(o.g, from, nudge, 0.15, 180);
            await hop(o.g, nudge, from, 0.1, 180);
          } else {
            await hop(o.g, from, hexPos(st.to).setY(H / 2), 0.4, 340);
          }
          if (st.hit) await shake(st.hit);
        }
        clearDice();
      } else if (e.t === 'spawn') {
        const g = makeMonster(e.kind);
        g.position.copy(hexPos(e.at)).setY(H / 2);
        g.scale.multiplyScalar(0.01);
        pieceRoot.add(g);
        monsters[e.id] = { g, hp: -1, hpS: null };
        upgradeMonster(monsters[e.id], e.kind);
        const target = (e.kind === 'root-king' ? 1.25 : 1) * 1.3;
        await tween(650, (t) => g.scale.setScalar(0.01 + ease(t) * target));
      } else if (e.t === 'corrupt') {
        const obj = tiles[e.at];
        if (obj) {
          obj.blight.visible = true;
          obj.blight.scale.setScalar(0.01);
          await tween(450, (t) => obj.blight.scale.setScalar(Math.max(0.01, ease(t))));
        }
      } else if (e.t === 'cleanse') {
        const obj = tiles[e.at];
        if (obj) { await tween(450, (t) => obj.blight.scale.setScalar(1 - ease(t))); obj.blight.visible = false; obj.blight.scale.setScalar(1); }
      } else if (e.t === 'dice') {
        const p = finalState.players.find((x) => x.char === e.who);
        await rollDice('risk', e.faces, p ? p.at : null);
        await wait(700);
        clearDice();
      } else if (e.t === 'kill') {
        const o = monsters[e.id];
        if (o) {
          await tween(500, (t) => { o.g.scale.setScalar(1 - ease(t)); o.g.rotation.y += 0.2; });
          pieceRoot.remove(o.g);
          delete monsters[e.id];
        }
      } else if (e.t === 'wander') {
        // A Lost friend stumbles across the board, rolled like a monster.
        const g = pieces[e.who];
        if (!g) continue;
        for (const st of e.steps) {
          await rollDice('move', [st.roll], g.position, 560);
          if (!st.blocked) await hop(g, g.position.clone(), hexPos(st.to).setY(H / 2 + 0.12), 0.25, 380);
          if (st.hit) await shake(st.hit);
        }
        clearDice();
      } else if (e.t === 'quest' || e.t === 'questDone' || e.t === 'questFail' || e.t === 'escort') {
        syncQuests(finalState);
      } else if (e.t === 'outpost') {
        syncOutposts({ outposts: { ...(current?.outposts || {}), ...finalState.outposts } });
      } else if (e.t === 'outpostLost') {
        if (outposts[e.at]) { scene.remove(outposts[e.at]); delete outposts[e.at]; }
      } else if (e.t === 'escape') {
        const o = monsters[e.id];
        if (o) {
          await tween(450, (t) => o.g.scale.setScalar(1.6 * (1 - ease(t)) + 0.01));
          o.g.position.copy(hexPos(e.at)).setY(H / 2);
          await tween(600, (t) => o.g.scale.setScalar(0.01 + ease(t) * 1.6));
        }
      } else if (e.t === 'trap') {
        if (tiles[e.at]) tiles[e.at].trap.visible = true;
      } else if (e.t === 'finale' && e.pylons) {
        syncPylons({ finale: { pylons: e.pylons } });
        await focus(e.pylons[0]);
        await wait(500);
        await focus(e.pylons[1]);
      } else if (e.t === 'strike') {
        const o = monsters[e.id];
        if (o) {
          const base = o.g.scale.x;
          await tween(260, (t) => o.g.scale.setScalar(base * (1 + Math.sin(Math.PI * t) * 0.35)));
          o.g.scale.setScalar(base);
        }
        await shake(e.hit);
      } else if (e.t === 'hurt') {
        const o = monsters[e.id];
        if (o) await shakeObj(o.g);
      } else if (e.t === 'life' && e.delta < 0) {
        await shake([e.who]);
      }
    }
    setState(finalState);
  }
  async function shake(chars) {
    await Promise.all(chars.map((c) => pieces[c] && shakeObj(pieces[c])));
  }
  async function shakeObj(g) {
    const x = g.position.x;
    await tween(320, (t) => { g.position.x = x + Math.sin(t * Math.PI * 8) * 0.06 * (1 - t); });
    g.position.x = x;
  }

  function focus(k, dist) {
    const p = hexPos(k);
    const from = controls.target.clone();
    const camOff = camera.position.clone().sub(controls.target);
    if (dist) camOff.setLength(dist);
    return tween(500, (t) => {
      controls.target.lerpVectors(from, p, ease(t));
      camera.position.copy(controls.target).add(camOff);
    });
  }
  function resetView() {
    const k = boardRadius() > 3 ? 1.3 : 1;
    controls.target.set(0, 0, 0.9);
    camera.position.set(0, 8.6 * k, 11.2 * k);
  }

  return { drawCard, setOptions, setState, play, setHighlights, focus, resetView, rollDice, clearDice, get state() { return current; } };
}
