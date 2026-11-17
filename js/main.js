import './sync.js';
import { state, init, login, getName, setName, logout, lock, unlock } from './auth.js';
import { on, emit } from './bus.js';
import { status as syncStatus, kick } from './sync.js';
import { ApiError } from './api.js';
import { html, raw, icon, esc, closeSheet, toast, actions, ustawRole } from './ui.js';
ustawRole(() => state.admin);
import { VERSION, TEST } from './config.js';
import { initUpdates } from './update.js';
import * as A from './adopcje.js';
import * as Z from './zaginiecia.js';
import * as F from './finanse.js';
import * as S from './screens-start.js';
import * as P from './screens-psy.js';
import * as W from './screens-spacer.js';
import * as B from './brama.js';
import * as X from './screens-inne.js';
import * as TM from './terminarz.js';
import * as C from './czat.js';
import * as WO from './wolontariusz.js';
import { firstPrompt, syncPush } from './push.js';

const app = document.getElementById('app');

// ---------- trasy ----------
const routes = [
  [/^\/?$/, () => S.start()], [/^\/start$/, () => S.start()],
  [/^\/psy$/, () => P.list()], [/^\/psy\/([\w-]+)$/, (m) => P.card(m[1])],
  [/^\/brama$/, () => B.brama()], [/^\/raport\/([\w-]+)$/, (m) => W.report(m[1])],
  [/^\/czat$/, () => C.czat()], [/^\/wydarzenia$/, () => TM.wydarzenia()], [/^\/(?:pomoc|potrzeby|transport)$/, () => X.help()],
  [/^\/(?:terminarz|zadania)$/, () => TM.wydarzenia({ tab: 'ter', filt: 'wszystko' })], [/^\/(?:sobotnie|spacery)$/, () => TM.wydarzenia({ tab: 'sob' })], [/^\/dt$/, () => A.dt()], [/^\/dt\/([\w-]+)$/, (m) => A.dtKarta(m[1])], [/^\/zaginiecia$/, () => Z.zaginiecia()], [/^\/zaginiecia\/([\w-]+)$/, (m) => Z.karta(m[1])], [/^\/finanse$/, () => F.finanse()], [/^\/ustawienia$/, () => X.settings()], [/^\/dziekujemy$/, () => X.thanks()],
  [/^\/zgloszenia$/, () => WO.zgloszeniaAdmin()], [/^\/byli$/, () => P.byli()]
];
// Trasy wolontariusza (te same adresy, widoki tylko do podglądu + zgłoszenia).
const ROUTES_WOL = [
  [/^\/?$/, () => WO.startWol()], [/^\/start$/, () => WO.startWol()],
  [/^\/psy$/, () => P.list()], [/^\/byli$/, () => P.byli()], [/^\/psy\/([\w-]+)$/, (m) => P.card(m[1])], [/^\/raport\/([\w-]+)$/, (m) => W.report(m[1])],
  [/^\/(?:pomoc|potrzeby|transport)$/, () => WO.pomocWol()],
  [/^\/(?:sobotnie|spacery)$/, () => WO.sobotyWol()], [/^\/zaginiecia$/, () => Z.zaginiecia()], [/^\/zaginiecia\/([\w-]+)$/, (m) => Z.karta(m[1])], [/^\/ustawienia$/, () => X.settings()], [/^\/dziekujemy$/, () => X.thanks()]
];
// Dolny pasek administratora: Start, Psy, Brama (duży przycisk na środku), Terminarz, Pomoc. Reszta jest w menu (trzy kreski). Nic się nie powtarza.
const TABS = [['start', 'Start', 'home'], ['psy', 'Psy', 'paw'], null, ['wydarzenia', 'Terminarz', 'calendar'], ['pomoc', 'Pomoc', 'heart']];
// Wolontariusz: Start, Psy, Pomoc (psy, potrzeby, transport), Spacery (sobotnie).
const TABS_WOL = [['start', 'Start', 'home'], ['psy', 'Psy', 'paw'], ['pomoc', 'Pomoc', 'heart'], ['spacery', 'Spacery', 'calendar']];
// Trasy dostępne dla wolontariusza (reszta: tylko administrator).
const wolnoWol = (path) => ROUTES_WOL.some(([re]) => re.test(path));


// Panel boczny na komputerze (od 860 px): to samo menu co „trzy kreski”, tylko stale rozwinięte.
// Jedno menu dla telefonu (trzy kreski) i komputera (panel boczny): pogrupowane według tego, czego szukasz.
// Menu (trzy kreski) na telefonie: tylko to, czego nie ma na dolnym pasku. Na komputerze panel boczny = pasek + menu, każda rzecz raz.
const MENU_WOL = [['Więcej', [['zaginiecia', 'Zaginione psy', 'alert'], ['ustawienia', 'Ustawienia', 'sliders'], ['dziekujemy', 'Dziękujemy', 'gift']]]];
const MENU = [['Więcej', [['czat', 'Czat wolontariuszy', 'chat'], ['zaginiecia', 'Zaginięcia', 'alert'], ['dt', 'Domy tymczasowe i hoteliki', 'pin'], ['finanse', 'Finanse', 'box'], ['zgloszenia', 'Zgłoszenia wolontariuszy', 'user'], ['ustawienia', 'Ustawienia', 'sliders'], ['dziekujemy', 'Dziękujemy', 'gift']]]];
const PASEK = () => (state.admin ? [['start', 'Start', 'home'], ['psy', 'Psy', 'paw'], ['brama', 'Brama', 'walk'], ['wydarzenia', 'Terminarz', 'calendar'], ['pomoc', 'Pomoc', 'heart']] : TABS_WOL);
const menuHtml = (cls, on, zPaskiem = false) => [...(zPaskiem ? [['', PASEK()]] : []), ...(state.admin ? MENU : MENU_WOL)].map(([g, items]) => (g ? `<div class="slab">${g}</div>` : '') + items.map((x) => `<a class="${cls}${on(x[0]) ? ' on' : ''}" href="#/${x[0]}"${on(x[0]) ? ' aria-current="page"' : ''}>${icon(x[2]).s}<span>${x[1]}</span>${x[0] === 'czat' ? '<span class="cbadge" hidden></span>' : ''}</a>`).join('')).join('');
const segNow = () => location.hash.replace(/^#\//, '').split('/')[0] || 'start';
const isOn = (k) => { const seg = segNow(); return seg === k || (k === 'wydarzenia' && ['terminarz', 'sobotnie'].includes(seg)) || (k === 'spacery' && seg === 'sobotnie') || (k === 'pomoc' && ['potrzeby', 'transport'].includes(seg)); };
function side() {
  return `<aside class="side" aria-label="Menu"><div class="sbrand">${icon('paw').s}<div><b>ŁAPA</b><small>NOWODWÓR</small></div></div>
    <div class="who2"><b>${esc(getName() || 'Wolontariusz')}</b><span>${state.admin ? 'Administrator' : 'Wolontariusz'}</span></div>
    ${menuHtml('sl', isOn, true)}
    <div style="flex:1"></div><span class="syncpill" id="sp2" style="align-self:flex-start;margin:8px 12px"><i></i><span></span></span><div class="sver">ŁAPA ${VERSION}</div></aside>`;
}

function nav(tab) {
  const t = (x) => x ? `<a class="tab ${tab === x[0] ? 'on' : ''}" href="#/${x[0]}" ${tab === x[0] ? 'aria-current="page"' : ''}>${icon(x[2]).s}<span>${x[1]}</span></a>`
    : `<a class="plus${tab === 'brama' ? ' on' : ''}" href="#/brama" aria-label="Brama: wydaj i zwróć psa">${icon('walk').s}<span class="plbl">Brama</span></a>`;
  return `<nav class="nav${state.admin ? '' : ' wol'}" aria-label="Główna nawigacja">${(state.admin ? TABS : TABS_WOL).map(t).join('')}</nav>`;
}

let current = null, renderId = 0;
async function render(keepScroll = false) {
  if (!state.loggedIn) return showLogin();
  if (!getName()) return showName();
  const id = ++renderId, path = location.hash.replace(/^#/, '') || '/start';
  if (!state.admin && !wolnoWol(path)) { location.replace('#/start'); toast('Ta część aplikacji jest dla administratorów'); return; }
  const y = keepScroll ? scrollY : 0;
  let view;
  try {
    for (const [re, fn] of (state.admin ? routes : ROUTES_WOL)) { const m = re.exec(path); if (m) { view = await fn(m); break; } }
    view ||= state.admin ? await S.start() : await WO.startWol();
  } catch (e) { console.error(e); view = { html: html`<div class="empty"><h3>Coś poszło nie tak</h3><p>${e.message}</p><a class="btn gold" href="#/start">Wróć na Start</a></div>`, tab: 'start' }; }
  if (id !== renderId) return;
  current = view;
  app.innerHTML = `<div class="shell">${side()}${view.nav === false ? '' : nav(view.tab)}<main class="main" ${view.nav === false ? 'style="padding-bottom:40px"' : ''}>${view.html.s}</main></div>`;
  paintSync(document.getElementById('sp2'));
  C.refreshBadge();
  view.mount?.(app);
  scrollTo(0, y);
  document.title = (TEST ? 'TEST · ' : '') + (view.title ? view.title + ' · ' : '') + 'ŁAPA — Nowodwór';
}
addEventListener('hashchange', () => { closeSheet(); render(); });

// odświeżanie po zmianie danych (bez psucia wpisywania tekstu)
let rt;
on('change', () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    if (!current || current.live === false) return;
    if (document.querySelector('#sheet-root .sheet')) return;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    render(true);
  }, 250);
});
on('auth', () => { if (!state.loggedIn || !getName()) render(); else { render(true); if (state.admin) { setTimeout(() => TM.poranny(), 2500); setTimeout(syncPush, 1500); setTimeout(firstPrompt, 4500); } } }); // poranny komunikat i powiadomienia czatu: tylko administrator
on('authlost', () => { toast('Sesja wygasła – zaloguj się ponownie', true); });

// ---------- logowanie ----------
function showLogin(msg = '') {
  renderId++;
  app.innerHTML = `<div class="login"><span class="pawbig">${icon('paw').s}</span><div class="box">
    <div class="logo"><img src="icons/icon-192.png" alt="" width="104" height="104"><div class="w">ŁAPA</div><div class="s">NOWODWÓR</div></div>
    <p class="tag">Każdy dzień ma znaczenie.</p>
    <form class="card" id="lf" autocomplete="on" novalidate>
      <h3 style="font-size:24px;margin-bottom:4px">Witaj, wolontariuszu</h3>
      <p class="sub" style="margin:0 0 16px">Wpisz hasło, które dostałeś(-aś) razem z aplikacją. Zrobisz to tylko raz.</p>
      <div class="field"><label for="pw">Hasło</label><input class="input" id="pw" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required></div>
      <div class="err" id="le" role="alert">${esc(msg)}</div>
      <button class="btn block" id="lb" type="submit">Wejdź ${icon('arrow').s}</button>
    </form></div></div>`;
  const f = document.getElementById('lf'), pw = document.getElementById('pw'), le = document.getElementById('le'), lb = document.getElementById('lb');
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); if (!pw.value) { le.textContent = 'Wpisz hasło.'; return; }
    lb.disabled = true; le.textContent = '';
    try { await login(pw.value); }
    catch (err) {
      lb.disabled = false;
      le.textContent = err instanceof ApiError && err.status === 0 ? 'Brak połączenia. Sprawdź internet i spróbuj ponownie.'
        : err.status === 429 ? 'Za dużo błędnych prób. Spróbuj za ' + Math.max(1, Math.ceil((err.body.retry_after || 600) / 60)) + ' min.'
        : err.status === 401 ? 'Nieprawidłowe hasło.' : err.message;
      pw.select();
    }
  });
  pw.focus();
}

// ---------- imię ----------
function showName() {
  renderId++;
  app.innerHTML = `<div class="login"><span class="pawbig">${icon('paw').s}</span><div class="box">
    <div class="logo"><div class="w" style="font-size:38px;margin-top:0">Miło Cię widzieć</div></div>
    <form class="card" id="nf" novalidate>
      <h3 style="font-size:22px;margin-bottom:4px">Jak masz na imię?</h3>
      <p class="sub" style="margin:0 0 16px">Imię podpisze Twoje wpisy i spacery, żeby inni wolontariusze wiedzieli, kto co zrobił. Możesz je później zmienić w ustawieniach.</p>
      <div class="field"><label for="nm">Imię</label><input class="input" id="nm" autocomplete="given-name" maxlength="40" required></div>
      <div class="err" id="ne" role="alert"></div>
      <button class="btn block" type="submit">Dalej ${icon('arrow').s}</button>
    </form></div></div>`;
  const nm = document.getElementById('nm');
  document.getElementById('nf').addEventListener('submit', (e) => {
    e.preventDefault();
    if (nm.value.trim().length < 2) { document.getElementById('ne').textContent = 'Wpisz swoje imię.'; return; }
    const first = !localStorage.getItem('lapa.thanks');
    setName(nm.value);
    if (first) { try { localStorage.setItem('lapa.thanks', '1'); } catch {} location.hash = '#/dziekujemy'; }
  });
  nm.focus();
}

// ---------- menu, dzwonek, dodawanie ----------
actions.menu = () => {
  const el = document.createElement('div'); el.className = 'drawer';
  el.innerHTML = `<div class="scrim"></div><nav aria-label="Menu">
    <div class="who2"><b>${esc(getName() || 'Wolontariusz')}</b><span>${state.admin ? 'Administrator' : 'Wolontariusz'}</span></div>
    ${menuHtml('', isOn)}
    <div style="flex:1"></div><span class="syncpill" id="sp" style="align-self:flex-start;margin:8px 12px"><i></i><span></span></span>
    <div style="font-size:12px;color:var(--sage);padding:0 12px">ŁAPA ${VERSION}</div></nav>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelector('.scrim').onclick = close; el.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  paintSync(el.querySelector('#sp'));
};
actions.bell = () => S.komunikatySheet();

function paintSync(el) {
  if (!el) return;
  const s = syncStatus; el.className = 'syncpill ' + (s.state === 'offline' || s.state === 'error' ? 'off' : s.state === 'busy' || s.pending ? 'wait' : '');
  el.querySelector('span').textContent = s.state === 'offline' ? 'Offline – zapisane w telefonie' : s.state === 'error' ? 'Błąd synchronizacji' : s.pending ? `Do wysłania: ${s.pending}` : s.state === 'busy' ? 'Synchronizuję…' : 'Wszystko zapisane';
}
on('sync', () => { paintSync(document.getElementById('sp')); paintSync(document.getElementById('sp2')); });

// ---------- start ----------
(async function boot() {
  if (TEST) { document.documentElement.classList.add('wersja-testowa'); const b = document.createElement('div'); b.className = 'testbar'; b.textContent = 'WERSJA TESTOWA · zmiany widać tylko tutaj'; document.body.appendChild(b); document.title = 'TEST · ' + document.title; }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  await init();
  if (new URLSearchParams(location.search).get('action') === 'walk' && state.loggedIn) location.hash = '#/brama';
  await render();
  kick(100);
  initUpdates();
  C.initChat();
  if (state.loggedIn && getName() && state.admin) { setTimeout(syncPush, 2000); setTimeout(firstPrompt, 4500); }
  setTimeout(() => { if (state.admin) TM.poranny(); }, 3000);
})();
export { render, lock, unlock, emit, logout, raw };

// Bez powiększania: ściąganie palcami (podwójne dotknięcie blokuje touch-action w CSS)
['gesturestart', 'gesturechange', 'gestureend'].forEach((n) => document.addEventListener(n, (e) => e.preventDefault()));
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
