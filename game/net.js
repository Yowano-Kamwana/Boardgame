// Game sync. Online: one shared db document per expedition (games/<id>), read live by every
// player. Offline (or "play on this device"): kept in this browser for pass-and-play.

const LOCAL_KEY = 'rootbound-local-games';
const tabId = Math.random().toString(36).slice(2, 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; }
}
function saveLocal(all) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); } catch { /* private window: play continues in memory */ }
}

function localStore() {
  const games = loadLocal();
  const watchers = {};
  const listWatchers = new Set();
  const emitList = () => listWatchers.forEach((cb) => cb(Object.values(games)));
  return {
    online: false,
    uid: 'this-device',
    listGames(cb) { listWatchers.add(cb); cb(Object.values(games)); return () => listWatchers.delete(cb); },
    async create(state) { games[state.id] = state; saveLocal(games); emitList(); return state; },
    watch(id, cb) {
      (watchers[id] ||= new Set()).add(cb);
      if (games[id]) cb(structuredClone(games[id]));
      return () => watchers[id].delete(cb);
    },
    async mutate(id, fn) {
      const next = fn(structuredClone(games[id]));
      games[id] = next;
      saveLocal(games);
      (watchers[id] || []).forEach((cb) => cb(structuredClone(next)));
      emitList();
      return next;
    },
    async remove(id) { delete games[id]; saveLocal(games); emitList(); },
  };
}

export async function createNet() {
  const local = localStore();
  try { return await connect(local); } catch { return { remote: null, local }; }
}

async function connect(local) {
  const claude = window.claude;
  if (!claude?.use) return { remote: null, local };
  const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  if (!db) return { remote: null, local };
  const uid = user ? await user.id() : null;
  // Without an identity, or with view-only access, a friend can see expeditions but not join them.
  let canWrite = null;
  try { canWrite = user?.can ? await user.can('data.write') : null; } catch { canWrite = null; }
  if (!uid) canWrite = false;

  const remote = {
    online: true,
    uid,
    canWrite,
    listGames(cb, onError) {
      return db.collection('games').orderBy('updated', 'desc').limit(25)
        .onSnapshot((snap) => cb(snap.docs.map((d) => d.data())), onError);
    },
    async create(state) {
      await db.doc(`games/${state.id}`).set(state);
      return state;
    },
    watch(id, cb, onError) {
      return db.doc(`games/${id}`).onSnapshot((snap) => { if (snap.exists) cb(structuredClone(snap.data())); }, onError);
    },
    // Read-modify-write under a short lease so two players never clobber each other.
    async mutate(id, fn) {
      const ref = db.doc(`games/${id}`);
      for (let attempt = 0; attempt < 12; attempt++) {
        const lease = await ref.acquire({ holder: uid + ':' + tabId, ttlMs: 5000 });
        if (!lease.acquired) { await sleep(250 + Math.random() * 300); continue; }
        const snap = await ref.get();
        const cur = structuredClone(snap.data());
        delete cur._lease; // lease bookkeeping, if the platform merged any
        const next = fn(cur);
        await ref.set(next);
        return next;
      }
      throw new Error('Another player is moving. Try again in a moment.');
    },
    async remove(id) { await db.doc(`games/${id}`).delete(); },
    // Small diagnostics (which figures load, and why one fails) so problems can be fixed remotely.
    async report(entry) {
      if (canWrite === false) return;
      try { await db.doc(`diag/${Date.now().toString(36)}-${tabId}`).set({ ...entry, at: Date.now(), ua: navigator.userAgent.slice(0, 160) }); } catch { /* best effort */ }
    },
  };
  return { remote, local };
}
