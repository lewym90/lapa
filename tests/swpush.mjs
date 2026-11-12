// Test obsługi powiadomień w sw.js (symulowany kontekst Service Workera).
import vm from 'node:vm'; import fs from 'node:fs';
const code = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'); const L = {}; const shown = [], badges = [], opened = [], posted = []; let focused = 0;
const clients = [{ focus: async () => { focused++; }, postMessage: (m) => posted.push(m) }];
const self_ = { addEventListener: (t, f) => { L[t] = f; }, registration: { scope: 'https://x.test/lapa/', showNotification: async (t, o) => { shown.push([t, o]); } }, navigator: { setAppBadge: async (n) => badges.push(n), clearAppBadge: async () => badges.push(0) }, clients: { matchAll: async () => clients, openWindow: async (u) => { opened.push(u); }, claim: async () => {} }, skipWaiting() {} };
vm.runInNewContext(code, { self: self_, caches: { open: async () => ({}), keys: async () => [], match: async () => null }, fetch: async () => ({}), URL, Response: { error: () => ({}) }, Promise, location: { origin: 'https://x.test' } });
let fails = 0; const ck = (n, c) => { console.log(c ? 'OK  ' : 'FAIL', n); if (!c) fails++; };
const ev = (data) => { const p = []; L.push({ data: { json: () => JSON.parse(data), text: () => data }, waitUntil: (x) => p.push(x) }); return Promise.all(p); };
await ev(JSON.stringify({ t: 'Basia', b: 'Kto zawiezie psa?', url: '#/czat', badge: 3 }));
ck('powiadomienie z tytułem, treścią i adresem', shown[0][0] === 'Basia' && shown[0][1].body === 'Kto zawiezie psa?' && shown[0][1].data.url === '#/czat');
ck('bez tagu (kolejne się nie nadpisują)', shown[0][1].tag === undefined); ck('odznaka ikony = 3', badges.at(-1) === 3);
await ev(JSON.stringify({ t: 'ŁAPA', b: 'test', tag: 'test', badge: 0 })); ck('test ma tag i zeruje odznakę', shown[1][1].tag === 'test' && badges.at(-1) === 0);
await ev('to nie jest json'); ck('zwykły tekst nie psuje obsługi', shown[2][0] === 'ŁAPA' && shown[2][1].body === 'to nie jest json');
let closed = 0; const click = async (url) => { const p = []; L.notificationclick({ notification: { close: () => closed++, data: { url } }, waitUntil: (x) => p.push(x) }); await Promise.all(p); };
await click('#/czat'); ck('kliknięcie: okno aktywowane i przekierowane', focused === 1 && posted[0].type === 'go' && posted[0].url === '#/czat' && closed === 1);
clients.length = 0; await click('#/czat'); ck('kliknięcie bez otwartego okna: otwiera aplikację', opened[0] === 'https://x.test/lapa/#/czat');
console.log(fails ? 'BŁĘDÓW: ' + fails : 'WSZYSTKO OK'); process.exit(fails ? 1 : 0);
