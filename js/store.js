// Warstwa danych: zapis lokalny natychmiast, wysyłka na serwer w tle.
import * as db from './db.js';
import { LOCAL_ONLY } from './config.js';
import { emit } from './bus.js';
import { uid } from './util.js';
import { kick } from './sync.js';
import { getName } from './auth.js';

export async function save(col, obj) {
  obj.id ||= uid();
  const rec = { col, id: obj.id, data: obj, updated_at: Date.now(), deleted: false, by: getName() };
  await db.putRec(rec);
  if (!LOCAL_ONLY.has(col)) await db.addOutbox({ col, id: rec.id, data: obj, updated_at: rec.updated_at, deleted: false, by: rec.by });
  emit('change', { col }); kick();
  return obj;
}
export async function remove(col, id) {
  const old = await db.getRec(col, id);
  const rec = { col, id, data: old?.data || {}, updated_at: Date.now(), deleted: true, by: getName() };
  await db.putRec(rec);
  if (!LOCAL_ONLY.has(col)) await db.addOutbox({ col, id, data: rec.data, updated_at: rec.updated_at, deleted: true, by: rec.by });
  emit('change', { col }); kick();
}
export async function list(col) { return (await db.getAll(col)).filter((r) => !r.deleted).map((r) => r.data); }
export async function listRecs(col) { return (await db.getAll(col)).filter((r) => !r.deleted); }
export async function get(col, id) { const r = await db.getRec(col, id); return r && !r.deleted ? r.data : null; }
