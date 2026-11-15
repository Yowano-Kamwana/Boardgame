// The Figures: a turntable showcase of every sculpted miniature, opened from the title menu.
// Drag to turn a figure, scroll or pinch to zoom, arrows (or swipe) to move between them.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadFigure } from './models.js?v=19';
import { CHARACTERS, MONSTERS } from './data.js?v=19';

const FIGURES = [
  ...Object.entries(CHARACTERS).filter(([, c]) => c.model).map(([id, c]) => ({ id, name: c.name, sub: `${c.role} · Mushroomfolk`, model: c.model, turn: c.turn || 0, fit: false })),
  ...Object.entries(MONSTERS).filter(([, m]) => m.model).map(([id, m]) => ({ id, name: m.name, sub: m.boss ? 'The Ancient Horror' : `Monster · ${m.hp} health`, model: m.model, turn: m.turn || 0, fit: true, boss: !!m.boss })),
];

export function showGallery({ assetBase, quality = 'high', version = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'gallery';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', 'The Figures');
  wrap.innerHTML = `
    <div class="g-stage"></div>
    <header class="g-top"><div class="eyebrow">The Figures</div><button class="btn small g-close">Back</button></header>
    <div class="g-caption"><h2></h2><small></small><p class="g-load">Loading…</p></div>
    <button class="g-nav g-prev" aria-label="Previous figure">‹</button>
    <button class="g-nav g-next" aria-label="Next figure">›</button>
    <div class="g-dots"></div>
    <p class="g-hint">Drag to turn · scroll or pinch to zoom · ${quality === 'high' ? 'High detail' : 'Low detail (change in Settings)'}</p>`;
  document.body.append(wrap);
  const stage = wrap.querySelector('.g-stage');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color('#1a120b');
  scene.fog = new THREE.Fog('#1a120b', 4, 10);
  const key = new THREE.DirectionalLight('#ffe6c0', 2.4);
  key.position.set(2.5, 4, 3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -2; key.shadow.camera.right = key.shadow.camera.top = 2;
  const rim = new THREE.DirectionalLight('#9fb8ff', 1.2); rim.position.set(-3, 2.5, -3);
  scene.add(key, rim, new THREE.HemisphereLight('#ffeacc', '#2a1a10', 0.35));

  // a wooden plinth with a brass rim
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.9, 0.16, 64),
    new THREE.MeshStandardMaterial({ color: '#4a2e18', roughness: 0.6 }));
  plinth.position.y = -0.08; plinth.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.02, 12, 96), new THREE.MeshStandardMaterial({ color: '#c9a24f', metalness: 0.8, roughness: 0.3 }));
  ring.rotation.x = Math.PI / 2;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshStandardMaterial({ color: '#120c07', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.18; floor.receiveShadow = true;
  scene.add(plinth, ring, floor);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  camera.position.set(0, 1.1, 3.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 1.4; controls.maxDistance = 6;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 1.2;

  const holder = new THREE.Group();
  scene.add(holder);
  const caption = wrap.querySelector('.g-caption');
  const dots = wrap.querySelector('.g-dots');
  FIGURES.forEach((f, i) => {
    const d = document.createElement('button');
    d.setAttribute('aria-label', f.name);
    d.onclick = () => show(i);
    dots.append(d);
  });
  let index = 0, token = 0;
  const path = (m) => assetBase + (quality === 'high' ? m : m.replace('models/', 'models/lite/')) + version;
  async function show(i) {
    index = (i + FIGURES.length) % FIGURES.length;
    const f = FIGURES[index], my = ++token;
    caption.querySelector('h2').textContent = f.name;
    caption.querySelector('small').textContent = f.sub;
    caption.querySelector('.g-load').textContent = 'Loading…';
    caption.querySelector('.g-load').hidden = false;
    [...dots.children].forEach((d, j) => d.setAttribute('aria-current', String(j === index)));
    holder.clear();
    try {
      const fig = await loadFigure(path(f.model), f.boss ? 1.25 : 1.1, f.fit);
      if (my !== token) return;
      fig.rotation.y = f.turn;
      holder.add(fig);
      const box = new THREE.Box3().setFromObject(fig);
      controls.target.set(0, (box.max.y) * 0.48, 0);
      caption.querySelector('.g-load').hidden = true;
    } catch (e) {
      if (my === token) caption.querySelector('.g-load').textContent = 'This figure could not be loaded.';
    }
  }
  wrap.querySelector('.g-prev').onclick = () => show(index - 1);
  wrap.querySelector('.g-next').onclick = () => show(index + 1);
  let sx = null;
  stage.addEventListener('touchstart', (e) => { if (e.touches.length === 1) sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 90 && e.changedTouches.length === 1 && !controls.autoRotate) show(index + (dx < 0 ? 1 : -1));
  });
  const onKey = (e) => {
    if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'Escape') close();
  };
  addEventListener('keydown', onKey);

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.setLength(w < h ? 4.4 : 3.3);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();
  let alive = true;
  renderer.setAnimationLoop(() => { if (!alive) return; controls.update(); renderer.render(scene, camera); });
  function close() {
    alive = false; token++;
    renderer.setAnimationLoop(null);
    ro.disconnect(); removeEventListener('keydown', onKey);
    controls.dispose(); renderer.dispose(); pm.dispose();
    wrap.remove();
  }
  wrap.querySelector('.g-close').onclick = close;
  show(0);
  return close;
}
