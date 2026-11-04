// Balance check with the goal-focused bot.
import { newLobby, joinSeat, startGame, act, RuleError } from '../game/engine.js';
import { botAction } from './bot.mjs';
const [games = 200, nP = 4, spawnEvery = 4, lives = 2, scenario = 'skyship', hunger = 'rep', mode = 'standard', quests = ''] = process.argv.slice(2);
const chars = ['mushy', 'bramblecap', 'morella', 'sporewick', 'thorncap'];
const tally = { qdone: 0, qfail: 0, kills: 0, snares: 0, snared: 0, lost: 0, attacks: 0 };
function count(evs) {
  for (const e of evs || []) {
    if (e.t === 'kill') tally.kills++;
    if (e.t === 'questDone') tally.qdone++;
    if (e.t === 'questFail') tally.qfail++;
    if (e.t === 'trap') tally.snares++;
    if (e.t === 'monsterMove') tally.snared += e.steps.filter((x) => x.trap).length;
    if (e.t === 'lost') tally.lost++;
    if (e.t === 'dice' && e.why === 'attack') tally.attacks++;
  }
}
const res = { won: 0, lost: 0, stalled: 0, rounds: [], reasons: {}, built: [], levels: 0, upgrades: {}, spent: {} };
for (let g = 0; g < games; g++) {
  let s = newLobby({ id: 'g', name: 'sim', hostUid: 'u', spawnEvery: +spawnEvery, lives: +lives, scenario, hunger, mode, quests: quests === 'quests' });
  for (let i = 0; i < +nP; i++) s = joinSeat(s, { uid: 'u', name: chars[i], char: chars[i] });
  s = startGame(s).state;
  for (let i = 0; i < 6000 && s.phase === 'playing'; i++) {
    const p = s.players[s.turn];
    try { s = act(s, p.char, botAction(s)).state; count(s.events); }
    catch (e) { if (!(e instanceof RuleError)) throw e; s = act(s, p.char, s.pending ? { type: 'choose', index: 0 } : { type: 'endTurn' }).state; }
  }
  if (s.phase !== 'over') res.stalled++; else { res[s.result.result]++; const k = s.result.reason.slice(0, 40); res.reasons[k] = (res.reasons[k] || 0) + 1; }
  res.rounds.push(s.round); res.built.push(Object.keys(s.built).length);
  res.levels += s.players.reduce((a, p) => a + p.level, 0);
}
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`${mode} ${scenario} p=${nP} every=${spawnEvery} lives=${lives} hunger=${hunger}: won ${res.won}/${games}, stalled ${res.stalled}, avg rounds ${avg(res.rounds)}, avg parts ${avg(res.built)}, levels/game ${(res.levels / games).toFixed(1)}`);
console.log('   per game: attacks', (tally.attacks / games).toFixed(1), 'kills', (tally.kills / games).toFixed(2), 'snares set', (tally.snares / games).toFixed(2), 'monsters snared', (tally.snared / games).toFixed(2), 'players lost', (tally.lost / games).toFixed(2), 'quests done', (tally.qdone / games).toFixed(2), 'failed', (tally.qfail / games).toFixed(2));
