import * as E from '../game/engine.js';
import { botAction } from '../game/ai.js';
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok  ', m); };
let edgeOk = 0, edgeAll = 0, chainSteps = {}, nights = new Set(), stories = 0, newCards = new Set();
for (let g = 0; g < 60; g++) {
  let s = E.newLobby({ id: 'x', name: 'x', hostUid: 'u', quests: true, mode: g % 2 ? 'full' : 'standard' });
  for (const c of ['mushy', 'bramblecap', 'morella']) s = E.joinSeat(s, { uid: 'u', name: c, char: c });
  s = E.startGame(s).state;
  for (let i = 0; i < 2500 && s.phase === 'playing'; i++) {
    const p = s.players[s.turn];
    try { s = E.act(s, p.char, botAction(s)).state; } catch (e) { if (!(e instanceof E.RuleError)) throw e; s = E.act(s, p.char, { type: 'endTurn' }).state; }
    E.useBoard(s);
    for (const e of s.events) {
      if (e.t === 'quest' && ['forest-spirit', 'missing-trapper', 'wind-nymph'].includes(e.id)) { edgeAll++; if (E.dist(e.at, '0,0') === E.boardRadius()) edgeOk++; }
      if (e.t === 'chain') chainSteps[e.step] = (chainSteps[e.step] || 0) + 1;
      if (e.t === 'chainDone') chainSteps.done = (chainSteps.done || 0) + 1;
      if (e.t === 'night') nights.add(e.id);
      if (e.t === 'card') { newCards.add(e.id); if (/messenger|warning|stone|bottle|echo|tree|light|glass|snares|lanterns|watchtower|cave|rotten/.test(e.id)) stories++; }
    }
  }
}
ok(edgeAll > 0 && edgeOk === edgeAll, `edge quests start on the rim (${edgeOk}/${edgeAll})`);
ok(nights.size >= 8, `night cards drawn (${nights.size} different)`);
ok(stories > 0, `story cards drawn (${stories})`);
ok((chainSteps[1] || 0) > 0, `broken compass chain progresses ${JSON.stringify(chainSteps)}`);
console.log('distinct discovery cards drawn:', newCards.size);
