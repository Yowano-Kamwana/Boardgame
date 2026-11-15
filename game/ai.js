// AI Mushroomfolk: gathers what the invention still needs, carries it home, builds, then finishes.
// Avoids corrupted ground and builds Outposts on long trips. Hunts monsters it can beat
// (alone or with friends), and sets snares where monsters are likely to walk.
import { act, options, reachable, dist, RuleError, monstersAt, neighbors, useBoard, partCost, questsOk } from './engine.js?v=19';
import { BIOMES, SCENARIOS, OUTPOST, CRAFTS, QUESTS } from './data.js?v=19';
const HOME = '0,0';

function needs(s) {
  const need = {};
  for (const part of SCENARIOS[s.settings.scenario].parts) if (!s.built[part.id])
    for (const [r, n] of Object.entries(partCost(s, part))) need[r] = (need[r] || 0) + n;
  // Deliveries for active quests count as needs too.
  for (const q of s.quest?.active || []) if (q.kind === 'deliver')
    for (const [r, n] of Object.entries(QUESTS[q.id].need)) need[r] = (need[r] || 0) + n;
  const have = {};
  for (const p of s.players) for (const [r, n] of Object.entries(p.bag)) have[r] = (have[r] || 0) + n;
  for (const [r, n] of Object.entries(s.storage)) have[r] = (have[r] || 0) + n;
  const out = {};
  for (const [r, n] of Object.entries(need)) if (n > (have[r] || 0)) out[r] = n - (have[r] || 0);
  const crew = s.players.filter((x) => !x.lost).length;
  if ((have.food || 0) < crew * 2 + 2) out.food = (out.food || 0) + 1;
  return out;
}
const yieldsWanted = (biome, need) => (BIOMES[biome].yields || []).findIndex((y) => Object.keys(y).some((r) => need[r]));
const ok = (s, p, a) => { try { act(s, p.char, a); return true; } catch (e) { if (!(e instanceof RuleError)) throw e; return false; } };

export function dangerTiles(s) {
  const out = new Set();
  // Monster moves are a surprise, so treat everything within one step of a monster as risky.
  for (const m of s.monsters) { out.add(m.at); for (const n of neighbors(m.at)) out.add(n); }
  for (const p of s.players) if (p.lost) { out.add(p.at); for (const n of neighbors(p.at)) out.add(n); }
  return out;
}

const FIGHTERS = new Set(['bramblecap', 'thorncap']);
// Average damage per risk die: two Hits (1), one Double (2) out of six faces.
const DMG_PER_DIE = 4 / 6;
// Dice when attacking a monster standing at `at` (friends on or beside its tile add one each).
function attackDice(s, p, at) {
  const allies = s.players.filter((x) => x !== p && !x.lost && dist(x.at, at) <= 1).length;
  const bonus = (p.char === 'bramblecap' ? 1 : 0) + (p.char === 'thorncap' && p.level >= 1 ? 1 : 0);
  return Math.min(5, 1 + allies + bonus);
}
// Where to stand to fight m this turn: a clean tile beside it (no corruption bite), else its own tile.
function strikeSpot(s, p, m, r) {
  const here = [p.at, ...neighbors(p.at)].includes(m.at) ? p.at : null;
  if (here) return here;
  const beside = neighbors(m.at).filter((k) => r[k] && !r[k].hurt && !monstersAt(s, k).length)
    .sort((a, b) => r[a].cost - r[b].cost);
  if (beside.length) return beside[0];
  return r[m.at] && r[m.at].hurt <= 1 ? m.at : null;
}
// Is this monster worth going after this turn?
function worthHunting(s, p, m, r) {
  if (m.kind === 'root-king' || p.turn.dec < 1) return false;
  const spot = strikeSpot(s, p, m, r);
  if (!spot) return false;
  if (spot === m.at && p.lives < 2) return false;          // stepping onto it would bite
  const dice = attackDice(s, p, m.at);
  const expected = dice * DMG_PER_DIE * Math.min(2, p.turn.dec); // both decisions can attack
  const friendNear = s.players.some((x) => x !== p && !x.lost && dist(x.at, m.at) <= 2);
  const threat = dist(m.at, HOME) <= 2 || s.players.some((x) => x !== p && !x.lost && dist(x.at, m.at) <= 1);
  // Unless snared, a monster that survives an attack strikes back at everyone beside it.
  if (!m.stuck && p.lives < 2) return expected >= m.hp * 1.6;
  const questBonus = s.quest?.active.some((q) => q.kind === 'slay' && (!q.monster || q.monster === m.id)) ? 0.75 : 1;
  if (expected >= m.hp * 1.15 * questBonus) return true;    // likely kill this turn (keener with a slay quest)
  if (FIGHTERS.has(p.char) && p.lives >= 2 && expected >= m.hp * 0.9) return true;
  return (friendNear && threat) && expected >= m.hp * 0.8;  // protect the team, with backup close
}

// A good place for a snare: clean, not home, next to a monster, and ideally between it
// and the Workshop or a friend.
function snareValue(s, k) {
  const t = s.tiles[k];
  if (k === HOME || t.trap || t.corrupted || monstersAt(s, k).length) return 0;
  let v = 0;
  for (const m of s.monsters) {
    if (m.kind === 'root-king') continue;
    const d = dist(k, m.at);
    if (d !== 1) continue;
    v += 1;
    if (dist(k, HOME) < dist(m.at, HOME)) v += 1;
    if (s.players.some((x) => !x.lost && dist(x.at, k) <= 1)) v += 0.5;
  }
  return v;
}
const canAfford = (p, cost) => Object.entries(cost).every(([r, n]) => p.bag[r] >= n);

function stepToward(s, p, target) {
  const r = reachable(s, p);
  const danger = dangerTiles(s);
  let best = null, bd = dist(p.at, target);
  for (const k of Object.keys(r)) {
    if (monstersAt(s, k).length || r[k].hurt > 0 || (danger.has(k) && k !== target)) continue;
    const d = dist(k, target);
    if (d < bd) { bd = d; best = k; }
  }
  return best && { type: 'move', to: best };
}

export function botAction(s) {
  useBoard(s);
  const p = s.players[s.turn], o = options(s);
  if (s.pending) return { type: 'choose', index: 0 };
  if (o.revive?.length) return { type: 'revive', target: o.revive[0].char };
  const need = needs(s);
  const carrying = Object.entries(p.bag).some(([r, n]) => r !== 'food' && n > 0);
  const full = Object.values(p.bag).reduce((a, b) => a + b, 0) >= 7;
  const sc = s.settings.scenario;
  const done = SCENARIOS[sc].parts.every((x) => s.built[x.id]);
  if (p.at === HOME) {
    // Unpack the haul, but not a lone snare kit (1 Wood + 1 Metal) carried on purpose.
    const beyondKit = Object.entries(p.bag).some(([r, n]) => r !== 'food' && n > (r === 'wood' || r === 'metal' ? 1 : 0));
    if (o.deposit && beyondKit) return { type: 'deposit' };
    for (const part of o.build) if (ok(s, p, { type: 'build', part: part.id })) return { type: 'build', part: part.id };
    if (done && sc === 'skyship') {
      const crew = s.players.filter((x) => !x.lost).length;
      if (s.storage.food < crew && p.bag.food > 0) return { type: 'store', res: 'food' };
      if (o.launch && ok(s, p, { type: 'launch' })) return { type: 'launch' };
    }
    if (o.rest && (p.lives < 2 || p.fear >= 2)) return { type: 'rest' };
    if (o.recall?.length) return { type: 'recall', target: o.recall[0].char };
    if (o.advance && ok(s, p, { type: 'advance' })) return { type: 'advance' };
    if (!done && p.bag.food < 2 && s.storage.food > 2) return { type: 'withdraw', res: 'food' };
    // Carry a snare kit (1 Wood + 1 Metal) when storage holds more than the invention still needs.
    const kitKeen = FIGHTERS.has(p.char) || Math.random() < 0.3;
    if (kitKeen && !need.wood && !need.metal) {
      if (p.bag.wood < 1 && s.storage.wood > 0) return { type: 'withdraw', res: 'wood' };
      if (p.bag.metal < 1 && s.storage.metal > 0) return { type: 'withdraw', res: 'metal' };
    }
  }
  if (o.fuel) {
    const stay = p.at === HOME && done && sc === 'skyship';
    if (!stay) return { type: 'fuel', how: p.bag.food > 0 || (p.at === HOME && s.storage.food > 0) ? 'food' : 'free' };
  }
  if (o.revive?.length) return { type: 'revive', target: o.revive[0].char };
  // Standing with a monster: the corruption has already bitten, so make it count.
  if (o.attack?.length) {
    const m = [...o.attack].sort((a, b) => a.hp - b.hp)[0];
    const backup = s.players.some((x) => x !== p && !x.lost && dist(x.at, m.at) <= 1);
    // On a last life, alone, against a monster that won't fall this turn: back off instead.
    const dice = attackDice(s, p, m.at);
    const killNow = dice * DMG_PER_DIE >= m.hp * 1.2;          // likely to finish it with this swing
    const safe = m.stuck || p.lives >= 2;                       // snared monsters can't strike back
    if (killNow || safe || (backup && p.lives >= 2) || m.kind === 'root-king') return { type: 'attack', id: m.id };
  }
  // Snare a tile monsters are likely to cross (Bramblecap the Trapper loves this).
  if (o.craft && canAfford(p, CRAFTS.snare.cost) && snareValue(s, p.at) > 0) {
    const keen = p.char === 'bramblecap' ? 0.9 : snareValue(s, p.at) >= 2 ? 0.6 : 0.3;
    if (Math.random() < keen) return { type: 'craft', id: 'snare' };
  }
  // Weather Engine finale: hold the pylons
  if (s.finale?.pylons) {
    const free = s.finale.pylons.filter((k) => !s.players.some((x) => x !== p && x.at === k && !x.lost));
    const target = s.finale.pylons.includes(p.at) && !s.players.some((x) => x !== p && x.at === p.at) ? null : free[0];
    if (target && o.move) { const m = stepToward(s, p, target); if (m) return m; }
    if (o.cleanse?.length) return { type: 'cleanse', at: o.cleanse[0] };
    if (s.finale.pylons.includes(p.at)) return { type: 'endTurn' };
  }
  // Monster Cage finale: hunt the Root King together
  const king = s.monsters.find((m) => m.kind === 'root-king');
  if (king && (s.finale?.cage || sc !== 'monster-cage') && p.lives > 1 && o.move) {
    // Worth a life to close in: take the reachable tile nearest the King, crossing at most one corrupted tile.
    const r = reachable(s, p);
    const opts = Object.entries(r).filter(([, v]) => v.hurt <= 1).sort((a, b) => dist(a[0], king.at) - dist(b[0], king.at) || a[1].hurt - b[1].hurt);
    if (opts.length && dist(opts[0][0], king.at) < dist(p.at, king.at)) return { type: 'move', to: opts[0][0] };
  }
  // Quests: the nearest free Mushroomfolk goes after each marker; carriers head home.
  if (s.quest && !(s.finale?.pylons)) {
    for (const q of [...(o.quest || [])]) {
      const def = QUESTS[q.id];
      if (q.kind !== 'deliver' || Object.entries(def.need).every(([r, n]) => p.bag[r] + (p.at === HOME ? s.storage[r] : 0) >= n))
        return { type: 'quest', qid: q.qid };
    }
    if (o.move) {
      const r = reachable(s, p);
      const goTo = (k) => (r[k] && r[k].hurt <= (p.lives >= 2 ? 1 : 0) && !monstersAt(s, k).length) ? { type: 'move', to: k } : stepToward(s, p, k);
      const mine = s.quest.active.find((q) => q.carrier === p.char);
      if (mine) { const m = goTo(HOME); if (m) return m; }
      const open = s.quest.active.filter((q) => q.at && !q.carrier && ['visit', 'deliver', 'escort'].includes(q.kind))
        .sort((a, b) => (a.deadline - b.deadline) || dist(p.at, a.at) - dist(p.at, b.at));
      for (const q of open) {
        // Only the closest standing friend takes it on, so the team spreads out.
        const closest = s.players.filter((x) => !x.lost).sort((a, b) => dist(a.at, q.at) - dist(b.at, q.at))[0];
        if (closest !== p && dist(p.at, q.at) > dist(closest.at, q.at) + 1) continue;
        if (q.kind === 'deliver' && !Object.entries(QUESTS[q.id].need).every(([res, n]) => p.bag[res] >= n)) continue;
        const m = goTo(q.at);
        if (m) return m;
      }
    }
  }
  // Hunt: go after a monster this turn when the odds (or a friend in trouble) say so.
  if (o.move && !(s.finale?.pylons)) {
    const r = reachable(s, p);
    const prey = s.monsters.filter((m) => worthHunting(s, p, m, r)).sort((a, b) => a.hp - b.hp || dist(p.at, a.at) - dist(p.at, b.at));
    if (prey.length) { const spot = strikeSpot(s, p, prey[0], r); if (spot && spot !== p.at) return { type: 'move', to: spot }; }
    // Join a friend who is already fighting: stand beside the monster to add a die.
    const brawl = s.monsters.find((m) => m.kind !== 'root-king' && s.players.some((x) => x !== p && !x.lost && dist(x.at, m.at) <= 1));
    if (brawl) { const spot = strikeSpot(s, p, brawl, r); if (spot && spot !== p.at && (spot !== brawl.at || p.lives >= 2)) return { type: 'move', to: spot }; }
    // The Trapper sets a trap line: walk to a safe tile beside a monster to lay a snare there.
    if (p.char === 'bramblecap' && p.turn.dec > 0 && canAfford(p, CRAFTS.snare.cost)) {
      const spots = Object.keys(r).filter((k) => !r[k].hurt && snareValue(s, k) > 0).sort((a, b) => snareValue(s, b) - snareValue(s, a));
      if (spots.length) return { type: 'move', to: spots[0] };
    }
  }
  const goHome = full || (carrying && Object.keys(need).length <= 2) || (p.lives < 2 && p.char !== 'sporewick') || (done && sc === 'skyship');
  if (goHome && p.at !== HOME && o.move) { const m = reachable(s, p)[HOME] ? { type: 'move', to: HOME } : stepToward(s, p, HOME); if (m) return m; }
  const here = s.tiles[p.at];
  if (p.at !== HOME && !goHome) {
    const cleanseQuest = s.quest?.active.some((q) => q.kind === 'cleanse');
    if (o.cleanse?.length && (cleanseQuest || Math.random() < 0.5)) return { type: 'cleanse', at: o.cleanse[0] };
    // A long way from home with spare Wood and Metal: raise an Outpost.
    if (o.outpost && dist(p.at, HOME) >= 3 && Object.entries(OUTPOST.cost).every(([r, n]) => p.bag[r] >= n) && Math.random() < 0.6)
      return { type: 'outpost' };
    const gi = yieldsWanted(here.biome, need);
    const clueHere = s.quest && s.quest.chain > 0 && s.quest.chain < 4 && here.biome === ['highlands', 'crystal', 'ruins'][s.quest.chain - 1];
    if (o.search && !here.searched && !here.corrupted && (clueHere || gi < 0 || Math.random() < 0.5)) return { type: 'search' };
    if (o.gather && gi >= 0 && here.harvest < 2) return { type: 'gather', option: gi };
    if (o.search && !here.searched && !here.corrupted) return { type: 'search' };
  }
  if (o.move) {
    const r = reachable(s, p);
    const danger = dangerTiles(s);
    const chainBiome = s.quest && s.quest.chain > 0 && s.quest.chain < 4 ? ['highlands', 'crystal', 'ruins'][s.quest.chain - 1] : null;
    const scored = Object.keys(r).filter((k) => !monstersAt(s, k).length && !r[k].hurt).map((k) => {
      const t = s.tiles[k];
      let sc2 = -dist(k, HOME) * 0.3 + Math.random();
      if (danger.has(k)) sc2 -= 4;
      if (!t.revealed) sc2 += s.quest && !questsOk(s) ? 2.4 : 1.2;
      // Broken Compass: head for an unsearched tile of the biome the next clue is in.
      if (chainBiome && t.revealed && t.biome === chainBiome && !t.searched && !t.corrupted) sc2 += 3;
      else if (yieldsWanted(t.biome, need) >= 0 && t.harvest < 2) sc2 += 2.5;
      return [k, sc2];
    }).sort((a, b) => b[1] - a[1]);
    if (scored.length) return { type: 'move', to: scored[0][0] };
  }
  if (dangerTiles(s).has(p.at) && p.at !== HOME && o.move) { const m = stepToward(s, p, HOME); if (m) return m; }
  if (o.fuel && dangerTiles(s).has(p.at) && p.at !== HOME) return { type: 'fuel', how: p.bag.food > 0 ? 'food' : 'free' };
  return { type: 'endTurn' };
}
