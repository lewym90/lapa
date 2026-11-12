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
CREATE TABLE IF NOT EXISTS push(
  endpoint TEXT PRIMARY KEY, sub TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', quiet INTEGER NOT NULL DEFAULT 1, mute INTEGER NOT NULL DEFAULT 0,
  badge INTEGER NOT NULL DEFAULT 0, created INTEGER, last_ok INTEGER DEFAULT 0, fails INTEGER NOT NULL DEFAULT 0);
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

const PHOTO_DIR = path.join(path.dirname(DB_FILE), 'photos');
fs.mkdirSync(PHOTO_DIR, { recursive: true });
// ---------- Czat: powiadomienia web push (bez zależności, node:crypto) i natychmiastowa synchronizacja (SSE) ----------
const CHAT_DAYS = +(process.env.CHAT_DAYS || 30);
const VAPID_SUB = process.env.VAPID_SUB || 'https://188-68-247-201.sslip.io/lapa';
const TEST_PUSH = process.env.LAPA_TEST_PUSH_HOST || ''; // tylko testy: host:port atrapy usługi push (http)
const b64u = (b) => Buffer.from(b).toString('base64url');
const VAPID_FILE = path.join(path.dirname(DB_FILE), 'vapid.json');
function loadVapid() {
  try { const j = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8')); if (j.priv && j.pub) return j; } catch { /* nowy */ }
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const pub = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]));
  const j = { priv: privateKey.export({ format: 'jwk' }), pub };
  fs.writeFileSync(VAPID_FILE, JSON.stringify(j), { mode: 0o600 });
  return j;
}
const VAPID = loadVapid();
const VAPID_KEY = crypto.createPrivateKey({ key: VAPID.priv, format: 'jwk' });
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.api\.microsoft\.com$/];
function pushUrlOk(ep) {
  if (typeof ep !== 'string' || ep.length > 700) return false;
  let u; try { u = new URL(ep); } catch { return false; }
  if (TEST_PUSH && u.host === TEST_PUSH) return true;
  return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((r) => r.test(u.hostname));
}
const vapidJwt = (aud) => {
  const h = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' })), c = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUB }));
  return `${h}.${c}.${b64u(crypto.sign('sha256', Buffer.from(`${h}.${c}`), { key: VAPID_KEY, dsaEncoding: 'ieee-p1363' }))}`;
};
const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));
function encryptPush(sub, payload) { // RFC 8291 (aes128gcm)
  const ua = Buffer.from(sub.keys.p256dh, 'base64url'), auth = Buffer.from(sub.keys.auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(), secret = ecdh.computeSecret(ua), salt = crypto.randomBytes(16);
  const prk = hkdf(auth, secret, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32);
  const cek = hkdf(salt, prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hkdf(salt, prk, Buffer.from('Content-Encoding: nonce\0'), 12);
  const ci = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([ci.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), ci.final(), ci.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}
const pushDel = db.prepare('DELETE FROM push WHERE endpoint=?');
async function sendPush(row, msg, urgent = false) {
  let sub; try { sub = JSON.parse(row.sub); } catch { pushDel.run(row.endpoint); return false; }
  const u = new URL(row.endpoint);
  try {
    const r = await fetch(row.endpoint, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '86400', urgency: urgent ? 'high' : 'normal', authorization: `vapid t=${vapidJwt(u.origin)}, k=${VAPID.pub}` },
      body: encryptPush(sub, JSON.stringify(msg))
    });
    if (r.status === 404 || r.status === 410) { pushDel.run(row.endpoint); return false; }
    if (!r.ok) { db.prepare('UPDATE push SET fails=fails+1 WHERE endpoint=?').run(row.endpoint); if (row.fails >= 8) pushDel.run(row.endpoint); console.error('Push', r.status, u.hostname); return false; }
    db.prepare('UPDATE push SET fails=0, last_ok=? WHERE endpoint=?').run(Date.now(), row.endpoint);
    return true;
  } catch (e) { db.prepare('UPDATE push SET fails=fails+1 WHERE endpoint=?').run(row.endpoint); console.error('Push:', e.message); return false; }
}
const QUIET = { from: +(process.env.QUIET_FROM || 22), to: +(process.env.QUIET_TO || 7) };
const warsawHour = () => +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', hourCycle: 'h23' }).format(new Date());
const isQuiet = () => { const h = warsawHour(); return QUIET.from > QUIET.to ? h >= QUIET.from || h < QUIET.to : h >= QUIET.from && h < QUIET.to; };
const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
async function notifyChat(d) { // d: dane nowej wiadomości
  const rows = db.prepare('SELECT * FROM push').all();
  const preview = String(d.text || '').replace(/\s+/g, ' ').trim().slice(0, 110) || (d.foto ? '📷 Zdjęcie' : d.ref?.nazwa ? String(d.ref.nazwa).slice(0, 80) : 'Nowa wiadomość');
  const body = (d.kind === 'prosba' ? '🙋 Prośba o pomoc: ' : d.pilne ? '❗ ' : '') + preview;
  const mentioned = (n) => Array.isArray(d.wzm) && d.wzm.some((x) => sameName(x, n));
  for (const r of rows) {
    if (sameName(r.name, d.autor)) continue;
    db.prepare('UPDATE push SET badge=badge+1 WHERE endpoint=?').run(r.endpoint);
    const urgent = !!d.pilne || mentioned(r.name);
    if (r.mute && !mentioned(r.name)) continue;
    if (r.quiet && isQuiet() && !urgent) continue;
    const badge = db.prepare('SELECT badge FROM push WHERE endpoint=?').get(r.endpoint)?.badge || 1;
    sendPush(r, { t: String(d.autor || 'Czat').slice(0, 40), b: mentioned(r.name) ? '@ ' + body : body, url: '#/czat', tag: 'czat', badge }, urgent);
  }
}
const sseClients = new Set();
function sseBroadcast() { const m = `data: {"t":${Date.now()}}\n\n`; for (const c of sseClients) { try { c.write(m); } catch { sseClients.delete(c); } } }
setInterval(() => { for (const c of sseClients) { try { c.write(': ping\n\n'); } catch { sseClients.delete(c); } } }, 20e3).unref();
function pruneChat() { // wiadomości czatu i ich zdjęcia: tylko CHAT_DAYS dni
  const lim = Date.now() - CHAT_DAYS * 86400e3;
  try {
    for (const r of db.prepare("SELECT col,id,data FROM records WHERE col IN ('czat','czat_re') AND updated_at < ?").all(lim)) {
      try { const f = JSON.parse(r.data).foto; if (f && /^[A-Za-z0-9_-]{1,64}$/.test(f)) fs.rmSync(path.join(PHOTO_DIR, f + '.jpg'), { force: true }); } catch { /* */ }
    }
    db.prepare("DELETE FROM records WHERE col IN ('czat','czat_re') AND updated_at < ?").run(lim);
    db.prepare("DELETE FROM history WHERE col IN ('czat','czat_re') AND replaced_at < ?").run(lim);
  } catch (e) { console.error('Czyszczenie czatu:', e.message); }
}
setInterval(pruneChat, 6 * 3600e3).unref(); setTimeout(pruneChat, process.env.LAPA_TEST_FAST ? 300 : 20e3).unref();

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
const clientIp = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',').pop().trim();


// ---------- import ze strony schroniska (tylko ta jedna domena, tylko adresy psów) ----------
const SITE = process.env.LAPA_TEST_SITE || 'https://www.schronisko-nowodwor.com.pl'; // zmienna tylko do testów
const SITE_HOSTS = new Set(['www.schronisko-nowodwor.com.pl', 'schronisko-nowodwor.com.pl', new URL(SITE).hostname]);
const SITE_PROTO = new URL(SITE).protocol;
const DOG_PATH = /^\/(psy-do-adopcji|do-adopcji-pilne|adoptowane)\/([^/?#]+)\/(\d+)\/?$/;
const UA = { 'user-agent': 'LAPA-Nowodwor/1.0 (aplikacja wolontariuszy schroniska)', accept: 'text/html,application/xhtml+xml' };
const htmlCache = new Map();
const FAST = !!process.env.LAPA_TEST_FAST; // tylko testy
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? 0 : ms));
async function fetchHtml(urlStr, fresh = false) {
  if (fresh) { // automatyczne sprawdzanie: bez pamięci podręcznej, z ponowieniami przy chwilowych błędach
    let last; for (let i = 0; i < 3; i++) { try { return await fetchHtml1(urlStr, true); } catch (e) { last = e; if (e.status404) throw e; await sleep(1500 * (i + 1)); } }
    throw last;
  }
  return fetchHtml1(urlStr, false);
}
async function fetchHtml1(urlStr, fresh) {
  const hit = !fresh && htmlCache.get(urlStr); if (hit && Date.now() - hit.t < 10 * 60e3) return hit.v;
  let u = new URL(urlStr);
  for (let i = 0; i < 3; i++) {
    if (u.protocol !== SITE_PROTO || !SITE_HOSTS.has(u.hostname)) throw Object.assign(new Error('Niedozwolony adres'), { code: 422 });
    let res; try { res = await fetch(u, { headers: UA, redirect: 'manual', signal: AbortSignal.timeout(12000) }); } catch { throw Object.assign(new Error('Nie udało się połączyć ze stroną schroniska'), { code: 502 }); }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { u = new URL(res.headers.get('location'), u); continue; }
    if (!res.ok) throw Object.assign(new Error(res.status === 404 ? 'Nie ma takiej strony na stronie schroniska' : 'Strona schroniska odpowiedziała błędem ' + res.status), { code: 502, status404: res.status === 404 });
    const t = await res.text();
    if (t.length > 2_500_000) throw Object.assign(new Error('Strona jest zbyt duża'), { code: 502 });
    if (!fresh) htmlCache.set(urlStr, { t: Date.now(), v: t }); if (htmlCache.size > 200) htmlCache.delete(htmlCache.keys().next().value);
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
const LABELS = { 'Płeć': 'plec', 'Wiek': 'wiek', 'Wielkość': 'wielkosc', 'Waga': 'waga', 'Wysokość w kłębie': 'wzrost', 'Wzrost': 'wzrost', 'Sierść': 'siersc', 'Status': 'status_txt' };
const MIESIACE = { stycze: 1, luty: 2, marzec: 3, kwiecie: 4, maj: 5, czerwiec: 6, lipiec: 7, sierpie: 8, wrzesie: 9, pa: 10, listopad: 11, grudzie: 12 };
const strip = (x) => decode(String(x).replace(/<[^>]+>/g, ' ')).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
// Struktura strony (Joomla TZ Portfolio): h2.TzArticleTitle, lista pól .tz_extrafield-item, hasło w .intro, opis w .text, galeria a[data-fancybox].
function parseDog(h, u) {
  const m = DOG_PATH.exec(u.pathname), slug = decodeURIComponent(m[2]), id = m[3];
  let status = m[1] === 'do-adopcji-pilne' ? 'pilne' : m[1] === 'adoptowane' ? 'adoptowany' : 'do_adopcji';
  const title = (/<h2[^>]*class="[^"]*TzArticleTitle[^"]*"[^>]*>([\s\S]*?)<\/h2>/i.exec(h) || [])[1];
  const name = title && strip(title) ? strip(title) : titleCase(slug);
  const fields = {};
  for (const chunk of h.split(/<li[^>]*tz_extrafield-item[^>]*>/i).slice(1)) {
    const lab = strip((/tz_extrafield-label[^>]*>([\s\S]*?)<\/div>/i.exec(chunk) || [])[1] || '');
    const valHtml = (/tz_extrafield-value[^>]*>([\s\S]*?)<\/div>\s*<\/li>/i.exec(chunk) || [])[1] || '';
    const parts = [...valHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => strip(x[1])).filter(Boolean);
    const val = (parts.length ? parts.join(', ') : strip(valHtml)).slice(0, 80);
    if (LABELS[lab] && val && !fields[LABELS[lab]]) fields[LABELS[lab]] = val;
  }
  const st = (fields.status_txt || '').toLowerCase(); delete fields.status_txt;
  if (/pilny|pilne/.test(st)) status = 'pilne'; else if (/adoptowan/.test(st)) status = 'adoptowany'; else if (/w trakcie|zarezerw/.test(st)) status = 'w_trakcie'; else if (/do adopcji/.test(st)) status = status === 'pilne' ? 'pilne' : 'do_adopcji';
  const body = h.slice(Math.max(0, h.search(/TzArticleTitle/)));
  const intro = (/class="[^"]*\bintro\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(body) || [])[1];
  const haslo = intro ? strip(intro).replace(new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[-–—:]\\s*', 'i'), '') : '';
  // opis: akapity z bloku .text przed galerią/wideo i przed sekcją kontaktu/zasad
  const tb = /class="[^"]*\bcol-[^"]*\btext\b[^"]*"[^>]*>([\s\S]*?)(?:<!--\s*JoomlaWorks|<div class="video-responsive"|$)/i.exec(body);
  const STOP = /(kontakt w sprawie adopcji|zasady adopcji|przed adopcją obowiązuje|numer konta)/i;
  const desc = [];
  if (tb) for (const pm of tb[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) { const t = strip(pm[1]); if (!t || t.length < 3) continue; if (STOP.test(t)) break; desc.push(t); if (desc.join('\n').length > 4000) break; }
  const abs = (x) => { try { return new URL(decode(x), u).href; } catch { return ''; } };
  const imgs = [];
  const og = /<meta[^>]+(?:property=["']og:image["']|name=["']twitter:image["'])[^>]+content=["']([^"']+)/i.exec(h); if (og) { const a = abs(og[1]); if (a && SITE_HOSTS.has(new URL(a).hostname)) imgs.push(a); }
  for (const g of h.matchAll(/<a[^>]+data-fancybox[^>]+href=["']([^"']+\.(?:jpe?g|png|webp))["']/gi)) { const a = abs(g[1]); if (a && SITE_HOSTS.has(new URL(a).hostname) && !imgs.includes(a)) imgs.push(a); }
  if (imgs.length < 2) for (const g of h.matchAll(/["'(]((?:https?:)?\/?[^"'\s()<>]*?_l\.jpe?g)/gi)) { const a = abs(g[1].startsWith('//') ? 'https:' + g[1] : g[1]); if (a && SITE_HOSTS.has(new URL(a).hostname) && !imgs.includes(a)) imgs.push(a); }
  const yt = /(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([\w-]{11})/.exec(h);
  const dm = /(?:poniedziałek|wtorek|środa|czwartek|piątek|sobota|niedziela),\s*(\d{1,2})\s+([a-zżźćńółęąś]+)\s+(\d{4})/i.exec(strip(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')));
  let opublikowano = null; if (dm) { const k = Object.keys(MIESIACE).find((x) => norm(dm[2]).startsWith(norm(x))); if (k) opublikowano = Date.UTC(+dm[3], MIESIACE[k] - 1, +dm[1], 10); }
  return { url: u.origin + u.pathname.replace(/\/$/, ''), id, name, status, fields, haslo, opis: desc.join('\n\n'), zdjecia: imgs.slice(0, 24), film: yt ? 'https://www.youtube.com/watch?v=' + yt[1] : '', opublikowano,
    debug: { pol: Object.keys(fields), zdj: imgs.length, akapity: desc.length } };
}
async function dogLinks(fresh = false, info = {}) {
  const links = new Set();
  for (const cat of ['psy-do-adopcji', 'do-adopcji-pilne']) for (let start = 0; start < 9 * 60; start += 9) { // lista: 9 psów na stronę, kolejne przez ?start=
    let h; try { h = await fetchHtml(`${SITE}/${cat}${start ? '?start=' + start : ''}`, fresh); } catch (e) { if (start === 0 && fresh) throw e; if (!e.status404) info.partial = true; break; }
    const before = links.size, re = /href=["']((?:https?:\/\/(?:www\.)?schronisko-nowodwor\.com\.pl)?\/(?:psy-do-adopcji|do-adopcji-pilne)\/[^"'\/\s]+\/\d+)\/?["']/gi; let m;
    while ((m = re.exec(h))) links.add(new URL(m[1], SITE).href);
    if (links.size === before) break;
    await sleep(fresh ? 500 : 250);
  }
  return [...links].slice(0, 500);
}
// ===== Kopie zapasowe: baza co 30 minut (VACUUM INTO), zdjęcia kopiowane przyrostowo =====
const BACKUP_DIR = path.join(path.dirname(DB_FILE), 'backups');
fs.mkdirSync(BACKUP_DIR, { recursive: true });
let lastBackup = { t: 0, ok: null };
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
function runBackup() {
  try {
    const f = path.join(BACKUP_DIR, `lapa-${stamp(new Date())}.db`);
    if (!fs.existsSync(f)) db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
    const pc = path.join(BACKUP_DIR, 'photos'); fs.mkdirSync(pc, { recursive: true });
    for (const n of fs.readdirSync(PHOTO_DIR)) { const to = path.join(pc, n); if (!fs.existsSync(to)) fs.copyFileSync(path.join(PHOTO_DIR, n), to); }
    // retencja: wszystko z 48 godzin, potem po jednej kopii na dobę przez 60 dni
    const now = Date.now(), seenDay = new Set();
    for (const n of fs.readdirSync(BACKUP_DIR).filter((x) => /^lapa-\d{8}-\d{6}\.db$/.test(x)).sort().reverse()) {
      const m = /^lapa-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.db$/.exec(n), t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]), day = n.slice(5, 13);
      if (now - t < 48 * 3600e3) continue;
      if (now - t > 60 * 86400e3 || seenDay.has(day)) fs.unlinkSync(path.join(BACKUP_DIR, n)); else seenDay.add(day);
    }
    lastBackup = { t: Date.now(), ok: true };
  } catch (e) { lastBackup = { t: Date.now(), ok: false }; console.error('Kopia zapasowa nie powiodła się:', e.message); }
}

// ===== Automatyczne sprawdzanie strony schroniska (3 razy dziennie): nowe psy i zmiany opisów, zdjęć, statusu =====
let merge = null;
try { merge = await import('./dogmerge.mjs'); } catch { console.error('Brak pliku dogmerge.mjs: automatyczne sprawdzanie strony wyłączone (uruchom aktualizuj.sh).'); }
const STATUS_FILE = path.join(path.dirname(DB_FILE), 'site-status.json');
let siteSt = { t: 0, ok: null, running: false, nowych: 0, zmienionych: 0, razem: 0, blad: '', slot: '', nazwy: [] };
try { Object.assign(siteSt, JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')), { running: false }); } catch { /* pierwszy start */ }
const saveSiteSt = () => { try { fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...siteSt, running: false })); } catch { /* nie krytyczne */ } };
const warsaw = () => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value; return { day: `${g('year')}-${g('month')}-${g('day')}`, hour: +g('hour') % 24 };
};
const SYNC_HOURS = (process.env.SITE_SYNC_HOURS || '3,11,17').split(',').map(Number);
const cmpDog = (o) => JSON.stringify(o, (k, v) => (k === 'zaimportowano' || k === 'ts' ? undefined : v));
async function syncSite(reason = 'auto') {
  if (!merge) { siteSt = { ...siteSt, t: Date.now(), ok: false, blad: 'Serwer nie ma pliku dogmerge.mjs. Uruchom aktualizację serwera.' }; saveSiteSt(); return siteSt; }
  if (siteSt.running) return siteSt;
  siteSt.running = true;
  const res = { t: Date.now(), ok: true, running: false, nowych: 0, zmienionych: 0, razem: 0, blad: '', nazwy: [], pominietych: 0, nieudanych: 0 };
  try {
    runBackup(); // kopia bazy tuż przed zmianami
    const info = {}, links = await dogLinks(true, info);
    const getRow = db.prepare("SELECT * FROM records WHERE col='psy' AND id=?");
    const allDogs = db.prepare("SELECT id,data,deleted FROM records WHERE col='psy'").all().map((r) => ({ id: r.id, deleted: !!r.deleted, d: JSON.parse(r.data) }));
    const known = allDogs.filter((x) => !x.deleted && x.d.zrodlo_id).length;
    res.razem = links.length;
    if (links.length < 20 || (known >= 20 && links.length < known * (info.partial ? 0.85 : 0.6))) throw new Error(`Na liście strony znalazłem tylko ${links.length} psów (w aplikacji jest ${known}). Nie zmieniam nic, bo to wygląda na błąd strony albo zmianę jej układu.`);
    const hist = db.prepare('INSERT INTO history(col,id,data,updated_at,deleted,by,replaced_at) VALUES(?,?,?,?,?,?,?)');
    const put = db.prepare('INSERT OR REPLACE INTO records(col,id,data,updated_at,deleted,by) VALUES(?,?,?,?,?,?)');
    for (const link of links) {
      try {
        const u = new URL(link), h = await fetchHtml(u.origin + u.pathname, true), imp = parseDog(h, new URL(u.origin + u.pathname));
        const sensowny = imp.name && imp.id && (imp.opis || imp.zdjecia.length || Object.keys(imp.fields).length);
        if (!sensowny) { res.nieudanych++; continue; }
        let row = getRow.get('d' + imp.id), old = {};
        if (row) { if (row.deleted) { res.pominietych++; continue; } old = JSON.parse(row.data); }
        else { // pies dodany wcześniej ręcznie (jeszcze bez strony): łączymy po imieniu
          const same = allDogs.find((x) => !x.deleted && !x.d.zrodlo_id && (x.d.imie || '').trim().toLowerCase() === imp.name.trim().toLowerCase());
          if (same) { row = getRow.get(same.id); old = same.d; }
        }
        const dog = merge.dogFromImport(imp, old);
        if (!old.id) dog.auto_dodany = Date.now();
        if (old.id && cmpDog(dog) === cmpDog(old)) continue;
        const now = Date.now();
        if (row) hist.run(row.col, row.id, row.data, row.updated_at, row.deleted, row.by, now);
        put.run('psy', dog.id, JSON.stringify(dog), now, 0, 'strona');
        if (old.id) res.zmienionych++; else { res.nowych++; res.nazwy.push(dog.imie); }
      } catch (e) { res.nieudanych++; console.error('Sprawdzanie strony, pies', link, e.message); }
      await sleep(400);
    }
    if (!info.partial && res.nieudanych <= Math.max(3, links.length * 0.25)) { // pies, którego nie ma już na liście strony: znacznik „poza_strona” (alert „adoptowany?”), znika, gdy wróci
      const ids = new Set(links.map((l) => /\/(\d+)\/?$/.exec(l)?.[1]).filter(Boolean)), now = Date.now();
      for (const x of db.prepare("SELECT * FROM records WHERE col='psy' AND deleted=0").all()) {
        const d = JSON.parse(x.data); if (!d.zrodlo_id) continue;
        const gone = !ids.has(String(d.zrodlo_id)) && d.status !== 'adoptowany' && d.miejsce !== 'adoptowany';
        if (gone && !d.poza_strona) d.poza_strona = now; else if (!gone && d.poza_strona) delete d.poza_strona; else continue;
        hist.run(x.col, x.id, x.data, x.updated_at, x.deleted, x.by, now); put.run('psy', x.id, JSON.stringify(d), now, 0, 'strona');
      }
    }
    if (res.nieudanych > Math.max(3, links.length * 0.25)) { res.ok = false; res.blad = `Nie udało się odczytać ${res.nieudanych} z ${links.length} stron psów. Strona mogła zmienić układ.`; }
  } catch (e) { res.ok = false; res.blad = e.message; console.error('Sprawdzanie strony nie powiodło się:', e.message); }
  siteSt = { ...siteSt, ...res, slot: siteSt.slot, reason }; saveSiteSt(); return siteSt;
}
setInterval(() => {
  const w = warsaw(), slot = `${w.day}-${w.hour}`;
  if (SYNC_HOURS.includes(w.hour) && siteSt.slot !== slot && !siteSt.running) { siteSt.slot = slot; syncSite('auto').catch((e) => console.error(e)); }
}, 60e3).unref();
setTimeout(() => { if (Date.now() - (siteSt.t || 0) > 8 * 3600e3) syncSite('start').catch((e) => console.error(e)); }, 120e3).unref(); // po restarcie nadrabia zaległe sprawdzenie
setInterval(() => { try { db.prepare('DELETE FROM history WHERE replaced_at < ?').run(Date.now() - 365 * 86400e3); } catch (e) { console.error('Czyszczenie historii:', e.message); } }, 24 * 3600e3).unref(); // historia wersji rekordów: rok
setTimeout(runBackup, 5000).unref(); setInterval(runBackup, 30 * 60e3).unref();
function readRaw(req, max) {
  return new Promise((resolve, reject) => {
    let n = 0; const c = [];
    req.on('data', (b) => { n += b.length; if (n > max) { reject(Object.assign(new Error('Zdjęcie jest za duże'), { code: 413 })); req.destroy(); } else c.push(b); });
    req.on('end', () => resolve(Buffer.concat(c))); req.on('error', reject);
  });
}

function corsFor(req) {
  const origin = req.headers.origin;
  return origin && ORIGINS.includes(origin)
    ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'authorization,content-type,x-active', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-max-age': '600' } : {};
}
async function handle(req, res) {
  const cors = corsFor(req);
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const send2 = (c, o) => send(res, c, o, cors);
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '') || '/';

  if (p === '/health') return send2(200, { ok: true, backup: lastBackup, site: { t: siteSt.t, ok: siteSt.ok, running: siteSt.running, nowych: siteSt.nowych, zmienionych: siteSt.zmienionych, razem: siteSt.razem, blad: siteSt.blad, nazwy: siteSt.nazwy, enabled: !!merge } });

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
    const now = Date.now(), results = [], fresh = [];
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
        if (old && old.updated_at > ts && old.by !== 'strona') { results.push({ ...r, status: 'stale' }); continue; } // zmiana wolontariusza wygrywa z automatycznym zapisem ze strony (strona i tak wróci przy następnym sprawdzeniu)
        if (old) hist.run(old.col, old.id, old.data, old.updated_at, old.deleted, old.by, now);
        put.run(c.col, c.id, json, ts, c.deleted ? 1 : 0, String(c.by || '').slice(0, 60));
        if (c.col === 'czat' && !old && !c.deleted && now - ts < 2 * 86400e3 && c.data && typeof c.data === 'object') fresh.push(c.data);
        results.push({ ...r, status: 'ok' });
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    if (results.some((x) => x.status === 'ok')) sseBroadcast();
    for (const d of fresh) notifyChat(d).catch((e) => console.error('notifyChat:', e.message));
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

  // ----- Powiadomienia i natychmiastowa synchronizacja -----
  if (p === '/push/key' && req.method === 'GET') return send2(200, { key: VAPID.pub });
  if (p === '/events' && req.method === 'GET') {
    if (sseClients.size >= 200) return send2(503, { error: 'Za dużo połączeń' });
    res.writeHead(200, { ...cors, 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write(`retry: 3000\ndata: {"t":${Date.now()},"hello":1}\n\n`);
    sseClients.add(res); req.on('close', () => sseClients.delete(res));
    return;
  }
  if (p.startsWith('/push/') && req.method === 'POST') {
    const b = await readJson(req), name = String(b.name || '').trim().slice(0, 40);
    if (p === '/push/subscribe') {
      const sub = b.sub;
      if (!sub || !pushUrlOk(sub.endpoint) || !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string' || sub.keys.p256dh.length > 200 || sub.keys.auth.length > 100) return send2(422, { error: 'Nieprawidłowa subskrypcja' });
      if (db.prepare('SELECT COUNT(*) n FROM push').get().n >= 300 && !db.prepare('SELECT 1 FROM push WHERE endpoint=?').get(sub.endpoint)) return send2(429, { error: 'Za dużo urządzeń' });
      db.prepare('INSERT INTO push(endpoint,sub,name,quiet,mute,created) VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET sub=excluded.sub,name=excluded.name,quiet=excluded.quiet,mute=excluded.mute,fails=0')
        .run(sub.endpoint, JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }), name, b.quiet === false ? 0 : 1, b.mute ? 1 : 0, Date.now());
      return send2(200, { ok: true });
    }
    const ep = b.endpoint, row = pushUrlOk(ep) ? db.prepare('SELECT * FROM push WHERE endpoint=?').get(ep) : null;
    if (p === '/push/unsubscribe') { if (row) pushDel.run(ep); return send2(200, { ok: true }); }
    if (!row) return send2(404, { error: 'Nie ma takiego urządzenia', gone: true });
    if (p === '/push/prefs') { db.prepare('UPDATE push SET name=?, quiet=?, mute=? WHERE endpoint=?').run(name || row.name, b.quiet === false ? 0 : 1, b.mute ? 1 : 0, ep); return send2(200, { ok: true }); }
    if (p === '/push/read') { db.prepare('UPDATE push SET badge=0 WHERE endpoint=?').run(ep); return send2(200, { ok: true }); }
    if (p === '/push/test') { const ok = await sendPush(row, { t: 'ŁAPA', b: 'Powiadomienia działają. Dostaniesz je, gdy ktoś napisze na czacie.', url: '#/czat', tag: 'test', badge: 0 }, true); return send2(200, { ok }); }
  }

  // GET /import?url=...  — pobiera i odczytuje stronę jednego psa ze strony schroniska
  if (p === '/import' && req.method === 'GET') {
    let u; try { u = new URL(url.searchParams.get('url') || ''); } catch { return send2(422, { error: 'To nie jest poprawny adres' }); }
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (!SITE_HOSTS.has(u.hostname) || !DOG_PATH.test(u.pathname)) return send2(422, { error: 'To nie jest link do psa na stronie schronisko-nowodwor.com.pl' });
    const h = await fetchHtml(u.origin + u.pathname);
    return send2(200, parseDog(h, new URL(u.origin + u.pathname)));
  }
  if (p === '/site/sync' && req.method === 'POST') { if (!siteSt.running && Date.now() - (siteSt.t || 0) > (FAST ? 0 : 20e3)) syncSite('reczne').catch((e) => console.error(e)); return send2(200, { ok: true, started: true }); }
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
    if (!res.headersSent) send(res, code, { error: code === 500 ? 'Błąd serwera' : e.message }, corsFor(req));
  });
}).listen(PORT, HOST, () => console.log(`ŁAPA nasłuchuje na ${HOST}:${PORT}`));
