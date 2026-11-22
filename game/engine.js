// Rootbound rules engine. Pure: act(state, seat, action) returns a new state plus the
// list of events that happened, which every client replays as animation.
import {
  RES, STACK, BAG_SLOTS, BAG_SLOTS_UPGRADED, MAX_LIVES, HORROR_MAX, BIOMES, TILE_MIX, CHARACTERS,
  DIRS, RISK_FACES, MONSTERS, SPAWN_ORDER, SCENARIOS, UPGRADES, CARDS, DECKS, WEATHER, CYCLE,
  MAX_SEATS, WORKSHOP, CRAFTS, MODES, OUTPOST,
  QUESTS, HORROR_QUESTS, QUEST_TILES, QUEST_MAX_ACTIVE, QUEST_TIMER, QUESTS_TO_WIN, RUMOURS, NIGHT, CHAIN, CHAIN_BIOME,
} from './data.js?v=23';

// The board's size depends on the game mode; every entry point sets it from the state.
let RADIUS = 3;
export const useBoard = (s) => { RADIUS = s?.radius || 3; };
export const boardRadius = () => RADIUS;
export const key = (q, r) => `${q},${r}`;
export const parse = (k) => k.split(',').map(Number);
export const dist = (a, b) => {
  const [q1, r1] = parse(a), [q2, r2] = parse(b);
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;
};
export const onBoard = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= RADIUS;
export const neighbors = (k) => {
  const [q, r] = parse(k);
  return DIRS.map((d) => [q + d.dq, r + d.dr]).filter(([a, b]) => onBoard(a, b)).map(([a, b]) => key(a, b));
};
export const allKeys = () => {
  const out = [];
  for (let q = -RADIUS; q <= RADIUS; q++)
    for (let r = -RADIUS; r <= RADIUS; r++) if (onBoard(q, r)) out.push(key(q, r));
  return out;
};
const HOME = key(0, 0);

let rnd = Math.random;
export const setRandom = (fn) => { rnd = fn; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const roll = () => 1 + Math.floor(rnd() * 6);
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const emptyBag = () => Object.fromEntries(RES.map((r) => [r, 0]));

export class RuleError extends Error {}
const fail = (msg) => { throw new RuleError(msg); };

// ---------------------------------------------------------------- setup
export function newLobby({ id, name, hostUid, spawnEvery = 3, lives = MAX_LIVES, hunger = 'rep', scenario = 'skyship', mode = 'standard', quests = false }) {
  return {
    v: 3, id, name, hostUid, phase: 'lobby', created: Date.now(), updated: Date.now(),
    settings: { spawnEvery, lives, hunger, scenario: SCENARIOS[scenario] ? scenario : 'skyship', mode: MODES[mode] ? mode : 'standard', quests: !!quests },
    seats: [], // { uid, name, char }
    seq: 0, events: [], log: [],
  };
}

export function joinSeat(state, { uid, name, char, ai = false }) {
  const s = structuredClone(state);
  if (s.phase !== 'lobby') fail('This expedition has already set out.');
  if (!CHARACTERS[char]) fail('Unknown character.');
  if (s.seats.some((x) => x.char === char)) fail(`${CHARACTERS[char].name} is already taken.`);
  if (s.seats.length >= MAX_SEATS) fail('Every Mushroomfolk is taken.');
  s.seats.push({ uid: ai ? 'ai' : uid, ai, name: ai ? `${CHARACTERS[char].name} (AI)` : (name || '').trim().slice(0, 24) || CHARACTERS[char].name, char });
  s.updated = Date.now();
  return s;
}

export function leaveSeat(state, char) {
  const s = structuredClone(state);
  if (s.phase !== 'lobby') fail('The expedition has already set out.');
  s.seats = s.seats.filter((x) => x.char !== char);
  s.updated = Date.now();
  return s;
}

function buildMap(mix) {
  const ring = allKeys().filter((k) => k !== HOME);
  let bag = [];
  for (const [b, n] of Object.entries(mix)) for (let i = 0; i < n; i++) bag.push(b);
  bag = shuffle(bag);
  const tiles = {};
  ring.forEach((k, i) => { tiles[k] = { biome: bag[i] }; });
  const inner = ring.filter((k) => dist(k, HOME) === 1);
  const outer = ring.filter((k) => dist(k, HOME) > 1);
  // Keep Corrupted Lands away from home, and make sure home has at least 2 Forests and a Ruins or Crystal.
  const swapInto = (k, pred) => {
    if (!k) return;
    const donor = shuffle(outer).find((o) => pred(tiles[o].biome));
    if (donor) [tiles[k].biome, tiles[donor].biome] = [tiles[donor].biome, tiles[k].biome];
  };
  for (const k of inner) if (tiles[k].biome === 'corrupted') swapInto(k, (b) => b !== 'corrupted');
  const count = (b) => inner.filter((k) => tiles[k].biome === b).length;
  for (const k of inner) {
    if (count('forest') >= 2) break;
    if (tiles[k].biome !== 'forest') swapInto(k, (b) => b === 'forest');
  }
  if (!inner.some((k) => ['ruins', 'crystal'].includes(tiles[k].biome)))
    swapInto(inner.find((k) => tiles[k].biome !== 'forest'), (b) => b === 'ruins' || b === 'crystal');
  for (const k of ring) {
    const t = tiles[k];
    Object.assign(t, { art: 1 + Math.floor(rnd() * BIOMES[t.biome].art), revealed: false,
      corrupted: t.biome === 'corrupted', harvest: 0, searched: 0 });
  }
  tiles[HOME] = { biome: 'workshop', art: 1, revealed: true, corrupted: false, harvest: 0, searched: 0 };
  const startReveal = shuffle(inner).slice(0, 4);
  for (const k of startReveal) tiles[k].revealed = true;
  return tiles;
}

export function startGame(state) {
  const s = structuredClone(state);
  if (s.phase !== 'lobby') fail('Already started.');
  if (!s.seats.length) fail('At least one Mushroomfolk must join.');
  s.phase = 'playing';
  const mode = MODES[s.settings.mode || 'standard'];
  s.radius = mode.radius;
  useBoard(s);
  s.tiles = buildMap(mode.mix);
  s.outposts = {};
  s.players = s.seats.map((seat) => ({
    char: seat.char, name: seat.name, uid: seat.uid, ai: !!seat.ai, at: HOME, lives: s.settings.lives, lost: false,
    rep: 0, level: 0, fear: 0, bag: { ...emptyBag(), food: 2 }, slots: BAG_SLOTS, turn: null,
  }));
  s.upgrades = {};
  s.finale = null;
  s.found = Object.fromEntries(Object.values(s.tiles).filter((t) => t.revealed).map((t) => [t.biome, 'start']));
  s.storage = { ...emptyBag(), food: 2, wood: 1 };
  s.built = {};
  s.monsters = [];
  s.monsterSeq = 0;
  s.spawned = 0;
  s.horror = 0;
  s.rootKing = false;
  const decks = structuredClone(DECKS);
  if (s.settings.quests) {
    for (const [b, ids] of Object.entries(RUMOURS)) decks[b].push(...ids);
    // Quest marks hide under tile backs: unrevealed, not Corrupted Lands.
    const cands = shuffle(allKeys().filter((k) => k !== HOME && !s.tiles[k].revealed && s.tiles[k].biome !== 'corrupted'));
    for (const k of cands.slice(0, QUEST_TILES[s.settings.mode || 'standard'] || 6)) s.tiles[k].questMark = true;
    s.quest = { deck: shuffle(Object.keys(QUESTS).filter((id) => !Object.values(HORROR_QUESTS).some((h) => h.id === id))), active: [], done: 0, failed: 0, fired: {}, seq: 0, chain: 0 };
  }
  s.decks = Object.fromEntries(Object.entries(decks).map(([k, v]) => [k, shuffle(v)]));
  s.discards = Object.fromEntries(Object.keys(DECKS).map((k) => [k, []]));
  s.weatherDeck = shuffle(Object.keys(WEATHER));
  s.nightDeck = shuffle(Object.keys(NIGHT));
  s.night = null;
  s.round = 0;
  s.pending = null;
  s.result = null;
  const ev = [];
  log(s, 'The expedition sets out from the Workshop.');
  beginRound(s, ev);
  return finish(s, ev);
}

// ---------------------------------------------------------------- helpers
function log(s, text) {
  s.log.push({ r: s.round || 0, text });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
}
function finish(s, ev) {
  s.seq = (s.seq || 0) + 1;
  s.events = ev;
  s.updated = Date.now();
  return { state: s, events: ev };
}
export const slotsUsed = (bag) => RES.reduce((n, r) => n + Math.ceil((bag[r] || 0) / STACK[r]), 0);
export const canHold = (p, res) => {
  const b = { ...p.bag, [res]: (p.bag[res] || 0) + 1 };
  return slotsUsed(b) <= p.slots;
};
export const phaseOf = (s) => CYCLE[(s.round - 1) % CYCLE.length];
export const weatherMods = (s) => (s.weather ? WEATHER[s.weather].mods : {});
export const monstersAt = (s, k) => s.monsters.filter((m) => m.at === k);
export const playersAt = (s, k) => s.players.filter((p) => p.at === k);
export const isCorrupt = (s, k) => !!s.tiles[k]?.corrupted;
export const activePlayer = (s) => s.players[s.turn];
export const maxLives = (s) => s.settings.lives || MAX_LIVES;

function gain(s, p, res, n, ev, why) {
  if (res === 'food' && weatherMods(s).noFood) { if (n > 0) log(s, `${p.name} can't gather Food in the heatwave.`); return 0; }
  let got = 0;
  for (let i = 0; i < n; i++) { if (!canHold(p, res)) break; p.bag[res]++; got++; }
  if (got) ev.push({ t: 'gain', who: p.char, res, n: got });
  if (got < n) log(s, `${p.name}'s backpack is full: ${n - got} ${res} left behind.`);
  return got;
}

// Missing anything costs Reputation. Missing Food costs a life — or, with the
// "Reputation first" hunger rule, Reputation while you have any, then a life.
function lose(s, p, res, n, ev) {
  for (let i = 0; i < n; i++) {
    if (p.bag[res] > 0) { p.bag[res]--; ev.push({ t: 'lose', who: p.char, res, n: 1 }); }
    else if (res === 'food' && (s.settings.hunger === 'life' || p.rep === 0)) {
      log(s, `${p.name} had no Food to give up and loses a life.`); loseLife(s, p, 1, ev);
    } else if (p.rep > 0) {
      p.rep--; ev.push({ t: 'rep', who: p.char, delta: -1 });
      log(s, `${p.name} had no ${res} and loses 1 Reputation.`);
    }
  }
}
function loseRandom(s, p, ev) {
  const have = RES.filter((r) => p.bag[r] > 0);
  if (!have.length) { if (p.rep > 0) { p.rep--; log(s, `${p.name} had nothing to lose and loses 1 Reputation.`); } return; }
  const r = pick(have);
  p.bag[r]--; ev.push({ t: 'lose', who: p.char, res: r, n: 1 });
}

function loseLife(s, p, n, ev) {
  if (p.lost) return;
  p.lives = Math.max(0, p.lives - n);
  ev.push({ t: 'life', who: p.char, delta: -n, lives: p.lives });
  if (p.lives === 0) {
    p.lost = true;
    p.fear = 0;
    log(s, `${p.name} is Lost! The ground where they fell turns dark.`);
    ev.push({ t: 'lost', who: p.char, at: p.at });
    corruptTile(s, p.at, ev, 'lost');
    if (s.players.every((x) => x.lost)) endGame(s, ev, 'lost', 'Every Mushroomfolk is Lost in the Everdeep.');
  }
}

function endGame(s, ev, result, reason) {
  if (s.phase !== 'playing') return;
  s.phase = 'over';
  s.result = { result, reason };
  log(s, reason);
  ev.push({ t: 'end', result, reason });
}

function corruptTile(s, k, ev, why) {
  const t = s.tiles[k];
  if (!t || t.biome === 'workshop' || t.corrupted) return false;
  t.corrupted = true;
  s.horror++;
  if (s.outposts?.[k]) {
    delete s.outposts[k];
    ev.push({ t: 'outpostLost', at: k });
    log(s, 'Corruption swallows an Outpost and everything stored in it.');
  }
  ev.push({ t: 'corrupt', at: k, horror: s.horror, why });
  log(s, `Corruption spreads (${s.horror}/${HORROR_MAX}).`);
  horrorRose(s, k, ev);
  return true;
}
// What follows every step up the Horror Track: monsters, Root King quests, the King himself.
function horrorRose(s, k, ev) {
  // Each spawn mark wakes a monster once: cleansing back below a mark and passing it again does not.
  s.spawnMarks ||= {};
  if (s.horror % s.settings.spawnEvery === 0 && s.horror < HORROR_MAX && !s.spawnMarks[s.horror]) { s.spawnMarks[s.horror] = true; spawnMonster(s, ev); }
  if (s.quest) for (const [mark, hq] of Object.entries(HORROR_QUESTS))
    if (s.horror >= +mark && !s.quest.fired[mark]) { s.quest.fired[mark] = true; openQuest(s, hq.id, k, ev, { force: true }); }
  if (s.horror >= HORROR_MAX && !s.rootKing) awakenRootKing(s, ev);
}

// Cleansing pushes the Horror Track back one step.
function lowerHorror(s, ev) {
  if (s.horror <= 0) return;
  s.horror--;
  ev.push({ t: 'horror', horror: s.horror, delta: -1 });
  log(s, `The Horror Track falls back (${s.horror}/${HORROR_MAX}).`);
}

// Fear: harmless until the third, then panic — lose a life, flee to a neighbouring tile, and the Fear is spent.
export const FEAR_MAX = 3;
function addFear(s, p, n, ev) {
  if (p.lost) return;
  const before = p.fear || 0;
  p.fear = Math.max(0, before + n);
  if (p.fear === before) return;
  ev.push({ t: 'fear', who: p.char, delta: p.fear - before, fear: Math.min(p.fear, FEAR_MAX) });
  log(s, n > 0 ? `${p.name} is gripped by Fear (${Math.min(p.fear, FEAR_MAX)}/${FEAR_MAX}).` : `${p.name} shakes off some Fear.`);
  if (p.fear >= FEAR_MAX) {
    p.fear = 0;
    log(s, `${p.name} panics!`);
    ev.push({ t: 'panic', who: p.char });
    loseLife(s, p, 1, ev);
    if (!p.lost && s.phase === 'playing') flee(s, p, ev);
  }
}
function flee(s, p, ev) {
  const to = neighbors(p.at).filter((k) => s.tiles[k].revealed && !monstersAt(s, k).length);
  const clean = to.filter((k) => !s.tiles[k].corrupted);
  if (!to.length) return;
  p.at = pick(clean.length ? clean : to);
  ev.push({ t: 'move', who: p.char, path: [p.at], panic: true });
  log(s, `${p.name} panics and flees!`);
  corruptionBites(s, p, p.at, ev);
}

function spreadCorruption(s, ev) {
  const keys = allKeys().filter((k) => k !== HOME && !s.tiles[k].corrupted);
  if (!keys.length) return;
  const edge = keys.filter((k) => neighbors(k).some((n) => s.tiles[n].corrupted));
  corruptTile(s, pick(edge.length ? edge : keys), ev, 'spread');
}

function spawnMonster(s, ev, kind, near) {
  kind = kind || SPAWN_ORDER[s.spawned % SPAWN_ORDER.length];
  let spots;
  if (near) spots = neighbors(near).filter((k) => k !== HOME);
  else {
    const corrupt = allKeys().filter((k) => s.tiles[k].corrupted && k !== HOME);
    const empty = corrupt.filter((k) => !playersAt(s, k).length && !monstersAt(s, k).length);
    const far = empty.filter((k) => dist(k, HOME) >= 2);
    spots = far.length ? far : empty.length ? empty : corrupt;
  }
  if (!spots.length) return;
  const at = pick(spots);
  const m = { id: `m${++s.monsterSeq}`, kind, at, hp: MONSTERS[kind].hp, maxHp: MONSTERS[kind].hp };
  s.monsters.push(m);
  s.spawned++;
  ev.push({ t: 'spawn', id: m.id, kind, at });
  log(s, `${MONSTERS[kind].name} crawls out of the corruption.`);
}

function awakenRootKing(s, ev) {
  s.rootKing = true;
  const lands = allKeys().filter((k) => s.tiles[k].biome === 'corrupted');
  const at = pick(lands.length ? lands : allKeys().filter((k) => k !== HOME && s.tiles[k].corrupted));
  const m = { id: `m${++s.monsterSeq}`, kind: 'root-king', at, hp: MONSTERS['root-king'].hp, maxHp: MONSTERS['root-king'].hp };
  s.monsters.push(m);
  ev.push({ t: 'spawn', id: m.id, kind: 'root-king', at, boss: true });
  log(s, 'The Horror Track reaches 20. THE ROOT KING AWAKENS. If it reaches the Workshop, all is lost.');
}

function revealTile(s, k, ev, who, chain = true) {
  const t = s.tiles[k];
  if (t.revealed) return;
  t.revealed = true;
  ev.push({ t: 'reveal', at: k, biome: t.biome, art: t.art, who });
  log(s, `${who ? s.players.find((p) => p.char === who).name + ' discovers' : 'Revealed:'} ${BIOMES[t.biome].name}.`);
  const p = who && s.players.find((x) => x.char === who);
  if (s.quest && t.questMark) {
    t.questMark = false;
    log(s, 'A quest mark is uncovered!');
    openQuest(s, s.quest.deck.shift(), k, ev);
  }
  if (p) questProgress(s, 'explore', p, ev);
  // Landmark: the first Mushroomfolk to find each biome earns Reputation.
  s.found ||= {};
  if (p && !s.found[t.biome] && t.biome !== 'corrupted') {
    s.found[t.biome] = p.char;
    p.rep++; ev.push({ t: 'rep', who: p.char, delta: 1 });
    log(s, `${p.name} is the first to chart the ${BIOMES[t.biome].name}: +1 Reputation.`);
  }
  if (chain && p?.char === 'mushy' && p.level >= 2) {
    const next = neighbors(k).filter((n) => !s.tiles[n].revealed);
    if (next.length) revealTile(s, pick(next), ev, who, false);
  }
}

// ---------------------------------------------------------------- quests
export const partCost = (s, part) => s.settings?.quests ? { ...part.cost, artifact: Math.max(1, part.cost.artifact || 0) } : part.cost;
export const questsOk = (s) => !s.settings?.quests || (s.quest?.done || 0) >= QUESTS_TO_WIN;

// The rim tile on the straight line from the Workshop through `origin` (random line if at home).
function edgeInLine(s, origin) {
  let [q, r] = parse(origin);
  if (q === 0 && r === 0) { const d = pick(DIRS); q = d.dq; r = d.dr; }
  const t = RADIUS / dist(origin === HOME ? key(q, r) : origin, HOME);
  let x = q * t, z = r * t, y = -x - z;
  let rx = Math.round(x), rz = Math.round(z), ry = Math.round(y);
  const dx = Math.abs(rx - x), dz = Math.abs(rz - z), dy = Math.abs(ry - y);
  if (dx > dz && dx > dy) rx = -rz - ry; else if (dz > dy) rz = -rx - ry;
  const k = key(rx, rz);
  return onBoard(rx, rz) && k !== HOME ? k : origin;
}

function questTarget(s, where, origin) {
  if (!where) return null;
  if (where === 'here') return origin;
  if (where.edge) return edgeInLine(s, origin);
  const all = allKeys().filter((k) => k !== HOME && k !== origin && !s.tiles[k].corrupted && !s.quest.active.some((q) => q.at === k));
  const far = all.filter((k) => dist(k, origin) >= (where.far || 1));
  const biome = far.filter((k) => !where.biome || s.tiles[k].biome === where.biome);
  return pick(biome.length ? biome : far.length ? far : all) || origin;
}

function openQuest(s, id, origin, ev, { force = false } = {}) {
  const def = QUESTS[id];
  if (!def) return;
  if (!force && s.quest.active.filter((q) => !q.horror).length >= QUEST_MAX_ACTIVE) {
    log(s, `${def.title}: the party already has ${QUEST_MAX_ACTIVE} quests, so this one is set aside.`);
    return;
  }
  const q = { qid: `q${++s.quest.seq}`, id, kind: def.kind, at: questTarget(s, def.where, origin), progress: 0,
    goal: def.goal || 1, deadline: s.round + (def.timer || QUEST_TIMER), carrier: null, monster: null, horror: !!def.horrorBack };
  if (def.spawn && q.at) {
    const m = { id: `m${++s.monsterSeq}`, kind: def.spawn, at: q.at, hp: MONSTERS[def.spawn].hp, maxHp: MONSTERS[def.spawn].hp };
    s.monsters.push(m); s.spawned++;
    q.monster = m.id;
    ev.push({ t: 'spawn', id: m.id, kind: def.spawn, at: q.at });
  }
  s.quest.active.push(q);
  ev.push({ t: 'quest', id, qid: q.qid, at: q.at });
  log(s, `Quest: ${def.title}. ${def.text} (${q.deadline - s.round} rounds)`);
}

function completeQuest(s, q, p, ev) {
  const def = QUESTS[q.id];
  s.quest.active = s.quest.active.filter((x) => x !== q);
  s.quest.done++;
  if (p && canHold(p, 'artifact')) { p.bag.artifact++; ev.push({ t: 'gain', who: p.char, res: 'artifact', n: 1 }); }
  else s.storage.artifact++;
  if (p) { p.rep++; ev.push({ t: 'rep', who: p.char, delta: 1 }); }
  if (def.horrorBack) s.horror = Math.max(0, s.horror - def.horrorBack);
  ev.push({ t: 'questDone', id: q.id, qid: q.qid, who: p?.char, done: s.quest.done });
  log(s, `Quest complete: ${def.title}! ${p ? p.name + ' gains' : 'The Workshop receives'} an Artifact. (${s.quest.done}/${QUESTS_TO_WIN} quests)`);
  if (def.bonus === 'reveal') {
    const hidden = allKeys().filter((k) => !s.tiles[k].revealed).sort((a, b) => dist(a, q.at || HOME) - dist(b, q.at || HOME));
    for (const k of hidden.slice(0, 3)) revealTile(s, k, ev, p?.char, false);
  }
  if (def.bonus === 'monster' && q.at) spawnMonster(s, ev, 'shadow-stalker', q.at);
}

function questProgress(s, kind, p, ev, monsterId) {
  if (!s.quest) return;
  for (const q of s.quest.active.slice()) {
    if (q.kind !== kind) continue;
    if (kind === 'slay' && q.monster && q.monster !== monsterId) continue;
    q.progress++;
    if (q.progress >= q.goal) completeQuest(s, q, p, ev);
  }
}

function questsEndOfRound(s, ev) {
  if (!s.quest) return;
  for (const q of s.quest.active.slice()) {
    const carrier = q.carrier && s.players.find((x) => x.char === q.carrier);
    const dropped = carrier && carrier.lost;
    if (s.round < q.deadline && !dropped) continue;
    s.quest.active = s.quest.active.filter((x) => x !== q);
    s.quest.failed++;
    ev.push({ t: 'questFail', id: q.id, qid: q.qid });
    log(s, `Quest failed: ${QUESTS[q.id].title}. The forest grows darker.`);
    spreadCorruption(s, ev);
    if (q.horror && s.phase === 'playing') spawnMonster(s, ev);
  }
}

// ---------------------------------------------------------------- rounds & turns
function beginRound(s, ev) {
  s.round++;
  const id = drawWeather(s);
  s.weather = id;
  const phase = phaseOf(s);
  ev.push({ t: 'round', round: s.round, phase, weather: id });
  log(s, `Round ${s.round} — ${phase === 'night' ? 'Night falls' : 'Day'}. Weather: ${WEATHER[id].title}.`);
  const any = s.players.find((p) => !p.lost);
  if (any) applyFx(s, any, WEATHER[id].now, ev, { source: 'weather' });
  s.night = null;
  if (phase === 'night' && s.phase === 'playing') {
    if (!s.nightDeck?.length) s.nightDeck = shuffle(Object.keys(NIGHT));
    s.night = s.nightDeck.shift();
    ev.push({ t: 'night', id: s.night });
    log(s, `Night card: ${NIGHT[s.night].title}. ${NIGHT[s.night].text}`);
    const anyone = s.players.find((p) => !p.lost);
    if (anyone && NIGHT[s.night].now) applyFx(s, anyone, NIGHT[s.night].now, ev, { source: 'night' });
  }

  s.turn = -1;
  nextTurn(s, ev);
}

function drawWeather(s) {
  if (!s.weatherDeck.length) s.weatherDeck = shuffle(Object.keys(WEATHER));
  return s.weatherDeck.shift();
}

function nextTurn(s, ev) {
  if (s.phase !== 'playing') return;
  for (let i = s.turn + 1; i < s.players.length; i++) {
    if (!s.players[i].lost) {
      s.turn = i;
      s.players[i].turn = { fueled: false, mp: 0, dec: 2, trailblazed: false, sureFooted: false, freeSearch: false, converted: false, slow: s.players[i].slowNext || 0 };
      s.players[i].slowNext = 0;
      ev.push({ t: 'turn', who: s.players[i].char });
      return;
    }
  }
  endRound(s, ev);
}

function endRound(s, ev) {
  ev.push({ t: 'stir', phase: phaseOf(s) });
  const few = s.players.length <= 2;
  const spreads = phaseOf(s) === 'night' ? (few ? 1 : 2) : (few ? 0 : 1);
  for (let i = 0; i < spreads && s.phase === 'playing'; i++) spreadCorruption(s, ev);
  const extra = weatherMods(s).monsterRolls || 0;
  for (const m of s.monsters.slice()) {
    if (s.phase !== 'playing') break;
    moveMonster(s, m, 3 + extra, ev);
  }
  // The Lost are not still: the forest walks them, and they lash out at anyone they meet.
  for (const p of s.players.filter((x) => x.lost)) {
    if (s.phase !== 'playing') break;
    wander(s, p, 3, ev);
  }
  // Harvested land no longer recovers overnight: the forest doesn't give forever.
  if (s.phase === 'playing') questsEndOfRound(s, ev);
  if (s.phase === 'playing' && s.finale?.pylons) {
    const held = s.finale.pylons.every((k) => !s.tiles[k].corrupted && playersAt(s, k).some((p) => !p.lost));
    if (held) {
      s.finale.held++;
      ev.push({ t: 'pylons', held: s.finale.held });
      log(s, `The Pylons hold! (${s.finale.held}/3 rounds)`);
      if (s.finale.held >= 3 && questsOk(s)) endGame(s, ev, 'won', 'The Weather Engine roars to life. Clean rain washes the corruption from the Everdeep.');
      else if (s.finale.held >= 3) log(s, `The Engine is ready, but the forest still needs your help: complete ${QUESTS_TO_WIN} quests.`);
    } else log(s, 'The Pylons stand unguarded (or corrupted) this round.');
  }
  if (s.phase === 'playing') beginRound(s, ev);
}

// The direction (1-6) that brings a monster one step closer to the nearest standing Mushroomfolk.
function huntDir(s, m) {
  const prey = s.players.filter((p) => !p.lost).sort((a, b) => dist(a.at, m.at) - dist(b.at, m.at))[0];
  if (!prey || prey.at === m.at) return null;
  const [q, r] = parse(m.at);
  let best = null, bd = dist(m.at, prey.at);
  DIRS.forEach((d, i) => {
    const k = key(q + d.dq, r + d.dr);
    if (!onBoard(q + d.dq, r + d.dr) || k === HOME) return;
    const dd = dist(k, prey.at);
    if (dd < bd) { bd = dd; best = i + 1; }
  });
  return best;
}

function moveMonster(s, m, rolls, ev) {
  const boss = m.kind === 'root-king';
  const steps = [];
  const hunt = s.night === 'the-hunt' && !boss && !m.stuck ? huntDir(s, m) : null;
  if (hunt) rolls += 1;
  if (m.stuck > 0) {
    m.stuck--;
    ev.push({ t: 'stuck', id: m.id, at: m.at });
    log(s, `${MONSTERS[m.kind].name} thrashes in the snare and cannot move.`);
    return;
  }
  for (let i = 0; i < rolls; i++) {
    const n = hunt && i === 0 ? hunt : roll();
    const d = DIRS[n - 1];
    const [q, r] = parse(m.at);
    const to = key(q + d.dq, r + d.dr);
    const wall = onBoard(q + d.dq, r + d.dr) && !boss &&
      s.players.some((x) => x.char === 'thorncap' && !x.lost && x.level >= 2 && x.at === to);
    const blocked = !onBoard(q + d.dq, r + d.dr) || (to === HOME && !boss) || wall;
    steps.push({ roll: n, to: blocked ? m.at : to, blocked });
    if (blocked) continue;
    m.at = to;
    const t = s.tiles[to];
    if (s.outposts?.[to]) {
      delete s.outposts[to];
      ev.push({ t: 'outpostLost', at: to, by: m.id });
      log(s, `${MONSTERS[m.kind].name} tramples an Outpost flat, and everything stored in it.`);
    }
    if (t.trap && !boss) {
      steps[steps.length - 1].trap = true;
      t.trap = null;
      m.hp -= 1;
      m.stuck = 1;
      log(s, `${MONSTERS[m.kind].name} blunders into a snare! It is stuck there for a round.`);
      if (m.hp > 0) {
        for (const p of playersAt(s, to).filter((p) => !p.lost)) steps[steps.length - 1].hit = (steps[steps.length - 1].hit || []).concat(p.char);
      }
      break;
    }
    if (boss) corruptTile(s, to, ev, 'rootking');
    if (to === HOME && boss) {
      ev.push({ t: 'monsterMove', id: m.id, steps });
      endGame(s, ev, 'lost', 'The Root King tears into the Workshop. The forest has swallowed your home.');
      return;
    }
    // A monster hurts each player at most once per round, even if its rolls double back.
    const already = new Set(steps.flatMap((x) => x.hit || []));
    let victims = playersAt(s, to).filter((p) => !p.lost && !already.has(p.char));
    // Thorncap's Shield Wall: the Guardian takes the blow for everyone on the tile.
    const guard = victims.find((p) => p.char === 'thorncap');
    if (guard) victims = [guard];
    for (const p of victims) steps[steps.length - 1].hit = (steps[steps.length - 1].hit || []).concat(p.char);
  }
  ev.push({ t: 'monsterMove', id: m.id, steps });
  if (m.hp <= 0) {
    s.monsters = s.monsters.filter((x) => x !== m);
    ev.push({ t: 'kill', id: m.id, by: null });
    log(s, `The snare finishes off ${MONSTERS[m.kind].name}!`);
    questProgress(s, 'slay', null, ev, m.id);
    return;
  }
  // Apply damage after the movement event so clients animate the hop before the hurt.
  for (const st of steps) for (const c of st.hit || []) {
    const p = s.players.find((x) => x.char === c);
    log(s, `${MONSTERS[m.kind].name} tramples ${p.name}!`);
    loseLife(s, p, 1, ev);
  }
  if (s.phase === 'playing' && !boss) corruptTile(s, m.at, ev, 'monster');
}

function wander(s, lostP, rolls, ev) {
  const steps = [];
  const hit = new Set();
  for (let i = 0; i < rolls; i++) {
    const n = roll();
    const d = DIRS[n - 1];
    const [q, r] = parse(lostP.at);
    const to = key(q + d.dq, r + d.dr);
    const blocked = !onBoard(q + d.dq, r + d.dr) || to === HOME;
    steps.push({ roll: n, to: blocked ? lostP.at : to, blocked });
    if (blocked) continue;
    lostP.at = to;
    let victims = playersAt(s, to).filter((x) => !x.lost && !hit.has(x.char));
    const guard = victims.find((x) => x.char === 'thorncap');
    if (guard) victims = [guard];
    for (const v of victims) { hit.add(v.char); steps[steps.length - 1].hit = (steps[steps.length - 1].hit || []).concat(v.char); }
  }
  ev.push({ t: 'wander', who: lostP.char, steps });
  log(s, `${lostP.name} wanders the forest, lost and hollow.`);
  for (const st of steps) for (const c of st.hit || []) {
    const v = s.players.find((x) => x.char === c);
    log(s, `${lostP.name} lashes out at ${v.name}!`);
    loseLife(s, v, 1, ev);
  }
  if (s.phase === 'playing') corruptTile(s, lostP.at, ev, 'lost');
}

// Stepping onto corrupted ground costs a life (Morella's Dream Ward burns Essence instead).
function corruptionBites(s, p, k, ev) {
  if (!s.tiles[k].corrupted || p.lost) return;
  if (p.char === 'morella' && p.level >= 2) {
    if (p.bag.essence > 0) { p.bag.essence--; ev.push({ t: 'lose', who: p.char, res: 'essence', n: 1 }); }
    log(s, 'Morella\u2019s Dream Ward turns the corruption aside.');
    return;
  }
  log(s, `The corruption bites ${p.name}.`);
  loseLife(s, p, 1, ev);
}

// ---------------------------------------------------------------- effects
function applyFx(s, p, fx, ev, ctx = {}) {
  for (const f of fx) {
    if (s.phase !== 'playing') return;
    const everyone = s.players.filter((x) => !x.lost);
    if (f.gain) for (const [r, n] of Object.entries(f.gain)) gain(s, p, r, n, ev);
    if (f.lose) for (const [r, n] of Object.entries(f.lose)) lose(s, p, r, n, ev);
    if (f.allGain) for (const x of everyone) for (const [r, n] of Object.entries(f.allGain)) gain(s, x, r, n, ev);
    if (f.allLose) for (const x of everyone) for (const [r, n] of Object.entries(f.allLose)) lose(s, x, r, n, ev);
    if (f.allLoseRandom) for (const x of everyone) for (let i = 0; i < f.allLoseRandom; i++) loseRandom(s, x, ev);
    if (f.rep) { p.rep = Math.max(0, p.rep + f.rep); ev.push({ t: 'rep', who: p.char, delta: f.rep }); }
    if (f.life) { log(s, `${p.name} is hurt.`); loseLife(s, p, -f.life, ev); }
    if (f.loseRandom) for (let i = 0; i < f.loseRandom; i++) loseRandom(s, p, ev);
    if (f.healLow) for (const x of everyone) if (x.lives === 1 && maxLives(s) > 1) { x.lives++; ev.push({ t: 'life', who: x.char, delta: 1, lives: x.lives }); }
    if (f.allRep) for (const x of everyone) { x.rep += f.allRep; ev.push({ t: 'rep', who: x.char, delta: f.allRep }); }
    if (f.spawnAny) spawnMonster(s, ev);
    if (f.essenceOrRot) {
      const have = s.storage.essence + everyone.reduce((a, x) => a + x.bag.essence, 0);
      if (have >= f.essenceOrRot) {
        let need = f.essenceOrRot;
        const fromStore = Math.min(need, s.storage.essence); s.storage.essence -= fromStore; need -= fromStore;
        for (const x of everyone) while (need > 0 && x.bag.essence > 0) { x.bag.essence--; need--; ev.push({ t: 'lose', who: x.char, res: 'essence', n: 1 }); }
        log(s, 'The party burns Essence to keep the dream at bay.');
      } else { log(s, 'Not enough Essence: the dream spreads into the forest.'); spreadCorruption(s, ev); }
    }
    if (f.questId && s.quest) {
      const id = s.quest.active.some((q) => q.id === f.questId) ? s.quest.deck.shift() : f.questId;
      s.quest.deck = s.quest.deck.filter((x) => x !== id);
      openQuest(s, id, p.at, ev);
    }
    if (f.chain && s.quest) {
      // Chain cards are used once: they never go back into a discard pile.
      if (ctx.deck && CHAIN.includes(s.discards[ctx.deck].at(-1))) s.discards[ctx.deck].pop();
      if (s.quest.chain !== f.chain - 1) {
        log(s, 'An old clue, already followed. It crumbles away.');
      } else {
        s.quest.chain = f.chain;
        applyFx(s, p, f.fx || [], ev, {});
        if (f.chain >= CHAIN.length) {
          s.quest.done += 2;
          for (let i = 0; i < 2; i++) { if (canHold(p, 'artifact')) { p.bag.artifact++; ev.push({ t: 'gain', who: p.char, res: 'artifact', n: 1 }); } else s.storage.artifact++; }
          p.rep += 2; ev.push({ t: 'rep', who: p.char, delta: 2 });
          ev.push({ t: 'chainDone', who: p.char, done: s.quest.done });
          log(s, `The Broken Compass quest is complete! 2 Artifacts, and it counts as 2 quests (${s.quest.done}/${QUESTS_TO_WIN}).`);
        } else {
          ev.push({ t: 'chain', step: f.chain });
          log(s, `The Broken Compass: step ${f.chain} of ${CHAIN.length}.`);
        }
      }
    }
    if (f.mp && p.turn) {
      p.turn.mp = Math.max(0, p.turn.mp + f.mp);
      log(s, f.mp > 0 ? `${p.name} gains +${f.mp} movement.` : `${p.name} loses ${-f.mp} movement.`);
    }
    if (f.heal && p.lives < maxLives(s)) { p.lives = Math.min(maxLives(s), p.lives + f.heal); ev.push({ t: 'life', who: p.char, delta: f.heal, lives: p.lives }); }
    if (f.allHeal) for (const x of everyone) if (x.lives < maxLives(s)) { x.lives++; ev.push({ t: 'life', who: x.char, delta: 1, lives: x.lives }); }
    if (f.fear) addFear(s, p, f.fear, ev);
    if (f.allFear) for (const x of everyone) addFear(s, x, f.allFear, ev);
    if (f.horror) for (let i = 0; i < f.horror && s.phase === 'playing'; i++) {
      s.horror++;
      ev.push({ t: 'horror', horror: s.horror, delta: 1 });
      log(s, `The Horror Track advances (${s.horror}/${HORROR_MAX}).`);
      horrorRose(s, p.at, ev);
    }
    if (f.cleanseNear) { // your own tile first, else a corrupted tile beside you
      const k = [p.at, ...neighbors(p.at)].find((x) => s.tiles[x]?.corrupted && s.tiles[x].biome !== 'corrupted' && !monstersAt(s, x).length);
      if (k) { s.tiles[k].corrupted = false; ev.push({ t: 'cleanse', at: k }); log(s, 'The corruption there melts away.'); lowerHorror(s, ev); questProgress(s, 'cleanse', p, ev); }
    }
    if (f.slowOn) for (const x of everyone) if (s.tiles[x.at].biome === f.slowOn) { x.slowNext = (x.slowNext || 0) + 1; log(s, `${x.name} will lose 1 movement next turn.`); }
    if (f.endMove && p.turn) { p.turn.mp = 0; log(s, `${p.name}'s movement ends.`); }
    if (f.sureFooted && p.turn) { p.turn.sureFooted = true; log(s, `${p.name} ignores difficult terrain this turn.`); }
    if (f.reveal) {
      const hidden = allKeys().filter((k) => !s.tiles[k].revealed && neighbors(k).some((n) => s.tiles[n].revealed));
      hidden.sort((a, b) => dist(a, p.at) - dist(b, p.at));
      for (const k of hidden.slice(0, f.reveal)) revealTile(s, k, ev, p.char);
    }
    if (f.spawn) spawnMonster(s, ev, f.spawn === 'elite' ? 'shadow-stalker' : f.spawn, p.at);
    if (f.corruptAdjacent) {
      const opts = neighbors(p.at).filter((k) => k !== HOME && !s.tiles[k].corrupted);
      if (opts.length) corruptTile(s, pick(opts), ev, 'card');
    }
    if (f.spread) for (let i = 0; i < f.spread; i++) spreadCorruption(s, ev);
    if (f.quest && s.quest && s.quest.deck.length) openQuest(s, s.quest.deck.shift(), p.at, ev);
    if (f.draw && ctx.deck) ctx.draws = (ctx.draws || 0) + f.draw;
    if (f.drawIfWood && ctx.deck && p.bag.wood > 0) ctx.draws = (ctx.draws || 0) + 1;
    if (f.peek && ctx.deck) ctx.peek = f.peek;
  }
}

function deckFor(s, k) {
  const t = s.tiles[k];
  if (t.corrupted || t.biome === 'corrupted' || t.searched > 0) return 'blight';
  return t.biome;
}
function drawCard(s, deck) {
  if (!s.decks[deck].length) { s.decks[deck] = shuffle(s.discards[deck]); s.discards[deck] = []; }
  if (!s.decks[deck].length) s.decks[deck] = shuffle(DECKS[deck]);
  return s.decks[deck].shift();
}

// Resolve one discovery card; may leave s.pending set for a choice.
function resolveCard(s, p, id, deck, ev, chain) {
  const card = CARDS[id];
  s.discards[deck].push(id);
  ev.push({ t: 'card', id, who: p.char, deck });
  log(s, `${p.name} draws ${card.title}.`);
  const choiceFx = card.fx.find((f) => f.choice);
  if (choiceFx) {
    const rest = card.fx.filter((f) => !f.choice);
    if (rest.length) applyFx(s, p, rest, ev, {});
    // An option that costs something you don't carry can't be picked.
    const can = choiceFx.choice.map((o, i) => i).filter((i) => Object.entries(choiceFx.choice[i].needs || {}).every(([r, n]) => p.bag[r] >= n));
    if (can.length === 1 && can.length < choiceFx.choice.length) {
      const opt = choiceFx.choice[can[0]];
      log(s, `${p.name} has no other choice: ${opt.label}.`);
      const cctx = { deck };
      applyFx(s, p, opt.fx, ev, cctx);
      continueChain(s, p, deck, ev, chain + (cctx.draws || 0));
      return;
    }
    const idx = can.length ? can : choiceFx.choice.map((o, i) => i);
    s.pending = { kind: 'choice', who: p.char, card: id, deck, options: idx.map((i) => choiceFx.choice[i].label), idx, chain };
    return;
  }
  const ctx = { deck };
  applyFx(s, p, card.fx, ev, ctx);
  continueChain(s, p, deck, ev, chain + (ctx.draws || 0), ctx.peek);
}

function continueChain(s, p, deck, ev, draws, peek) {
  if (s.phase !== 'playing' || p.lost) return;
  if (peek) return offerPick(s, p, deck, peek, ev, draws);
  if (draws > 0) resolveCard(s, p, drawCard(s, deck), deck, ev, draws - 1);
}

function offerPick(s, p, deck, n, ev, chain) {
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(drawCard(s, deck));
  s.pending = { kind: 'pick', who: p.char, cards: ids, deck, chain };
  ev.push({ t: 'pick', who: p.char, cards: ids });
}

// ---------------------------------------------------------------- movement
export function stepCost(s, p, k) {
  const t = s.tiles[k];
  if (!t.revealed) return 1; // you pay the rest when it turns out to be rough ground
  let c = BIOMES[t.biome].cost;
  if (p.turn?.sureFooted) c = 1;
  return c;
}

export const isNode = (s, k) => k === HOME || !!s.outposts?.[k];

// Every tile p can reach this turn, by the path that crosses the fewest corrupted tiles (then
// the cheapest). Unrevealed tiles end a path. Outposts and the Workshop link up: travelling
// between any two of them costs 1 movement.
export function reachable(s, p) {
  useBoard(s);
  const out = {};
  if (!p.turn || p.lost) return out;
  const mods = weatherMods(s);
  const MP = p.turn.mp;
  // Dijkstra over (tile, trailblaze-used): cheapest by fewest corrupted tiles, then fewest moves.
  const key = (k, tr) => `${k}|${tr ? 1 : 0}`;
  const lt = (a, b) => a.hurt < b.hurt || (a.hurt === b.hurt && a.mp < b.mp);
  const done = new Set();
  const open = [{ k: p.at, mp: 0, trail: !!p.turn.trailblazed, hurt: 0, steps: [] }];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (lt(open[i], open[bi])) bi = i;
    const cur = open.splice(bi, 1)[0];
    const sk = key(cur.k, cur.trail);
    if (done.has(sk)) continue;
    done.add(sk);
    if (cur.k !== p.at && (!out[cur.k] || lt(cur, out[cur.k])))
      out[cur.k] = { cost: cur.mp, path: cur.steps.map((x) => x.k), steps: cur.steps, trail: cur.trail, hurt: cur.hurt };
    if (cur.k !== p.at && !s.tiles[cur.k].revealed) continue;   // the unknown ends a path
    const next = neighbors(cur.k).map((n) => ({ n, travel: false }));
    if (isNode(s, cur.k)) for (const n of [HOME, ...Object.keys(s.outposts || {})]) if (n !== cur.k) next.push({ n, travel: true });
    for (const { n, travel } of next) {
      if (n === p.at) continue;
      const t = s.tiles[n];
      if (!t.revealed && (mods.noExplore || travel)) continue;
      let c = travel ? 1 : stepCost(s, p, n), trail = cur.trail;
      if (!travel && p.char === 'mushy' && c > 1 && !trail) { c = 1; trail = true; }
      const total = cur.mp + c;
      // You may always step into the unknown with at least 1 movement left.
      if (total > MP && !(!t.revealed && MP - cur.mp >= 1)) continue;
      if (done.has(key(n, trail))) continue;
      open.push({ k: n, mp: Math.min(total, MP), trail, hurt: cur.hurt + (t.corrupted ? 1 : 0), steps: [...cur.steps, { k: n, c, travel }] });
    }
  }
  return out;
}

// ---------------------------------------------------------------- actions
export function act(state, seatChar, action) {
  const s = structuredClone(state);
  useBoard(s);
  const ev = [];
  if (s.phase !== 'playing') fail('The game is not in progress.');
  const p = s.players[s.turn];
  if (!p || p.char !== seatChar) fail('It is not your turn.');
  if (s.pending && action.type !== 'choose') fail('Finish resolving the card first.');
  const T = p.turn;
  const here = s.tiles[p.at];
  const atHome = p.at === HOME;
  const decide = () => { if (T.dec <= 0) fail('No decisions left this turn.'); T.dec--; };

  switch (action.type) {
    case 'fuel': {
      if (T.fueled) fail('You have already set out this turn.');
      const mods = weatherMods(s);
      let mp;
      if (action.how === 'food') {
        if (p.bag.food > 0) p.bag.food--;
        else if (atHome && s.storage.food > 0) s.storage.food--;
        else fail('You have no Food.');
        mp = 3; ev.push({ t: 'lose', who: p.char, res: 'food', n: 1 });
        log(s, `${p.name} eats and sets out (3 movement).`);
      } else if (action.how === 'life') {
        if (p.lives < 2) fail('Spending your last life would leave you Lost.');
        mp = 3; loseLife(s, p, 1, ev);
        log(s, `${p.name} pushes through hunger, spending a life (3 movement).`);
      } else { mp = 1; log(s, `${p.name} trudges on with an empty stomach (1 movement).`); }
      mp += mods.mpBonus || 0;
      if (s.night === 'night-terrors' && !atHome && !s.outposts[p.at]) { mp = Math.max(1, mp - 1); log(s, `Night terrors: ${p.name} sets out slowly.`); }
      if (p.char === 'mushy' && p.level >= 1) mp += 1;
      if (T.slow) { mp = Math.max(1, mp - T.slow); log(s, `Shaken ground: ${p.name} sets out slowly.`); T.slow = 0; }
      if (mods.mpCap) mp = Math.min(mp, mods.mpCap);
      T.fueled = true; T.mp += mp;
      break;
    }
    case 'move': {
      if (!T.fueled && T.mp <= 0) fail('Choose how to set out first (Food, a life, or 1 free step).');
      const opts = reachable(s, p);
      const dest = opts[action.to];
      if (!dest) fail('You cannot reach that tile this turn.');
      const path = [];
      let spent = 0, trail = T.trailblazed;
      for (const st of dest.steps) {
        const t = s.tiles[st.k];
        path.push(st.k);
        let c = st.c;
        if (!t.revealed) {
          revealTile(s, st.k, ev, p.char);
          c = T.sureFooted ? 1 : BIOMES[t.biome].cost;
          if (p.char === 'mushy' && c > 1 && !trail) { c = 1; trail = true; }
          spent += c;
          break;
        }
        if (!st.travel && p.char === 'mushy' && BIOMES[t.biome].cost > 1 && !T.sureFooted && !trail) trail = true;
        spent += c;
      }
      const end = path[path.length - 1];
      T.trailblazed = trail;
      T.mp = Math.max(0, T.mp - spent);
      p.at = end;
      ev.push({ t: 'move', who: p.char, path, travel: dest.steps.some((x) => x.travel) });
      // Corruption bites on every corrupted tile walked onto.
      for (const k of path) { if (p.lost) break; corruptionBites(s, p, k, ev); }
      if (s.quest && !p.lost && p.at === HOME)
        for (const q of s.quest.active.slice()) if (q.kind === 'escort' && q.carrier === p.char) completeQuest(s, q, p, ev);
      if (monstersAt(s, end).length) log(s, `${p.name} faces ${MONSTERS[monstersAt(s, end)[0].kind].name}!`);
      break;
    }
    case 'search': {
      if (atHome) fail('There is nothing to search at the Workshop.');
      if (p.char === 'morella' && p.level >= 1 && !T.freeSearch) T.freeSearch = true;
      else decide();
      const deck = deckFor(s, p.at);
      here.searched++;
      // Broken Compass: the next clue waits on the first Search of the biome it names.
      if (s.quest && CHAIN_BIOME[s.quest.chain] === here.biome && deck !== 'blight') {
        resolveCard(s, p, CHAIN[s.quest.chain], deck, ev, 0);
        break;
      }
      const n = (p.char === 'morella' ? 2 : 1) + (s.upgrades.archive ? 1 : 0);
      if (n > 1) offerPick(s, p, deck, n, ev, 0);
      else resolveCard(s, p, drawCard(s, deck), deck, ev, 0);
      break;
    }
    case 'choose': {
      const pd = s.pending;
      if (!pd || pd.who !== p.char) fail('Nothing to choose.');
      s.pending = null;
      if (pd.kind === 'choice') {
        const opt = CARDS[pd.card].fx.find((f) => f.choice).choice[pd.idx ? pd.idx[action.index] : action.index];
        if (!opt) { s.pending = pd; fail('Pick one of the options.'); }
        log(s, `${p.name} chooses: ${opt.label}.`);
        const cctx = { deck: pd.deck };
        applyFx(s, p, opt.fx, ev, cctx);
        continueChain(s, p, pd.deck, ev, pd.chain + (cctx.draws || 0));
      } else {
        const id = pd.cards[action.index];
        if (!id) fail('Pick one of the cards.');
        pd.cards.filter((c, i) => i !== action.index).forEach((c) => s.decks[pd.deck].push(c));
        resolveCard(s, p, id, pd.deck, ev, pd.chain);
      }
      break;
    }
    case 'gather': {
      if (atHome) fail('Nothing to gather at the Workshop.');
      if (s.night === 'long-dark') fail('The Long Dark: no one can Gather tonight.');
      const yields = BIOMES[here.biome].yields;
      const y = yields[action.option || 0];
      if (!y) fail('Choose what to gather.');
      decide();
      const level = here.harvest;
      const half = level >= 2;
      for (const [r, n] of Object.entries(y)) gain(s, p, r, half ? Math.max(1, n - 1) : n, ev);
      here.harvest++;
      ev.push({ t: 'harvest', at: p.at, level: here.harvest });
      if (level >= 1) {
        const face = pick(RISK_FACES);
        ev.push({ t: 'dice', kind: 'risk', who: p.char, faces: [face], why: 'harvest' });
        log(s, `The ${level >= 2 ? 'exhausted' : 'disturbed'} land stirs (${face}).`);
        if (face === 'wound') loseLife(s, p, 1, ev);
        if (face === 'panic' && level >= 2) corruptTile(s, p.at, ev, 'harvest');
      }
      break;
    }
    case 'attack': {
      // Fight a monster on your tile or the next one. Friends beside it lend a die each.
      const near = [p.at, ...neighbors(p.at)];
      const m = action.id ? s.monsters.find((x) => x.id === action.id) : s.monsters.find((x) => near.includes(x.at));
      if (!m || !near.includes(m.at)) fail('No monster on your tile or next to it.');
      decide();
      const allies = s.players.filter((x) => !x.lost && x !== p && dist(x.at, m.at) <= 1).length;
      const bonus = (p.char === 'bramblecap' ? 1 : 0) + (p.char === 'thorncap' && p.level >= 1 ? 1 : 0);
      const n = Math.min(5, 1 + allies + bonus);
      const faces = Array.from({ length: n }, () => pick(RISK_FACES));
      ev.push({ t: 'dice', kind: 'risk', who: p.char, faces, why: 'attack', target: m.id });
      let dmg = faces.reduce((a, f) => a + (f === 'hit' ? 1 : f === 'double' ? 2 : 0), 0);
      if (dmg > 0 && p.char === 'bramblecap' && p.level >= 2) dmg++;
      m.hp -= dmg;
      log(s, `${p.name} attacks ${MONSTERS[m.kind].name}: ${dmg} damage.`);
      ev.push({ t: 'hurt', id: m.id, dmg, hp: Math.max(0, m.hp) });
      let escaped = false;
      // Monster Cage: without the finished Cage the Root King cannot be held.
      if (m.hp <= 0 && m.kind === 'root-king' && ((s.settings.scenario === 'monster-cage' && !s.finale?.cage) || !questsOk(s))) {
        m.hp = m.maxHp; escaped = true;
        const lands = allKeys().filter((k) => s.tiles[k].biome === 'corrupted' && k !== p.at);
        if (lands.length) m.at = pick(lands);
        ev.push({ t: 'escape', id: m.id, at: m.at });
        log(s, questsOk(s) ? 'The Root King crumbles into roots... and regrows in the Corrupted Lands. Only the Cage can hold it.'
          : `The Root King crumbles... and regrows. The forest is not ready: complete ${QUESTS_TO_WIN} quests first.`);
      } else if (m.hp <= 0) {
        s.monsters = s.monsters.filter((x) => x !== m);
        ev.push({ t: 'kill', id: m.id, by: p.char });
        p.rep++; ev.push({ t: 'rep', who: p.char, delta: 1 });
        gain(s, p, 'essence', 1, ev);
        log(s, `${MONSTERS[m.kind].name} is defeated! ${p.name} gains 1 Reputation and 1 Essence.`);
        questProgress(s, 'slay', p, ev, m.id);
        if (m.kind === 'root-king') endGame(s, ev, 'won', s.settings.scenario === 'monster-cage'
          ? 'The Root King is dragged into the Monster Cage. The Rune Locks seal. The forest is free.'
          : 'The Root King falls. The Everdeep breathes again.');
      }
      if (faces.includes('wound') && !faces.includes('shield') && !(p.char === 'bramblecap' && p.level >= 1)) {
        log(s, `${p.name} is wounded in the fight.`);
        loseLife(s, p, 1, ev);
      }
      // The Root King does not forgive: fail to bring it down and it kills you outright.
      // No Shield, snare or Thorncap's guard saves the attacker.
      if (m.kind === 'root-king' && m.hp > 0 && !escaped && s.monsters.includes(m) && !p.lost && s.phase === 'playing') {
        ev.push({ t: 'kingKill', id: m.id, who: p.char });
        ev.push({ t: 'strike', id: m.id, hit: [p.char] });
        log(s, `The Root King survives the blow and crushes ${p.name}!`);
        loseLife(s, p, p.lives, ev);
      }
      // A monster that survives (and is not caught in a snare) strikes back at everyone on or
      // beside its tile. A Shield in this attack protects the attacker; Thorncap shields the rest.
      if (m.hp > 0 && s.monsters.includes(m) && !m.stuck && s.phase === 'playing') {
        let victims = s.players.filter((x) => !x.lost && dist(x.at, m.at) <= 1 && !(x === p && faces.includes('shield')));
        const guard = victims.find((x) => x.char === 'thorncap');
        if (guard) victims = [guard];
        if (victims.length) {
          ev.push({ t: 'strike', id: m.id, hit: victims.map((x) => x.char) });
          log(s, `${MONSTERS[m.kind].name} strikes back at ${victims.map((x) => x.name).join(', ')}!`);
          for (const v of victims) loseLife(s, v, 1, ev);
        }
      } else if (m.hp > 0 && m.stuck) log(s, `${MONSTERS[m.kind].name} is tangled in the snare and cannot strike back.`);
      if (faces.includes('panic') && !p.lost && m.hp > 0) flee(s, p, ev);
      break;
    }
    case 'cleanse': {
      const at = action.at || p.at;
      if (at !== p.at && !neighbors(p.at).includes(at)) fail('Cleanse your tile or one next to it.');
      const tgt = s.tiles[at];
      if (!tgt.corrupted || tgt.biome === 'corrupted') fail('Only corrupted tiles (not Corrupted Lands) can be cleansed.');
      if (monstersAt(s, at).length) fail('Defeat the monster there first.');
      const free = p.char === 'sporewick';
      if (!free && p.bag.essence < 1) fail('Cleansing takes 1 Essence.');
      decide();
      if (!free) { p.bag.essence--; ev.push({ t: 'lose', who: p.char, res: 'essence', n: 1 }); }
      tgt.corrupted = false;
      ev.push({ t: 'cleanse', at });
      p.rep++; ev.push({ t: 'rep', who: p.char, delta: 1 });
      log(s, `${p.name} cleanses the land: +1 Reputation.`);
      lowerHorror(s, ev);
      questProgress(s, 'cleanse', p, ev);
      break;
    }
    case 'revive': {
      const target = s.players.find((x) => x.char === action.target);
      if (!target || !target.lost || (target.at !== p.at && !neighbors(p.at).includes(target.at))) fail('Reach a Lost friend on your tile or the next one.');
      decide();
      target.lost = false; target.lives = 1;
      ev.push({ t: 'revive', who: target.char, by: p.char });
      log(s, `${p.name} revives ${target.name}!`);
      break;
    }
    case 'rest': {
      if (!atHome && !s.outposts[p.at] && p.char !== 'sporewick') fail('Rest at the Workshop or an Outpost.');
      if (!atHome && p.char !== 'sporewick' && s.night === 'snuffed') fail('Snuffed Lanterns: no Resting at Outposts tonight.');
      if (p.lives >= maxLives(s) && !p.fear) fail('You are already at full health.');
      decide();
      if (p.lives < maxLives(s)) { p.lives++; ev.push({ t: 'life', who: p.char, delta: 1, lives: p.lives }); }
      log(s, `${p.name} rests and recovers.`);
      if (p.fear) addFear(s, p, -1, ev);
      break;
    }
    case 'build': {
      if (!atHome) fail('Build at the Workshop.');
      const part = SCENARIOS[s.settings.scenario].parts.find((x) => x.id === action.part);
      if (!part) fail('Unknown part.');
      if (s.built[part.id]) fail('Already built.');
      payCost(s, p, partCost(s, part), ev);
      decide();
      s.built[part.id] = p.char;
      ev.push({ t: 'build', part: part.id, who: p.char });
      p.rep++; ev.push({ t: 'rep', who: p.char, delta: 1 });
      log(s, `${p.name} builds the ${part.name}! +1 Reputation.`);
      if (SCENARIOS[s.settings.scenario].parts.every((x) => s.built[x.id])) startFinale(s, ev);
      break;
    }
    case 'advance': {
      if (!atHome) fail('Train at the Workshop.');
      const lv = CHARACTERS[p.char].levels[p.level];
      if (!lv) fail('Already at the highest level.');
      if (p.rep < lv.rep) fail(`Needs ${lv.rep} Reputation.`);
      payCost(s, p, lv.cost, ev);
      decide();
      p.rep -= lv.rep;
      p.level++;
      ev.push({ t: 'advance', who: p.char, level: p.level });
      log(s, `${p.name} learns ${lv.name}!`);
      break;
    }
    case 'workshop': {
      const w = WORKSHOP[action.id];
      if (!w) fail('Unknown improvement.');
      if (!atHome) fail('Build at the Workshop.');
      if (s.upgrades[action.id]) fail('Already built.');
      payCost(s, p, w.cost, ev);
      decide();
      s.upgrades[action.id] = p.char;
      ev.push({ t: 'improve', id: action.id, who: p.char });
      log(s, `${p.name} builds the ${w.name}.`);
      if (action.id === 'watchtower') {
        const hidden = allKeys().filter((k) => !s.tiles[k].revealed).sort((a, b) => dist(a, HOME) - dist(b, HOME));
        for (const k of hidden.slice(0, 3)) revealTile(s, k, ev, p.char, false);
      }
      break;
    }
    case 'craft': {
      const c = CRAFTS[action.id];
      if (!c) fail('Unknown item.');
      if (action.id === 'bandage' && p.lives >= maxLives(s)) fail('You are already at full health.');
      if (action.id === 'snare' && (atHome || here.trap)) fail(atHome ? 'Monsters never reach the Workshop.' : 'There is already a snare here.');
      const hidden = neighbors(p.at).filter((k) => !s.tiles[k].revealed);
      if (action.id === 'flare' && !hidden.length) fail('Nothing unexplored next to you.');
      payField(s, p, c.cost, atHome);
      decide();
      for (const [r, n] of Object.entries(c.cost)) ev.push({ t: 'lose', who: p.char, res: r, n });
      if (action.id === 'bandage') { p.lives++; ev.push({ t: 'life', who: p.char, delta: 1, lives: p.lives }); log(s, `${p.name} binds their wounds.`); }
      if (action.id === 'snare') { here.trap = p.char; ev.push({ t: 'trap', at: p.at }); log(s, `${p.name} sets a snare.`); }
      if (action.id === 'flare') { log(s, `${p.name} fires a Crystal Flare.`); revealTile(s, pick(hidden), ev, p.char, false); }
      break;
    }
    case 'heal': {
      if (!(p.char === 'sporewick' && p.level >= 1)) fail('Only Sporewick knows Remedy.');
      const f = s.players.find((x) => x.char === action.target);
      if (!f || f === p || f.at !== p.at || f.lost) fail('Heal a friend standing on your tile.');
      if (f.lives >= maxLives(s)) fail(`${f.name} is already at full health.`);
      decide();
      f.lives++;
      ev.push({ t: 'life', who: f.char, delta: 1, lives: f.lives });
      log(s, `${p.name} brews a remedy for ${f.name}.`);
      break;
    }
    case 'convert': {
      const anywhere = p.char === 'sporewick' && p.level >= 2;
      if (!anywhere && !(atHome && s.upgrades.furnace)) fail('Convert at the Crystal Furnace in the Workshop.');
      if (T.converted) fail('Only once per turn.');
      const { from, to } = action;
      if (!RES.includes(from) || !RES.includes(to) || from === to || to === 'artifact') fail('Pick two different resources (Artifacts can\u2019t be made).');
      payField(s, p, { [from]: 2 }, atHome);
      T.converted = true;
      ev.push({ t: 'lose', who: p.char, res: from, n: 2 });
      gain(s, p, to, 1, ev);
      log(s, `${p.name} turns 2 ${from} into 1 ${to}.`);
      break;
    }
    case 'recall': {
      if (!atHome || !s.upgrades.beacon) fail('Use the Emergency Beacon at the Workshop.');
      const f = s.players.find((x) => x.char === action.target);
      if (!f || !f.lost) fail('Choose a Lost friend.');
      decide();
      f.lost = false; f.lives = 1; f.at = HOME;
      ev.push({ t: 'revive', who: f.char, by: p.char });
      ev.push({ t: 'move', who: f.char, path: [HOME] });
      log(s, `The Beacon blazes. ${f.name} finds their way home.`);
      break;
    }
    case 'upgrade': {
      const up = UPGRADES[action.id];
      if (!up) fail('Unknown upgrade.');
      if (!atHome) fail('Upgrade at the Workshop.');
      if (p.slots >= BAG_SLOTS_UPGRADED) fail('Already upgraded.');
      if (p.rep < up.rep) fail(`Needs ${up.rep} Reputation.`);
      payCost(s, p, up.cost, ev);
      decide();
      p.rep -= up.rep;
      p.slots = BAG_SLOTS_UPGRADED;
      log(s, `${p.name} stitches a Reinforced Backpack.`);
      break;
    }
    case 'launch': {
      if (!atHome) fail('Launch from the Workshop.');
      const parts = SCENARIOS[s.settings.scenario].parts;
      if (s.settings.scenario !== 'skyship') fail('Only the Skyship launches.');
      if (!parts.every((x) => s.built[x.id])) fail('The Skyship is not finished.');
      const away = s.players.filter((x) => !x.lost && x.at !== HOME);
      if (away.length) fail(`Everyone standing must be aboard: ${away.map((x) => x.name).join(', ')} still away.`);
      if (!questsOk(s)) fail(`The forest needs you first: complete ${QUESTS_TO_WIN} quests (${s.quest.done} done).`);
      const crew = s.players.filter((x) => !x.lost).length;
      if (s.storage.food < crew) fail(`Load provisions first: ${crew} Food in Workshop storage (1 per crew member).`);
      decide();
      s.storage.food -= crew;
      ev.push({ t: 'launch' });
      endGame(s, ev, 'won', 'The Skyship rises above the canopy. The Mushroomfolk are free!');
      break;
    }
    case 'deposit': {
      if (!atHome) fail('Deposit at the Workshop.');
      // Food stays in the backpack: it's your travel ration.
      for (const r of RES) if (r !== 'food') { s.storage[r] += p.bag[r]; p.bag[r] = 0; }
      ev.push({ t: 'deposit', who: p.char });
      log(s, `${p.name} unpacks their haul into Workshop storage.`);
      break;
    }
    case 'quest': {
      if (!s.quest) fail('Quests are off in this game.');
      const q = s.quest.active.find((x) => x.qid === action.qid);
      if (!q || q.at !== p.at) fail('Stand on the quest marker.');
      if (!['visit', 'deliver', 'escort'].includes(q.kind) || q.carrier) fail('This quest is not done here.');
      if (monstersAt(s, p.at).length) fail('Not with a monster on the tile.');
      const def = QUESTS[q.id];
      if (q.kind === 'deliver') payField(s, p, def.need, atHome);
      decide();
      if (q.kind === 'deliver') for (const [r, n] of Object.entries(def.need)) ev.push({ t: 'lose', who: p.char, res: r, n });
      if (q.kind === 'escort') {
        q.carrier = p.char; q.at = HOME;
        ev.push({ t: 'escort', qid: q.qid, who: p.char });
        log(s, `${p.name} takes charge: ${def.title}. Bring them to the Workshop.`);
      } else completeQuest(s, q, p, ev);
      break;
    }
    case 'outpost': {
      const max = MODES[s.settings.mode || 'standard'].outposts;
      if (atHome) fail('The Workshop is already home.');
      if (s.outposts[p.at]) fail('There is already an Outpost here.');
      if (here.corrupted) fail('You cannot build on corrupted ground.');
      if (monstersAt(s, p.at).length) fail('Not with a monster on the tile.');
      if (Object.keys(s.outposts).length >= max) fail(`You can only keep ${max} Outposts.`);
      payField(s, p, OUTPOST.cost, false);
      decide();
      s.outposts[p.at] = { by: p.char, store: emptyBag() };
      for (const [r, n] of Object.entries(OUTPOST.cost)) ev.push({ t: 'lose', who: p.char, res: r, n });
      ev.push({ t: 'outpost', at: p.at, who: p.char });
      log(s, `${p.name} raises an Outpost.`);
      break;
    }
    case 'stash': {
      const o = s.outposts[p.at];
      if (!o) fail('Stand on an Outpost.');
      const r = action.res;
      if (!(p.bag[r] > 0)) fail('You have none.');
      if (RES.reduce((a, x) => a + o.store[x], 0) >= OUTPOST.capacity) fail(`An Outpost holds ${OUTPOST.capacity} items.`);
      p.bag[r]--; o.store[r]++;
      break;
    }
    case 'take': {
      const o = s.outposts[p.at];
      if (!o) fail('Stand on an Outpost.');
      const r = action.res;
      if (!(o.store[r] > 0)) fail('None stored here.');
      if (!canHold(p, r)) fail('Your backpack is full.');
      o.store[r]--; p.bag[r]++;
      break;
    }
    case 'store': {
      if (!atHome) fail('Store supplies at the Workshop.');
      const r = action.res;
      if (!(p.bag[r] > 0)) fail('You have none.');
      p.bag[r]--; s.storage[r]++;
      break;
    }
    case 'setSettings': fail('Settings can only change in the lobby.');
    case 'withdraw': {
      if (!atHome) fail('Take supplies at the Workshop.');
      const r = action.res;
      if (!(s.storage[r] > 0)) fail('None in storage.');
      if (!canHold(p, r)) fail('Your backpack is full.');
      s.storage[r]--; p.bag[r]++;
      break;
    }
    case 'give': {
      const to = s.players.find((x) => x.char === action.to);
      if (!to || to === p || to.at !== p.at) fail('Give only to a friend on your tile.');
      if (!(p.bag[action.res] > 0)) fail('You have none.');
      if (!canHold(to, action.res)) fail(`${to.name}'s backpack is full.`);
      p.bag[action.res]--; to.bag[action.res]++;
      log(s, `${p.name} hands ${to.name} 1 ${action.res}.`);
      break;
    }
    case 'endTurn': {
      p.turn = null;
      ev.push({ t: 'endTurn', who: p.char });
      nextTurn(s, ev);
      break;
    }
    default: fail('Unknown action.');
  }
  // Someone who falls on their own turn hands the turn on.
  if (s.phase === 'playing' && p.lost && s.players[s.turn] === p) {
    if (s.pending?.who === p.char) s.pending = null;
    p.turn = null;
    nextTurn(s, ev);
  }
  return finish(s, ev);
}

// Workshop builds draw on storage first; field crafting uses the backpack (plus storage at home).
function payField(s, p, cost, home) {
  for (const [r, n] of Object.entries(cost))
    if ((home ? s.storage[r] : 0) + (p.bag[r] || 0) < n) fail(`Not enough ${r}: needs ${n}.`);
  for (const [r, n] of Object.entries(cost)) {
    let need = n;
    const fromBag = Math.min(need, p.bag[r]); p.bag[r] -= fromBag; need -= fromBag;
    if (need) s.storage[r] -= need;
  }
}

function startFinale(s, ev) {
  const sc = s.settings.scenario;
  if (sc === 'weather-engine') {
    // Two Pylon sites on opposite sides of the map, two or three hexes out.
    const ring = allKeys().filter((k) => dist(k, HOME) >= 2 && s.tiles[k].biome !== 'corrupted');
    const a = pick(ring);
    const [q, r] = parse(a);
    const opp = ring.filter((k) => dist(k, a) >= 4).sort((x, y) => dist(y, a) - dist(x, a));
    const b = opp[0] || pick(ring.filter((k) => k !== a));
    s.finale = { pylons: [a, b], held: 0 };
    for (const k of [a, b]) revealTile(s, k, ev, null, false);
    ev.push({ t: 'finale', kind: sc, pylons: [a, b] });
    log(s, 'The Weather Engine hums. Two Pylon sites flare to life out in the wild: hold both for 3 rounds!');
  } else if (sc === 'monster-cage') {
    s.finale = { cage: true };
    ev.push({ t: 'finale', kind: sc });
    if (!s.rootKing) {
      log(s, 'The Cage is ready. Its runes call to the deep...');
      awakenRootKing(s, ev);
    } else log(s, 'The Cage is ready. Bring the Root King down to capture it!');
  } else {
    s.finale = { ready: true };
    ev.push({ t: 'finale', kind: sc });
    log(s, 'The Skyship is complete! Stock the provisions and gather everyone aboard.');
  }
}

function payCost(s, p, cost, ev) {
  for (const [r, n] of Object.entries(cost))
    if ((s.storage[r] || 0) + (p.bag[r] || 0) < n) fail(`Not enough ${r}: needs ${n}.`);
  for (const [r, n] of Object.entries(cost)) {
    let need = n;
    const fromStore = Math.min(need, s.storage[r]); s.storage[r] -= fromStore; need -= fromStore;
    p.bag[r] -= need;
  }
}

// What the active player can do right now (used by the UI to enable buttons).
export function options(s) {
  useBoard(s);
  const p = s.players?.[s.turn];
  if (!p || s.phase !== 'playing' || !p.turn) return null;
  const here = s.tiles[p.at], home = p.at === HOME, T = p.turn;
  const dec = T.dec > 0 && !s.pending;
  const monster = monstersAt(s, p.at)[0];
  const foes = s.monsters.filter((m) => m.at === p.at || neighbors(p.at).includes(m.at));
  const near = [p.at, ...neighbors(p.at)];
  const lostHere = s.players.filter((x) => x.lost && near.includes(x.at));
  const cleanable = near.filter((k) => s.tiles[k].corrupted && s.tiles[k].biome !== 'corrupted' && !monstersAt(s, k).length);
  const outpostOk = !home && !s.outposts?.[p.at] && !here.corrupted && !monster &&
    Object.keys(s.outposts || {}).length < MODES[s.settings.mode || 'standard'].outposts;
  const parts = SCENARIOS[s.settings.scenario].parts;
  const lv = CHARACTERS[p.char].levels[p.level];
  return {
    fuel: !T.fueled && !s.pending,
    move: (T.fueled || T.mp > 0) && T.mp > 0 && !s.pending,
    search: dec && !home,
    gather: dec && !home && s.night !== 'long-dark' ? BIOMES[here.biome].yields : null,
    attack: dec ? foes : [],
    cleanse: dec && (p.char === 'sporewick' || p.bag.essence > 0) ? cleanable : [],
    outpost: dec && outpostOk,
    atOutpost: !!s.outposts?.[p.at],
    revive: dec ? lostHere : [],
    rest: dec && (home || (!!s.outposts?.[p.at] && s.night !== 'snuffed') || p.char === 'sporewick') && (p.lives < maxLives(s) || p.fear > 0),
    build: dec && home ? parts.filter((x) => !s.built[x.id]) : [],
    upgrade: dec && home && p.slots < BAG_SLOTS_UPGRADED,
    launch: dec && home && s.settings.scenario === 'skyship' && parts.every((x) => s.built[x.id]) && questsOk(s),
    quest: dec && s.quest && !monster ? s.quest.active.filter((q) => q.at === p.at && ['visit', 'deliver', 'escort'].includes(q.kind) && !q.carrier) : [],
    advance: dec && home && lv ? lv : null,
    workshop: dec && home ? Object.keys(WORKSHOP).filter((id) => !s.upgrades[id]) : [],
    craft: dec,
    heal: dec && p.char === 'sporewick' && p.level >= 1 ? s.players.filter((x) => x !== p && x.at === p.at && !x.lost && x.lives < maxLives(s)) : [],
    convert: !s.pending && !T.converted && ((p.char === 'sporewick' && p.level >= 2) || (home && s.upgrades.furnace)),
    recall: dec && home && s.upgrades.beacon ? s.players.filter((x) => x.lost) : [],
    deposit: home && !s.pending,
    endTurn: !s.pending,
  };
}
