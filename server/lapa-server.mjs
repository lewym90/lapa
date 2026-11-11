// ŁAPA – Nowodwór: serwer wspólnych danych. Zero zależności (tylko Node 22: node:sqlite).
// Dwa poziomy dostępu: hasło wolontariusza (sesja 24 h od ostatniej aktywności)
// i hasło koordynatora (dane osobowe, blokada po 1 h bez aktywności użytkownika).
// Dane osobowe = kolekcje o nazwie zaczynającej się od "p_". Bez odblokowania serwer ich NIE wysyła.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = +(process.env.PORT || 8797);
const HOST = process.env.HOST || '127.0.0.1';
const DB_FILE = process.env.DB_FILE || './data/lapa.db';
const HASH_VOL = process.env.PASS_VOLUNTEER_HASH || '';
const HASH_COORD = process.env.PASS_COORDINATOR_HASH || '';
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://lewym90.github.io,http://localhost:8000,http://127.0.0.1:8000').split(',');
const VOL_TTL = +(process.env.VOL_TTL_MS || 24 * 3600e3);
const COORD_TTL = +(process.env.COORD_TTL_MS || 3600e3);
const MAX_BODY = 1_000_000;
const MAX_RECORD = 200_000;

if (!HASH_VOL || !HASH_COORD) { console.error('Brak PASS_VOLUNTEER_HASH / PASS_COORDINATOR_HASH'); process.exit(1); }
const fp = (h) => crypto.createHash('sha256').update(h).digest('hex').slice(0, 16);
const FP_VOL = fp(HASH_VOL), FP_COORD = fp(HASH_COORD);

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
CREATE TABLE IF NOT EXISTS records(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
  updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, by TEXT NOT NULL DEFAULT '',
  UNIQUE(col,id));
CREATE INDEX IF NOT EXISTS records_seq ON records(seq);
CREATE TABLE IF NOT EXISTS history(
  hid INTEGER PRIMARY KEY AUTOINCREMENT, col TEXT, id TEXT, data TEXT, updated_at INTEGER, deleted INTEGER, by TEXT, replaced_at INTEGER);
CREATE INDEX IF NOT EXISTS history_rec ON history(col,id);
CREATE TABLE IF NOT EXISTS sessions(
  th TEXT PRIMARY KEY, created INTEGER, vol_seen INTEGER, fp_vol TEXT, coord_until INTEGER DEFAULT 0, fp_coord TEXT DEFAULT '');
`);

// ---------- hasła ----------
function verifyPassword(pw, stored) {
  try {
    const [alg, n, salt, hash] = stored.split('$');
    if (alg !== 'scrypt') return false;
    const want = Buffer.from(hash, 'base64');
    const got = crypto.scryptSync(pw, Buffer.from(salt, 'base64'), want.length, { N: +n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return crypto.timingSafeEqual(got, want);
  } catch { return false; }
}

// ---------- ograniczanie prób logowania ----------
const fails = new Map(); // ip -> {n, t}
const WINDOW = 15 * 60e3, MAX_FAILS = 8;
function blocked(ip) { const f = fails.get(ip); if (!f) return 0; if (Date.now() - f.t > WINDOW) { fails.delete(ip); return 0; } return f.n >= MAX_FAILS ? Math.ceil((WINDOW - (Date.now() - f.t)) / 1000) : 0; }
function addFail(ip) { const f = fails.get(ip); if (!f || Date.now() - f.t > WINDOW) fails.set(ip, { n: 1, t: Date.now() }); else f.n++; }
setInterval(() => { for (const [k, v] of fails) if (Date.now() - v.t > WINDOW) fails.delete(k); }, 60e3).unref();

// ---------- sesje ----------
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function newSession(coord) {
  const token = crypto.randomBytes(32).toString('base64url'), now = Date.now();
  db.prepare('INSERT INTO sessions(th,created,vol_seen,fp_vol,coord_until,fp_coord) VALUES(?,?,?,?,?,?)')
    .run(sha(token), now, now, FP_VOL, coord ? now + COORD_TTL : 0, coord ? FP_COORD : '');
  return token;
}
function getSession(req, touchActive) {
  const m = /^Bearer ([\w-]{20,80})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const th = sha(m[1]), row = db.prepare('SELECT * FROM sessions WHERE th=?').get(th), now = Date.now();
  if (!row || row.fp_vol !== FP_VOL || now - row.vol_seen > VOL_TTL) { if (row) db.prepare('DELETE FROM sessions WHERE th=?').run(th); return null; }
  const coord = row.coord_until > now && row.fp_coord === FP_COORD;
  const active = req.headers['x-active'] === '1' || touchActive;
  if (now - row.vol_seen > Math.min(30e3, VOL_TTL / 10)) db.prepare('UPDATE sessions SET vol_seen=? WHERE th=?').run(now, th);
  if (coord && active) db.prepare('UPDATE sessions SET coord_until=? WHERE th=?').run(now + COORD_TTL, th);
  return { th, coord, coordUntil: coord ? (active ? now + COORD_TTL : row.coord_until) : 0 };
}
setInterval(() => db.prepare('DELETE FROM sessions WHERE vol_seen < ?').run(Date.now() - VOL_TTL), 3600e3).unref();

// ---------- HTTP ----------
function send(res, code, obj, extra = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { reject(Object.assign(new Error('za duże'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('zły JSON'), { code: 400 })); } });
    req.on('error', reject);
  });
}
const COL_RE = /^[a-z][a-z0-9_]{0,39}$/, ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const isPrivate = (col) => col.startsWith('p_');
const clientIp = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

async function handle(req, res) {
  const origin = req.headers.origin;
  const cors = origin && ORIGINS.includes(origin)
    ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'authorization,content-type,x-active', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-max-age': '600' } : {};
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const send2 = (c, o) => send(res, c, o, cors);
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '') || '/';

  if (p === '/health') return send2(200, { ok: true });

  if (p === '/auth/login' && req.method === 'POST') {
    const ip = clientIp(req), wait = blocked(ip);
    if (wait) return send2(429, { error: 'Za dużo prób. Spróbuj za kilka minut.', retry_after: wait });
    const { password } = await readJson(req);
    if (typeof password !== 'string' || password.length < 1 || password.length > 200) return send2(400, { error: 'Brak hasła' });
    const isCoord = verifyPassword(password, HASH_COORD), isVol = !isCoord && verifyPassword(password, HASH_VOL);
    if (!isCoord && !isVol) { addFail(ip); await new Promise((r) => setTimeout(r, 500)); return send2(401, { error: 'Nieprawidłowe hasło' }); }
    const token = newSession(isCoord);
    return send2(200, { token, coordinator: isCoord, vol_ttl_ms: VOL_TTL, coord_ttl_ms: COORD_TTL });
  }

  const s = getSession(req, false);
  if (!s) return send2(401, { error: 'Zaloguj się ponownie', login: true });

  if (p === '/auth/status') return send2(200, { ok: true, coordinator: s.coord, coord_until: s.coordUntil });
  if (p === '/auth/logout' && req.method === 'POST') { db.prepare('DELETE FROM sessions WHERE th=?').run(s.th); return send2(200, { ok: true }); }
  if (p === '/auth/lock' && req.method === 'POST') { db.prepare('UPDATE sessions SET coord_until=0 WHERE th=?').run(s.th); return send2(200, { ok: true }); }
  if (p === '/auth/unlock' && req.method === 'POST') {
    const ip = clientIp(req), wait = blocked(ip);
    if (wait) return send2(429, { error: 'Za dużo prób. Spróbuj za kilka minut.', retry_after: wait });
    const { password } = await readJson(req);
    if (typeof password !== 'string' || !verifyPassword(password, HASH_COORD)) { addFail(ip); await new Promise((r) => setTimeout(r, 500)); return send2(401, { error: 'Nieprawidłowe hasło koordynatora' }); }
    const until = Date.now() + COORD_TTL;
    db.prepare('UPDATE sessions SET coord_until=?, fp_coord=? WHERE th=?').run(until, FP_COORD, s.th);
    return send2(200, { ok: true, coordinator: true, coord_until: until });
  }

  // GET /sync?since=N&private=0|1  — zmiany od numeru N; private=1 tylko dla koordynatora
  if (p === '/sync' && req.method === 'GET') {
    const wantPrivate = url.searchParams.get('private') === '1';
    if (wantPrivate && !s.coord) return send2(403, { error: 'Wymagane hasło koordynatora', locked: true });
    const since = Math.max(0, parseInt(url.searchParams.get('since') || '0', 10) || 0), limit = 300;
    const rows = db.prepare(`SELECT seq,col,id,data,updated_at,deleted,by FROM records WHERE seq>? AND ${wantPrivate ? "col LIKE 'p\\_%' ESCAPE '\\'" : "col NOT LIKE 'p\\_%' ESCAPE '\\'"} ORDER BY seq LIMIT ?`).all(since, limit + 1);
    const more = rows.length > limit; if (more) rows.pop();
    const changes = rows.map((r) => ({ seq: r.seq, col: r.col, id: r.id, data: JSON.parse(r.data), updated_at: r.updated_at, deleted: !!r.deleted, by: r.by }));
    return send2(200, { changes, seq: changes.length ? changes[changes.length - 1].seq : since, more, server_time: Date.now() });
  }

  // POST /sync {changes:[{col,id,data,updated_at,deleted,by}]}
  if (p === '/sync' && req.method === 'POST') {
    const { changes } = await readJson(req);
    if (!Array.isArray(changes) || changes.length > 100) return send2(400, { error: 'Zła lista zmian (max 100)' });
    const now = Date.now(), results = [];
    const get = db.prepare('SELECT * FROM records WHERE col=? AND id=?');
    const hist = db.prepare('INSERT INTO history(col,id,data,updated_at,deleted,by,replaced_at) VALUES(?,?,?,?,?,?,?)');
    const put = db.prepare('INSERT OR REPLACE INTO records(col,id,data,updated_at,deleted,by) VALUES(?,?,?,?,?,?)');
    db.exec('BEGIN');
    try {
      for (const c of changes) {
        const r = { col: c?.col, id: c?.id };
        if (!COL_RE.test(c?.col || '') || !ID_RE.test(c?.id || '') || !Number.isFinite(c?.updated_at)) { results.push({ ...r, status: 'invalid' }); continue; }
        if (isPrivate(c.col) && !s.coord) { results.push({ ...r, status: 'locked' }); continue; }
        const json = JSON.stringify(c.data ?? {});
        if (json.length > MAX_RECORD) { results.push({ ...r, status: 'too_big' }); continue; }
        const ts = Math.min(Math.floor(c.updated_at), now + 5 * 60e3), old = get.get(c.col, c.id);
        if (old && old.updated_at > ts) { results.push({ ...r, status: 'stale' }); continue; }
        if (old) hist.run(old.col, old.id, old.data, old.updated_at, old.deleted, old.by, now);
        put.run(c.col, c.id, json, ts, c.deleted ? 1 : 0, String(c.by || '').slice(0, 60));
        results.push({ ...r, status: 'ok' });
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return send2(200, { results });
  }

  // GET /history?col=&id=  — poprzednie wersje rekordu
  if (p === '/history' && req.method === 'GET') {
    const col = url.searchParams.get('col') || '', id = url.searchParams.get('id') || '';
    if (!COL_RE.test(col) || !ID_RE.test(id)) return send2(400, { error: 'Zły rekord' });
    if (isPrivate(col) && !s.coord) return send2(403, { error: 'Wymagane hasło koordynatora', locked: true });
    const rows = db.prepare('SELECT data,updated_at,deleted,by FROM history WHERE col=? AND id=? ORDER BY hid DESC LIMIT 50').all(col, id);
    return send2(200, { versions: rows.map((r) => ({ data: JSON.parse(r.data), updated_at: r.updated_at, deleted: !!r.deleted, by: r.by })) });
  }

  return send2(404, { error: 'Nie ma takiej ścieżki' });
}

http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    const code = e.code === 413 || e.code === 400 ? e.code : 500;
    if (code === 500) console.error(new Date().toISOString(), e);
    if (!res.headersSent) send(res, code, { error: code === 500 ? 'Błąd serwera' : e.message });
  });
}).listen(PORT, HOST, () => console.log(`ŁAPA nasłuchuje na ${HOST}:${PORT}`));
