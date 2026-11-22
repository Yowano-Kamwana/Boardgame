// Cleansing lowers the Horror Track; each monster mark wakes only one monster.
import * as E from '../game/engine.js';
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok  ', m); };
let s = E.newLobby({ id: 'x', name: 'x', hostUid: 'u', spawnEvery: 3 });
s = E.joinSeat(s, { uid: 'u', name: 'm', char: 'sporewick' });
s = E.startGame(s).state; E.useBoard(s);
const p = s.players[0];
const k = E.neighbors('0,0').find((x) => s.tiles[x]);
s.tiles[k].revealed = true; s.tiles[k].corrupted = true; s.tiles[k].biome = 'forest';
const h0 = s.horror; p.turn.dec = 2;
s = E.act(s, 'sporewick', { type: 'cleanse', at: k }).state;
ok(s.horror === Math.max(0, h0 - 1) && !s.tiles[k].corrupted, `cleanse lowers Horror (${h0} -> ${s.horror})`);
// walk Horror up to a spawn mark, down, and up again: one monster only
s.horror = 2; s.monsters = []; s.spawnMarks = {};
const t = Object.keys(s.tiles).filter((x) => x !== '0,0' && !s.tiles[x].corrupted);
const corrupt = (x) => { s.tiles[x].revealed = true; s.players[0].at = '0,0'; s.players[0].turn.dec = 2; s.tiles[x].corrupted = false; };
// use a Withered Ward-like path: the engine's own corruption via an effect card
s.decks.blight.unshift('withered-ward');
s.players[0].at = t[0]; s.tiles[t[0]].revealed = true; s.tiles[t[0]].corrupted = true; s.tiles[t[0]].biome = 'forest';
s = E.act(s, 'sporewick', { type: 'search' }).state;
const first = s.monsters.length;
ok(s.horror >= 3 && first === 1, `reaching mark 3 wakes one monster (Horror ${s.horror}, monsters ${first})`);
s.horror = 2; s.players[0].turn.dec = 2;
s.decks.blight.unshift('withered-ward');
s = E.act(s, 'sporewick', { type: 'search' }).state;
ok(s.monsters.length === first, `passing mark 3 again wakes nothing new (monsters ${s.monsters.length})`);
console.log('horror ok');
