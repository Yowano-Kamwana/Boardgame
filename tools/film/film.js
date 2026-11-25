// Scripted shots of the real game for the tutorial video. Each shot builds a game state with the
// real engine, plays real actions through the real board, and flies a scripted camera.
// tools/film/capture.mjs drives the virtual clock and saves one frame per step.
const V = '?v=23';
const THREE = await import('three');
const { createBoard, hexPos } = await import(`../../game/board3d.js${V}`);
const E = await import(`../../game/engine.js${V}`);

const params = new URLSearchParams(location.search);
const QUALITY = params.get('q') || 'high';
const cap = document.getElementById('cap');
const card = document.getElementById('card');

// ------------------------------------------------------------ camera paths
const v3 = (a) => new THREE.Vector3(...a);
const smooth = (t) => t * t * (3 - 2 * t);
let path = null; // { t0, keys: [{t, pos, look}] } times in ms from t0
function cam(keys) { path = { t0: performance.now(), keys: keys.map((k) => ({ t: k.t, pos: v3(k.pos), look: v3(k.look) })) }; }
// Orbit: angles in degrees around a centre at a height and radius, sampled into keys.
function orbit({ center = [0, 0, 0], r = 9, h = 6, from = 0, to = 40, ms = 10000, lookY = 0, r2 = r, h2 = h }) {
  const keys = [];
  for (let i = 0; i <= 12; i++) {
    const f = i / 12, a = ((from + (to - from) * f) * Math.PI) / 180, rr = r + (r2 - r) * f, hh = h + (h2 - h) * f;
    keys.push({ t: ms * f, pos: [center[0] + Math.sin(a) * rr, hh, center[2] + Math.cos(a) * rr], look: [center[0], lookY, center[2]] });
  }
  cam(keys);
}
let cine = null;
window.__beforeFrame = () => {
  if (!path || !cine) return;
  const t = performance.now() - path.t0, k = path.keys;
  let i = 0; while (i < k.length - 2 && t > k[i + 1].t) i++;
  const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
  const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
  // smoothstep only at the ends of the whole path, linear in between, so the motion never stalls
  const ease = (i === 0 && k.length > 2) ? f * f * (3 - 2 * f) * 0.5 + f * 0.5 : (i === k.length - 2 && k.length > 2) ? 1 - (1 - f) * (1 - f) * 0.5 - (1 - f) * 0.5 + (f * f * (3 - 2 * f) - f) * 0 : smooth(f);
  cine.camera.position.lerpVectors(a.pos, b.pos, k.length > 2 ? f : ease);
  cine.controls.target.lerpVectors(a.look, b.look, k.length > 2 ? f : ease);
  cine.camera.lookAt(cine.controls.target);
};

// ------------------------------------------------------------ captions and card overlay
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function fadeEl(el, from, to, ms, extra = () => {}) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) { const f = (performance.now() - t0) / ms; el.style.opacity = from + (to - from) * f; extra(f); await wait(16); }
  el.style.opacity = to; extra(1);
}
async function caption(kicker, title, holdMs = 3200) {
  cap.querySelector('.k').textContent = kicker;
  cap.querySelector('.t').textContent = title;
  fadeEl(cap, 0, 1, 500).then(() => wait(holdMs)).then(() => fadeEl(cap, 1, 0, 500));
}
async function showCard(src, holdMs = 3500) {
  card.src = src;
  await new Promise((r) => { if (card.complete) r(); else card.onload = r; });
  await fadeEl(card, 0, 1, 450, (f) => { card.style.transform = `translateY(-50%) scale(${0.9 + 0.1 * f})`; });
  await wait(holdMs);
  await fadeEl(card, 1, 0, 400);
}

// ------------------------------------------------------------ game states
const CHARS = ['mushy', 'bramblecap', 'morella', 'sporewick', 'thorncap'];
function newGame({ players = CHARS, seed = 1 } = {}) {
  let s = E.newLobby({ id: 'film', name: 'Film', hostUid: 'u', spawnEvery: 3, lives: 2, scenario: 'skyship' });
  for (const c of players) s = E.joinSeat(s, { uid: 'u', name: c[0].toUpperCase() + c.slice(1), char: c });
  s = E.startGame(s).state;
  E.useBoard(s);
  s.weather = 'clear-skies';
  window.__s = s;
  return s;
}
const ring = (n) => Object.keys(window.__s.tiles).filter((k) => E.dist(k, '0,0') === n);
function reveal(s, keys) { for (const k of keys) if (s.tiles[k]) s.tiles[k].revealed = true; }
function act(s, action) { const p = s.players[s.turn]; const r = E.act(s, p.char, action); return r.state; }

let board;
async function freshBoard(state) {
  document.getElementById('stage').innerHTML = '';
  board = createBoard(document.getElementById('stage'), { assetBase: '../../assets/', atmosphere: true, quality: QUALITY });
  cine = board.cine();
  window.__s = state;
  board.setState(state);
  await wait(2500); // let figures and textures arrive before the shot starts
}
async function play(prev, next) { await board.play(next.events || [], next); board.setState(next); return next; }

// ------------------------------------------------------------ shots
const shots = {};

// A lively mid-game board for flyovers.
function midGame() {
  const s = newGame();
  reveal(s, [...ring(1), ...ring(2)]);
  const r2 = ring(2);
  s.players[0].at = r2[0]; s.players[1].at = r2[3]; s.players[2].at = ring(1)[2]; s.players[3].at = '0,0'; s.players[4].at = r2[7];
  for (const k of [r2[5], ring(3)[9], ring(3)[10]]) if (s.tiles[k]) { s.tiles[k].revealed = true; s.tiles[k].corrupted = true; }
  s.horror = 5;
  s.monsters = [
    { id: 'm1', kind: 'corrupted-wolf', at: r2[5], hp: 2, maxHp: 2 },
    { id: 'm2', kind: 'crystal-husk', at: ring(3)[10], hp: 4, maxHp: 4 },
  ];
  return s;
}

shots.goal = async (ms) => {
  await freshBoard(midGame());
  orbit({ r: 12.5, h: 9.5, r2: 9, h2: 5.2, from: -30, to: 35, ms, lookY: 0 });
  caption('A cooperative game', 'Win or lose together', ms - 1800);
  await wait(ms);
};

shots.board = async (ms) => {
  const s = newGame(); reveal(s, ring(1));
  await freshBoard(s);
  cam([
    { t: 0, pos: [-7.5, 1.6, 6.5], look: [-1, 0.2, 0] },
    { t: ms * 0.5, pos: [0, 2.6, 6.2], look: [0, 0.2, 0] },
    { t: ms, pos: [7.5, 4.8, 5.5], look: [1, 0, -0.5] },
  ]);
  caption('The Everdeep', 'Explore the forest', 3500);
  await wait(ms);
};

shots.turn = async (ms) => {
  let s = newGame(); reveal(s, ring(1));
  await freshBoard(s);
  const p0 = s.players[0];
  const target = E.neighbors('0,0').find((k) => s.tiles[k]);
  const beyond = E.neighbors(target).find((k) => s.tiles[k] && !s.tiles[k].revealed && E.dist(k, '0,0') === 2);
  const tp = hexPos(target), bp = hexPos(beyond);
  cam([
    { t: 0, pos: [tp.x * 0.3 + 3.5, 3.6, tp.z * 0.3 + 5.5], look: [0, 0.3, 0] },
    { t: ms * 0.55, pos: [tp.x + 3, 2.8, tp.z + 4.2], look: [tp.x, 0.3, tp.z] },
    { t: ms, pos: [bp.x + 2.6, 2.3, bp.z + 3.6], look: [bp.x, 0.3, bp.z] },
  ]);
  caption('Your turn', 'Set out, then make two decisions', 4000);
  await wait(1500);
  s = await play(s, act(s, { type: 'fuel', how: 'food' }));
  await wait(1200);
  s = await play(s, act(s, { type: 'move', to: target }));
  await wait(Math.max(300, ms * 0.35));
  s = await play(s, act(s, { type: 'move', to: beyond }));
  await wait(Math.max(0, ms - (performance.now() - path.t0)));
};

shots.search = async (ms) => {
  let s = newGame(); reveal(s, ring(1));
  const k = ring(1).find((x) => s.tiles[x].biome === 'forest') || ring(1)[0];
  s.tiles[k].biome = 'forest'; s.players[0].at = k; s.players[0].turn.fueled = true;
  s.decks.forest.unshift('forgotten-orchard');
  await freshBoard(s);
  const p = hexPos(k);
  cam([{ t: 0, pos: [p.x + 3.2, 3.2, p.z + 4.4], look: [p.x, 0.2, p.z] }, { t: ms, pos: [p.x + 1.8, 2.4, p.z + 3.4], look: [p.x, 0.3, p.z] }]);
  caption('Search', 'Draw a Discovery card', 3000);
  await wait(900);
  board.drawCard('discovery');
  s = act(s, { type: 'search' });
  await wait(500);
  const cardShow = showCard('../../assets/cards/v2/forgotten-orchard.webp', Math.max(1500, ms - 4200));
  await play(s, s);
  await cardShow;
  await wait(Math.max(0, ms - (performance.now() - path.t0)));
};

shots.gather = async (ms) => {
  let s = newGame(); reveal(s, ring(1));
  const k = ring(1).find((x) => s.tiles[x].biome === 'forest') || ring(1)[1];
  s.tiles[k].biome = 'forest'; s.players[0].at = k; s.players[0].turn.fueled = true; s.players[0].turn.mp = 1;
  await freshBoard(s);
  const p = hexPos(k);
  cam([
    { t: 0, pos: [p.x + 2.8, 2.6, p.z + 3.8], look: [p.x, 0.3, p.z] },
    { t: ms * 0.45, pos: [p.x * 0.5 + 2.8, 3.4, p.z * 0.5 + 4.6], look: [p.x * 0.5, 0.3, p.z * 0.5] },
    { t: ms, pos: [2.4, 2.9, 3.6], look: [0, 0.4, 0] },
  ]);
  caption('Gather and build', 'Carry resources home to the Workshop', 4200);
  await wait(900);
  s = await play(s, act(s, { type: 'gather', option: 0 }));
  await wait(ms * 0.25);
  s = await play(s, act(s, { type: 'move', to: '0,0' }));
  await wait(Math.max(0, ms - (performance.now() - path.t0)));
};

shots.corrupt = async (ms) => {
  let s = newGame(['mushy', 'bramblecap']);
  reveal(s, [...ring(1), ...ring(2)]);
  s.players[0].at = ring(1)[0]; s.players[1].at = ring(1)[3];
  const seedK = ring(2)[4]; s.tiles[seedK].corrupted = true;
  s.horror = 2; s.spawnMarks = {};
  s.round = 2; // the next round is a Night
  await freshBoard(s);
  orbit({ r: 10.5, h: 8.5, r2: 8.5, h2: 6.2, from: 20, to: 70, ms, lookY: 0 });
  caption('The forest stirs', 'Corruption spreads; monsters wake', 4500);
  await wait(1500);
  for (let i = 0; i < 2 && s.phase === 'playing'; i++) {
    s = act(s, { type: 'endTurn' });
    await play(s, s);
  }
  await wait(Math.max(0, ms - (performance.now() - path.t0)));
};

shots.fight = async (ms) => {
  let s = newGame(['bramblecap', 'thorncap', 'mushy']);
  reveal(s, [...ring(1), ...ring(2)]);
  const mk = ring(2)[2];
  const near = E.neighbors(mk).filter((k) => s.tiles[k] && k !== '0,0');
  s.players[0].at = near[0]; s.players[1].at = near[1]; s.players[2].at = near[2] || near[0];
  for (const p of s.players) { p.turn = p.turn || { fueled: true, mp: 0, dec: 2 }; }
  s.players[0].turn.fueled = true;
  s.monsters = [{ id: 'm1', kind: 'shadow-stalker', at: mk, hp: 9, maxHp: 4, stuck: true }];
  await freshBoard(s);
  const p = hexPos(mk);
  cam([{ t: 0, pos: [p.x + 4.2, 3.4, p.z + 4.8], look: [p.x, 0.4, p.z] }, { t: ms, pos: [p.x + 2.2, 2.2, p.z + 3.2], look: [p.x, 0.5, p.z] }]);
  caption('Fight together', 'Every friend nearby adds a die', 3800);
  await wait(1600);
  s = act(s, { type: 'attack', id: 'm1' });
  await play(s, s);
  await wait(Math.max(0, ms - (performance.now() - path.t0)));
};

shots.cleanse = async (ms) => {
  let s = newGame(['sporewick', 'morella']);
  reveal(s, [...ring(1), ...ring(2)]);
  const k = ring(1)[4]; s.tiles[k].corrupted = true; if (s.tiles[k].biome === 'corrupted') s.tiles[k].biome = 'forest';
  s.players.forEach((pl) => { pl.bag.essence = 2; }); s.players[0].at = k; s.players[0].turn.fueled = true; s.players[1].at = ring(1)[3];
  s.horror = 7;
  await freshBoard(s);
  const p = hexPos(k);
  cam([{ t: 0, pos: [p.x + 2.4, 3.0, p.z + 3.6], look: [p.x, 0.2, p.z] }, { t: ms, pos: [p.x + 3.2, 2.0, p.z + 2.8], look: [p.x, 0.3, p.z] }]);
  caption('Cleanse the land', 'Push the Horror Track back', 3800);
  await wait(1800);
  s = act(s, { type: 'cleanse', at: k });
  await play(s, s);
  await wait(Math.max(0, ms - (performance.now() - path.t0)));
};

shots.king = async (ms) => {
  let s = newGame(['mushy', 'bramblecap', 'thorncap']);
  reveal(s, [...ring(1), ...ring(2), ...ring(3)]);
  const lands = Object.keys(s.tiles).filter((k) => s.tiles[k].biome === 'corrupted');
  const at = lands[0] || ring(3)[0];
  s.monsters = [{ id: 'mk', kind: 'root-king', at, hp: 6, maxHp: 6 }];
  for (const k of [at, ...E.neighbors(at)]) if (s.tiles[k]) { s.tiles[k].revealed = true; s.tiles[k].corrupted = true; }
  s.horror = 20;
  await freshBoard(s);
  const p = hexPos(at);
  cam([
    { t: 0, pos: [p.x * 0.2, 1.4, p.z * 0.2 + 2.5], look: [p.x * 0.6, 0.6, p.z * 0.6] },
    { t: ms, pos: [p.x * 0.55 + 1.2, 1.5, p.z * 0.55 + 1.6], look: [p.x, 1.0, p.z] },
  ]);
  caption('Horror 20', 'The Root King awakens', 4500);
  await wait(ms);
};

shots.win = async (ms) => {
  const s = newGame(); reveal(s, [...ring(1), ...ring(2)]);
  for (const p of s.players) p.at = '0,0';
  await freshBoard(s);
  orbit({ r: 3.6, h: 2.2, r2: 6.5, h2: 4.8, from: 140, to: 220, ms, lookY: 0.3 });
  caption('Build, gather, launch', 'Save the forest together', ms - 1600);
  await wait(ms);
};

shots.outro = async (ms) => {
  await freshBoard(midGame());
  orbit({ r: 7, h: 4, r2: 15, h2: 12, from: 200, to: 250, ms, lookY: 0 });
  await wait(ms);
};

// The heroes: a turntable of each sculpted figure, from the game's own gallery.
shots.heroes = async (ms) => {
  const { showGallery } = await import(`../../game/gallery.js${V}`);
  showGallery({ assetBase: '../../assets/', quality: QUALITY });
  const per = ms / 5;
  for (let i = 0; i < 5; i++) {
    if (i) document.querySelectorAll('.g-dots button')[i].click();
    await wait(per);
  }
};

window.film = {
  shots: Object.keys(shots),
  done: false,
  error: null,
  start(name, ms) {
    this.done = false;
    shots[name](ms).then(() => { this.done = true; }, (e) => { this.error = String(e && e.stack || e); this.done = true; });
  },
};
window.filmReady = true;
