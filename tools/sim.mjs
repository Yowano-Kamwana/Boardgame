// Plays many random games through the engine to catch crashes and get a feel for pacing.
import { newLobby, joinSeat, startGame, act, options, reachable, RuleError } from '../game/engine.js';

const chars = ['mushy', 'bramblecap', 'morella', 'sporewick', 'thorncap'];
const scenario = process.argv[6] || 'skyship';
const hunger = process.argv[7] || 'rep';
const games = Number(process.argv[2] || 300);
const nPlayers = Number(process.argv[3] || 4);
const causes = {};
const stats = { won: 0, lost: 0, stalled: 0, rounds: [], reasons: {}, monsters: [], errors: 0 };

function smartish(s) {
  const o = options(s);
  const p = s.players[s.turn];
  if (s.pending) return { type: 'choose', index: 0 };
  if (o.fuel) return { type: 'fuel', how: p.bag.food > 0 || (p.at === '0,0' && s.storage.food > 0) ? 'food' : 'free' };
  if (o.launch && s.players.every((x) => x.lost || x.at === '0,0')) return { type: 'launch' };
  if (o.deposit && Object.entries(p.bag).some(([r, n]) => r !== 'food' && n > 0)) return { type: 'deposit' };
  if (o.deposit && p.bag.food < 2 && s.storage.food > 0) return { type: 'withdraw', res: 'food' };
  if (o.build?.length) for (const part of o.build) {
    const tryIt = { type: 'build', part: part.id };
    try { act(s, p.char, tryIt); return tryIt; } catch {}
  }
  if (o.revive?.length) return { type: 'revive', target: o.revive[0].char };
  if (o.recall?.length) return { type: 'recall', target: o.recall[0].char };
  if (o.heal?.length) return { type: 'heal', target: o.heal[0].char };
  const tries = [];
  if (o.advance) tries.push({ type: 'advance' });
  for (const id of o.workshop || []) tries.push({ type: 'workshop', id });
  if (o.convert) tries.push({ type: 'convert', from: 'wood', to: 'crystal' }, { type: 'convert', from: 'food', to: 'metal' });
  if (o.craft && Math.random() < 0.15) tries.push({ type: 'craft', id: ['bandage', 'snare', 'flare'][Math.floor(Math.random() * 3)] });
  for (const t of tries) { try { act(s, p.char, t); if (Math.random() < 0.5) return t; } catch (e) { if (!(e instanceof RuleError)) throw e; } }
  if (o.attack?.length) return { type: 'attack', id: o.attack[0].id };
  if (o.rest && p.lives < 2) return { type: 'rest' };
  if (p.lives < 2 && o.move && reachable(s, p)['0,0'] && p.at !== '0,0') return { type: 'move', to: '0,0' };
  const full = Object.values(p.bag).reduce((a, b) => a + b, 0) >= 7;
  if (o.move && Math.random() < 0.8) {
    const r = Object.keys(reachable(s, p));
    if (r.length) {
      let to;
      if (full) to = r.includes('0,0') ? '0,0' : r.sort((a, b) => a.length - b.length)[0];
      else {
        const safe = r.filter((k) => !s.tiles[k].corrupted && !s.monsters.some((m) => m.at === k));
        const pool = safe.length ? safe : r;
        to = pool[Math.floor(Math.random() * pool.length)];
      }
      return { type: 'move', to };
    }
  }
  if (o.cleanse) return { type: 'cleanse' };
  if (o.gather && Math.random() < 0.6) return { type: 'gather', option: Math.floor(Math.random() * o.gather.length) };
  if (o.search) return { type: 'search' };
  return { type: 'endTurn' };
}

for (let g = 0; g < games; g++) {
  let s = newLobby({ id: 'g', name: 'sim', hostUid: 'u', spawnEvery: Number(process.argv[4] || 3), lives: Number(process.argv[5] || 2), scenario, hunger });
  for (let i = 0; i < nPlayers; i++) s = joinSeat(s, { uid: 'u', name: chars[i], char: chars[i] });
  s = startGame(s).state;
  let steps = 0;
  while (s.phase === 'playing' && steps < 4000) {
    const p = s.players[s.turn];
    const a = smartish(s);
    try { s = act(s, p.char, a).state; }
    catch (e) {
      if (!(e instanceof RuleError)) { stats.errors++; console.error('CRASH', a, e); process.exit(1); }
      s = act(s, p.char, s.pending ? { type: 'choose', index: 0 } : { type: 'endTurn' }).state;
    }
    steps++;
  }
  for (const l of s.log) {
    const m = l.text.match(/(loses a life|tramples|is wounded|gnaws at|had no Food|pushes through|stirs \(wound)/);
    if (m) causes[m[1]] = (causes[m[1]] || 0) + 1;
  }
  if (s.phase !== 'over') stats.stalled++;
  else {
    stats[s.result.result]++;
    stats.reasons[s.result.reason] = (stats.reasons[s.result.reason] || 0) + 1;
  }
  stats.rounds.push(s.round);
  stats.monsters.push(s.spawned);
}
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log({ games, players: nPlayers, won: stats.won, lost: stats.lost, stalled: stats.stalled,
  avgRounds: avg(stats.rounds), avgMonsters: avg(stats.monsters), reasons: stats.reasons, causes });
