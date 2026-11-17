// Test serwera 1.16: role wolontariusz / administrator.
// Wolontariusz: tylko odczyt dozwolonych danych (bez czipa, opiekuna DT, telefonów z Bramy), zapis wyłącznie własnych zgłoszeń.
// Administrator: wszystko. Hasło koordynatora nie działa. Telefony zgłoszeń znikają po TEL_DAYS.
import { spawn, execSync } from 'node:child_process'; import fs from 'node:fs';
const R = new URL('..', import.meta.url).pathname.replace(/\/$/, ''), D = '/tmp/srv4', PORT = 18993, API = 'http://127.0.0.1:' + PORT;
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
const call = async (path, { method = 'GET', body, tok, dev, raw } = {}) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': raw ? 'image/jpeg' : 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...(dev ? { 'x-lapa-dev': dev } : {}) }, body: raw || (body ? JSON.stringify(body) : undefined) });
  let j = null; try { j = await r.json(); } catch { /* */ } return { s: r.status, j };
};
const login = async (password) => (await call('/auth/login', { method: 'POST', body: { password } }));
const ch = (col, id, data, extra = {}) => ({ col, id, data, updated_at: Date.now(), deleted: false, by: 'X', ...extra });
const push = async (tok, changes, dev) => (await call('/sync', { method: 'POST', tok, dev, body: { changes } })).j.results.map((x) => x.status);
const pull = async (tok, priv = 0) => (await call('/sync?since=0&private=' + priv, { tok })).j;
const DEV1 = 'telefon-wolontariusza-1-aaaa', DEV2 = 'telefon-wolontariusza-2-bbbb';

try {
  await start();
  const a = (await login('administrator-haslo-3')).j, w = (await login('wolontariusz-haslo-1')).j;
  ck('hasło koordynatora nie działa', (await login('koordynator-haslo-2')).s === 401);
  ck('administrator: admin', a.admin === true);
  ck('wolontariusz: bez uprawnień', w.admin === false && w.coordinator === false);
  ck('wolontariusz: odblokowanie hasłem koordynatora nie działa', (await call('/auth/unlock', { method: 'POST', tok: w.token, body: { password: 'koordynator-haslo-2' } })).s === 401);

  // dane od administratora
  const now = Date.now();
  ck('administrator zapisuje', (await push(a.token, [
    ch('psy', 'd1', { imie: 'Saba', chip: '616093900000001', opiekun: 'Jan Kowalski', boks: '7', opis: 'Opis', ocena: { psy: 'nie' }, kanaly: { fb: 1 }, karta_gotowa: 1, nowy: true, zdjecia: ['x'] }),
    ch('spacery', 'w1', { pies_id: 'd1', start: now - 6e4, osoba: 'Kasia', kontakt: '600 100 200' }),
    ch('czat', 'c1', { text: 'tajne' }), ch('zdrowie', 'z1', { pies_id: 'd1' }), ch('obserwacje', 'o1', { pies_id: 'd1' }),
    ch('oznaczenia', 'd1', { opis: 'wycofany' }), ch('potrzeby', 'n1', { nazwa: 'Karma', potrzeba: 10, zapewniono: 0 }), ch('transporty', 'tr1', { pies_id: 'd1', status: 'szuka' }),
    ch('spacery_sob', 's1', { start: now + 86400e3 }), ch('zaginiecia', 'g1', { imie: 'Burek' }), ch('komunikaty', 'k1', { tekst: 'Hej' }), ch('terminarz', 't1', { tytul: 'Weterynarz' }), ch('p_adopcje', 'a1', { imie: 'Pani X', tel: '500' })
  ])).every((x) => x === 'ok'));

  // odczyt wolontariusza
  const pw = await pull(w.token), cols = new Set(pw.changes.map((c) => c.col));
  ck('wolontariusz dostaje tylko dozwolone kolekcje', ['terminarz', 'czat', 'zdrowie', 'obserwacje', 'oznaczenia'].every((c) => !cols.has(c)) && ['psy', 'spacery', 'potrzeby', 'transporty', 'spacery_sob', 'zaginiecia', 'komunikaty'].every((c) => cols.has(c)), [...cols].join(','));
  const pies = pw.changes.find((c) => c.col === 'psy').data;
  ck('pies bez czipa, opiekuna, kanałów, karty', !('chip' in pies) && !('opiekun' in pies) && !('kanaly' in pies) && !('karta_gotowa' in pies) && !('nowy' in pies), JSON.stringify(pies));
  ck('pies z boksem, opisem, oceną, zdjęciami', pies.boks === '7' && pies.opis === 'Opis' && pies.ocena.psy === 'nie' && pies.zdjecia.length === 1);
  const sp = pw.changes.find((c) => c.col === 'spacery').data;
  ck('spacer bez telefonu, z imieniem', !('kontakt' in sp) && sp.osoba === 'Kasia');
  ck('kursor przesuwa się za ukrytymi rekordami (ostatni publiczny to terminarz)', pw.seq === 12 && pw.changes[pw.changes.length - 1].seq === 11, pw.seq);
  ck('wolontariusz nie czyta danych prywatnych', (await call('/sync?since=0&private=1', { tok: w.token })).s === 403);
  ck('administrator dostaje wszystko', (await pull(a.token)).changes.length === 12 && (await pull(a.token, 1)).changes.length === 1);
  ck('historia zmian tylko dla administratora', (await call('/history?col=psy&id=d1', { tok: w.token })).s === 403 && (await call('/history?col=psy&id=d1', { tok: a.token })).s === 200);

  // zapis wolontariusza
  const zakazane = await push(w.token, [ch('psy', 'd1', { imie: 'Zmiana' }), ch('psy', 'nowy', { imie: 'X' }), ch('potrzeby', 'n1', { zapewniono: 10 }), ch('transporty', 'tr1', { status: 'przypisany' }), ch('terminarz', 't2', {}), ch('spacery', 'w2', {}), ch('oznaczenia', 'd1', {}), ch('p_adopcje', 'a2', {})], DEV1);
  ck('wolontariusz nic nie edytuje', zakazane.every((x) => x === 'forbidden'), zakazane.join(','));
  ck('import i sprawdzenie strony tylko dla administratora', (await call('/site/sync', { method: 'POST', tok: w.token })).s === 403 && (await call('/import/links', { tok: w.token })).s === 403);
  ck('zdjęcia wysyła tylko administrator', (await call('/photo/abc123', { method: 'POST', tok: w.token, raw: Buffer.alloc(200, 0xff) })).s === 403);
  const moje = await push(w.token, [ch('deklaracje', 'dA', { pies_id: 'd1', potrzeba: 'spacer', imie: 'Ola' }), ch('zgloszenia', 'zA', { key: 's1', imie: 'Ola', status: 'tak' }),
    ch('oferty', 'oA', { typ: 'potrzeba', ref: 'n1', imie: 'Ola', ilosc: 5, stan: 'przyjeta' }), ch('p_tel', 'oA', { ref_col: 'oferty', ref_id: 'oA', tel: '600 700 800', imie: 'Ola', ts: Date.now() })], DEV1);
  ck('wolontariusz zapisuje swoje zgłoszenia', moje.every((x) => x === 'ok'), moje.join(','));
  const po = (await pull(a.token)).changes.find((c) => c.id === 'oA' && c.col === 'oferty').data;
  ck('oferta wolontariusza zawsze „nowa” (przyjmuje administrator)', po.stan === 'nowa');
  ck('telefon widzi administrator', (await pull(a.token, 1)).changes.some((c) => c.col === 'p_tel' && c.data.tel === '600 700 800'));
  ck('inny wolontariusz nie widzi telefonu', !(await pull(w.token)).changes.some((c) => c.col === 'p_tel'));
  ck('inny telefon nie zmieni cudzego zgłoszenia', (await push(w.token, [ch('oferty', 'oA', { imie: 'Hack' }), ch('deklaracje', 'dA', {}, { deleted: true })], DEV2)).every((x) => x === 'forbidden'));
  ck('ten sam telefon wycofa swoje zgłoszenie', (await push(w.token, [ch('deklaracje', 'dA', {}, { deleted: true, updated_at: Date.now() + 10 })], DEV1))[0] === 'ok');
  ck('administrator przyjmuje ofertę', (await push(a.token, [ch('oferty', 'oA', { ...po, stan: 'przyjeta' }, { updated_at: Date.now() + 20 })]))[0] === 'ok');
  ck('stare zgłoszenia bez właściciela: wolontariusz nie zmieni', (await push(a.token, [ch('zgloszenia', 'legacy', { imie: 'Ania' })]))[0] === 'ok' && (await push(w.token, [ch('zgloszenia', 'legacy', {}, { deleted: true, updated_at: Date.now() + 30 })], DEV1))[0] === 'forbidden');

  // wolontariusz nie wygasa po dobie (domyślnie 180 dni)
  ck('wolontariusz zalogowany długo', (await call('/auth/status', { tok: w.token })).s === 200);
  await stop();

  // telefony zgłoszeń znikają po TEL_DAYS (tu 0 dni: od razu przy starcie)
  await start({ TEL_DAYS: '0' }); await sl(900);
  const tel = (await pull(a.token, 1)).changes.filter((c) => c.col === 'p_tel');
  ck('telefon skasowany (znacznik usunięcia, bez danych)', tel.length === 1 && tel[0].deleted === true && !tel[0].data.tel, JSON.stringify(tel));
  ck('imię przy zgłoszeniu zostaje', (await pull(a.token)).changes.find((c) => c.id === 'oA' && c.col === 'oferty').data.imie === 'Ola');
  await stop();

  // krótki czas sesji wolontariusza (VOL_TTL_MS) nadal działa; administrator nie wygasa
  await start({ VOL_TTL_MS: '1000' }); const w3 = (await login('wolontariusz-haslo-1')).j, a3 = (await login('administrator-haslo-3')).j; await sl(1600);
  ck('VOL_TTL_MS działa', (await call('/auth/status', { tok: w3.token })).s === 401);
  ck('administrator nie wygasa', (await call('/auth/status', { tok: a3.token })).s === 200);
} catch (e) { console.error(e); fails++; }
await stop();
console.log(fails ? `BŁĘDY: ${fails}` : 'WSZYSTKO OK'); process.exit(fails ? 1 : 0);
