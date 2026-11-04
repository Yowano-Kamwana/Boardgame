// Builds a Weather Engine save in its finale (pylons lit), for visual testing.
import { newLobby, joinSeat, startGame, act, RuleError } from '../game/engine.js';
import { botAction } from './bot.mjs';
const chars = ['mushy', 'bramblecap', 'morella', 'sporewick', 'thorncap'];
for (let tries = 0; tries < 400; tries++) {
  let s = newLobby({ id: 'finale', name: 'Weather Engine test', hostUid: 'this-device', scenario: 'weather-engine' });
  for (const c of chars) s = joinSeat(s, { uid: 'this-device', name: c[0].toUpperCase() + c.slice(1), char: c });
  s = startGame(s).state;
  for (let i = 0; i < 3000 && s.phase === 'playing'; i++) {
    const p = s.players[s.turn];
    try { s = act(s, p.char, botAction(s)).state; } catch (e) { if (!(e instanceof RuleError)) throw e; s = act(s, p.char, { type: 'endTurn' }).state; }
    if (s.finale?.pylons && s.monsters.length >= 2 && s.players.every((x) => !x.lost) && s.turn === 0 && !s.pending) {
      s.tiles[s.players[1].at].trap = 'bramblecap';
      process.stdout.write(JSON.stringify({ finale: s })); process.exit(0);
    }
  }
}
console.error('none');
