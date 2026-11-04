// Rootbound playtest app: lobby, HUD, and the glue between the rules engine, sync and 3D table.
import { createBoard } from './board3d.js';
import { createNet } from './net.js';
import { portraitDataURL } from './models.js';
import { botAction } from './ai.js';
import * as SND from './sound.js';
import * as E from './engine.js';
import {
  CARDS, CHARACTERS, BIOMES, RES, RES_LABEL, WEATHER, SCENARIOS, MONSTERS, UPGRADES, HORROR_MAX, DIRS,
  RISK_LABEL, STACK, WORKSHOP, CRAFTS, MODES, OUTPOST, QUESTS, QUESTS_TO_WIN, QUEST_MAX_ACTIVE, NIGHT, CHAIN, CHAIN_BIOME,
} from './data.js';

const A = 'assets/';
const $ = (s) => document.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const tok = (r, cls = 'tok') => h('img', { class: cls, src: `${A}ui/token-${r}.png`, alt: RES_LABEL[r] });
const costEl = (cost) => h('span', { class: 'cost' }, Object.entries(cost).map(([r, n]) => h('span', { title: `${n} ${RES_LABEL[r]}` }, n, tok(r))));
// Small line icons for the tray and the table buttons (24px grid, drawn with the current text colour).
const ICONS = {
  move: 'M8 3h5v8l6 3v4H5v-4l3-2z M5 18v2h14v-2',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13z M15.5 15.5 21 21',
  gather: 'M3 10h18l-2.2 10H5.2z M8 10l4-6 4 6 M9 14v3 M15 14v3',
  attack: 'M14.5 3H21v6.5L10 20.5 3.5 14z M6 15l3 3 M3 21l3-3',
  cleanse: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z M19 3v4 M17 5h4',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4 4 0 0 1 12 7.3a4 4 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z',
  outpost: 'M3 20 12 4l9 16z M12 4v16 M9 20l3-5 3 5',
  rest: 'M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z',
  chest: 'M4 10h16v10H4z M4 10l1.5-5h13L20 10 M10.5 13h3v3h-3z',
  train: 'M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.4l-5.4 3 1.2-6-4.5-4.1 6.1-.7z',
  build: 'M13 4.5l6.5 6.5-2.8 2.8-6.5-6.5z M10.2 9.8 3.5 16.5l3 3 6.7-6.7',
  quest: 'M7 4h10.5A1.5 1.5 0 0 1 19 5.5V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M9 9h6 M9 12.5h6 M9 16h3',
  heal: 'M12 5v14 M5 12h14',
  beacon: 'M12 2.5v3 M5.5 6l2 2 M18.5 6l-2 2 M9 21h6l-1.4-10h-3.2z M8 21h8',
  end: 'M6 3h12 M6 21h12 M7 3c0 5.5 10 5.5 10 9s-10 3.5-10 9 M17 3c0 5.5-10 5.5-10 9s10 3.5 10 9',
  book: 'M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z M12 6v13.5',
  recenter: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z',
  rules: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5 M12 17.5v.5 M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1',
  leave: 'M14 4H5v16h9 M10 12h11 M17.5 8.5 21 12l-3.5 3.5',
};
const ico = (name) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'ico'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
};
const iconBtn = (name, label, onclick) => h('button', { class: 'icon-btn', title: label, 'aria-label': label, onclick }, ico(name));
// A tray button: an icon over a short label.
const tb = (icon, label, onclick, { cls = '', disabled = false, title = '' } = {}) =>
  h('button', { class: 'btn tray-btn ' + cls, disabled, title: title || null, onclick }, h('span', { class: 'ti' }, typeof icon === 'string' ? ico(icon) : icon), h('span', { class: 'tl' }, label));
function setJournal(v) {
  journalOpen = v;
  const j = $('#hud .journal');
  if (j) { j.classList.toggle('open', v); j.setAttribute('aria-hidden', String(!v)); }
  $('#hud .journal-btn')?.setAttribute('aria-expanded', String(v));
  if (v) SND.play('card');
}

// Settings: sound, music, ambience, board atmosphere and graphics quality.
function showSettings() {
  const sw = (label, sub, key, apply) => {
    const b = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(prefs[key] !== false), 'aria-label': label, onclick: () => {
      prefs[key] = prefs[key] === false; savePrefs();
      b.setAttribute('aria-checked', String(prefs[key] !== false));
      apply();
    } }, h('span', { class: 'knob' }));
    return h('div', { class: 'set-row' }, h('div', {}, h('strong', {}, label), h('small', {}, sub)), b);
  };
  const applySound = () => { SND.init(); SND.setOptions(soundPrefs()); };
  const applyLook = () => { look.atmosphere = prefs.atmosphere !== false; look.quality = prefs.quality || look.quality; board?.setOptions({ ...look }); };
  const q = h('div', { class: 'seg', role: 'group', 'aria-label': 'Graphics quality' }, ['high', 'low'].map((v) => h('button', {
    'aria-pressed': String(look.quality === v),
    onclick: (e) => { prefs.quality = v; savePrefs(); applyLook(); [...q.children].forEach((x) => x.setAttribute('aria-pressed', String(x === e.currentTarget))); },
  }, v === 'high' ? 'High' : 'Low')));
  openModal(h('div', { class: 'panel settings-panel' },
    h('h2', {}, 'Settings'),
    h('div', { class: 'set-group' }, h('div', { class: 'eyebrow' }, 'Sound'),
      sw('Sound effects', 'Dice, cards, footsteps and monsters', 'sfx', applySound),
      sw('Forest ambience', 'Wind, birdsong by day, crickets at night', 'ambience', applySound),
      sw('Music', 'A quiet score for the expedition', 'music', applySound)),
    h('div', { class: 'set-group' }, h('div', { class: 'eyebrow' }, 'The table'),
      sw('Board atmosphere', 'Fog over unexplored land, fireflies and spores, dust, pulsing corruption', 'atmosphere', applyLook),
      h('div', { class: 'set-row' }, h('div', {}, h('strong', {}, 'Graphics'), h('small', {}, 'High adds glow, a miniature-style blur and the detailed figures. Low is lighter for phones.')), q)),
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: closeModal }, 'Done'))));
}

const hearts = (n, max) => h('span', { 'aria-label': `${n} of ${max} lives` }, Array.from({ length: max }, (_, i) => h('i', { class: 'heart' + (i < n ? '' : ' empty') })));
const portraits = {};
const faceOf = (c) => {
  if (!CHARACTERS[c].draftArt) return `${A}ui/${c}.jpg`;
  if (!portraits[c]) { try { portraits[c] = portraitDataURL(c, CHARACTERS[c]); } catch { portraits[c] = `${A}ui/sporelings.jpg`; } }
  return portraits[c];
};
const HUNGER_TEXT = { rep: 'Missing Food costs Reputation first, then a life', life: 'Missing Food costs a life' };
const prefs = (() => { try { return JSON.parse(localStorage.getItem('rootbound-prefs') || '{}'); } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem('rootbound-prefs', JSON.stringify(prefs)); } catch {} };

// Look and sound. Phones and small screens start on Low graphics.
const look = {
  atmosphere: prefs.atmosphere !== false,
  quality: prefs.quality || (matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700 ? 'low' : 'high'),
};
const soundPrefs = () => ({ sfx: prefs.sfx !== false, ambience: prefs.ambience !== false, music: prefs.music !== false });
SND.setOptions(soundPrefs());
// Browsers only allow audio after a tap or key press.
const wake = () => SND.init();
addEventListener('pointerdown', wake, { passive: true });
addEventListener('keydown', wake);
addEventListener('click', (e) => { if (e.target.closest?.('.btn, .m-item, .medal, .journal-btn, .j-tabs button, .switch')) SND.play('click'); });

let NET = null;          // { remote, local }
let store = null;        // the backend this game lives in
let gameId = null;
let game = null;         // latest state from the store
let shown = null;        // state currently drawn on the table
let board = null;
let unwatch = null;
let busy = false;
let hoverKey = null;
const queue = [];
let draining = false;
let peek = null;          // party medallion opened for details
let journalOpen = false;  // the journal drawer starts closed
let journalTab = 'goal';
let endSounded = false;
const settings = { spawnEvery: prefs.spawnRate || 3, lives: prefs.lives || 2, hunger: prefs.hunger || 'rep', scenario: prefs.scenario || 'skyship', mode: prefs.mode || 'standard', quests: !!prefs.quests };

// ------------------------------------------------------------------ toasts & modal
function toast(content, kind = '') {
  const t = h('div', { class: 'toast ' + kind }, content);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3300);
}
let modalResolve = null;
function openModal(content, { dismissable = true } = {}) {
  const m = $('#modal');
  m.replaceChildren(h('div', { class: 'modal-inner' }, content));
  m.classList.remove('hidden');
  m.onclick = dismissable ? (e) => { if (e.target === m) closeModal(); } : null;
  return new Promise((r) => { modalResolve = r; });
}
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal').replaceChildren();
  if (modalResolve) { const r = modalResolve; modalResolve = null; r(); }
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').classList.contains('hidden') && !(game?.pending && mine(game.pending.who))) closeModal(); });

function questCardEl(id, q) {
  const d = QUESTS[id];
  return h('div', { class: 'card-face draft quest' + (d.horrorBack ? ' corrupt' : ''), role: 'img', 'aria-label': d.title + ' quest card' },
    h('div', { class: 'star' }),
    h('div', { class: 'art', style: `background-image:url(${A}${d.art})` }),
    h('div', { class: 'text' },
      h('h4', {}, d.title),
      h('div', { class: 'sub' }, d.horrorBack ? 'Root King quest' : 'Quest'),
      h('div', { class: 'fl' }, d.flavor),
      h('div', { class: 'fx' }, d.text),
      h('div', { class: 'qreward' }, 'Reward: 1 Artifact, +1 Reputation', q ? ` · ${q.deadline - (game?.round || 0)} rounds` : '')),
    h('div', { class: 'badge' }, 'Quest'));
}
const questLine = (s, q) => {
  const d = QUESTS[q.id];
  const left = q.deadline - s.round;
  const prog = ['explore', 'cleanse', 'slay'].includes(q.kind) && q.goal > 1 ? ` (${q.progress}/${q.goal})` : '';
  const what = q.carrier ? `Carry them home: ${s.players.find((p) => p.char === q.carrier)?.name}` : d.text;
  return { d, left, text: what + prog };
};

function draftFace(title, sub, flavor, text, art, cls) {
  return h('div', { class: 'card-face draft' + cls, role: 'img', 'aria-label': title + ' card' },
    h('div', { class: 'star' }),
    h('div', { class: 'art', style: `background-image:url(${A}${art})` }),
    h('div', { class: 'text' }, h('h4', {}, title), h('div', { class: 'sub' }, sub), h('div', { class: 'fl' }, flavor), h('div', { class: 'fx' }, text)),
    h('div', { class: 'badge' }, 'Draft card'));
}

function cardEl(id, kind = 'discovery') {
  if (kind === 'weather' && WEATHER[id].draft) return draftFace(WEATHER[id].title, 'Weather', WEATHER[id].draft.flavor, WEATHER[id].text, WEATHER[id].draft.art, '');
  if (kind === 'weather') return h('img', { class: 'card-face', src: `${A}cards/${id}.jpg`, alt: WEATHER[id].title + ' weather card' });
  if (kind === 'night') {
    const n = NIGHT[id];
    return draftFace(n.title, `Night \u2022 ${n.mood === 'good' ? 'a small mercy' : n.mood === 'relief' ? 'quiet' : 'danger'}`, n.flavor, n.text, 'cardart/corrupted_1.jpg', ' night');
  }
  if (kind === 'monster') return h('img', { class: 'card-face', src: `${A}cards/${MONSTERS[id].card}.jpg`, alt: MONSTERS[id].name });
  const c = CARDS[id];
  if (c.img) return h('img', { class: 'card-face', src: A + c.img, alt: c.title + ' card' });
  const d = c.draft;
  if (c.type === 'story') return draftFace(c.title, `Story \u2022 ${d.biome}`, d.flavor, d.text, d.art, ' quest');
  return h('div', { class: 'card-face draft' + (c.corrupt ? ' corrupt' : ''), role: 'img', 'aria-label': c.title + ' card' },
    h('div', { class: 'star' }),
    h('div', { class: 'art', style: `background-image:url(${A}${d.art})` }),
    h('div', { class: 'text' },
      h('h4', {}, c.title),
      h('div', { class: 'sub' }, `${c.type} • ${d.biome}`),
      h('div', { class: 'fl' }, d.flavor),
      h('div', { class: 'fx' }, d.text)),
    h('div', { class: 'badge' }, 'Draft card'));
}

// ------------------------------------------------------------------ identity helpers
const myUid = () => store?.uid;
function mine(char) {
  if (!game?.players && !game?.seats) return false;
  const seat = (game.players || game.seats).find((x) => x.char === char);
  return !!seat && !seat.ai && (!store.online || seat.uid === myUid());
}

// ------------------------------------------------------------------ AI players
// One device runs AI turns: the host's (or this device offline). If the host is away, any
// seated player's device takes over after a short wait.
let aiTimer = null, aiWaitSince = 0, aiTurnKey = '', aiCount = 0;
function scheduleAi() {
  clearTimeout(aiTimer);
  const s = game;
  if (!s || s.phase !== 'playing' || draining) return;
  const cur = s.players[s.turn];
  if (!cur?.ai) { aiWaitSince = 0; return; }
  const host = !store.online || s.hostUid === myUid();
  const seated = s.players.some((p) => !p.ai && p.uid === myUid());
  if (!aiWaitSince) aiWaitSince = Date.now();
  const takeOver = seated && Date.now() - aiWaitSince > 15000;
  if (!host && !takeOver) { aiTimer = setTimeout(scheduleAi, 4000); return; }
  aiTimer = setTimeout(runAi, 850);
}
async function runAi() {
  const seq = game.seq;
  const turnKey = `${game.round}:${game.turn}`;
  if (turnKey !== aiTurnKey) { aiTurnKey = turnKey; aiCount = 0; }
  aiCount++;
  await mutate((st) => {
    if (st.seq !== seq || st.phase !== 'playing') return st;   // someone else moved first
    const cur = st.players[st.turn];
    if (!cur.ai) return st;
    const action = aiCount > 30 ? (st.pending ? { type: 'choose', index: 0 } : { type: 'endTurn' }) : botAction(st);
    try { return E.act(st, cur.char, action).state; }
    catch (e) {
      if (!(e instanceof E.RuleError)) throw e;
      return E.act(st, cur.char, st.pending ? { type: 'choose', index: 0 } : { type: 'endTurn' }).state;
    }
  });
  aiWaitSince = 0;
  setTimeout(scheduleAi, 1500); // in case the move was skipped (another action was in flight)
}

// ------------------------------------------------------------------ title screen
function showTitle() {
  SND.setScene('title'); SND.setPhase('day'); endSounded = false; peek = null; journalOpen = false;
  if (unwatch) { unwatch(); unwatch = null; }
  game = shown = null; gameId = null;
  $('#hud').classList.add('hidden');
  $('#room').classList.add('hidden');
  const t = $('#title');
  t.classList.remove('hidden');
  const nameIn = h('input', { id: 'player-name', value: prefs.name || '', maxlength: 24, placeholder: 'e.g. Yowano', autocomplete: 'nickname' });
  nameIn.addEventListener('input', () => { prefs.name = nameIn.value; savePrefs(); });
  const seg = (label, key, opts) => h('div', { class: 'field' }, h('label', {}, label),
    h('div', { class: 'seg', role: 'group', 'aria-label': label }, opts.map(([v, txt]) => h('button', {
      type: 'button', 'aria-pressed': String(settings[key] === v),
      onclick: (e) => { settings[key] = v; prefs[key === 'spawnEvery' ? 'spawnRate' : key] = v; savePrefs(); [...e.target.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.target))); },
    }, txt))));
  const online = !!NET?.remote;
  const setup = [
    h('p', { class: 'lede' }, 'Gather up to five Mushroomfolk, build your invention, and finish it before the forest wakes.'),
    h('div', { class: 'field' }, h('label', { for: 'player-name' }, 'Your name'), nameIn),
    h('div', { class: 'settings' },
      seg('Board', 'mode', Object.entries(MODES).map(([id, m]) => [id, `${m.name} (${m.text})`])),
      seg('Goal', 'scenario', Object.entries(SCENARIOS).map(([id, sc]) => [id, sc.name.replace('The ', '')])),
      seg('A monster appears every', 'spawnEvery', [[3, '3 corruption'], [4, '4 (gentler)']]),
      seg('Lives per Mushroomfolk', 'lives', [[2, '2 (as designed)'], [3, '3 (gentler)']]),
      seg('No Food to lose?', 'hunger', [['rep', 'Lose Reputation first'], ['life', 'Lose a life']]),
      seg('Quests', 'quests', [[false, 'Off'], [true, `On: ${QUESTS_TO_WIN} to win, Artifact in every part`]])),
    h('div', { class: 'actions' },
      online && h('button', { class: 'btn primary', onclick: () => createGame(NET.remote) }, 'Start online expedition'),
      h('button', { class: 'btn' + (online ? '' : ' primary'), onclick: () => createGame(NET.local) }, 'Play on this device')),
    !NET ? h('p', { class: 'note' }, 'Connecting…')
      : online ? h('p', { class: 'note' }, 'Online expeditions are shared with everyone who can open this page. Friends join from their own device and see every move live.')
      : h('p', { class: 'note' }, 'Online play isn’t available in this view, so expeditions stay on this device (pass-and-play). Open the published game page in Claude to play with friends.'),
  ];
  const list = h('div', { class: 'game-list' }, h('p', { class: 'note' }, online ? 'Looking for expeditions…' : 'No saved expeditions yet.'));
  const join = [
    list,
    online && h('p', { class: 'note' }, 'To invite friends: open Share on this page and add them by email as Editors. Then they open the link, enter a name, and join here.'),
  ];
  const folk = [h('div', { class: 'folk' }, Object.entries(CHARACTERS).map(([id, c]) => h('article', { class: 'folk-card' },
    h('img', { src: faceOf(id), alt: '' }),
    h('div', {}, h('h3', {}, c.name), h('div', { class: 'role' }, c.role),
      h('p', {}, h('b', {}, c.ability + '. '), c.abilityText), h('p', { class: 'quote' }, `“${c.quote}”`)))))];

  const drawer = h('aside', { class: 'drawer', 'aria-label': 'Menu panel' });
  const closeDrawer = () => { drawer.classList.remove('open'); t.classList.remove('drawer-open'); };
  const openDrawer = (title, content) => {
    drawer.replaceChildren(h('div', { class: 'scroll' },
      h('button', { class: 'scroll-close', 'aria-label': 'Close', onclick: closeDrawer }, '×'),
      h('div', { class: 'scroll-orn', 'aria-hidden': 'true' }),
      h('h2', {}, title), ...content.filter(Boolean)));
    drawer.classList.add('open');
    t.classList.add('drawer-open');
    drawer.querySelector('input, button.btn')?.focus({ preventScroll: true });
  };
  const badge = h('span', { class: 'm-badge', hidden: true });
  const item = (label, sub, onclick, primary, extra) => h('button', { class: 'm-item' + (primary ? ' primary' : ''), onclick },
    h('span', { class: 'm-gem', 'aria-hidden': 'true' }), h('span', { class: 'm-text' }, h('span', { class: 'm-label' }, label, extra), h('span', { class: 'm-sub' }, sub)));
  const menu = h('nav', { class: 'menu', 'aria-label': 'Main menu' },
    item('Begin an Expedition', 'Gather a party and set out', () => openDrawer('Begin an Expedition', setup), true),
    item(online ? 'Join an Expedition' : 'Continue', online ? 'Friends’ games and your own' : 'Saved games on this device', () => openDrawer(online ? 'Join an Expedition' : 'Saved Expeditions', join), false, badge),
    item('The Mushroomfolk', 'Meet the five inventors', () => openDrawer('The Mushroomfolk', folk)),
    item('How to Play', 'The rules of the Everdeep', showGuide),
    item('Settings', 'Sound, music and graphics', showSettings));
  const stage = h('div', { class: 'hero-stage', 'aria-hidden': 'true' },
    h('img', { class: 'hero-art', src: `${A}ui/cover-hd.jpg`, alt: '' }),
    h('div', { class: 'hero-fire' }), h('i', { class: 'hero-eye', style: 'left:70.75%;top:20.7%' }), h('i', { class: 'hero-eye', style: 'left:74.15%;top:19.7%' }));
  const motes = h('canvas', { class: 'hero-motes', 'aria-hidden': 'true' });
  t.replaceChildren(
    h('div', { class: 'hero' }, stage, motes, h('div', { class: 'hero-shade' })),
    h('h1', { class: 'sr-only' }, 'Rootbound: Discover, Survive, Invent, Together'),
    h('div', { class: 'title-ui' }, menu,
      h('p', { class: 'title-foot' }, online ? 'Online play ready · up to 5 players' : NET ? 'Pass-and-play on this device · up to 5 players' : 'Connecting…')),
    drawer);
  runMotes(motes, t);
  t.onkeydown = (e) => { if (e.key === 'Escape') closeDrawer(); };

  const rows = { remote: [], local: [] };
  const draw = () => {
    const all = [...rows.remote.map((g) => [NET.remote, g]), ...rows.local.map((g) => [NET.local, g])];
    badge.hidden = !all.length;
    badge.textContent = String(all.length);
    if (!all.length) { list.replaceChildren(h('p', { class: 'note' }, online ? 'No expeditions yet. Start one and your friends will see it here.' : 'No saved expeditions yet.')); return; }
    list.replaceChildren(...all.map(([be, g]) => {
      const seated = (g.seats || []).some((x) => x.uid === be.uid);
      const status = g.phase === 'lobby' ? `Gathering the party · ${g.seats.length}/4`
        : g.phase === 'over' ? (g.result?.result === 'won' ? 'Victory' : 'Fallen') + ` · round ${g.round}` : `Round ${g.round} · ${g.seats.map((s) => s.name).join(', ')}`;
      const label = g.phase === 'lobby' ? (seated ? 'Open' : 'Join') : seated ? 'Resume' : 'Watch';
      return h('div', { class: 'game-row' },
        h('div', { class: 'meta' }, h('strong', {}, g.name), h('small', {}, (be.online ? '' : 'This device · ') + status)),
        h('button', { class: 'btn small primary', onclick: () => openGame(be, g.id) }, label),
        (g.hostUid === be.uid || !be.online) && h('button', { class: 'btn small danger', 'aria-label': `Delete ${g.name}`, onclick: async (e) => {
          const b = e.currentTarget;
          if (b.dataset.armed) { await be.remove(g.id); } else { b.dataset.armed = '1'; b.textContent = 'Confirm'; }
        } }, 'Delete'));
    }));
  };
  if (NET?.local) NET.local.listGames((gs) => { rows.local = gs.sort((a, b) => b.updated - a.updated).slice(0, 8); draw(); });
  if (NET?.remote) NET.remote.listGames((gs) => { rows.remote = gs; draw(); }, () => { rows.remote = []; draw(); });
}

// Spores, embers and fireflies drifting over the title art.
let motesRunning = null;
function runMotes(canvas, host) {
  if (motesRunning) cancelAnimationFrame(motesRunning);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const g = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const kinds = [
    { c: '255,178,90', n: 26, r: [0.8, 2.2], vy: [-0.35, -0.12], fire: true },   // embers from the campfire
    { c: '200,255,170', n: 22, r: [1.2, 2.6], vy: [-0.12, 0.05], blink: true },  // fireflies
    { c: '170,140,255', n: 14, r: [0.8, 1.8], vy: [-0.18, -0.05] },              // crystal motes
    { c: '240,225,200', n: 30, r: [0.5, 1.3], vy: [-0.08, 0.08] },               // spores
  ];
  const rand = (a, b) => a + Math.random() * (b - a);
  let ps = [];
  const spawn = (k, fresh) => ({
    k, r: rand(...k.r), vy: rand(...k.vy), vx: rand(-0.15, 0.15), ph: Math.random() * 6.28,
    x: k.fire ? W * rand(0.53, 0.65) : rand(0, W), y: k.fire ? (fresh ? H * rand(0.6, 0.85) : H * 0.86) : rand(0, H),
    life: k.fire ? rand(160, 360) : Infinity,
  });
  const resize = () => {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    ps = kinds.flatMap((k) => Array.from({ length: k.n }, () => spawn(k, true)));
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  let t0 = 0;
  const tick = (t) => {
    if (host.classList.contains('hidden') || !canvas.isConnected) { ro.disconnect(); motesRunning = null; return; }
    const dt = Math.min(3, (t - (t0 || t)) / 16.7); t0 = t;
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.ph += 0.03 * dt;
      p.x += (p.vx + Math.sin(p.ph) * 0.18) * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.y < -10 || p.y > H + 10 || p.x < -10 || p.x > W + 10 || p.life <= 0) { ps[i] = spawn(p.k, false); continue; }
      let a = p.k.blink ? Math.max(0, Math.sin(p.ph * 1.7)) : 0.8;
      if (p.k.fire) a *= Math.min(1, p.life / 80);
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      grd.addColorStop(0, `rgba(${p.k.c},${a})`); grd.addColorStop(1, `rgba(${p.k.c},0)`);
      g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, p.r * 4, 0, 6.283); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    motesRunning = requestAnimationFrame(tick);
  };
  motesRunning = requestAnimationFrame(tick);
}

async function createGame(be) {
  const name = (prefs.name || '').trim() || 'A wanderer';
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const lobby = E.newLobby({ id, name: `${name}’s expedition`, hostUid: be.uid, spawnEvery: settings.spawnEvery, lives: settings.lives, hunger: settings.hunger, scenario: settings.scenario, mode: settings.mode, quests: settings.quests });
  try {
    await be.create(lobby);
    openGame(be, id);
  } catch (e) {
    toast(be.online ? 'Couldn’t save online (you may only have view access). Playing on this device instead.' : e.message, 'bad');
    if (be.online) createGame(NET.local);
  }
}

function openGame(be, id) {
  if (unwatch) unwatch();
  store = be; gameId = id; game = shown = null;
  $('#title').classList.add('hidden');
  unwatch = be.watch(id, onState, () => toast('Lost connection to this expedition.', 'bad'));
}

// ------------------------------------------------------------------ waiting room
function showRoom(s) {
  $('#hud').classList.add('hidden');
  const room = $('#room');
  room.classList.remove('hidden');
  const myName = (prefs.name || '').trim();
  const seatedHere = s.seats.some((x) => !store.online || x.uid === myUid());
  const cards = Object.entries(CHARACTERS).map(([id, c]) => {
    const seat = s.seats.find((x) => x.char === id);
    const isMine = seat && (!store.online || seat.uid === myUid());
    return h('article', { class: 'char-card' + (seat ? ' taken' : '') },
      seat && h('div', { class: 'seat' }, h('span', {}, seat.name + (isMine && store.online ? ' (you)' : ''))),
      h('img', { src: faceOf(id), alt: `${c.name}, ${c.role}` }),
      h('div', { class: 'body' },
        h('h3', {}, c.name), h('div', { class: 'role' }, c.role),
        h('div', { class: 'ability' }, h('b', {}, c.ability + '. '), c.abilityText),
        h('div', { class: 'quote' }, `“${c.quote}”`),
        h('div', { class: 'ability' }, c.levels.map((lv, i) => h('div', {}, h('b', {}, `Lv ${i + 1} ${lv.name}. `), lv.text))),
        !seat ? h('button', { class: 'btn primary', onclick: () => mutate((st) => E.joinSeat(st, { uid: myUid(), name: store.online ? myName : (myName && !seatedHere ? myName : c.name), char: id })) },
          seatedHere ? `Also play ${c.name}` : `Play as ${c.name}`)
          : isMine || (seat.ai && (seatedHere || s.hostUid === myUid())) ? h('button', { class: 'btn small', onclick: () => mutate((st) => E.leaveSeat(st, id)) }, seat.ai ? 'Remove AI' : 'Leave seat') : null,
        !seat && h('button', { class: 'btn small', title: 'A computer-controlled Mushroomfolk joins the party', onclick: () => mutate((st) => E.joinSeat(st, { char: id, ai: true })) }, 'Add as AI')));
  });
  const humanHere = s.seats.some((x) => !x.ai && (!store.online || x.uid === myUid()));
  const canStart = s.seats.length > 0 && (humanHere || s.hostUid === myUid());
  room.replaceChildren(h('div', { class: 'room-inner' },
    h('div', { class: 'room-head' },
      h('div', {}, h('div', { class: 'eyebrow' }, store.online ? 'Gathering the party · online' : 'Gathering the party · this device'),
        h('h1', {}, s.name),
        h('p', { class: 'note' }, `${MODES[s.settings.mode || 'standard'].name} (${MODES[s.settings.mode || 'standard'].text}) · Goal: ${SCENARIOS[s.settings.scenario].name} · a monster every ${s.settings.spawnEvery} corruption · ${s.settings.lives} lives each · ${HUNGER_TEXT[s.settings.hunger || 'life']}${s.settings.quests ? ` · Quest mode (${QUESTS_TO_WIN} to win)` : ''}`)),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: showTitle }, 'Back'),
        h('button', { class: 'btn primary', disabled: !canStart, onclick: () => mutate((st) => E.startGame(st).state) }, 'Set out'))),
    store.online && h('p', { class: 'note' }, 'Friends who open this page will see this expedition under “Join an expedition”. Each friend picks a Mushroomfolk; one device can also play several.'),
    h('div', { class: 'chars' }, cards)));
}

// ------------------------------------------------------------------ state flow
function onState(s) {
  const prevSeq = game?.seq;
  game = s;
  if (s.phase === 'lobby') { showRoom(s); return; }
  SND.setScene('game');
  $('#room').classList.add('hidden');
  $('#title').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  if (!board) {
    board = createBoard($('#stage'), { assetBase: A, onHexClick, onHexHover: (k) => { hoverKey = k; renderTip(); }, ...look });
    board.setState(s);
    board.resetView();
  }
  const animate = shown && prevSeq != null && s.seq === prevSeq + 1 && s.events?.length;
  queue.push({ s, animate });
  drain();
}

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const { s, animate } = queue.shift();
    if (animate && !queue.length) {
      board.setHighlights(null);
      renderHud(shown, true);
      await board.play(s.events, s, { onEvent: (e) => narrate(e, s), onMonsterStep: (e, st) => {
        const m = s.monsters.find((x) => x.id === e.id) || shown.monsters.find((x) => x.id === e.id);
        const name = m ? MONSTERS[m.kind].name : 'The monster';
        toast(`${name} ${st.blocked ? 'is blocked' : 'steps ' + DIRS[st.roll - 1].name}${st.trap ? ' into a snare!' : ''}`);
        SND.play('monsterStep');
      } });
    } else {
      board.setState(s);
    }
    shown = s;
    SND.setPhase(E.phaseOf(s));
    renderHud(s);
  }
  draining = false;
  scheduleAi();
}

async function narrate(e, s) {
  const who = (c) => s.players.find((p) => p.char === c)?.name || c;
  const sfx = { gain: 'gain', lose: 'lose', hurt: 'hurt', dice: 'dice', reveal: 'flip', move: 'step', corrupt: 'corrupt', cleanse: 'cleanse', quest: 'quest', questDone: 'quest',
    chainDone: 'quest', chain: 'gain', build: 'build', improve: 'build', outpost: 'build', advance: 'quest', revive: 'cleanse', spawn: 'growl', strike: 'hurt', kill: 'gain',
    outpostLost: 'corrupt', questFail: 'corrupt', escape: 'growl', lost: 'hurt', trap: 'build' }[e.t];
  if (sfx) SND.play(sfx);
  if (e.t === 'life' && e.delta < 0) SND.play('hurt');
  switch (e.t) {
    case 'gain': toast([`${who(e.who)} +${e.n}`, tok(e.res)], 'good'); break;
    case 'lose': toast([`${who(e.who)} −${e.n}`, tok(e.res)], 'bad'); break;
    case 'rep': toast(`${who(e.who)} +${e.delta} Reputation`, 'good'); break;
    case 'life': toast([`${who(e.who)} `, e.delta < 0 ? 'loses a life' : 'recovers a life'], e.delta < 0 ? 'bad' : 'good'); break;
    case 'lost': toast(`${who(e.who)} is Lost! A friend can revive them on that tile.`, 'bad'); break;
    case 'revive': toast(`${who(e.by)} revives ${who(e.who)}!`, 'good'); break;
    case 'advance': toast(`${who(e.who)} reaches level ${e.level}: ${CHARACTERS[e.who].levels[e.level - 1].name}!`, 'good'); break;
    case 'improve': toast(`${who(e.who)} builds the ${WORKSHOP[e.id].name}`, 'good'); break;
    case 'trap': toast('A snare is set'); break;
    case 'pylons': toast(`The Pylons hold! ${e.held}/3`, 'good'); break;
    case 'escape': toast('The Root King regrows in the Corrupted Lands. Only the Cage can hold it!', 'bad'); break;
    case 'finale': toast(e.kind === 'weather-engine' ? 'The Pylons light up! Hold both for 3 rounds.' : e.kind === 'monster-cage' ? 'The Cage is ready. Bring down the Root King!' : 'The Skyship is ready! Stock 1 Food per crew member and gather aboard.', 'good'); break;
    case 'build': toast(`${who(e.who)} builds the ${SCENARIOS[s.settings.scenario].parts.find((x) => x.id === e.part).name}!`, 'good'); break;
    case 'turn': toast(`${who(e.who)}’s turn`); break;
    case 'quest': {
      const done = openModal(h('div', { class: 'card-wrap' }, questCardEl(e.id, s.quest?.active.find((q) => q.qid === e.qid)),
        h('div', { class: 'card-note' }, e.at ? 'A new quest! A gold banner marks the spot on the map.' : 'A new quest! Track its progress in the Quests panel.'), h('button', { class: 'btn primary', onclick: closeModal }, 'Onward')));
      if (e.at) board.focus(e.at);
      await Promise.race([done, new Promise((r) => setTimeout(r, 6000))]);
      closeModal();
      break;
    }
    case 'night': {
      SND.setPhase('night');
      SND.play('card');
      await board.drawCard('night');
      const done = openModal(h('div', { class: 'card-wrap' }, cardEl(e.id, 'night'), h('div', { class: 'card-note' }, 'Night falls. This card lasts the whole Night.')));
      await Promise.race([done, new Promise((r) => setTimeout(r, 3200))]);
      closeModal();
      break;
    }
    case 'chain': toast(`The Broken Compass: step ${e.step} of 4. Next clue: Search a ${BIOMES[CHAIN_BIOME[e.step]].name} tile.`, 'good'); break;
    case 'chainDone': toast(`The Sealed Vault opens! 2 Artifacts, and it counts as 2 quests (${e.done}/${QUESTS_TO_WIN})`, 'good'); break;
    case 'questDone': toast(`Quest complete: ${QUESTS[e.id].title}! (${e.done}/${QUESTS_TO_WIN})`, 'good'); break;
    case 'questFail': toast(`Quest failed: ${QUESTS[e.id].title}. The forest grows darker.`, 'bad'); break;
    case 'escort': toast(`${who(e.who)} takes charge. Head for the Workshop!`, 'good'); break;
    case 'outpost': toast(`${who(e.who)} raises an Outpost`, 'good'); break;
    case 'outpostLost': toast(e.by ? 'A monster tramples an Outpost flat!' : 'Corruption swallows an Outpost!', 'bad'); break;
    case 'stuck': toast('A snared monster thrashes but cannot move', 'good'); break;
    case 'strike': toast(`It strikes back at ${e.hit.map(who).join(', ')}!`, 'bad'); break;
    case 'wander': toast(`${who(e.who)} wanders the forest, Lost\u2026 catch them to bring them back`, 'bad'); break;
    case 'stir': toast(e.phase === 'night' ? 'Night deepens. The forest stirs…' : 'The forest stirs…', 'bad'); break;
    case 'dice': toast(`${who(e.who)} rolls: ${e.faces.map((f) => RISK_LABEL[f]).join(', ')}`); break;
    case 'corrupt': if (e.why !== 'spread') toast(`Corruption spreads (${e.horror}/${HORROR_MAX})`, 'bad'); break;
    case 'round': {
      SND.play('card');
      await board.drawCard('weather');
      toast(`Round ${e.round} · ${e.phase === 'night' ? 'Night' : 'Day'} · ${WEATHER[e.weather].title}`);
      const done = openModal(h('div', { class: 'card-wrap' }, cardEl(e.weather, 'weather'),
        h('div', { class: 'card-note' }, WEATHER[e.weather].text)));
      await Promise.race([done, new Promise((r) => setTimeout(r, 2600))]);
      closeModal();
      break;
    }
    case 'spawn': {
      board.focus(e.at);
      const done = openModal(h('div', { class: 'card-wrap' }, cardEl(e.kind, 'monster'),
        h('div', { class: 'card-note' }, e.boss ? 'The Root King awakens! If it reaches the Workshop, the game is lost. Defeat it, or launch the Skyship first.'
          : `${MONSTERS[e.kind].name} appears (${MONSTERS[e.kind].hp} health). Each round it rolls the die 3 times and steps that way.`)));
      await Promise.race([done, new Promise((r) => setTimeout(r, 2600))]);
      closeModal();
      break;
    }
    case 'card': {
      SND.play('card');
      await board.drawCard('discovery');
      const p = s.pending;
      if (p && p.kind === 'choice' && p.card === e.id && p.who === e.who) break; // the choice dialog will show it
      const c = CARDS[e.id];
      const actor = mine(e.who);
      const done = openModal(h('div', { class: 'card-wrap' }, cardEl(e.id),
        c.note && h('div', { class: 'card-note' }, c.note),
        actor && h('button', { class: 'btn primary', onclick: closeModal }, 'Continue')));
      await Promise.race([done, new Promise((r) => setTimeout(r, actor ? 9000 : 3200))]);
      closeModal();
      break;
    }
  }
}

async function mutate(fn) {
  if (busy) return;
  busy = true;
  try { await store.mutate(gameId, fn); }
  catch (e) { toast(e.message || 'Something went wrong.', 'bad'); }
  finally { busy = false; }
}
function act(action) {
  const cur = game.players[game.turn];
  return mutate((s) => E.act(s, cur.char, action).state);
}

// ------------------------------------------------------------------ board input
function onHexClick(k) {
  const s = shown;
  if (!s || s.phase !== 'playing' || draining) return;
  const cur = s.players[s.turn];
  if (!mine(cur.char)) return;
  const reach = cur.turn && (cur.turn.fueled || cur.turn.mp > 0) ? E.reachable(s, cur) : {};
  if (reach[k]) { act({ type: 'move', to: k }); return; }
  if (!cur.turn.fueled && E.dist(k, cur.at) === 1) toast('Choose how to set out first: eat Food, spend a life, or trudge 1 step.');
  else if (k !== cur.at) toast('That tile is out of reach this turn.');
}

function renderTip() {
  const tip = $('#tile-tip');
  if (!tip || !shown?.tiles) return;
  const k = hoverKey;
  if (!k) { tip.classList.add('hidden'); return; }
  const t = shown.tiles[k];
  const bits = [];
  if (!t.revealed) bits.push(h('b', {}, 'Unexplored'));
  else bits.push(h('b', {}, BIOMES[t.biome].name));
  if (t.revealed && t.biome !== 'workshop') bits.push(` · move ${BIOMES[t.biome].cost}`);
  if (t.corrupted) bits.push(' · Corrupted');
  if (t.harvest) bits.push(t.harvest >= 2 ? ' · Exhausted' : ' · Disturbed');
  const mons = shown.monsters.filter((m) => m.at === k);
  if (mons.length) bits.push(' · ' + mons.map((m) => `${MONSTERS[m.kind].name} (${m.hp}${m.stuck ? ', snared' : ''})`).join(', '));
  if (shown.outposts?.[k]) bits.push(' · Outpost');
  const lostHere = shown.players.filter((p) => p.lost && p.at === k);
  if (lostHere.length) bits.push(' · Lost: ' + lostHere.map((p) => p.name).join(', '));
  const ps = shown.players.filter((p) => p.at === k);
  if (ps.length) bits.push(' · ' + ps.map((p) => p.name).join(', '));
  tip.replaceChildren(...bits);
  tip.classList.remove('hidden');
}

// ------------------------------------------------------------------ HUD
function renderHud(s, animating = false) {
  if (!s?.players) return;
  const hud = $('#hud');
  const cur = s.players[s.turn];
  const myTurn = s.phase === 'playing' && cur && mine(cur.char) && !animating;
  const o = myTurn ? E.options(s) : null;
  const phase = E.phaseOf(s);
  const w = WEATHER[s.weather];
  const scen = SCENARIOS[s.settings.scenario];
  const home = '0,0';

  // top bar: round medallion, weather, night, horror track, table buttons
  const track = h('div', { class: 'track', 'aria-label': `Horror track ${s.horror} of ${HORROR_MAX}` },
    Array.from({ length: HORROR_MAX }, (_, i) => h('i', {
      class: [i < s.horror ? 'on' : '', (i + 1) % s.settings.spawnEvery === 0 && i + 1 < HORROR_MAX ? 'spawn' : '', i + 1 === HORROR_MAX ? 'king' : ''].join(' '),
      title: i + 1 === HORROR_MAX ? 'The Root King awakens' : (i + 1) % s.settings.spawnEvery === 0 ? 'A monster appears' : '',
    })));
  const top = h('header', { class: 'topbar' },
    h('div', { class: 'round-medal ' + phase, title: `Round ${s.round} · ${phase === 'night' ? 'Night' : 'Day'}` },
      h('span', { class: 'ph ' + phase }), h('b', {}, s.round), h('small', {}, phase === 'night' ? 'Night' : 'Day')),
    w && h('button', { class: 'weather-chip', onclick: () => openModal(h('div', { class: 'card-wrap' }, cardEl(s.weather, 'weather'), h('div', { class: 'card-note' }, w.text), h('button', { class: 'btn', onclick: closeModal }, 'Close'))) },
      h('img', { src: A + (w.draft ? w.draft.art : `cards/${s.weather}.jpg`), alt: '' }), h('span', {}, w.title, h('small', {}, w.text))),
    s.night && h('button', { class: 'weather-chip night-chip', onclick: () => openModal(h('div', { class: 'card-wrap' }, cardEl(s.night, 'night'), h('button', { class: 'btn', onclick: closeModal }, 'Close'))) },
      h('span', {}, NIGHT[s.night].title, h('small', {}, NIGHT[s.night].text))),
    h('div', { class: 'horror' },
      h('div', { class: 'lbl' }, h('span', {}, 'Horror'), h('b', {}, `${s.horror} / ${HORROR_MAX}`)), track),
    h('div', { class: 'top-actions' },
      iconBtn('recenter', 'Recenter the camera', () => board.resetView()),
      iconBtn('rules', 'Rules', showGuide),
      iconBtn('gear', 'Settings', showSettings),
      iconBtn('leave', 'Leave the table', showTitle)));

  // party: a column of portrait medallions; tap one for that Mushroomfolk's details
  const party = h('nav', { class: 'party', 'aria-label': 'The party' }, s.players.map((p, i) => {
    const active = i === s.turn && s.phase === 'playing';
    return h('button', {
      class: 'medal' + (active ? ' active' : '') + (p.lost ? ' lost' : '') + (peek === p.char ? ' peeked' : ''),
      style: `--ring:${CHARACTERS[p.char].base}`, 'aria-pressed': String(peek === p.char),
      'aria-label': `${p.name}, ${CHARACTERS[p.char].name}: ${p.lives} lives, ${p.rep} Reputation${p.lost ? ', Lost' : ''}`,
      onclick: () => { peek = peek === p.char ? null : p.char; renderHud(shown); },
    },
      h('span', { class: 'face' }, h('img', { src: faceOf(p.char), alt: '' })),
      h('span', { class: 'lv', title: 'Level' }, p.level || 0),
      p.ai ? h('span', { class: 'rib' }, 'AI') : mine(p.char) && store.online ? h('span', { class: 'rib you' }, 'You') : null,
      h('span', { class: 'hp' }, hearts(p.lives, E.maxLives(s))),
      h('span', { class: 'nm' }, p.name));
  }));
  const pp = peek && s.players.find((p) => p.char === peek);
  const peekCard = pp && h('section', { class: 'panel peek' },
    h('button', { class: 'x', 'aria-label': 'Close', onclick: () => { peek = null; renderHud(shown); } }, '×'),
    h('div', { class: 'nm' }, h('strong', {}, pp.name), h('small', {}, `${CHARACTERS[pp.char].name} · ${CHARACTERS[pp.char].role}`)),
    h('div', { class: 'stats' }, hearts(pp.lives, E.maxLives(s)), h('span', { title: 'Reputation' }, `✦ ${pp.rep}`), h('span', {}, `Level ${pp.level || 0}`),
      h('span', { class: 'slots', title: 'Backpack slots used' }, `bag ${E.slotsUsed(pp.bag)}/${pp.slots}`), pp.lost && h('span', { class: 'tag lost' }, 'Lost')),
    h('div', { class: 'bag' }, RES.filter((r) => pp.bag[r] > 0).map((r) => h('span', {}, tok(r), pp.bag[r])),
      !RES.some((r) => pp.bag[r] > 0) && h('span', { class: 'slots' }, 'Empty backpack')),
    h('p', { class: 'ab' }, h('b', {}, CHARACTERS[pp.char].ability + ': '), CHARACTERS[pp.char].abilityText),
    CHARACTERS[pp.char].levels.slice(0, pp.level).map((l) => h('p', { class: 'ab' }, h('b', {}, l.name + ': '), l.text)));

  // journal pages: goal, quests, stores, workshop, chronicle
  const atHome = cur && cur.at === home;
  const parts = h('div', { class: 'parts' }, scen.parts.map((part) => {
    const done = s.built[part.id];
    const can = myTurn && o.build.some((x) => x.id === part.id) && Object.entries(E.partCost(s, part)).every(([r, n]) => s.storage[r] + cur.bag[r] >= n);
    return h('div', { class: 'part' + (done ? ' done' : '') },
      h('div', {}, h('div', { class: 'pn' }, part.name), done ? h('small', {}, `Built by ${s.players.find((p) => p.char === done)?.name}`) : costEl(E.partCost(s, part))),
      !done && myTurn && h('button', { class: 'btn small primary', disabled: !can, title: atHome ? 'Uses Workshop storage first, then your backpack' : 'Build at the Workshop', onclick: () => act({ type: 'build', part: part.id }) }, 'Build'));
  }));
  const ship = h('section', { class: 'page' }, h('h3', {}, scen.name),
    h('img', { class: 'ship-art', src: A + scen.art, alt: '' }),
    h('p', { class: 'note', style: 'margin:6px 0 0' }, scen.goal), parts,
    s.finale?.pylons && h('p', { class: 'note', style: 'margin:8px 0 0;color:var(--gold-deep)' }, `Pylons held: ${s.finale.held}/3 rounds. Keep a Mushroomfolk on each clean Pylon at the end of the round.`),
    s.finale?.cage && h('p', { class: 'note', style: 'margin:8px 0 0;color:var(--gold-deep)' }, 'The Cage is ready. Bring the Root King to 0 health to capture it.'),
    s.settings.scenario === 'skyship' && s.finale?.ready && h('p', { class: 'note', style: 'margin:8px 0 0;color:var(--gold-deep)' },
      `Provisions: ${s.storage.food}/${s.players.filter((x) => !x.lost).length} Food in storage. Everyone standing must be at the Workshop.`));
  const urgentQuest = s.quest?.active.some((q) => q.deadline - s.round <= 1);
  const questPanel = s.quest && h('section', { class: 'page' }, h('h3', {}, `Quests · ${s.quest.done}/${QUESTS_TO_WIN} done`),
    !s.quest.active.length && h('p', { class: 'note', style: 'margin:0' }, 'No active quests. Flip tiles to uncover quest marks, or Search for Story cards.'),
    s.quest.chain > 0 && s.quest.chain < 4 && h('div', { class: 'part quest-row' }, h('div', {}, h('div', { class: 'pn' }, `The Broken Compass · step ${s.quest.chain}/4`),
      h('small', { class: 'note' }, `Next clue: Search a ${BIOMES[CHAIN_BIOME[s.quest.chain]].name} tile. No time limit; counts as 2 quests.`))),
    h('div', { class: 'parts' }, s.quest.active.map((q) => {
      const { d, left, text } = questLine(s, q);
      return h('div', { class: 'part quest-row' + (left <= 1 ? ' urgent' : '') },
        h('div', { style: 'min-width:0' }, h('div', { class: 'pn' }, d.title), h('small', { class: 'note' }, text),
          h('div', {}, h('small', { class: 'tag' + (left <= 1 ? ' lost' : '') }, left <= 0 ? 'Last round!' : `${left} round${left === 1 ? '' : 's'} left`))),
        h('div', { style: 'display:grid;gap:4px' },
          h('button', { class: 'btn small', onclick: () => openModal(h('div', { class: 'card-wrap' }, questCardEl(q.id, q), h('button', { class: 'btn', onclick: closeModal }, 'Close'))) }, 'Card'),
          q.at && h('button', { class: 'btn small', onclick: () => board.focus(q.at) }, 'Find')));
    })),
    !E.questsOk(s) && h('p', { class: 'note', style: 'margin:6px 0 0' }, `Every invention part needs an Artifact. You need ${QUESTS_TO_WIN} completed quests to win.`));
  const improvements = h('section', { class: 'page' }, h('h3', {}, 'Workshop improvements'),
    h('div', { class: 'parts' }, Object.entries(WORKSHOP).map(([id, w]) => {
      const done = s.upgrades?.[id];
      const can = myTurn && o.workshop.includes(id) && Object.entries(w.cost).every(([r, n]) => s.storage[r] + cur.bag[r] >= n);
      return h('div', { class: 'part' + (done ? ' done' : ''), title: w.text },
        h('div', {}, h('div', { class: 'pn' }, w.name), h('small', { class: 'note' }, w.text), !done && h('div', {}, costEl(w.cost))),
        !done && myTurn && h('button', { class: 'btn small', disabled: !can, onclick: () => act({ type: 'workshop', id }) }, 'Build'));
    })));
  const canWithdraw = myTurn && atHome && !s.pending;
  const op = cur && s.outposts?.[cur.at];
  const opPanel = op && h('section', { class: 'page' }, h('h3', {}, `Outpost (${RES.reduce((a, r) => a + op.store[r], 0)}/${OUTPOST.capacity})`),
    h('p', { class: 'note', style: 'margin:0 0 6px' }, myTurn ? 'Tap a resource to take it. Use the buttons below to stash from your backpack.' : 'Stored at this Outpost.'),
    h('div', { class: 'store' }, RES.map((r) => h('button', { disabled: !myTurn || s.pending || !op.store[r], onclick: () => act({ type: 'take', res: r }), title: `Take 1 ${RES_LABEL[r]}` }, tok(r), op.store[r]))),
    myTurn && !s.pending && h('div', { class: 'actions', style: 'margin-top:6px' }, RES.filter((r) => cur.bag[r] > 0).map((r) =>
      h('button', { class: 'btn small', onclick: () => act({ type: 'stash', res: r }) }, 'Stash ', tok(r)))));
  const storage = h('section', { class: 'page' }, h('h3', {}, 'Workshop storage'),
    h('div', { class: 'store' }, RES.map((r) => h('button', {
      disabled: !canWithdraw || !s.storage[r], title: canWithdraw ? `Take 1 ${RES_LABEL[r]} into your backpack` : RES_LABEL[r],
      onclick: () => act({ type: 'withdraw', res: r }),
    }, tok(r), s.storage[r]))),
    canWithdraw && h('p', { class: 'note', style: 'margin:6px 0 0' }, 'Tap a resource to take 1 into your backpack.'));
  const log = h('section', { class: 'page' }, h('h3', {}, 'Chronicle'),
    h('div', { class: 'log' }, s.log.slice(-40).reverse().map((l) => h('div', {}, h('b', {}, `R${l.r} `), l.text))));
  const pages = { goal: ['Goal', [ship]], quests: s.quest && ['Quests', [questPanel]], stores: ['Stores', [opPanel, storage]], workshop: ['Workshop', [improvements]], log: ['Log', [log]] };
  if (!pages[journalTab]) journalTab = 'goal';
  const journal = h('aside', { class: 'journal' + (journalOpen ? ' open' : ''), 'aria-label': 'Journal', 'aria-hidden': String(!journalOpen) },
    h('div', { class: 'j-tabs', role: 'tablist' }, Object.entries(pages).filter(([, v]) => v).map(([id, [label]]) =>
      h('button', { role: 'tab', 'aria-selected': String(id === journalTab), class: id === 'quests' && urgentQuest ? 'urgent' : '', onclick: () => { journalTab = id; renderHud(shown); } }, label))),
    h('button', { class: 'x', 'aria-label': 'Close the journal', onclick: () => setJournal(false) }, '×'),
    h('div', { class: 'j-page' }, pages[journalTab][1]));
  const journalBtn = h('button', { class: 'journal-btn' + (urgentQuest ? ' alert' : ''), 'aria-expanded': String(journalOpen), onclick: () => setJournal(!journalOpen) },
    ico('book'), h('span', {}, 'Journal'));
  const openPage = (id) => { journalTab = id; journalOpen = true; renderHud(shown); };

  // action tray
  const bar = h('section', { class: 'tray' + (prefs.barMin ? ' min' : ''), 'aria-label': 'Turn actions' });
  // Slide the tray away (tap the handle, or swipe it down; swipe up to bring it back).
  const setMin = (v) => { prefs.barMin = v; savePrefs(); bar.classList.toggle('min', v); handle.setAttribute('aria-expanded', String(!v)); handle.lastChild.textContent = v ? 'Show actions' : 'Hide'; };
  const handle = h('button', { class: 'bar-handle', 'aria-expanded': String(!prefs.barMin), onclick: () => setMin(!prefs.barMin) },
    h('span', { class: 'grip', 'aria-hidden': 'true' }), h('span', {}, prefs.barMin ? 'Show actions' : 'Hide'));
  bar.append(handle);
  let swipeY = null;
  bar.addEventListener('touchstart', (e) => { swipeY = e.touches[0].clientY; }, { passive: true });
  bar.addEventListener('touchend', (e) => {
    if (swipeY == null) return;
    const dy = e.changedTouches[0].clientY - swipeY; swipeY = null;
    if (dy > 40 && !prefs.barMin) setMin(true); else if (dy < -40 && prefs.barMin) setMin(false);
  });
  if (s.phase === 'over') {
    bar.append(h('div', { class: 'turn-line' }, h('span', { class: 'who' }, s.result.result === 'won' ? 'Victory' : 'The forest wins'), h('span', { class: 'hint' }, s.result.reason),
      h('button', { class: 'btn primary', onclick: showTitle }, 'New expedition')));
  } else if (cur) {
    const T = cur.turn || { mp: 0, dec: 0 };
    const pips = h('div', { class: 'pips' },
      h('span', { class: 'mv', title: 'Moves left' }, ico('move'), h('b', {}, T.mp)),
      h('span', { title: 'Decisions left' }, h('i', { class: 'pip' + (T.dec > 0 ? ' on' : '') }), h('i', { class: 'pip' + (T.dec > 1 ? ' on' : '') })));
    let hint;
    if (animating) hint = 'Resolving…';
    else if (!myTurn) hint = s.pending ? `${cur.name} is choosing a card…` : `Waiting for ${cur.name} (${CHARACTERS[cur.char].name})…`;
    else if (s.pending) hint = 'Choose how to resolve the card.';
    else if (o.fuel) hint = 'Set out (eat Food for 3 moves), or stay and act. Then spend your 2 decisions.';
    else if (o.move) hint = 'Tap a glowing tile to move. Numbers show the cost; “?” is unexplored.';
    else hint = T.dec > 0 ? 'Spend your decisions, or end your turn.' : 'All done. End your turn.';
    const myBag = h('span', { class: 'mybag', title: 'Backpack' }, RES.filter((r) => cur.bag[r] > 0).map((r) => h('span', {}, tok(r), cur.bag[r])));
    bar.append(h('div', { class: 'turn-line' },
      h('img', { class: 'who-face', src: faceOf(cur.char), alt: '' }),
      h('span', { class: 'who' }, myTurn ? `${cur.name}’s turn` : cur.name), h('span', { class: 'hint' }, hint), myBag, pips));
    if (myTurn && !s.pending) {
      const acts = h('div', { class: 'actions' });
      const here = s.tiles[cur.at];
      if (o.fuel) {
        const hasFood = cur.bag.food > 0 || (atHome && s.storage.food > 0);
        acts.append(
          tb(tok('food'), 'Eat → 3 moves', () => act({ type: 'fuel', how: 'food' }), { cls: 'primary', disabled: !hasFood }),
          tb('heart', 'Spend a life → 3', () => act({ type: 'fuel', how: 'life' }), { disabled: cur.lives < 2, title: cur.lives < 2 ? 'Your last life can’t be spent' : '' }),
          tb('move', 'Trudge → 1', () => act({ type: 'fuel', how: 'free' })));
      }
      if (o.search) {
        const blight = here.corrupted || here.biome === 'corrupted' || here.searched;
        acts.append(tb('search', blight ? 'Search (Blight)' : 'Search', () => act({ type: 'search' }), { title: `Draw from the ${blight ? 'Blight' : BIOMES[here.biome].name} deck` }));
      }
      if (o.gather) o.gather.forEach((y, i) => acts.append(tb('gather', ['Gather ', costEl(here.harvest >= 2 ? Object.fromEntries(Object.entries(y).map(([r, n]) => [r, Math.max(1, n - 1)])) : y), here.harvest ? ' ⚠' : ''],
        () => act({ type: 'gather', option: i }), { title: here.harvest ? 'This land is already disturbed: a risk die will be rolled' : 'Fresh land' })));
      for (const q of o.quest || []) {
        const d = QUESTS[q.id];
        const label = q.kind === 'deliver' ? ['Deliver ', costEl(d.need)] : q.kind === 'escort' ? 'Take charge' : 'Investigate';
        const can = q.kind !== 'deliver' || Object.entries(d.need).every(([r, n]) => cur.bag[r] + (atHome ? s.storage[r] : 0) >= n);
        acts.append(tb('quest', label, () => act({ type: 'quest', qid: q.qid }), { cls: 'primary', disabled: !can, title: d.title }));
      }
      for (const m of o.attack) {
        const [q0, r0] = E.parse(cur.at), [q1, r1] = E.parse(m.at);
        const d = DIRS.find((x) => x.dq === q1 - q0 && x.dr === r1 - r0);
        acts.append(tb('attack', `Attack ${MONSTERS[m.kind].name} (${m.hp}${m.stuck ? ', snared' : ''}) ${d ? d.name : 'here'}`, () => act({ type: 'attack', id: m.id }),
          { cls: 'danger', title: 'Friends on or beside its tile add a die each' }));
      }
      const where = (k) => k === cur.at ? 'here' : (() => {
        const [q0, r0] = E.parse(cur.at), [q1, r1] = E.parse(k);
        const d = DIRS.find((x) => x.dq === q1 - q0 && x.dr === r1 - r0);
        return d ? d.name : 'nearby';
      })();
      for (const k of o.cleanse) acts.append(tb('cleanse', [`Cleanse ${where(k)} `, cur.char === 'sporewick' ? '(free)' : costEl({ essence: 1 })], () => act({ type: 'cleanse', at: k }), { title: '+1 Reputation' }));
      for (const t of o.revive) acts.append(tb('heart', `Revive ${t.name} (${where(t.at)})`, () => act({ type: 'revive', target: t.char }), { cls: 'primary' }));
      if (o.outpost) {
        const can = Object.entries(OUTPOST.cost).every(([r, n]) => cur.bag[r] >= n);
        acts.append(tb('outpost', ['Outpost ', costEl(OUTPOST.cost)], () => act({ type: 'outpost' }),
          { disabled: !can, title: 'A forward base: store up to ' + OUTPOST.capacity + ' items, Rest here, and travel between Outposts and the Workshop for 1 move. Corruption destroys it.' }));
      }
      if (op) acts.append(tb('chest', 'Outpost store', () => openPage('stores'), { title: 'Take or stash items here' }));
      if (o.rest) acts.append(tb('rest', 'Rest +1 life', () => act({ type: 'rest' })));
      if (o.deposit && RES.some((r) => r !== 'food' && cur.bag[r] > 0)) acts.append(tb('chest', 'Unpack', () => act({ type: 'deposit' }), { title: 'Unpack into storage. Food stays in your backpack' }));
      if (canWithdraw) acts.append(tb('chest', 'Storage', () => openPage('stores'), { title: 'Take resources from the Workshop' }));
      if (o.build?.length && scen.parts.some((p) => !s.built[p.id])) acts.append(tb('build', 'Build a part', () => openPage('goal'), { title: 'Open the invention plans' }));
      if (o.workshop?.length) acts.append(tb('build', 'Improve', () => openPage('workshop'), { title: 'Workshop improvements' }));
      if (o.upgrade && cur.rep >= UPGRADES.backpack.rep) {
        const up = UPGRADES.backpack;
        const can = cur.rep >= up.rep && Object.entries(up.cost).every(([r, n]) => s.storage[r] + cur.bag[r] >= n);
        acts.append(tb('chest', [`Backpack +2 (✦${up.rep} `, costEl(up.cost), ')'], () => act({ type: 'upgrade', id: 'backpack' }), { disabled: !can, title: up.text }));
      }
      if (o.advance) {
        const lv = o.advance;
        const can = cur.rep >= lv.rep && Object.entries(lv.cost).every(([r, n]) => s.storage[r] + cur.bag[r] >= n);
        acts.append(tb('train', [`Train: ${lv.name} (✦${lv.rep} `, costEl(lv.cost), ')'], () => act({ type: 'advance' }), { cls: can ? 'primary' : '', disabled: !can, title: `${lv.name}: ${lv.text}` }));
      }
      for (const t of o.heal) acts.append(tb('heal', `Remedy for ${t.name}`, () => act({ type: 'heal', target: t.char })));
      for (const t of o.recall) acts.append(tb('beacon', `Beacon: ${t.name}`, () => act({ type: 'recall', target: t.char }), { cls: 'primary', title: `Bring ${t.name} home` }));
      if (atHome && cur.bag.food > 0) acts.append(tb('chest', ['Store 1 ', tok('food')], () => act({ type: 'store', res: 'food' }), { title: 'Move 1 Food from your backpack into storage' }));
      const extras = h('div', { class: 'extras' });
      if (o.craft) {
        const sel = h('select', { 'aria-label': 'Craft an item', class: 'btn small' }, h('option', { value: '' }, 'Craft…'),
          Object.entries(CRAFTS).map(([id, c]) => h('option', { value: id }, `${c.name} (${Object.entries(c.cost).map(([r, n]) => `${n} ${RES_LABEL[r]}`).join(', ')}): ${c.text}`)));
        sel.addEventListener('change', () => { if (sel.value) act({ type: 'craft', id: sel.value }); });
        extras.append(sel);
      }
      if (o.convert) {
        const have = RES.filter((r) => cur.bag[r] + (atHome ? s.storage[r] : 0) >= 2);
        if (have.length) {
          const sel = h('select', { 'aria-label': 'Convert resources', class: 'btn small' }, h('option', { value: '' }, 'Convert 2→1…'),
            have.flatMap((f) => RES.filter((t) => t !== f && t !== 'artifact').map((t) => h('option', { value: `${f}|${t}` }, `2 ${RES_LABEL[f]} → 1 ${RES_LABEL[t]}`))));
          sel.addEventListener('change', () => { const [from, to] = sel.value.split('|'); if (from) act({ type: 'convert', from, to }); });
          extras.append(sel);
        }
      }
      const friends = s.players.filter((p) => p !== cur && p.at === cur.at && !p.lost);
      if (friends.length && RES.some((r) => cur.bag[r] > 0)) {
        const sel = h('select', { 'aria-label': 'Give to a friend on this tile', class: 'btn small' },
          h('option', { value: '' }, 'Give…'),
          friends.flatMap((f) => RES.filter((r) => cur.bag[r] > 0).map((r) => h('option', { value: `${f.char}|${r}` }, `1 ${RES_LABEL[r]} → ${f.name}`))));
        sel.addEventListener('change', () => { const [to, res] = sel.value.split('|'); if (to) act({ type: 'give', to, res }); });
        extras.append(sel);
      }
      if (myTurn && o.launch) acts.prepend(tb('beacon', 'Launch the Skyship', () => act({ type: 'launch' }), { cls: 'primary' }));
      acts.append(tb('end', 'End turn', () => act({ type: 'endTurn' }), { cls: 'end' + (T.dec === 0 && !o.move ? ' primary' : '') }));
      bar.append(acts);
      if (extras.childNodes.length) bar.append(extras);
    }
  }

  hud.replaceChildren(top, party, peekCard || '', journalBtn, journal, bar, h('div', { id: 'tile-tip', class: 'panel tile-tip hidden' }));
  renderTip();

  // move highlights
  if (myTurn && o.move && !s.pending) {
    const reach = E.reachable(s, cur);
    board.setHighlights(Object.fromEntries(Object.entries(reach).map(([k, v]) => [k, { cost: v.cost, unknown: !s.tiles[k].revealed, hurt: v.hurt }])));
  } else board.setHighlights(null);

  // pending choices
  if (s.pending && !animating) {
    const pd = s.pending;
    if (mine(pd.who)) {
      if (pd.kind === 'choice') {
        const c = CARDS[pd.card];
        openModal(h('div', { class: 'card-wrap' }, cardEl(pd.card), c.note && h('div', { class: 'card-note' }, c.note),
          h('div', { class: 'modal-actions' }, pd.options.map((label, i) => h('button', { class: 'btn primary', onclick: () => { closeModal(); act({ type: 'choose', index: i }); } }, label)))), { dismissable: false });
      } else {
        openModal(h('div', { class: 'modal-inner' },
          h('div', { class: 'eyebrow' }, `${s.players.find((p) => p.char === pd.who).name}: keep one card`),
          h('div', { class: 'cards-row' }, pd.cards.map((id, i) => h('div', { class: 'card-wrap' }, cardEl(id),
            h('button', { class: 'btn primary', onclick: () => { closeModal(); act({ type: 'choose', index: i }); } }, 'Keep this'))))), { dismissable: false });
      }
    }
  } else if (!animating && modalResolve === null && !$('#modal').classList.contains('hidden') && $('#modal .end') == null) {
    // nothing pending: leave any informational modal alone
  }

  if (s.phase === 'over' && !animating && !$('#modal .end')) {
    const won = s.result.result === 'won';
    if (!endSounded) { endSounded = true; SND.play(won ? 'win' : 'over'); }
    openModal(h('div', { class: 'panel end', style: 'padding:24px;display:grid;gap:14px;justify-items:center' },
      h('img', { src: won ? `${A}ui/skyship.jpg` : `${A}cards/root-king.jpg`, alt: '', style: 'width:min(280px,70vw);border-radius:12px' }),
      h('h2', {}, won ? 'The Everdeep is saved' : 'The forest has won'),
      h('p', {}, s.result.reason),
      h('p', { class: 'note' }, `Round ${s.round} · Horror ${s.horror}/${HORROR_MAX} · ${Object.keys(s.built).length}/${scen.parts.length} Skyship parts`),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn', onclick: closeModal }, 'Look at the board'), h('button', { class: 'btn primary', onclick: () => { closeModal(); showTitle(); } }, 'New expedition'))));
  }
}

function showGuide() {
  openModal(h('div', { class: 'panel guide' },
    h('h2', {}, 'How to play Rootbound'),
    h('p', {}, 'You are Mushroomfolk inventors. Work together to build the Skyship at the Workshop and launch it before the corruption wakes the Root King.'),
    h('h3', {}, 'Your turn'),
    h('ul', {},
      h('li', {}, 'Set out: eat 1 Food for 3 moves, spend a life for 3 moves, or trudge 1 move for free. You can also stay put.'),
      h('li', {}, 'Forest, Ruins and Crystal Fields cost 1 move. Swamp, Highlands and Corrupted Lands cost 2. Stepping into an unexplored tile flips it over and ends that path.'),
      h('li', {}, 'You also get 2 decisions: Search (draw a Discovery card), Gather (take the land’s resources), Attack, Cleanse, Revive, Rest, Build or Launch.'),
      h('li', {}, 'Moves and decisions can be mixed in any order.')),
    h('h3', {}, 'The land'),
    h('ul', {},
      h('li', {}, 'Gathering the same tile again disturbs it (a risk die is rolled). A third time exhausts it: smaller yields, and the land may turn corrupt. Harvested land never recovers.'),
      h('li', {}, 'Searching a tile a second time, or searching corrupted land, draws from the Blight deck.'),
      h('li', {}, 'Stepping onto a corrupted tile costs a life. Paths avoid corruption when they can; a \u2620 on a highlighted tile means the way there crosses corruption.'),
      h('li', {}, 'Cleanse a corrupted tile you stand on or one next to it (+1 Reputation).')),
    h('h3', {}, 'Outposts'),
    h('ul', {},
      h('li', {}, `Spend a decision and ${OUTPOST.cost.wood} Wood + ${OUTPOST.cost.metal} Metal to raise an Outpost on clean ground (2 per game on the standard board, 4 on the full board).`),
      h('li', {}, `An Outpost stores up to ${OUTPOST.capacity} items, lets you Rest, and links to the Workshop and every other Outpost: travelling between them costs 1 move.`),
      h('li', {}, 'If corruption reaches an Outpost, or a monster steps onto it, it is destroyed with everything stored there.')),
    h('h3', {}, 'Rounds, weather and corruption'),
    h('ul', {},
      h('li', {}, 'Each round starts with a Weather card. Rounds go Day, Day, Night. At the start of a Night round a Night card is drawn too, and lasts all Night (The Hunt, Howling, Creeping Rot, Moonlight and more).'),
      h('li', {}, 'After everyone has played, the forest stirs: corruption spreads (more at Night), then every monster rolls the die 3 times and steps that way (1 is North, then clockwise). A monster stepping onto you costs you a life. Where it stops, the land is corrupted.'),
      h('li', {}, 'The Lost wander too: each round they roll 3 times like a monster, lash out at anyone they step onto, and corrupt the tile where they stop. Catch up and Revive them from their tile or the one next to it.'),
      h('li', {}, `Every ${shown?.settings?.spawnEvery || 3} corruption on the Horror Track brings a new monster. At 20, the Root King awakens; if it reaches the Workshop, the game is lost.`)),
    h('h3', {}, 'Goals'),
    h('ul', {}, Object.values(SCENARIOS).map((sc) => h('li', {}, h('b', {}, sc.name + ': '), sc.goal)),
      h('li', {}, 'In the Skyship and Weather Engine games, defeating the Root King also wins.')),
    h('h3', {}, 'Quest mode'),
    h('ul', {},
      h('li', {}, 'Some tiles hide a quest mark. Flipping one opens a quest. Story cards in the Discovery decks open quests too: Rumours open the next quest, Landmarks open a specific one, and the Broken Compass starts a 4-step chain (each next clue is found by Searching the biome it names; it counts as 2 quests). A gold banner marks each quest on the map.'),
      h('li', {}, 'Escort quests and the Wind Nymph start at the very edge of the map, on the straight line from the Workshop through where the quest was opened.'),
      h('li', {}, `Up to ${QUEST_MAX_ACTIVE} quests can be active. Each has a time limit; a failed quest spreads corruption.`),
      h('li', {}, 'Quests: reach a marker and Investigate, Deliver resources to it, Escort someone home, or reveal, cleanse or defeat enough.'),
      h('li', {}, `Every completed quest gives 1 Artifact and 1 Reputation. Every invention part also needs an Artifact, and you must complete ${QUESTS_TO_WIN} quests to win.`),
      h('li', {}, 'At Horror 10 and 15 a Root King quest appears. Completing it pushes the Horror Track back 2; failing it also wakes a monster.')),
    h('h3', {}, 'Growing stronger'),
    h('ul', {},
      h('li', {}, 'Reputation comes from Relics, defeating monsters, cleansing corruption, building invention parts, and being first to chart each biome.'),
      h('li', {}, 'At the Workshop, spend Reputation and resources to Train (two levels per Mushroomfolk), or build Workshop improvements everyone shares.'),
      h('li', {}, 'Anywhere, spend a decision to Craft: a Bandage (heal), a Snare (the next monster to step in stops and takes 1 damage), or a Crystal Flare (reveal a tile).')),
    h('h3', {}, 'Fighting'),
    h('ul', {},
      h('li', {}, 'Attack a monster on your tile or the next one: roll 1 risk die, plus 1 for each friend on or beside its tile (Bramblecap adds 1 more). Hit = 1 damage, Double Hit = 2. Fighting from next door spares you the corruption on its tile.'),
      h('li', {}, 'A monster that survives your attack strikes back: everyone on or beside its tile loses a life (a Shield you rolled protects you; Thorncap takes the blow for friends). A monster caught in a snare cannot strike back.'),
      h('li', {}, 'A Wound costs you a life unless you also rolled a Shield. Panic makes you flee to a nearby tile.'),
      h('li', {}, 'Defeating a monster earns 1 Reputation and 1 Essence. Defeating the Root King wins the game.')),
    h('h3', {}, 'Losing things'),
    h('ul', {},
      h('li', {}, 'If you must lose Food and have none, you lose a life. Missing anything else costs 1 Reputation.'),
      h('li', {}, 'At 0 lives you are Lost and the tile turns corrupt. A friend on your tile can spend a decision to revive you with 1 life.'),
      h('li', {}, 'Backpacks hold 5 slots: Food and Wood stack 3 per slot, Metal, Crystal and Essence 2, Artifacts 1. Unpack at the Workshop; Food stays with you.')),
    h('h3', {}, 'Camera'),
    h('p', {}, 'Drag to rotate. Right-drag or two fingers to pan. Scroll or pinch to zoom.'),
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: closeModal }, 'Back to the table'))));
}

// ------------------------------------------------------------------ boot
showTitle();
createNet().then((n) => { NET = n; if (!gameId) showTitle(); }).catch(() => { NET = { remote: null, local: null }; showTitle(); });
