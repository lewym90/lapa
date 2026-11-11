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


// ---------- import ze strony schroniska (tylko ta jedna domena, tylko adresy psów) ----------
const SITE_HOSTS = new Set(['www.schronisko-nowodwor.com.pl', 'schronisko-nowodwor.com.pl']);
const SITE = 'https://www.schronisko-nowodwor.com.pl';
const DOG_PATH = /^\/(psy-do-adopcji|do-adopcji-pilne|adoptowane)\/([^/?#]+)\/(\d+)\/?$/;
const UA = { 'user-agent': 'LAPA-Nowodwor/1.0 (aplikacja wolontariuszy schroniska)', accept: 'text/html,application/xhtml+xml' };
const htmlCache = new Map();
async function fetchHtml(urlStr) {
  const hit = htmlCache.get(urlStr); if (hit && Date.now() - hit.t < 10 * 60e3) return hit.v;
  let u = new URL(urlStr);
  for (let i = 0; i < 3; i++) {
    if (u.protocol !== 'https:' || !SITE_HOSTS.has(u.hostname)) throw Object.assign(new Error('Niedozwolony adres'), { code: 422 });
    const res = await fetch(u, { headers: UA, redirect: 'manual', signal: AbortSignal.timeout(12000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { u = new URL(res.headers.get('location'), u); continue; }
    if (!res.ok) throw Object.assign(new Error(res.status === 404 ? 'Nie ma takiej strony na stronie schroniska' : 'Strona schroniska odpowiedziała błędem ' + res.status), { code: 502 });
    const t = await res.text();
    if (t.length > 2_500_000) throw Object.assign(new Error('Strona jest zbyt duża'), { code: 502 });
    htmlCache.set(urlStr, { t: Date.now(), v: t }); if (htmlCache.size > 200) htmlCache.delete(htmlCache.keys().next().value);
    return t;
  }
  throw Object.assign(new Error('Zbyt wiele przekierowań'), { code: 502 });
}
const ENT = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', oacute: 'ó', Oacute: 'Ó' };
const decode = (t) => t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m);
const textLines = (h) => decode(h.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<\/(p|div|li|h[1-6]|tr|section|article|ul|ol|table)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean);
const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]/g, '');
const titleCase = (x) => x ? x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() : x;
const LABELS = { 'Płeć': 'plec', 'Wiek': 'wiek', 'Wielkość': 'wielkosc', 'Waga': 'waga', 'Wzrost': 'wzrost', 'Sierść': 'siersc' };
function parseDog(h, u) {
  const m = DOG_PATH.exec(u.pathname), slug = decodeURIComponent(m[2]), id = m[3];
  const status = m[1] === 'do-adopcji-pilne' ? 'pilne' : m[1] === 'adoptowane' ? 'adoptowany' : 'do_adopcji';
  const lines = textLines(h);
  const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(h) || [])[1];
  const h1t = h1 ? decode(h1.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';
  const first = h1t.split(/\s+[-–—:]\s+|[:!]/)[0].trim().split(' ')[0];
  const name = first && norm(first) === norm(slug) ? titleCase(first) : titleCase(slug);
  const fields = {};
  for (const l of lines) { const f = /^(Płeć|Wiek|Wielkość|Waga|Wzrost|Sierść)\s*:\s*(.{1,60})$/.exec(l); if (f && !fields[LABELS[f[1]]]) fields[LABELS[f[1]]] = f[2].trim(); }
  // opis: akapity po nagłówku psa, do początku sekcji kontaktu / zasad adopcji
  let start = lines.findIndex((l) => h1t && l.startsWith(h1t.slice(0, 20)));
  if (start < 0) start = lines.findIndex((l) => norm(l).startsWith(norm(name)));
  const STOP = /(kontakt w sprawie adopcji|zasady adopcji|chcesz adoptować|zapraszamy do kontaktu|dane do wpłat|numer konta)/i;
  const desc = [];
  for (let i = start + 1; i < lines.length && start >= 0; i++) {
    const l = lines[i]; if (STOP.test(l)) break;
    if (/^(Płeć|Wiek|Wielkość|Waga|Wzrost|Sierść|Status)\s*:/.test(l) || l.length < 25) continue;
    desc.push(l); if (desc.join('\n').length > 4000) break;
  }
  const abs = (x) => { try { return new URL(decode(x), u).href; } catch { return ''; } };
  const imgs = []; const re = /(?:https?:)?\/?[^"'\s()<>]*?_l\.jpe?g(?:\?[^"'\s()<>]*)?/gi; let im;
  while ((im = re.exec(h))) { const a = abs(im[0].startsWith('//') ? 'https:' + im[0] : im[0]); if (a && SITE_HOSTS.has(new URL(a).hostname) && !imgs.includes(a)) imgs.push(a); }
  if (!imgs.length) { const og = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i.exec(h); if (og) { const a = abs(og[1]); if (a) imgs.push(a); } }
  const yt = /(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([\w-]{11})/.exec(h);
  return { url: u.origin + u.pathname.replace(/\/$/, ''), id, name, status, fields, opis: desc.join('\n\n'), zdjecia: imgs.slice(0, 20), film: yt ? 'https://www.youtube.com/watch?v=' + yt[1] : '',
    debug: { h1: h1t, linie: lines.length, start, pol: Object.keys(fields) } };
}
async function dogLinks() {
  const links = new Set();
  for (const cat of ['psy-do-adopcji', 'do-adopcji-pilne']) {
    for (let page = 1; page <= 15; page++) {
      let h; try { h = await fetchHtml(`${SITE}/${cat}${page > 1 ? '?page=' + page : ''}`); } catch { break; }
      const before = links.size, re = /href=["']((?:https?:\/\/(?:www\.)?schronisko-nowodwor\.com\.pl)?\/(?:psy-do-adopcji|do-adopcji-pilne)\/[^"'\/\s]+\/\d+)\/?["']/gi; let m;
      while ((m = re.exec(h))) links.add(new URL(m[1], SITE).href);
      if (links.size === before) break;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return [...links].slice(0, 400);
}
const PHOTO_DIR = path.join(path.dirname(DB_FILE), 'photos');
fs.mkdirSync(PHOTO_DIR, { recursive: true });
function readRaw(req, max) {
  return new Promise((resolve, reject) => {
    let n = 0; const c = [];
    req.on('data', (b) => { n += b.length; if (n > max) { reject(Object.assign(new Error('Zdjęcie jest za duże'), { code: 413 })); req.destroy(); } else c.push(b); });
    req.on('end', () => resolve(Buffer.concat(c))); req.on('error', reject);
  });
}

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


  // GET /import?url=...  — pobiera i odczytuje stronę jednego psa ze strony schroniska
  if (p === '/import' && req.method === 'GET') {
    let u; try { u = new URL(url.searchParams.get('url') || ''); } catch { return send2(422, { error: 'To nie jest poprawny adres' }); }
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (!SITE_HOSTS.has(u.hostname) || !DOG_PATH.test(u.pathname)) return send2(422, { error: 'To nie jest link do psa na stronie schronisko-nowodwor.com.pl' });
    const h = await fetchHtml(u.origin + u.pathname);
    return send2(200, parseDog(h, new URL(u.origin + u.pathname)));
  }
  if (p === '/import/links' && req.method === 'GET') return send2(200, { links: await dogLinks() });

  // POST /photo/:id (JPEG ≤ 1,5 MB), GET /photo/:id
  const pm = /^\/photo\/([A-Za-z0-9_-]{1,64})$/.exec(p);
  if (pm && req.method === 'POST') {
    const buf = await readRaw(req, 1_500_000), f = path.join(PHOTO_DIR, pm[1] + '.jpg');
    if (buf.length < 100 || !(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return send2(415, { error: 'To nie jest zdjęcie JPEG' });
    try { fs.writeFileSync(f, buf, { flag: 'wx' }); } catch (e) { if (e.code === 'EEXIST') return send2(409, { error: 'Zdjęcie już jest na serwerze' }); throw e; }
    return send2(200, { ok: true });
  }
  if (pm && req.method === 'GET') {
    let buf; try { buf = fs.readFileSync(path.join(PHOTO_DIR, pm[1] + '.jpg')); } catch { return send2(404, { error: 'Nie ma takiego zdjęcia' }); }
    res.writeHead(200, { ...cors, 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-length': buf.length });
    return res.end(buf);
  }

  return send2(404, { error: 'Nie ma takiej ścieżki' });
}

export { parseDog, DOG_PATH };
if (!process.env.LAPA_NO_LISTEN) http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    const code = [400, 413, 422, 502].includes(e.code) ? e.code : 500;
    if (code === 500) console.error(new Date().toISOString(), e);
    if (!res.headersSent) send(res, code, { error: code === 500 ? 'Błąd serwera' : e.message });
  });
}).listen(PORT, HOST, () => console.log(`ŁAPA nasłuchuje na ${HOST}:${PORT}`));
