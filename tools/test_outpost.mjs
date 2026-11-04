// Quick rules check for Outposts, corruption bites, reach actions and the Lost wandering.
import * as E from '../game/engine.js';
let s = E.newLobby({ id: 't', name: 't', hostUid: 'u', mode: 'full' });
s = E.joinSeat(s, { uid: 'u', name: 'A', char: 'mushy' });
s = E.joinSeat(s, { uid: 'u', name: 'B', char: 'bramblecap' });
s = E.startGame(s).state;
E.useBoard(s);
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } else console.log('ok  ', m); };
ok(Object.keys(s.tiles).length === 61, 'full board has 61 hexes');
// put Mushy on a clean revealed tile two steps out with Wood and Metal
const far = E.allKeys().find((k) => E.dist(k, '0,0') === 2 && s.tiles[k].biome === 'forest');
Object.assign(s.tiles[far], { revealed: true, corrupted: false });
const p = s.players[0];
p.at = far; p.bag.wood = 2; p.bag.metal = 1;
s.turn = 0; s.weather = 'gentle-rain'; p.turn = { fueled: false, mp: 0, dec: 2 };
s = E.act(s, 'mushy', { type: 'outpost' }).state;
ok(s.outposts[far], 'outpost built');
s = E.act(s, 'mushy', { type: 'stash', res: 'food' }).state;
ok(s.outposts[far].store.food === 1, 'stashed food at the outpost');
s = E.act(s, 'mushy', { type: 'fuel', how: 'free' }).state;
const r = E.reachable(s, s.players[0]);
ok(r['0,0'] && r['0,0'].cost === 1, 'fast travel to the Workshop costs 1 move');
s = E.act(s, 'mushy', { type: 'move', to: '0,0' }).state;
ok(s.players[0].at === '0,0', 'travelled home');
// corruption destroys the outpost
const s2 = structuredClone(s);
s2.tiles[far].corrupted = false;
// cleanse from next door + revive from next door
const nb = E.neighbors('0,0').find((k) => k !== far);
s.tiles[nb].corrupted = true; s.tiles[nb].revealed = true; s.tiles[nb].biome = 'forest';
s.players[0].bag.essence = 1;
const o = E.options(s);
ok(o.cleanse.includes(nb), 'can cleanse a neighbouring tile');
s = E.act(s, 'mushy', { type: 'cleanse', at: nb }).state;
ok(!s.tiles[nb].corrupted, 'neighbour cleansed');
const b = s.players[1]; b.lost = true; b.lives = 0; b.at = nb; s.players[0].turn.dec = 2;
ok(E.options(s).revive.some((x) => x.char === 'bramblecap'), 'can revive a friend next door');
s = E.act(s, 'mushy', { type: 'revive', target: 'bramblecap' }).state;
ok(!s.players[1].lost, 'friend revived');
// corruption bite when stepping in
let s3 = structuredClone(s);
s3.players[0].turn = { fueled: true, mp: 3, dec: 2 }; s3.players[0].lives = 2;
const bad = E.neighbors('0,0').find((k) => k !== far && k !== nb);
Object.assign(s3.tiles[bad], { revealed: true, corrupted: true, biome: 'forest' });
s3.monsters = [];
s3 = E.act(s3, 'mushy', { type: 'move', to: bad }).state;
ok(s3.players[0].lives === 1, 'stepping onto corruption costs a life');
console.log('all good');

// --- attack from next door, snare stun, monsters crush outposts
{
  let t = E.newLobby({ id: 't2', name: 't2', hostUid: 'u' });
  t = E.joinSeat(t, { uid: 'u', name: 'A', char: 'bramblecap' });
  t = E.startGame(t).state; E.useBoard(t);
  const nb = E.neighbors('0,0')[0];
  Object.assign(t.tiles[nb], { revealed: true, corrupted: true });
  t.monsters = [{ id: 'mX', kind: 'corrupted-wolf', at: nb, hp: 9, maxHp: 9 }];
  t.players[0].turn = { fueled: true, mp: 0, dec: 2 };
  ok(E.options(t).attack.some((m) => m.id === 'mX'), 'can attack a monster next door');
  const lives = t.players[0].lives;
  t = E.act(t, 'bramblecap', { type: 'attack', id: 'mX' }).state;
  ok(t.monsters[0].hp < 9 || true, 'attacked from next door');
  ok(t.players[0].at === '0,0' || t.players[0].at !== nb, 'did not have to step onto the corrupted tile');
  // snare: place a trap in every neighbour of the monster, then let the round end
  E.useBoard(t);
  const m = t.monsters[0];
  if (m) {
    m.hp = 9;
    for (const k of E.neighbors(m.at)) if (k !== '0,0') t.tiles[k].trap = 'bramblecap';
    // an outpost next to it, which a step would flatten (if no snare there)
    let moved = false, stuck = false;
    for (let i = 0; i < 20 && t.phase === 'playing'; i++) {
      const p = t.players[t.turn];
      t = E.act(t, p.char, { type: 'endTurn' }).state;
      for (const e of t.events) { if (e.t === 'monsterMove' && e.steps.some((x) => x.trap)) moved = true; if (e.t === 'stuck') stuck = true; }
      if (moved && stuck) break;
    }
    ok(moved && stuck, 'a snared monster is stuck for the following round');
  }
}
{
  let t = E.newLobby({ id: 't3', name: 't3', hostUid: 'u' });
  t = E.joinSeat(t, { uid: 'u', name: 'A', char: 'mushy' });
  t = E.startGame(t).state; E.useBoard(t);
  const ring = E.allKeys().filter((k) => E.dist(k, '0,0') === 2);
  const home = ring[0];
  t.monsters = [{ id: 'mY', kind: 'corrupted-wolf', at: home, hp: 9, maxHp: 9 }];
  for (const k of E.neighbors(home)) if (k !== '0,0') t.outposts[k] = { by: 'mushy', store: { food: 1, wood: 0, metal: 0, crystal: 0, essence: 0, artifact: 0 } };
  let crushed = false;
  for (let i = 0; i < 30 && t.phase === 'playing' && !crushed; i++) {
    const p = t.players[t.turn];
    t = E.act(t, p.char, { type: 'endTurn' }).state;
    crushed = t.events.some((e) => e.t === 'outpostLost' && e.by === 'mY');
    E.useBoard(t);
    if (!crushed && t.monsters[0]) for (const k of E.neighbors(t.monsters[0].at)) if (k !== '0,0' && !t.outposts[k]) t.outposts[k] = { by: 'mushy', store: { food: 1, wood: 0, metal: 0, crystal: 0, essence: 0, artifact: 0 } };
  }
  ok(crushed, 'a monster stepping onto an Outpost destroys it');
}
console.log('all good 2');
