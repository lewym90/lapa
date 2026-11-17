// Test serwera: rola administratora (logowanie, odblokowanie, brak wygasania, kolekcja „oznaczenia” tylko dla administratora,
// bez podpisu autora) oraz kasowanie numerów telefonu / Messengera z Bramy po KONTAKT_DAYS dniach.
import { spawn, execSync } from 'node:child_process'; import fs from 'node:fs';
const R = new URL('..', import.meta.url).pathname.replace(/\/$/, ''), D = '/tmp/srv3', PORT = 18994, API = 'http://127.0.0.1:' + PORT;
const hash = (p) => execSync('node ' + R + '/server/hash-password.mjs', { input: p }).toString().trim();
const sl = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const ck = (n, c, info = '') => { console.log(c ? 'OK  ' : 'FAIL', n, c ? '' : info); if (!c) fails++; };
fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D);
fs.copyFileSync(R + '/server/lapa-server.mjs', D + '/lapa-server.mjs'); fs.copyFileSync(R + '/js/dogmerge.js', D + '/dogmerge.mjs');
const H = { PASS_VOLUNTEER_HASH: hash('wolontariusz-haslo-1'), PASS_COORDINATOR_HASH: hash('koordynator-haslo-2'), PASS_ADMIN_HASH: hash('administrator-haslo-3') };
let srv;
const start = async (extra = {}) => {
  srv = spawn('node', ['--disable-warning=ExperimentalWarning', D + '/lapa-server.mjs'], { env: { ...process.env, ...H, DB_FILE: D + '/data/lapa.db', PORT: String(PORT), SITE_SYNC_HOURS: '99', LAPA_TEST_FAST: '1', LAPA_TEST_SITE: 'http://127.0.0.1:1', ...extra }, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 50; i++) { try { await fetch(API + '/health'); return; } catch { await sl(100); } }
};
const stop = async () => { srv.kill(); await sl(300); };
const call = async (path, { method = 'GET', body, tok } = {}) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* */ } return { s: r.status, j };
};
const login = async (password) => (await call('/auth/login', { method: 'POST', body: { password } })).j;
const push = (tok, changes) => call('/sync', { method: 'POST', tok, body: { changes } });
const pull = async (tok) => (await call('/sync?since=0&private=0', { tok })).j.changes;

try {
  // VOL_TTL i COORD_TTL krótkie, żeby sprawdzić, że administrator nie wygasa
  await start({ VOL_TTL_MS: '1500', COORD_TTL_MS: '1500' });
  const a = await login('administrator-haslo-3'), w = await login('wolontariusz-haslo-1');
  ck('logowanie administratora: admin (ma też dawne uprawnienia koordynatora)', a.admin === true && a.coordinator === true, JSON.stringify(a));
  ck('hasło koordynatora już nie działa (1.16)', (await call('/auth/login', { method: 'POST', body: { password: 'koordynator-haslo-2' } })).s === 401);
  ck('logowanie wolontariusza', w.admin === false && w.coordinator === false);
  ck('status administratora', (await call('/auth/status', { tok: a.token })).j.admin === true);
  ck('administrator widzi dane osobowe', (await call('/sync?since=0&private=1', { tok: a.token })).s === 200);

  // oznaczenia: tylko administrator, bez podpisu autora
  const zn = { col: 'oznaczenia', id: 'd1', data: { wybrani: { on: true, powody: ['silny'] }, opis: 'dla aktywnych' }, updated_at: Date.now(), deleted: false, by: 'Ania' };
  ck('wolontariusz nie zapisze oznaczenia', (await push(w.token, [zn])).j.results[0].status === 'forbidden');
  ck('administrator zapisze oznaczenie', (await push(a.token, [{ ...zn, by: 'Tajna' }])).j.results[0].status === 'ok');
  ck('wolontariusz nie widzi oznaczeń (1.16: tylko Brama, tylko administrator)', !(await pull(w.token)).some((c) => c.col === 'oznaczenia'));
  const got = (await pull(a.token)).find((c) => c.col === 'oznaczenia');
  ck('administrator widzi oznaczenie', got && got.data.opis === 'dla aktywnych');
  ck('bez podpisu autora', got && got.by === '', got && got.by);
  ck('usunięcie przez wolontariusza zablokowane', (await push(w.token, [{ ...zn, deleted: true, updated_at: Date.now() + 1 }])).j.results[0].status === 'forbidden');
  ck('wolontariusz nie zapisze psa (1.16)', (await push(w.token, [{ col: 'psy', id: 'd1', data: { imie: 'Saba', boks: '7' }, updated_at: Date.now(), deleted: false, by: 'Ania' }])).j.results[0].status === 'forbidden');
  ck('administrator zapisze psa', (await push(a.token, [{ col: 'psy', id: 'd1', data: { imie: 'Saba', boks: '7' }, updated_at: Date.now(), deleted: false, by: 'Ania' }])).j.results[0].status === 'ok');

  // wygasanie: wolontariusz i koordynator po czasie bez aktywności, administrator nie
  await sl(2200);
  ck('wolontariusz wygasł (krótki czas testowy)', (await call('/auth/status', { tok: w.token })).s === 401);
  const st = await call('/auth/status', { tok: a.token });
  ck('administrator dalej zalogowany', st.s === 200 && st.j.admin === true);

  // odblokowanie hasłem administratora w zwykłej sesji; „Zablokuj” zdejmuje administratora
  const w2 = await login('wolontariusz-haslo-1');
  const u = await call('/auth/unlock', { method: 'POST', tok: w2.token, body: { password: 'administrator-haslo-3' } });
  ck('odblokowanie hasłem administratora', u.s === 200 && u.j.admin === true);
  ck('po odblokowaniu zapisuje oznaczenia', (await push(w2.token, [{ ...zn, updated_at: Date.now() + 5 }])).j.results[0].status === 'ok');
  await call('/auth/lock', { method: 'POST', tok: w2.token });
  ck('po zablokowaniu już nie', (await push(w2.token, [{ ...zn, updated_at: Date.now() + 10 }])).j.results[0].status === 'forbidden');
  ck('złe hasło przy odblokowaniu', (await call('/auth/unlock', { method: 'POST', tok: w2.token, body: { password: 'zle-haslo-xx' } })).s === 401);

  // kontakty z Bramy: stary znika (rekord i historia), nowy zostaje, imię zostaje
  const old = Date.now() - 31 * 864e5, now = Date.now();
  const sp = (id, startT, upd, kontakt) => ({ col: 'spacery', id, data: { pies_id: 'd1', tryb: 'brama', start: startT, end: startT + 3e6, osoba: 'Kasia', kontakt }, updated_at: upd, deleted: false, by: 'Ania' });
  await push(a.token, [sp('w_old', old, now - 5000, '600 100 200'), sp('w_new', now - 3600e3, now - 5000, '700 200 300')]);
  await push(a.token, [{ ...sp('w_old', old, now - 4000, '600 100 200'), data: { ...sp('w_old', old, 0, '600 100 200').data, notatka: 'druga wersja' } }]); // historia z numerem
  await stop(); await start(); await sl(900); // czyszczenie przy starcie
  const ch = await pull(a.token), o = ch.find((c) => c.id === 'w_old'), n = ch.find((c) => c.id === 'w_new');
  ck('stary numer usunięty', o && o.data.kontakt === undefined, JSON.stringify(o?.data));
  ck('imię zostaje', o && o.data.osoba === 'Kasia' && o.data.notatka === 'druga wersja');
  ck('nowy numer zostaje', n && n.data.kontakt === '700 200 300');
  const hist = (await call('/history?col=spacery&id=w_old', { tok: a.token })).j.versions;
  ck('historia bez numeru', hist.length >= 1 && hist.every((v) => v.data.kontakt === undefined), JSON.stringify(hist.map((v) => v.data)));
  ck('administrator zalogowany po restarcie', (await call('/auth/status', { tok: a.token })).j.admin === true);
} catch (e) { console.error(e); fails++; }
await stop();

// bez hasła administratora w konfiguracji: rola wyłączona, nikt nie zapisze oznaczeń
fs.rmSync(D + '/data', { recursive: true, force: true });
delete H.PASS_ADMIN_HASH; await start();
const k2 = await login('wolontariusz-haslo-1');
ck('bez hasła admina: wolontariusz działa', k2.coordinator === false && k2.admin === false);
ck('bez hasła admina: odblokowanie niemożliwe', (await call('/auth/unlock', { method: 'POST', tok: k2.token, body: { password: 'administrator-haslo-3' } })).s === 401);
ck('bez hasła admina: oznaczenia zablokowane', (await push(k2.token, [{ col: 'oznaczenia', id: 'x', data: {}, updated_at: Date.now(), deleted: false, by: '' }])).j.results[0].status === 'forbidden');
ck('bez hasła admina: puste hasło nie loguje', (await call('/auth/login', { method: 'POST', body: { password: '' } })).s === 400);
await stop();
console.log(fails ? `BŁĘDY: ${fails}` : 'WSZYSTKO OK'); process.exit(fails ? 1 : 0);
