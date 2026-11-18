import { html, raw, esc, safeUrl } from './ui-core.js';
import { icon } from './icons.js';
import { metaGet, metaSet } from './db.js';
export { html, raw, esc, safeUrl, icon };

let toastT;
export function toast(msg, bad = false) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastT); toastT = setTimeout(() => { el.className = ''; }, 3200);
}

// Arkusz od dołu
let sheetClose = null;
export function openSheet(content, onMount) {
  closeSheet();
  const root = document.getElementById('sheet-root');
  root.innerHTML = `<div class="scrim" data-sheet-close></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><button type="button" class="sheetx" data-sheet-close aria-label="Zamknij">&times;</button>${content}</div>`;
  const sheet = root.querySelector('.sheet');
  root.querySelector('.scrim').addEventListener('click', closeSheet);
  sheet.addEventListener('click', (e) => { if (e.target.closest('[data-sheet-close]')) closeSheet(); });
  const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
  document.addEventListener('keydown', onKey);
  sheetClose = () => document.removeEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  onMount?.(sheet);
  sheet.setAttribute('tabindex', '-1'); try { sheet.focus({ preventScroll: true }); } catch {}
  draftsFor(sheet);
  return sheet;
}

// ===== Szkice: wpisany tekst nie ginie po zminimalizowaniu aplikacji, telefonie, przeładowaniu =====
let draft = null; // { key, sheet, submitted, timer }
const DRAFT_TTL = 3 * 24 * 3600e3;
const fieldsOf = (sh) => [...sh.querySelectorAll('input[id],textarea[id],select[id]')].filter((e) => !e.hasAttribute('data-nodraft') && !['password', 'file', 'button', 'submit'].includes(e.type));
function collect(sh) { const v = {}; for (const e of fieldsOf(sh)) { const x = e.type === 'checkbox' || e.type === 'radio' ? (e.checked ? '1' : '') : e.value; if (x) v[e.id] = x; } return v; }
function saveDraft(flush) {
  if (!draft || draft.submitted) return; const { key, sheet } = draft; if (!sheet.isConnected) return;
  const v = collect(sheet); if (!Object.keys(v).length) { metaSet(key, null).catch(() => {}); return; }
  metaSet(key, { v, t: Date.now() }).catch(() => {}); void flush;
}
async function draftsFor(sheet) {
  const h2 = sheet.querySelector('h2'); const fs = fieldsOf(sheet);
  if (!h2 || !fs.length || sheet.querySelector('input[type=password]')) { draft = null; return; }
  const init = fs.map((e) => e.id + '=' + (e.type === 'checkbox' || e.type === 'radio' ? (e.checked ? 1 : 0) : e.value)).join('|'); let hh = 0; for (const ch of init) hh = (hh * 31 + ch.charCodeAt(0)) | 0;
  const key = 'draft:' + h2.textContent.trim().slice(0, 80) + ':' + (hh >>> 0).toString(36);
  draft = { key, sheet, submitted: false };
  let saved = null; try { saved = await metaGet(key); } catch {}
  if (saved && Date.now() - saved.t < DRAFT_TTL && sheet.isConnected) {
    let n = 0; for (const e of fs) { const x = saved.v[e.id]; if (x === undefined) continue; if (e.type === 'checkbox' || e.type === 'radio') e.checked = !!x; else e.value = x; n++; }
    if (n) {
      const b = document.createElement('div'); b.className = 'hint'; b.style.cssText = 'background:rgba(177,138,82,.16);border-radius:12px;padding:8px 12px;margin:0 0 12px;display:flex;gap:10px;align-items:center;justify-content:space-between';
      b.innerHTML = '<span>Przywrócono niedokończony wpis.</span><button type="button" class="link" style="white-space:nowrap">Wyczyść</button>'; h2.after(b);
      b.querySelector('button').onclick = () => { for (const e of fs) { if (e.type === 'checkbox' || e.type === 'radio') e.checked = false; else if (e.tagName !== 'SELECT') e.value = ''; } metaSet(key, null).catch(() => {}); b.remove(); };
    }
  }
  const sched = () => { if (!draft) return; draft.submitted = false; clearTimeout(draft.timer); draft.timer = setTimeout(() => saveDraft(), 350); };
  sheet.addEventListener('input', sched); sheet.addEventListener('change', sched);
  sheet.addEventListener('submit', () => { if (draft) { draft.submitted = true; clearTimeout(draft.timer); } }, true);
}
const flushDraft = () => { if (draft) { clearTimeout(draft.timer); draft.submitted = false; saveDraft(true); } };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDraft(); });
addEventListener('pagehide', flushDraft);

// ===== Ekran nie gaśnie, gdy aplikacja jest otwarta =====
let wl = null;
async function wake() { try { if (document.visibilityState === 'visible' && 'wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch { wl = null; } }
document.addEventListener('visibilitychange', wake); addEventListener('pointerdown', wake, { passive: true }); wake();
export function closeSheet() {
  if (draft) { clearTimeout(draft.timer); if (draft.submitted) metaSet(draft.key, null).catch(() => {}); else saveDraft(); draft = null; }
  const root = document.getElementById('sheet-root');
  if (root.firstChild) root.innerHTML = '';
  sheetClose?.(); sheetClose = null;
  document.body.style.overflow = '';
}

export function confirmSheet(title, text, okLabel = 'Tak', danger = false) {
  return new Promise((resolve) => {
    openSheet(`<h2>${esc(title)}</h2><p class="hint" style="font-size:15px;margin:0 0 18px">${esc(text)}</p>
      <div class="btnrow"><button class="btn ghost" data-no>Anuluj</button><button class="btn ${danger ? 'terra' : ''}" data-yes>${esc(okLabel)}</button></div>`,
    (s) => {
      s.querySelector('[data-no]').onclick = () => { closeSheet(); resolve(false); };
      s.querySelector('[data-yes]').onclick = () => { closeSheet(); resolve(true); };
    });
  });
}

// Zdjęcie psa z awaryjnym tłem, gdy brak zdjęcia lub brak sieci
export function dogImg(url, alt = '', cls = '', fb = '') {
  const u = safeUrl(url);
  if (!u) return html`<div class="nophoto ${cls}">${icon('paw')}</div>`;
  return raw(`<img class="${esc(cls)}" src="${esc(u)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-ph${fb && safeUrl(fb) ? ` data-fb="${esc(safeUrl(fb))}"` : ''}>`);
}
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.hasAttribute('data-ph')) {
    if (t.dataset.fb && t.src !== t.dataset.fb) { t.src = t.dataset.fb; return; }
    const d = document.createElement('div'); d.className = 'nophoto ' + (t.className || '');
    d.innerHTML = icon('paw').s; t.replaceWith(d);
  }
}, true);

export const sexSymbol = (s) => (s === 'suka' ? '♀' : s === 'samiec' ? '♂' : '');
export const STATUS = {
  do_adopcji: 'Do adopcji', pilne: 'Pilny przypadek', dt: 'W domu tymczasowym', hotelik: 'W hoteliku',
  w_trakcie: 'W procesie adopcji', adoptowany: 'Adoptowany', schronisko: 'W schronisku'
};
export const statusChip = (s) => {
  const cls = s === 'pilne' ? 'terra' : s === 'adoptowany' ? 'gold' : '';
  return html`<span class="chip ${cls}">${STATUS[s] || 'W schronisku'}</span>`;
};

// ===== wspólne elementy układu =====
export const actions = {};
// Akcje dostępne dla wolontariusza (podgląd i własne zgłoszenia). Każda inna akcja: tylko administrator.
// To druga linia obrony – przyciski administratora i tak nie są wolontariuszowi pokazywane, a serwer odrzuca zapis.
export const VOL_ACTIONS = new Set(['menu', 'back', 'dog-filter', 'kolejnosc', 'dog-fav', 'dog-share', 'dog-walks', 'tr-open', 'zag-open', 'decl', 'of-potrzeba', 'of-transport', 'of-cofnij', 'sob-bede', 'zag-tekst', 'unlock-sheet', 'set-logout', 'set-update', 'set-sync', 'bell']);
const rola = { admin: () => true };
export const ustawRole = (fn) => { rola.admin = fn; };
const TYLKO_ADMIN = 'To może zrobić tylko administrator';
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const name = el.dataset.act, fn = actions[name];
  if (!fn) return;
  e.preventDefault();
  if (!rola.admin() && !VOL_ACTIONS.has(name)) { toast(TYLKO_ADMIN, true); return; }
  const blad = (err) => { if (err && err.name === 'TylkoAdmin') toast(TYLKO_ADMIN, true); else console.error(err); };
  try { const r = fn(el, e); if (r && typeof r.catch === 'function') r.catch(blad); } catch (err) { blad(err); } // wywołanie od razu (zdjęcia, udostępnianie wymagają dotyku)
});
addEventListener('unhandledrejection', (e) => { if (e.reason && e.reason.name === 'TylkoAdmin') { e.preventDefault(); toast(TYLKO_ADMIN, true); } });
export const brandBar = (dot = false, czat = true) => html`<header class="topbar">
  <button class="iconbtn" data-act="menu" aria-label="Menu">${icon('menu', 'big')}</button>
  <a class="brand" href="#/start" aria-label="ŁAPA — Nowodwór, ekran główny">
    <span style="font-size:36px;color:var(--gold-l);display:grid">${icon('paw')}</span>
    <span><span class="brand-word">ŁAPA</span><span class="brand-sub">NOWODWÓR</span></span>
  </a>
  <span style="display:flex">${czat ? html`<a class="iconbtn" href="#/czat" aria-label="Czat wolontariuszy">${icon('chat')}<span class="cbadge" hidden></span></a>` : ''}<button class="iconbtn" data-act="bell" aria-label="Komunikaty">${icon('bell')}${dot ? raw('<span class="dot"></span>') : ''}</button></span>
</header>`;
// Nagłówek ekranu: na głównych ekranach medalion z ikoną, tytuł i opcjonalnie podtytuł oraz zdjęcie psa po prawej;
// na podstronach przycisk „Wstecz” i tytuł.
// img: szeroki baner z psem po prawej (img/naglowki/*.webp) – leży pod nagłówkiem, przyciski stoją obok tytułu.
export const pageBar = (title, { back = true, right = '', ico = 'paw', sub = '', img = '' } = {}) => html`<header class="topbar hdr${back ? ' zback' : ''}${img ? ' hb' : ''}">
  ${img ? html`<img class="hban" src="${img}" alt="">` : ''}
  ${back ? html`<button class="iconbtn" data-act="back" aria-label="Wstecz">${icon('back')}</button>` : html`<span class="medal">${icon(ico)}</span>`}
  <div class="ht">${img && right ? html`<div class="htt"><h1>${title}</h1>${right}</div>` : html`<h1>${title}</h1>`}${sub ? html`<p>${sub}</p>` : ''}</div>
  ${right && !img ? html`<span class="hright">${right}</span>` : ''}
</header>`;
export const plusBtn = (act, label = 'Dodaj') => html`<button class="plusbtn" data-act="${act}" aria-label="${label}">${icon('plus')}</button>`;
actions.back = () => { if (history.length > 1) history.back(); else location.hash = '#/start'; };

// Podgląd do wydruku: pełnoekranowa nakładka z przyciskami (print() samo w PWA na telefonie bywa bez efektu)
