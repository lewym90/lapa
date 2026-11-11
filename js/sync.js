import { api, ApiError, getToken } from './api.js';
import * as db from './db.js';
import { emit, on } from './bus.js';
import { state, lock, sessionLost } from './auth.js';
import { uploadPending } from './photos.js';

export const status = { state: 'idle', pending: 0, last: 0 };
let running = false, timer;
const setStatus = (s) => { Object.assign(status, s); emit('sync', { ...status }); };

export function kick(delay = 400) { clearTimeout(timer); timer = setTimeout(run, delay); }

async function push() {
  for (;;) {
    const items = await db.listOutbox(100);
    if (!items.length) return;
    const body = { changes: items.map(({ col, id, data, updated_at, deleted, by }) => ({ col, id, data, updated_at, deleted, by })) };
    const r = await api('/sync', { method: 'POST', body });
    const done = [];
    r.results.forEach((res, i) => {
      // ok / stale / invalid / too_big: nie ponawiamy; locked: zostaje w kolejce do czasu odblokowania
      if (res.status !== 'locked') done.push(items[i].n);
    });
    await db.dropOutbox(done);
    if (done.length < items.length) return;
  }
}

async function applyRemote(changes) {
  const out = [];
  for (const c of changes) {
    const local = await db.getRec(c.col, c.id);
    if (local && local.updated_at > c.updated_at && (await db.pendingFor(c.col, c.id))) continue; // lokalna, jeszcze niewysłana, jest nowsza
    out.push({ col: c.col, id: c.id, data: c.data, updated_at: c.updated_at, deleted: !!c.deleted, by: c.by });
  }
  if (out.length) await db.putMany(out);
  return out.length;
}

async function pull(priv) {
  const key = priv ? 'cursor_private' : 'cursor';
  let since = (await db.metaGet(key)) || 0, total = 0;
  for (;;) {
    const r = await api(`/sync?since=${since}&private=${priv ? 1 : 0}`);
    total += await applyRemote(r.changes);
    since = r.seq; await db.metaSet(key, since);
    if (!r.more) break;
  }
  return total;
}

export async function run() {
  if (running || !getToken() || !state.loggedIn) return;
  if (!navigator.onLine) { setStatus({ state: 'offline', pending: await db.outboxCount() }); return; }
  running = true; setStatus({ state: 'busy' });
  let changed = 0;
  try {
    await push();
    await uploadPending().catch((e) => { if (e instanceof ApiError && e.status === 401) throw e; });
    changed += await pull(false);
    if (state.coordinator) {
      try { changed += await pull(true); }
      catch (e) { if (e instanceof ApiError && e.status === 403) await lock(false); else throw e; }
    }
    setStatus({ state: 'ok', pending: await db.outboxCount(), last: Date.now() });
    if (changed) emit('change', { col: '*', remote: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) sessionLost();
    else setStatus({ state: e instanceof ApiError && e.status === 0 ? 'offline' : 'error', pending: await db.outboxCount(), error: e.message });
  } finally { running = false; }
}

addEventListener('online', () => kick(200));
addEventListener('offline', () => setStatus({ state: 'offline' }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(300); });
setInterval(() => { if (document.visibilityState === 'visible') run(); }, 45000);
on('unlocked', () => kick(100));
on('auth', () => { if (state.loggedIn) kick(200); });
