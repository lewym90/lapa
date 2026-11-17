// Warstwa danych: zapis lokalny natychmiast, wysyłka na serwer w tle.
import * as db from './db.js';
import { LOCAL_ONLY, VOL_WRITE } from './config.js';
import { emit } from './bus.js';
import { uid } from './util.js';
import { kick } from './sync.js';
import { getName, state } from './auth.js';

// Wolontariusz może zapisać tylko własne zgłoszenia; reszta tylko administrator (to samo sprawdza serwer).
export class TylkoAdmin extends Error { constructor() { super('To może zrobić tylko administrator'); this.name = 'TylkoAdmin'; } }
const wolno = (col) => state.admin || VOL_WRITE.has(col);

// Oznaczenia administratora (kolekcja „oznaczenia”, id = id psa) są doklejane do psa jako d.ozn przy każdym odczycie,
// więc widać je wszędzie, gdzie pojawia się pies. Nigdy nie są zapisywane w rekordzie psa (save je odcina).
const OZN = 'oznaczenia';
async function withOzn(dogs) {
  const m = new Map((await db.getAll(OZN)).filter((r) => !r.deleted).map((r) => [r.id, r.data]));
  for (const d of dogs) if (d) d.ozn = m.get(d.id) || null;
  return dogs;
}
const bezOzn = (col, obj) => { if (col !== 'psy' || !obj || !('ozn' in obj)) return obj; const { ozn, ...rest } = obj; void ozn; return rest; };

export async function save(col, obj) {
  if (!wolno(col)) throw new TylkoAdmin();
  obj.id ||= uid();
  const data = bezOzn(col, obj);
  const rec = { col, id: obj.id, data, updated_at: Date.now(), deleted: false, by: getName() };
  await db.putRec(rec);
  if (!LOCAL_ONLY.has(col)) await db.addOutbox({ col, id: rec.id, data, updated_at: rec.updated_at, deleted: false, by: rec.by });
  emit('change', { col }); kick();
  return obj;
}
export async function remove(col, id) {
  if (!wolno(col)) throw new TylkoAdmin();
  const old = await db.getRec(col, id);
  const rec = { col, id, data: old?.data || {}, updated_at: Date.now(), deleted: true, by: getName() };
  await db.putRec(rec);
  if (!LOCAL_ONLY.has(col)) await db.addOutbox({ col, id, data: rec.data, updated_at: rec.updated_at, deleted: true, by: rec.by });
  emit('change', { col }); kick();
}
// Psy w archiwum (zniknęli ze strony schroniska) są pomijani wszędzie; { archiwum: true } – razem z nimi (np. do podpisania starych wpisów imieniem psa).
export async function list(col, { archiwum = false } = {}) { let out = (await db.getAll(col)).filter((r) => !r.deleted).map((r) => r.data); if (col === 'psy') { if (!archiwum) out = out.filter((d) => !d.archiwum); return withOzn(out); } return out; }
export async function listRecs(col) { return (await db.getAll(col)).filter((r) => !r.deleted); }
export async function get(col, id) { const r = await db.getRec(col, id); const d = r && !r.deleted ? r.data : null; if (d && col === 'psy') await withOzn([d]); return d; }
