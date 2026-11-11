// The second-edition Discovery cards: every card resolves, and the new rules (Fear, either/or costs,
// the Horror Track card, the Crystal Nymph) behave as printed.
import fs from 'node:fs';
import * as E from '../game/engine.js';
import { CARDS, DECKS } from '../game/data.js';
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok  ', m); };

function fresh() {
  let s = E.newLobby({ id: 'x', name: 'x', hostUid: 'u' });
  for (const c of ['mushy', 'bramblecap']) s = E.joinSeat(s, { uid: 'u', name: c, char: c });
  s = E.startGame(s).state;
  s.weather = 'clear-skies';
  return s;
}
// Put the active player on a clean tile of the card's biome with that card on top of the deck, then Search.
function draw(s, id, deck, prep) {
  E.useBoard(s);
  const p = s.players[s.turn];
  const k = Object.keys(s.tiles).find((x) => s.tiles[x].biome === deck && !s.tiles[x].corrupted && !s.monsters.some((m) => m.at === x));
  s.tiles[k].revealed = true; s.tiles[k].searched = 0;
  p.at = k; p.turn.dec = 2;
  s.decks[deck].unshift(id);
  if (prep) prep(s, p, k);
  return E.act(s, p.char, { type: 'search' }).state;
}
const me = (s) => s.players[s.turn];

// every new card has art and resolves
const v2 = Object.values(CARDS).filter((c) => c.v2);
ok(v2.length === 68, `68 second-edition cards (${v2.length})`);
ok(v2.every((c) => fs.existsSync(new URL(`../assets/${c.img}`, import.meta.url))), 'every card has its art file');
ok(DECKS.forest.length === 18 && DECKS.crystal.length === 27 && DECKS.ruins.length === 25, 'deck sizes 18 / 27 / 25');
ok([...DECKS.forest, ...DECKS.crystal, ...DECKS.ruins].every((id) => CARDS[id]), 'every deck entry is a known card');
for (const c of v2) {
  const deck = { Forest: 'forest', 'Crystal Fields': 'crystal', Ruins: 'ruins' }[c.v2.biome];
  let s = draw(fresh(), c.id, deck);
  const drawn = s.events.some((e) => e.t === 'card' && e.id === c.id);
  if (s.pending) s = E.act(s, me(s).char, { type: 'choose', index: 0 }).state;
  if (!drawn || s.pending) { console.error('FAIL', c.id, 'did not resolve', JSON.stringify(s.pending), s.events.map((e) => e.t).join(' ')); process.exit(1); }
}
ok(true, 'all 68 cards resolve without error');

// Fear: nothing until the third, then panic
let s = fresh();
for (let i = 0; i < 2; i++) s = draw(s, 'crystal-husk', 'crystal', (st, p) => { p.bag.crystal = 1; });
ok(me(s).fear === 2 && me(s).lives === 2, 'two Fear: no harm yet');
const before = me(s).at;
s = draw(s, 'crystal-husk', 'crystal', (st, p, k) => { p.bag.crystal = 1; for (const n of E.neighbors(k)) if (st.tiles[n]) st.tiles[n].revealed = true; });
ok(me(s).fear === 0 && me(s).lives === 1 && s.events.some((e) => e.t === 'panic'), 'third Fear: panic, lose a life, Fear cleared');
ok(s.events.some((e) => e.t === 'move' && e.panic) && me(s).at !== before, 'panic makes you flee to a neighbouring tile');

// removing Fear, and Rest
s = draw(fresh(), 'glimmering-wisp', 'crystal', (st, p) => { p.fear = 2; });
ok(me(s).fear === 1, 'Glimmering Wisp removes 1 Fear');
s = fresh(); me(s).fear = 1; me(s).turn.dec = 2;
ok(E.options(s).rest, 'Rest is offered at full health when you carry Fear');
s = E.act(s, me(s).char, { type: 'rest' }).state;
ok(me(s).fear === 0, 'Rest removes 1 Fear');
s = draw(fresh(), 'radiant-renewal', 'crystal', (st) => { st.players.forEach((x) => { x.fear = 1; x.lives = 1; }); });
ok(s.players.every((x) => x.fear === 0 && x.lives === 2), 'Radiant Renewal: everyone −1 Fear and +1 life');

// either/or: only what you have
s = draw(fresh(), 'rusted-blade-trap', 'ruins', (st, p) => { p.bag.metal = 0; });
ok(!s.pending && me(s).lives === 1, 'Rusted Blade Trap with no Metal: the life is lost, no choice offered');
s = draw(fresh(), 'rusted-blade-trap', 'ruins', (st, p) => { p.bag.metal = 1; });
ok(s.pending && s.pending.options.length === 2, 'with Metal: a real choice');
s = E.act(s, me(s).char, { type: 'choose', index: 1 }).state;
ok(me(s).lives === 1 && me(s).bag.metal === 1, 'choosing the life keeps the Metal');
s = draw(fresh(), 'possessed-armor', 'ruins', (st, p) => { p.bag.metal = 0; });
ok(!s.pending && me(s).fear === 1, 'Possessed Armor with no Metal: gain Fear');

// Horror Track, Nymph, movement, slowed next turn
s = fresh(); const h0 = s.horror; const corrupt0 = Object.values(s.tiles).filter((t) => t.corrupted).length;
s = draw(s, 'awakening-darkness', 'ruins');
ok(s.horror === h0 + 1 && Object.values(s.tiles).filter((t) => t.corrupted).length === corrupt0, 'Awakening Darkness: Horror Track +1 without corrupting a tile');
s = draw(fresh(), 'crystal-nymph', 'crystal', (st, p, k) => { E.useBoard(st); const n = E.neighbors(k).find((x) => x !== '0,0' && st.tiles[x]); st.tiles[n].corrupted = true; st.tiles[n].biome = st.tiles[n].biome === 'corrupted' ? 'forest' : st.tiles[n].biome; st._n = n; });
ok(!s.tiles[s._n].corrupted && s.events.some((e) => e.t === 'cleanse'), 'Crystal Nymph cleanses a corrupted tile beside you');
s = draw(fresh(), 'ancient-sentinel', 'ruins', (st, p) => { p.turn.mp = 2; });
ok(me(s).turn.mp === 1 && me(s).fear === 1, 'Ancient Sentinel: −1 movement and 1 Fear');
s = draw(fresh(), 'crumbling-foundations', 'ruins');
ok(me(s).slowNext === 1 && s.players.find((x) => x !== me(s)).slowNext !== 1, 'Crumbling Foundations slows only those standing on Ruins');
s = draw(fresh(), 'forests-embrace', 'forest', (st) => { st.players[1].lives = 1; });
ok(s.players[1].lives === 2, 'Forest’s Embrace heals everyone');
console.log('cards ok');
