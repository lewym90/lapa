import { html, raw, esc, safeUrl } from './ui-core.js';
import { icon } from './icons.js';
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
  root.innerHTML = `<div class="scrim" data-sheet-close></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${content}</div>`;
  const sheet = root.querySelector('.sheet');
  root.querySelector('.scrim').addEventListener('click', closeSheet);
  const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
  document.addEventListener('keydown', onKey);
  sheetClose = () => document.removeEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  onMount?.(sheet);
  return sheet;
}
export function closeSheet() {
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
export function dogImg(url, alt = '', cls = '') {
  const u = safeUrl(url);
  if (!u) return html`<div class="nophoto ${cls}">${icon('paw')}</div>`;
  return raw(`<img class="${esc(cls)}" src="${esc(u)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-ph>`);
}
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.hasAttribute('data-ph')) {
    const d = document.createElement('div'); d.className = 'nophoto ' + (t.className || '');
    d.innerHTML = icon('paw').s; t.replaceWith(d);
  }
}, true);

export const sexSymbol = (s) => (s === 'suka' ? '♀' : s === 'samiec' ? '♂' : '');
export const STATUS = {
  do_adopcji: 'Do adopcji', pilne: 'Pilny przypadek', dt: 'W domu tymczasowym', hotelik: 'W hoteliku',
  w_trakcie: 'W trakcie adopcji', adoptowany: 'Adoptowany', schronisko: 'W schronisku'
};
export const statusChip = (s) => {
  const cls = s === 'pilne' ? 'terra' : s === 'adoptowany' ? 'gold' : '';
  return html`<span class="chip ${cls}">${STATUS[s] || 'W schronisku'}</span>`;
};

// ===== wspólne elementy układu =====
export const actions = {};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
export const brandBar = (dot = false) => html`<header class="topbar">
  <button class="iconbtn" data-act="menu" aria-label="Menu">${icon('menu', 'big')}</button>
  <a class="brand" href="#/start" aria-label="ŁAPA — Nowodwór, ekran główny">
    <span style="font-size:36px;color:var(--gold-l);display:grid">${icon('paw')}</span>
    <span><span class="brand-word">ŁAPA</span><span class="brand-sub">NOWODWÓR</span></span>
  </a>
  <span style="display:flex"><button class="iconbtn" data-act="bell" aria-label="Komunikaty">${icon('bell')}${dot ? raw('<span class="dot"></span>') : ''}</button>
  <a class="iconbtn" href="#/ustawienia" aria-label="Ustawienia i profil">${icon('user')}</a></span>
</header>`;
export const pageBar = (title, { back = true, right = '' } = {}) => html`<header class="topbar">
  ${back ? html`<button class="iconbtn" data-act="back" aria-label="Wstecz">${icon('back')}</button>` : html`<span style="width:44px"></span>`}
  <h1 style="font-size:22px;font-weight:500;text-align:center;flex:1;padding:0 6px">${title}</h1>
  <span style="min-width:44px;display:flex;justify-content:flex-end">${right}</span>
</header>`;
actions.back = () => { if (history.length > 1) history.back(); else location.hash = '#/start'; };
