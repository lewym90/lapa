import './sync.js';
import { state, init, login, getName, setName, logout, lock, unlock } from './auth.js';
import { on, emit } from './bus.js';
import { status as syncStatus, kick } from './sync.js';
import { ApiError } from './api.js';
import { html, raw, icon, esc, openSheet, closeSheet, toast, actions } from './ui.js';
import { VERSION } from './config.js';
import { initUpdates } from './update.js';
import * as T from './teczka.js';
import * as A from './adopcje.js';
import * as Z from './zaginiecia.js';
import * as F from './finanse.js';
import * as S from './screens-start.js';
import * as P from './screens-psy.js';
import * as W from './screens-spacer.js';
import * as B from './brama.js';
import * as X from './screens-inne.js';
import * as TM from './terminarz.js';

const app = document.getElementById('app');

// ---------- trasy ----------
const routes = [
  [/^\/?$/, () => S.start()], [/^\/start$/, () => S.start()],
  [/^\/psy$/, () => P.list()], [/^\/psy\/([\w-]+)$/, (m) => P.card(m[1])],
  [/^\/brama$/, () => B.brama()], [/^\/spacer$/, () => W.pick()], [/^\/spacer\/([\w-]+)$/, (m) => W.walk(m[1])], [/^\/raport\/([\w-]+)$/, (m) => W.report(m[1])],
  [/^\/wydarzenia$/, () => TM.wydarzenia()], [/^\/pomoc$/, () => X.help()], [/^\/transport$/, () => X.transport()],
  [/^\/zadania$/, () => TM.wydarzenia({ tab: 'ter', filt: 'ja' })], [/^\/zrobic$/, () => T.zrobic()], [/^\/adopcje$/, () => A.adopcje()], [/^\/dt$/, () => A.dt()], [/^\/zaginiecia$/, () => Z.zaginiecia()], [/^\/finanse$/, () => F.finanse()], [/^\/ustawienia$/, () => X.settings()], [/^\/dziekujemy$/, () => X.thanks()]
];
const TABS = [['start', 'Start', 'home'], ['psy', 'Psy', 'paw'], null, ['wydarzenia', 'Terminarz', 'calendar'], ['pomoc', 'Pomoc', 'heart']];


// Panel boczny na komputerze (od 860 px): to samo menu co „trzy kreski”, tylko stale rozwinięte.
const MAIN = [['start', 'Start', 'home'], ['psy', 'Psy', 'paw'], ['brama', 'Brama (spacery)', 'walk'], ['wydarzenia', 'Terminarz', 'calendar'], ['pomoc', 'Pomoc i potrzeby', 'heart']];
const REST = [['spacer', 'Spacer osobisty', 'walk'], ['zadania', 'Tylko moje wpisy', 'check'], ['transport', 'Transport', 'truck'], ['zrobic', 'Do zrobienia', 'check'], ['adopcje', 'Adopcje', 'heart'], ['dt', 'Domy tymczasowe', 'pin'], ['zaginiecia', 'Zaginięcia', 'alert'], ['finanse', 'Finanse', 'box'], ['ustawienia', 'Ustawienia', 'sliders'], ['dziekujemy', 'Dziękujemy', 'gift']];
function side() {
  const seg = (location.hash.replace(/^#\//, '').split('/')[0] || 'start'), on = (k) => (seg === k || (k === 'spacer' && seg === 'raport')) ? ' on' : '';
  const a = (x) => `<a class="sl${on(x[0])}" href="#/${x[0]}"${on(x[0]) ? ' aria-current="page"' : ''}>${icon(x[2]).s}<span>${x[1]}</span></a>`;
  return `<aside class="side" aria-label="Menu"><div class="sbrand">${icon('paw').s}<div><b>ŁAPA</b><small>NOWODWÓR</small></div></div>
    <div class="who2"><b>${esc(getName() || 'Wolontariusz')}</b><span>${state.coordinator ? 'Koordynator · dane osobowe odblokowane' : 'Wolontariusz'}</span></div>
    <button class="btn gold block sadd" data-act="add">${icon('plus').s} Dodaj</button>
    <div class="sgrp">${MAIN.map(a).join('')}</div><div class="slab">Praca w schronisku</div><div class="sgrp">${REST.map(a).join('')}</div>
    <div style="flex:1"></div><span class="syncpill" id="sp2" style="align-self:flex-start;margin:8px 12px"><i></i><span></span></span><div class="sver">ŁAPA ${VERSION}</div></aside>`;
}

function nav(tab) {
  const t = (x) => x ? `<a class="tab ${tab === x[0] ? 'on' : ''}" href="#/${x[0]}" ${tab === x[0] ? 'aria-current="page"' : ''}>${icon(x[2]).s}<span>${x[1]}</span></a>`
    : `<button class="plus" data-act="add" aria-label="Dodaj">${icon('plus').s}</button>`;
  return `<nav class="nav" aria-label="Główna nawigacja">${TABS.map(t).join('')}</nav>`;
}

let current = null, renderId = 0;
async function render(keepScroll = false) {
  if (!state.loggedIn) return showLogin();
  if (!getName()) return showName();
  const id = ++renderId, path = location.hash.replace(/^#/, '') || '/start';
  const y = keepScroll ? scrollY : 0;
  let view;
  try {
    for (const [re, fn] of routes) { const m = re.exec(path); if (m) { view = await fn(m); break; } }
    view ||= await S.start();
  } catch (e) { console.error(e); view = { html: html`<div class="empty"><h3>Coś poszło nie tak</h3><p>${e.message}</p><a class="btn gold" href="#/start">Wróć na Start</a></div>`, tab: 'start' }; }
  if (id !== renderId) return;
  current = view;
  app.innerHTML = `<div class="shell">${side()}${view.nav === false ? '' : nav(view.tab)}<main class="main" ${view.nav === false ? 'style="padding-bottom:40px"' : ''}>${view.html.s}</main></div>`;
  paintSync(document.getElementById('sp2'));
  view.mount?.(app);
  scrollTo(0, y);
  document.title = (view.title ? view.title + ' · ' : '') + 'ŁAPA — Nowodwór';
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
on('auth', () => { if (!state.loggedIn || !getName()) render(); else { render(true); setTimeout(() => TM.poranny(), 2500); } });
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
    <div class="who2"><b>${esc(getName() || 'Wolontariusz')}</b><span>${state.coordinator ? 'Koordynator · dane osobowe odblokowane' : 'Wolontariusz'}</span></div>
    <a href="#/start">${icon('home').s}Start</a><a href="#/psy">${icon('paw').s}Psy</a>
    <a href="#/brama">${icon('walk').s}Brama (spacery)</a><a href="#/spacer">${icon('walk').s}Spacer osobisty</a><a href="#/zadania">${icon('check').s}Tylko moje wpisy</a>
    <a href="#/wydarzenia">${icon('calendar').s}Terminarz i sobotnie spacery</a><a href="#/transport">${icon('truck').s}Transport</a>
    <a href="#/zrobic">${icon('check').s}Do zrobienia</a><a href="#/adopcje">${icon('heart').s}Adopcje</a><a href="#/dt">${icon('pin').s}Domy tymczasowe</a><a href="#/zaginiecia">${icon('alert').s}Zaginięcia</a><a href="#/finanse">${icon('box').s}Finanse</a>
    <a href="#/pomoc">${icon('heart').s}Pomoc i potrzeby</a><a href="#/ustawienia">${icon('sliders').s}Ustawienia</a>
    <a href="#/dziekujemy">${icon('gift').s}Dziękujemy</a>
    <div style="flex:1"></div><span class="syncpill" id="sp" style="align-self:flex-start;margin:8px 12px"><i></i><span></span></span>
    <div style="font-size:12px;color:var(--sage);padding:0 12px">ŁAPA ${VERSION}</div></nav>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelector('.scrim').onclick = close; el.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  paintSync(el.querySelector('#sp'));
};
actions.bell = () => S.komunikatySheet();
actions.add = () => openSheet(`<h2>Co chcesz dodać?</h2><div class="actions">
  <button class="act primary" data-act="a-newdog">${icon('paw').s}Nowy pies w schronisku<small>Przyjęcie, ocena, sesja, publikacja</small></button>
  <button class="act primary" data-act="a-brama">${icon('walk').s}Brama: wydaj / zwróć psa<small>Sobotnie spacery, godziny same</small></button>
  <button class="act" data-act="a-walk">${icon('walk').s}Spacer osobisty<small>GPS, notatki, zdjęcia</small></button>
  <button class="act" data-act="a-obs">${icon('pencil').s}Dodaj obserwację<small>Zachowanie, zdrowie, uwagi</small></button>
  <button class="act" data-act="a-photo">${icon('camera').s}Dodaj zdjęcie<small>Do karty wybranego psa</small></button>
  <button class="act" data-act="a-task">${icon('check').s}Przypomnienie dla siebie<small>Widzisz tylko Ty, np. lek, zadanie</small></button>
  <button class="act" data-act="a-event">${icon('calendar').s}Wpis w terminarzu dla wszystkich<small>Można się zgłaszać</small></button>
  <button class="act" data-act="a-trans">${icon('truck').s}Zgłoś transport<small>Szukam kierowcy</small></button>
  <button class="act" data-act="a-need">${icon('box').s}Zgłoś potrzebę<small>Karma, leki, wyposażenie</small></button>
  <button class="act" data-act="a-dog">${icon('paw').s}Dodaj psa<small>Import ze strony schroniska lub ręcznie</small></button></div>`);
actions['a-newdog'] = () => { closeSheet(); T.nowyPies(); };
actions['a-brama'] = () => { closeSheet(); location.hash = '#/brama'; };
actions['a-walk'] = () => { closeSheet(); location.hash = '#/spacer'; };
actions['a-obs'] = () => { closeSheet(); P.pickDog((d) => P.obsForm(d.id)); };
actions['a-photo'] = () => { closeSheet(); P.pickDog((d) => P.addPhoto(d.id)); };
actions['a-task'] = () => { closeSheet(); TM.terForm(null, { widocznosc: 'ja' }); };
actions['a-event'] = () => { closeSheet(); TM.terForm(null, { widocznosc: 'wszyscy' }); };
actions['a-trans'] = () => { closeSheet(); X.transForm(); };
actions['a-need'] = () => { closeSheet(); X.needForm(); };
actions['a-dog'] = () => { closeSheet(); P.addDogSheet(); };

function paintSync(el) {
  if (!el) return;
  const s = syncStatus; el.className = 'syncpill ' + (s.state === 'offline' || s.state === 'error' ? 'off' : s.state === 'busy' || s.pending ? 'wait' : '');
  el.querySelector('span').textContent = s.state === 'offline' ? 'Offline – zapisane w telefonie' : s.state === 'error' ? 'Błąd synchronizacji' : s.pending ? `Do wysłania: ${s.pending}` : s.state === 'busy' ? 'Synchronizuję…' : 'Wszystko zapisane';
}
on('sync', () => { paintSync(document.getElementById('sp')); paintSync(document.getElementById('sp2')); });

// ---------- start ----------
(async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  await init();
  if (new URLSearchParams(location.search).get('action') === 'walk' && state.loggedIn) location.hash = '#/spacer';
  await render();
  kick(100);
  initUpdates();
  setTimeout(() => { if (state.loggedIn) P.refreshStale(); }, 4000);
  setTimeout(() => TM.poranny(), 3000);
})();
export { render, lock, unlock, emit, logout, raw };
