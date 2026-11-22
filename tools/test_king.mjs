// Attacking the Root King without killing it costs the attacker everything.
import * as E from '../game/engine.js';
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok  ', m); };
function setup(hp) {
  let s = E.newLobby({ id: 'x', name: 'x', hostUid: 'u', lives: 3 });
  for (const c of ['thorncap', 'mushy']) s = E.joinSeat(s, { uid: 'u', name: c, char: c });
  s = E.startGame(s).state; E.useBoard(s);
  const k = E.neighbors('0,0').find((x) => s.tiles[x]);
  s.tiles[k].revealed = true;
  s.monsters = [{ id: 'mk', kind: 'root-king', at: k, hp, maxHp: 6, stuck: true }];
  s.players[0].turn.dec = 2;
  return s;
}
let s = setup(99);
s = E.act(s, 'thorncap', { type: 'attack', id: 'mk' }).state;
ok(s.players[0].lost && s.players[0].lives === 0, 'a failed attack on the King leaves the attacker Lost (even snared, even Thorncap)');
ok(s.events.some((e) => e.t === 'kingKill'), 'the kill is announced');
let kills = 0, deaths = 0;
for (let i = 0; i < 300; i++) {
  let t = setup(1);
  t = E.act(t, 'thorncap', { type: 'attack', id: 'mk' }).state;
  if (t.phase === 'over' && t.result.result === 'won') kills++;
  else if (t.players[0].lost) deaths++;
}
ok(kills > 0 && kills + deaths === 300, `with 1 health left: ${kills} wins, ${deaths} deaths, nothing in between`);
console.log('king ok');
