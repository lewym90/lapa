// Lokalna baza (IndexedDB): rekordy, kolejka zmian do wysłania, drobne ustawienia i zdjęcia zrobione w telefonie.
let dbp;
function open() {
  dbp ||= new Promise((resolve, reject) => {
    const r = indexedDB.open('lapa', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('records', { keyPath: ['col', 'id'] }).createIndex('col', 'col');
      d.createObjectStore('outbox', { keyPath: 'n', autoIncrement: true });
      d.createObjectStore('meta');
      d.createObjectStore('blobs');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Baza zablokowana – zamknij inne karty ŁAPY'));
  });
  return dbp;
}
const p = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
async function run(stores, mode, fn) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(stores, mode);
    let out;
    Promise.resolve(fn(...stores.map((s) => t.objectStore(s)))).then((v) => { out = v; }, reject);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transakcja przerwana'));
  });
}

export const getAll = (col) => run(['records'], 'readonly', (s) => p(s.index('col').getAll(col)));
export const getRec = (col, id) => run(['records'], 'readonly', (s) => p(s.get([col, id])));
export const putRec = (rec) => run(['records'], 'readwrite', (s) => p(s.put(rec)));
export const putMany = (recs) => run(['records'], 'readwrite', async (s) => { for (const r of recs) s.put(r); });

export const addOutbox = (item) => run(['outbox'], 'readwrite', (s) => p(s.add(item)));
export const listOutbox = (limit = 100) => run(['outbox'], 'readonly', (s) => p(s.getAll(null, limit)));
export const outboxCount = () => run(['outbox'], 'readonly', (s) => p(s.count()));
export const dropOutbox = (ns) => run(['outbox'], 'readwrite', async (s) => { for (const n of ns) s.delete(n); });
export const pendingFor = async (col, id) => (await run(['outbox'], 'readonly', (s) => p(s.getAll()))).some((o) => o.col === col && o.id === id);

export const metaGet = (k) => run(['meta'], 'readonly', (s) => p(s.get(k)));
export const metaSet = (k, v) => run(['meta'], 'readwrite', (s) => p(s.put(v, k)));

export const blobPut = (k, blob) => run(['blobs'], 'readwrite', (s) => p(s.put(blob, k)));
export const blobGet = (k) => run(['blobs'], 'readonly', (s) => p(s.get(k)));
export const blobDel = (k) => run(['blobs'], 'readwrite', (s) => p(s.delete(k)));

// Po zablokowaniu koordynatora: usuń z telefonu wszystkie dane osobowe (kolekcje p_*) i ich kolejkę.
export async function purgePrivate() {
  await run(['records', 'outbox', 'meta'], 'readwrite', async (rs, os, ms) => {
    const recs = await p(rs.getAll());
    for (const r of recs) if (r.col.startsWith('p_')) rs.delete([r.col, r.id]);
    const outs = await p(os.getAll());
    for (const o of outs) if (o.col.startsWith('p_')) os.delete(o.n);
    ms.delete('cursor_private');
  });
}
export async function wipeAll() {
  await run(['records', 'outbox', 'meta', 'blobs'], 'readwrite', async (a, b, c, d) => { a.clear(); b.clear(); c.clear(); d.clear(); });
}
export const allRecs = () => run(['records'], 'readonly', (s) => p(s.getAll()));
