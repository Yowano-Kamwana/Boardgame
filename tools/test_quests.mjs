import * as E from '../game/engine.js';
import { SCENARIOS } from '../game/data.js';
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok  ', m); };
let s = E.newLobby({ id: 'q', name: 'q', hostUid: 'u', quests: true });
s = E.joinSeat(s, { uid: 'u', name: 'A', char: 'mushy' });
s = E.startGame(s).state; E.useBoard(s);
ok(Object.values(s.tiles).filter((t) => t.questMark).length === 6, '6 quest marks on the standard board');
ok(E.partCost(s, SCENARIOS.skyship.parts[0]).artifact === 1, 'every part needs an Artifact');
const p = s.players[0]; s.monsters = []; s.weather = 'gentle-rain';
const fresh = () => { s.players[0].turn = { fueled: true, mp: 9, dec: 2 }; };
// force a visit quest next to home
s.quest.deck.unshift('forgotten-blueprint');
const mark = Object.keys(s.tiles).find((k) => s.tiles[k].questMark && E.dist(k, '0,0') === 1) || Object.keys(s.tiles).find((k) => s.tiles[k].questMark);
fresh(); p.at = '0,0';
const nb = E.neighbors(mark).find((k) => k !== '0,0') ;
Object.assign(s.tiles[nb], { revealed: true, corrupted: false, questMark: false }); s.players[0].at = nb;
Object.assign(s.tiles[mark], { corrupted: false });
s = E.act(s, 'mushy', { type: 'move', to: mark }).state;
ok(s.quest.active.length === 1, 'flipping a quest tile opens a quest');
const q = s.quest.active[0];
Object.assign(s.tiles[q.at], { revealed: true, corrupted: false });
s.players[0].at = q.at; fresh();
s = E.act(s, 'mushy', { type: 'quest', qid: q.qid }).state;
ok(s.quest.done === 1 && s.players[0].bag.artifact === 1, 'visit quest done: +1 Artifact');
// deliver
s.quest.deck.unshift('voice-forest');
const t2 = Object.keys(s.tiles).find((k) => s.tiles[k].questMark);
s.players[0].at = t2; s.tiles[t2].revealed = false;
// simulate reveal via move from neighbour
const n2 = E.neighbors(t2)[0]; Object.assign(s.tiles[n2], { revealed: true, corrupted: false, questMark: false }); s.tiles[t2].corrupted = false; s.players[0].at = n2; fresh();
s = E.act(s, 'mushy', { type: 'move', to: t2 }).state;
const q2 = s.quest.active.find((x) => x.id === 'voice-forest');
ok(q2 && q2.at === t2, 'deliver quest marker is on the tile that opened it');
s.players[0].bag.food = 1; s.players[0].bag.essence = 1; s.tiles[t2].corrupted = false; fresh();
s = E.act(s, 'mushy', { type: 'quest', qid: q2.qid }).state;
ok(s.quest.done === 2 && s.players[0].bag.essence === 0, 'deliver quest pays and completes');
// launch blocked without 3 quests
for (const part of SCENARIOS.skyship.parts) s.built[part.id] = 'mushy';
s.players[0].at = '0,0'; s.storage.food = 5; fresh();
let blocked = false; try { E.act(s, 'mushy', { type: 'launch' }); } catch (e) { blocked = /quests/.test(e.message); }
ok(blocked, 'launch needs 3 completed quests');
// timer: an open quest fails after its deadline
s.quest.active.push({ qid: 'qx', id: 'giants-path', kind: 'slay', at: null, progress: 0, goal: 1, deadline: s.round, carrier: null });
const h0 = s.horror;
for (let i = 0; i < 3 && s.quest.active.some((x) => x.qid === 'qx'); i++) { const c = s.players[s.turn]; s = E.act(s, c.char, { type: 'endTurn' }).state; }
ok(!s.quest.active.some((x) => x.qid === 'qx') && s.quest.failed >= 1, 'a quest past its deadline fails');
console.log('quests ok');
