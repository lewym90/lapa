// Powiadomienia z serwera (Web Push): jedno dotknięcie „Włącz”, bez żadnych kodów i adresów.
import { api, ApiError } from './api.js';
import { getName } from './auth.js';
import { html, raw, icon, openSheet, closeSheet, toast, actions } from './ui.js';

const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* */ } }
};
export const prefs = { quiet: () => ls.get('lapa.push.quiet') !== '0', mute: () => ls.get('lapa.push.mute') === '1' };

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const toKey = (b64) => { const p = '='.repeat((4 - (b64.length % 4)) % 4), r = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
const sameKey = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);

async function currentSub() {
  if (!supported()) return null;
  try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch { return null; }
}
// 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'
export async function pushState() {
  if (isIOS() && !standalone()) return 'needs-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && (await currentSub()) && ls.get('lapa.push.on') === '1') return 'on';
  return 'off';
}

async function register(sub) {
  await api('/push/subscribe', { method: 'POST', body: { sub: sub.toJSON(), name: getName(), quiet: prefs.quiet(), mute: prefs.mute() } });
}
async function subscribeNow() {
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api('/push/key'), want = toKey(key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options?.applicationServerKey && new Uint8Array(sub.options.applicationServerKey), want)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
  await register(sub); ls.set('lapa.push.on', '1');
  return sub;
}
// Musi być wywołane bezpośrednio z kliknięcia (wymóg iPhone’a i Androida).
export async function enablePush() {
  if (!supported()) { toast('Ta przeglądarka nie obsługuje powiadomień', true); return false; }
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast(perm === 'denied' ? 'Powiadomienia zostały zablokowane w telefonie' : 'Powiadomienia nie zostały włączone', true); return false; }
  try { await subscribeNow(); toast('Powiadomienia włączone'); return true; }
  catch (e) { toast(e instanceof ApiError && e.status === 0 ? 'Brak połączenia z serwerem. Spróbuj za chwilę' : 'Nie udało się włączyć powiadomień: ' + (e.message || ''), true); return false; }
}
export async function disablePush() {
  const sub = await currentSub();
  try { if (sub) { await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); } } catch { /* */ }
  ls.set('lapa.push.on', null); toast('Powiadomienia wyłączone');
}
// Po starcie i po zmianie imienia: odnawia zapis na serwerze (nowy serwer, zmieniony klucz, nowe imię).
export async function syncPush() {
  try {
    if (!supported() || Notification.permission !== 'granted' || ls.get('lapa.push.on') !== '1') return;
    await subscribeNow();
  } catch { /* spróbuje przy następnym uruchomieniu */ }
}
export async function pushPrefsSave() {
  const sub = await currentSub(); if (!sub) return;
  try { await api('/push/prefs', { method: 'POST', body: { endpoint: sub.endpoint, name: getName(), quiet: prefs.quiet(), mute: prefs.mute() } }); }
  catch (e) { if (e instanceof ApiError && e.status === 404) await syncPush(); }
}
export async function pushRead() {
  try { if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {}); } catch { /* */ }
  const sub = await currentSub(); if (!sub) return;
  api('/push/read', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
}
export async function pushTest() {
  const sub = await currentSub(); if (!sub) { toast('Najpierw włącz powiadomienia', true); return; }
  try { const r = await api('/push/test', { method: 'POST', body: { endpoint: sub.endpoint } }); toast(r.ok ? 'Wysłano. Powiadomienie powinno przyjść za chwilę' : 'Serwer nie mógł wysłać powiadomienia', !r.ok); }
  catch (e) { if (e instanceof ApiError && e.status === 404) { await syncPush(); toast('Zapisano urządzenie na nowo. Spróbuj jeszcze raz'); } else toast(e.message, true); }
}

// ---------- karty i okna ----------
const HOW_IOS = 'Na iPhonie powiadomienia działają tylko w aplikacji dodanej do ekranu głównego. Otwórz stronę w Safari, dotknij „Udostępnij” (kwadrat ze strzałką), wybierz „Dodaj do ekranu początkowego”, a potem uruchom ŁAPĘ z ikony.';
const HOW_DENIED = 'Powiadomienia są zablokowane w telefonie. iPhone: Ustawienia → Powiadomienia → ŁAPA → Zezwalaj. Android: dotknij i przytrzymaj ikonę aplikacji → Informacje → Powiadomienia → Włącz. Potem wróć tutaj.';
export const pushHelp = (st) => (st === 'needs-install' ? HOW_IOS : st === 'denied' ? HOW_DENIED : st === 'unsupported' ? 'Ta przeglądarka nie obsługuje powiadomień. Użyj Chrome (Android) lub Safari z ikoną na ekranie głównym (iPhone).' : '');

// Karta zachęty (Start, Czat). Znika po włączeniu; „Nie teraz” ukrywa ją na 7 dni.
export async function promptCard() {
  const st = await pushState();
  if (st === 'on' || st === 'unsupported') return '';
  const until = +(ls.get('lapa.push.later') || 0); if (until > Date.now()) return '';
  if (st === 'off') return html`<div class="card pushcard"><div class="pc-h">${icon('bell')}<b>Włącz powiadomienia o czacie</b></div><p class="sub" style="margin:6px 0 12px">Dostaniesz sygnał, gdy ktoś napisze lub poprosi o pomoc. Dotknij raz i zezwól w telefonie.</p><div class="btnrow"><button class="btn gold" data-act="np-on">Włącz powiadomienia</button><button class="btn ghost" data-act="np-later">Nie teraz</button></div></div>`;
  return html`<div class="card pushcard"><div class="pc-h">${icon('bell')}<b>Powiadomienia nie są włączone</b></div><p class="sub" style="margin:6px 0 12px">${pushHelp(st)}</p><button class="btn ghost" data-act="np-later">Rozumiem</button></div>`;
}
// Jednorazowe okno po pierwszym zalogowaniu.
export async function firstPrompt() {
  if (ls.get('lapa.push.asked') || (await pushState()) !== 'off') return;
  ls.set('lapa.push.asked', '1');
  openSheet(`<h2>Powiadomienia z czatu</h2><p class="sub" style="margin:0 0 14px">Wolontariusze piszą tu o transportach, spacerach i pilnych sprawach. Włącz powiadomienia, żeby nic Cię nie ominęło. Zrobisz to jednym dotknięciem, nic nie trzeba wpisywać. Zawsze możesz to zmienić w Ustawieniach.</p>
    <button class="btn gold block" data-act="np-on-sheet">Włącz powiadomienia</button><button class="btn ghost block" style="margin-top:8px" data-act="np-later-sheet">Nie teraz</button>`);
}
// Karta w Ustawieniach (zawsze dostępna, także gdy ktoś pominął pierwsze okno).
export async function settingsCard() {
  const st = await pushState(), on = st === 'on';
  const label = { on: 'Włączone na tym telefonie', off: 'Wyłączone', denied: 'Zablokowane w telefonie', 'needs-install': 'Wymaga dodania aplikacji do ekranu głównego', unsupported: 'Niedostępne w tej przeglądarce' }[st];
  const sw = (act, on_, txt) => `<label class="swrow"><span>${txt}</span><input type="checkbox" role="switch" data-act="${act}" ${on_ ? 'checked' : ''}></label>`;
  return html`<div class="card"><h3>Powiadomienia</h3><p class="sub" style="margin:2px 0 12px">Stan: <b>${label}</b>. Dotyczą wiadomości z czatu wolontariuszy.</p>
    ${pushHelp(st) && !on && st !== 'off' ? html`<p class="hint" style="margin:0 0 12px">${pushHelp(st)}</p>` : ''}
    ${on ? html`<div class="btnrow"><button class="btn ghost" data-act="np-test">Wyślij testowe</button><button class="btn ghost" data-act="np-off">Wyłącz</button></div>
    ${raw(sw('np-quiet', prefs.quiet(), 'Cisza nocna 22:00–7:00 <small>(pilne i @Twoje imię nadal przyjdą)</small>'))}${raw(sw('np-mute', prefs.mute(), 'Wycisz czat <small>(tylko @Twoje imię przyjdzie)</small>'))}`
      : st === 'off' ? html`<button class="btn gold block" data-act="np-on">Włącz powiadomienia</button>` : ''}</div>`;
}
const refresh = () => dispatchEvent(new HashChangeEvent('hashchange'));
actions['np-on'] = async () => { await enablePush(); refresh(); };
actions['np-on-sheet'] = async () => { const ok = await enablePush(); closeSheet(); if (!ok) ls.set('lapa.push.later', String(Date.now() + 7 * 864e5)); };
actions['np-later-sheet'] = () => { ls.set('lapa.push.later', String(Date.now() + 7 * 864e5)); closeSheet(); };
actions['np-later'] = () => { ls.set('lapa.push.later', String(Date.now() + 7 * 864e5)); refresh(); };
actions['np-off'] = async () => { await disablePush(); refresh(); };
actions['np-test'] = () => pushTest();
// Dyspozytor kliknięć wywołuje preventDefault, więc stan przełącznika ustawiamy sami.
const keep = (el) => { const v = el.checked; setTimeout(() => { el.checked = v; }, 0); return v; };
actions['np-quiet'] = (el) => { ls.set('lapa.push.quiet', keep(el) ? '1' : '0'); pushPrefsSave(); };
actions['np-mute'] = (el) => { ls.set('lapa.push.mute', keep(el) ? '1' : '0'); pushPrefsSave(); };
