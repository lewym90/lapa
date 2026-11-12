// Test serwera: powiadomienia push (atrapa usługi push odszyfrowuje jak przeglądarka), cisza nocna, wyciszenie, SSE, czyszczenie czatu.
import http from 'node:http'; import { spawn, execSync } from 'node:child_process'; import fs from 'node:fs'; import crypto from 'node:crypto';
const R = '/home/claude/lapa-git', D = '/tmp/srv2';
const hash = (p) => execSync('node ' + R + '/server/hash-password.mjs', { input: p }).toString().trim();
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const ck = (n, c) => { console.log(c ? 'OK  ' : 'FAIL', n); if (!c) fails++; };
const b64u = (b) => Buffer.from(b).toString('base64url');

// ---- atrapa usługi push ----
const got = []; let status = 201; let VPUB = '';
const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));
const subs = {}; // nazwa -> {ecdh, auth}
const mkSub = (name) => { const e = crypto.createECDH('prime256v1'); e.generateKeys(); const auth = crypto.randomBytes(16); subs[name] = { e, auth }; return { endpoint: `http://127.0.0.1:19101/p/${name}`, keys: { p256dh: b64u(e.getPublicKey()), auth: b64u(auth) } }; };
function decrypt(name, body) {
  const { e, auth } = subs[name]; const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const secret = e.computeSecret(asPub), ua = e.getPublicKey();
  const prk = hkdf(auth, secret, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32);
  const cek = hkdf(salt, prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hkdf(salt, prk, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let i = pt.length - 1; while (pt[i] === 0) i--; if (pt[i] !== 2) throw new Error('zły padding');
  return JSON.parse(pt.subarray(0, i).toString());
}
function jwtOk(auth) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(auth || ''); if (!m) return false; const [h, c, sig] = m[1].split('.');
  if (m[2] !== VPUB) return false;
  const raw = Buffer.from(VPUB, 'base64url'); const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(raw.subarray(1, 33)), y: b64u(raw.subarray(33)) }, format: 'jwk' });
  const claims = JSON.parse(Buffer.from(c, 'base64url')); if (!(claims.exp > Date.now() / 1000 && claims.exp < Date.now() / 1000 + 86400) || !claims.sub || claims.aud !== 'http://127.0.0.1:19101') return false;
  return crypto.verify('sha256', Buffer.from(h + '.' + c), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
}
const fake = http.createServer((q, r) => { const ch = []; q.on('data', (c) => ch.push(c)); q.on('end', () => { const name = q.url.split('/').pop(); const body = Buffer.concat(ch); let msg = null, err = ''; try { msg = decrypt(name, body); } catch (e) { err = e.message; } got.push({ name, msg, err, jwt: jwtOk(q.headers.authorization), enc: q.headers['content-encoding'], urgency: q.headers.urgency, ttl: q.headers.ttl }); r.statusCode = status; r.end(); }); }).listen(19101);

async function boot(extra, port, keep = false) {
  if (!keep) { fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D); } fs.copyFileSync(R + '/server/lapa-server.mjs', D + '/lapa-server.mjs'); fs.copyFileSync(R + '/js/dogmerge.js', D + '/dogmerge.mjs');
  const env = { ...process.env, LAPA_TEST_FAST: '1', LAPA_TEST_PUSH_HOST: '127.0.0.1:19101', DB_FILE: D + '/data/lapa.db', PORT: String(port), SITE_SYNC_HOURS: '99', PASS_VOLUNTEER_HASH: hash('wolontariusz-haslo-1'), PASS_COORDINATOR_HASH: hash('koordynator-haslo-2'), ALLOWED_ORIGINS: 'http://127.0.0.1:8000', ...extra };
  const srv = spawn('node', ['--disable-warning=ExperimentalWarning', D + '/lapa-server.mjs'], { env, stdio: ['ignore', 'inherit', 'inherit'] });
  const B = 'http://127.0.0.1:' + port; for (let i = 0; i < 30; i++) { try { await fetch(B + '/health'); break; } catch { await sl(200); } }
  const tok = (await (await fetch(B + '/auth/login', { method: 'POST', body: JSON.stringify({ password: 'wolontariusz-haslo-1' }) })).json()).token;
  const H = { authorization: 'Bearer ' + tok, 'content-type': 'application/json' };
  const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
  const msg = (id, autor, o = {}) => post('/sync', { changes: [{ col: 'czat', id, data: { id, ts: Date.now(), autor, text: 'Kto zawiezie psa do weta jutro o 18?', kind: 'msg', ...o }, updated_at: o.updated_at || Date.now(), deleted: false, by: autor }] });
  return { srv, B, H, post, msg, VPUBget: async () => (await (await fetch(B + '/push/key', { headers: H })).json()).key };
}

// ===== A: zwykły tryb (bez ciszy nocnej) =====
let t = await boot({ QUIET_FROM: '30', QUIET_TO: '30' }, 18997); VPUB = await t.VPUBget();
ck('A0: klucz VAPID 65 B', Buffer.from(VPUB, 'base64url').length === 65 && Buffer.from(VPUB, 'base64url')[0] === 4);
const unauth = await fetch(t.B + '/push/key'); ck('A0b: /push/key chronione hasłem', unauth.status === 401);
const sA = mkSub('Ania'), sB = mkSub('Basia'), sC = mkSub('Celina');
ck('A1: zły adres odrzucony', (await t.post('/push/subscribe', { sub: { endpoint: 'https://evil.example.com/x', keys: { p256dh: 'a', auth: 'b' } }, name: 'X' })).s === 422);
ck('A1b: adres wewnętrzny odrzucony', (await t.post('/push/subscribe', { sub: { endpoint: 'http://127.0.0.1:8797/x', keys: { p256dh: 'a', auth: 'b' } }, name: 'X' })).s === 422);
for (const [n, s] of [['Ania', sA], ['Basia', sB], ['Celina', sC]]) ck('A2: subskrypcja ' + n, (await t.post('/push/subscribe', { sub: s, name: n })).s === 200);
// SSE
const ctl = new AbortController(); const sse = []; const sr = await fetch(t.B + '/events', { headers: { authorization: t.H.authorization }, signal: ctl.signal });
ck('A3: SSE content-type', /text\/event-stream/.test(sr.headers.get('content-type'))); (async () => { const rd = sr.body.getReader(); try { for (;;) { const { value, done } = await rd.read(); if (done) break; sse.push(Buffer.from(value).toString()); } } catch { /* */ } })();
await sl(300); const n0 = sse.join('').split('data:').length;
let r = await t.msg('m1', 'Basia'); await sl(600);
ck('A4: wiadomość przyjęta', r.j.results[0].status === 'ok'); ck('A4b: SSE powiadomił o zmianie', sse.join('').split('data:').length > n0);
const forAnia = got.filter((g) => g.name === 'Ania'), forB = got.filter((g) => g.name === 'Basia');
ck('A5: Ania dostała push, Basia (autor) nie', forAnia.length === 1 && forB.length === 0);
const g = forAnia[0] || {}; ck('A5b: treść odszyfrowana', g.msg && g.msg.t === 'Basia' && g.msg.b.includes('Kto zawiezie psa') && g.msg.url === '#/czat' && g.msg.badge === 1, JSON.stringify(g.msg));
ck('A5c: podpis VAPID i nagłówki', g.jwt === true && g.enc === 'aes128gcm' && g.ttl === '86400', JSON.stringify({ j: g.jwt, e: g.enc, err: g.err }));
ck('A5d: Celina też dostała', got.filter((x) => x.name === 'Celina').length === 1);
got.length = 0; await t.msg('m2', 'Basia', { text: 'Druga wiadomość' }); await sl(500);
ck('A6: licznik odznaki rośnie (2)', got.find((x) => x.name === 'Ania')?.msg?.badge === 2);
await t.post('/push/read', { endpoint: sA.endpoint }); got.length = 0; await t.msg('m3', 'Celina', { text: 'Trzecia' }); await sl(500);
ck('A7: po /push/read licznik od 1', got.find((x) => x.name === 'Ania')?.msg?.badge === 1);
// wyciszenie: Ania wyciszona, ale wzmianka przebija
await t.post('/push/prefs', { endpoint: sA.endpoint, name: 'Ania', mute: true, quiet: true }); got.length = 0;
await t.msg('m4', 'Basia', { text: 'zwykła' }); await sl(400); ck('A8: wyciszona Ania nie dostaje', !got.some((x) => x.name === 'Ania'));
await t.msg('m5', 'Basia', { text: '@Ania zawieziesz?', wzm: ['ania'] }); await sl(400); const w = got.find((x) => x.name === 'Ania'); ck('A8b: wzmianka przebija wyciszenie', w && w.msg.b.startsWith('@ ') && w.urgency === 'high');
// edycja nie wysyła ponownie; usunięcie też nie
got.length = 0; await t.post('/sync', { changes: [{ col: 'czat', id: 'm4', data: { id: 'm4', ts: Date.now(), autor: 'Basia', text: 'zmieniona' }, updated_at: Date.now() + 10, deleted: false, by: 'Basia' }] }); await sl(300);
ck('A9: edycja nie powiela powiadomienia', got.length === 0);
// test + 410
let tr = await t.post('/push/test', { endpoint: sB.endpoint }); await sl(200); ck('A10: /push/test dociera', tr.j.ok === true && got.some((x) => x.name === 'Basia' && x.msg.t === 'ŁAPA'));
status = 410; await t.msg('m6', 'Ania', { text: 'do Basi' }); await sl(500); status = 201;
const left = await t.post('/push/prefs', { endpoint: sB.endpoint, name: 'Basia' }); ck('A11: 410 usuwa subskrypcję', left.s === 404);
ck('A12: nieznany endpoint → 404', (await t.post('/push/read', { endpoint: 'https://fcm.googleapis.com/x/nieistnieje' })).s === 404);
ctl.abort(); t.srv.kill(); await sl(500);

// ===== B: cisza nocna zawsze włączona =====
got.length = 0; t = await boot({ QUIET_FROM: '0', QUIET_TO: '24' }, 18996); VPUB = await t.VPUBget(); const sD = mkSub('Ania'); const sE = mkSub('Dorota');
await t.post('/push/subscribe', { sub: sD, name: 'Ania', quiet: true }); await t.post('/push/subscribe', { sub: sE, name: 'Dorota', quiet: false });
await t.msg('q1', 'Basia', { text: 'noc zwykła' }); await sl(500);
ck('B1: w ciszy nocnej nie dostaje włączona cisza', !got.some((x) => x.name === 'Ania')); ck('B1b: ale ten bez ciszy dostaje', got.some((x) => x.name === 'Dorota'));
got.length = 0; await t.msg('q2', 'Basia', { text: 'pilne!', pilne: true }); await sl(500); ck('B2: pilne przebija ciszę', got.some((x) => x.name === 'Ania' && x.msg.b.startsWith('❗')));
got.length = 0; await t.msg('q3', 'Basia', { text: 'prośba', kind: 'prosba' }); await sl(500); ck('B3: prośba nocą bez pilnego: cisza', !got.some((x) => x.name === 'Ania') && got.some((x) => x.msg?.b.startsWith('🙋')));
await t.msg('q4', 'Basia', { text: 'x' }); await sl(300);
got.length = 0; await t.msg('q5', 'Basia', { text: 'po ciszy', pilne: true }); await sl(500); ck('B4: odznaka liczy też pominięte w ciszy', (got.find((x) => x.name === 'Ania')?.msg?.badge || 0) >= 4);
t.srv.kill(); await sl(500);

// ===== C: czyszczenie starych wiadomości i zdjęć =====
t = await boot({ CHAT_DAYS: '1' }, 18995);
fs.mkdirSync(D + '/data/photos', { recursive: true }); fs.writeFileSync(D + '/data/photos/stare1.jpg', 'x');
await t.post('/sync', { changes: [{ col: 'czat', id: 'old1', data: { id: 'old1', ts: Date.now() - 5 * 864e5, autor: 'Basia', text: 'stara', foto: 'stare1' }, updated_at: Date.now() - 5 * 864e5, deleted: false, by: 'Basia' }, { col: 'czat', id: 'new1', data: { id: 'new1', ts: Date.now(), autor: 'Basia', text: 'nowa' }, updated_at: Date.now(), deleted: false, by: 'Basia' }, { col: 'psy', id: 'p1', data: { imie: 'Stary pies' }, updated_at: Date.now() - 9 * 864e5, deleted: false, by: 'x' }] });
t.srv.kill(); await sl(400);
t = await boot({ CHAT_DAYS: '1' }, 18995, true); await sl(900);
const all = (await (await fetch(t.B + '/sync?since=0', { headers: t.H })).json()).changes;
ck('C1: stara wiadomość usunięta', !all.some((c) => c.id === 'old1')); ck('C2: nowa została', all.some((c) => c.id === 'new1'));
ck('C3: inne dane (psy) nietknięte', all.some((c) => c.col === 'psy' && c.id === 'p1')); ck('C4: zdjęcie starej wiadomości usunięte', !fs.existsSync(D + '/data/photos/stare1.jpg'));
t.srv.kill(); fake.close(); console.log(fails ? 'BŁĘDÓW: ' + fails : 'WSZYSTKO OK'); process.exit(fails ? 1 : 0);
