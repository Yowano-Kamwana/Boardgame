// Plays a bot game until monsters roam, then prints the state as a local save (for visual testing).
import { newLobby, joinSeat, startGame, act, options, reachable, RuleError } from '../game/engine.js';
const chars = ['mushy', 'bramblecap', 'morella', 'sporewick'];
for (let tries = 0; tries < 500; tries++) {
  let s = newLobby({ id: 'midgame', name: 'Midgame test', hostUid: 'this-device' });
  for (const c of chars) s = joinSeat(s, { uid: 'this-device', name: c[0].toUpperCase() + c.slice(1), char: c });
  s = startGame(s).state;
  for (let i = 0; i < 400 && s.phase === 'playing'; i++) {
    const p = s.players[s.turn], o = options(s);
    let a = { type: 'endTurn' };
    if (s.pending) a = { type: 'choose', index: 0 };
    else if (o.fuel) a = { type: 'fuel', how: p.bag.food ? 'food' : 'free' };
    else if (o.move && Math.random() < 0.7) { const r = Object.keys(reachable(s, p)).filter((k) => !s.monsters.some((m) => m.at === k)); if (r.length) a = { type: 'move', to: r[Math.floor(Math.random() * r.length)] }; }
    else if (o.gather && Math.random() < 0.5) a = { type: 'gather', option: 0 };
    else if (o.search) a = { type: 'search' };
    try { s = act(s, p.char, a).state; } catch (e) { s = act(s, p.char, { type: 'endTurn' }).state; }
    if (s.monsters.length >= 3 && s.players.every((x) => !x.lost && x.lives === 2) && s.turn === 0 && !s.pending && s.players[0].at !== '0,0') {
      process.stdout.write(JSON.stringify({ midgame: s }));
      process.exit(0);
    }
  }
}
console.error('no luck');
