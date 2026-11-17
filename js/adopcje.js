// Domy tymczasowe: dane osobowe, tylko dla administratora (kolekcja p_dt).
import { raw } from './ui-core.js';
import { wybCls, imieZnaki, boksPill } from './znak.js';
import { html, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet, plusBtn } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName } from './auth.js';
import { MS_DAY, fmtDate, uid } from './util.js';
import { dogThumb } from './screens-psy.js';
import { hydratePhotos } from './photos.js';

const SEL = (id, label, opts, val) => `<div class="field"><label for="${id}">${label}</label><select class="select" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
const d10 = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const tel = (t) => String(t || '').replace(/[^\d+]/g, '');
const lockPage = (title) => ({ tab: 'start', title, html: html`${pageBar(title)}<div class="pad"><div class="lockbox">${icon('lock')}<p style="margin:6px 0 10px"><b>Dane osobowe</b><br><span class="hint">Widzi je tylko administrator.</span></p><button class="btn sm" data-act="unlock-sheet">Odblokuj hasłem administratora</button></div></div>` });

// ===== Domy tymczasowe =====
const UMIE = [['szczeniaki', 'Szczenięta'], ['chore', 'Chore / po zabiegach'], ['behawioralne', 'Psy z problemami'], ['duze', 'Duże psy'], ['seniorzy', 'Seniorzy'], ['koty', 'Ma koty'], ['dzieci', 'Ma dzieci'], ['ogrod', 'Ogród']];
export async function dt() {
  if (!state.coordinator) return lockPage('Domy tymczasowe');
  const [people, dogs] = await Promise.all([list('p_dt'), list('psy', { archiwum: true })]);
  const living = (p) => dogs.filter((d) => d.miejsce === 'dt' && (d.opiekun || '').trim().toLowerCase() === p.imie.trim().toLowerCase());
  const rows = people.sort((a, b) => (a.imie || '').localeCompare(b.imie || '', 'pl'));
  return {
    tab: 'start', title: 'Domy tymczasowe', live: true,
    html: html`${pageBar('Domy tymczasowe', { right: html`${plusBtn('dt-add', 'Dodaj')}` })}
    <div class="pad stack"><p class="hint" style="color:var(--sage);margin:0">Pies jest przypisany do opiekuna, gdy w jego karcie wybierzesz miejsce „W domu tymczasowym” i wpiszesz to samo imię opiekuna.</p>
    ${rows.length ? rows.map((p) => { const l = living(p), free = Math.max(0, (+p.pojemnosc || 1) - l.length); return html`<div class="card"><button class="rowbtn" data-act="dt-open" data-id="${p.id}" style="width:100%;text-align:left;background:none;border:0;padding:0"><b>${p.imie}</b> <span class="chip ${free && p.dostepny !== false ? '' : 'outline'}">${p.dostepny === false ? 'Niedostępny' : free ? 'Wolne miejsca: ' + free : 'Komplet'}</span>
      <div class="hint">${[p.miasto, (p.umie || []).map((k) => (UMIE.find((x) => x[0] === k) || [])[1]).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div>
      ${l.length ? html`<div class="hint">Ma teraz: ${raw(l.map((d) => imieZnaki(d)).join(', '))}</div>` : ''}</button></div>`; })
      : html`<div class="empty">${icon('heart')}<h3>Brak opiekunów</h3><p>Dodaj osoby, które przyjmują psy do domu tymczasowego.</p></div>`}</div>`
  };
}
actions['dt-add'] = () => dtForm({});
actions['dt-open'] = async (el) => {
  const p = await get('p_dt', el.dataset.id); if (!p) return;
  openSheet(`<h2>${esc(p.imie)}</h2><p class="sub">${esc(p.miasto || '')} · pojemność: ${esc(String(p.pojemnosc || 1))}</p>${p.notatka ? `<div class="notebox">${esc(p.notatka)}</div>` : ''}
    ${p.telefon ? `<div class="btnrow" style="margin-top:10px"><a class="btn" href="tel:${esc(tel(p.telefon))}">Zadzwoń</a><a class="btn ghost" href="sms:${esc(tel(p.telefon))}">SMS</a></div>` : ''}
    <div class="btnrow" style="margin-top:10px"><button class="btn ghost" id="de">Edytuj</button><button class="btn ghost" style="color:var(--terra-d)" id="dx">Usuń</button></div>`, (s) => {
    s.querySelector('#de').onclick = () => { closeSheet(); dtForm(p); };
    s.querySelector('#dx').onclick = async () => { if (await confirmSheet('Usunąć?', 'Opiekun zniknie z listy.', 'Usuń', true)) { await remove('p_dt', p.id); toast('Usunięto'); } };
  });
};
function dtForm(p) {
  const cur = new Set(p.umie || []);
  openSheet(`<h2>${p.id ? 'Edytuj opiekuna' : 'Nowy opiekun domu tymczasowego'}</h2><form id="tf" novalidate>
    <div class="field"><label for="t_i">Imię i nazwisko</label><input class="input" id="t_i" maxlength="80" value="${esc(p.imie || '')}"></div>
    <div class="field"><label for="t_t">Telefon</label><input class="input" id="t_t" type="tel" maxlength="30" value="${esc(p.telefon || '')}"></div>
    <div class="field"><label for="t_m">Miejscowość</label><input class="input" id="t_m" maxlength="60" value="${esc(p.miasto || '')}"></div>
    <div class="field"><label for="t_c">Ile psów naraz</label><input class="input" id="t_c" type="number" min="1" max="10" value="${esc(String(p.pojemnosc || 1))}"></div>
    <div class="field"><label>Co potrafi</label><div class="chips" id="t_u">${UMIE.map(([k, l]) => `<button type="button" class="chip outline ${cur.has(k) ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div></div>
    <label class="check"><input type="checkbox" id="t_d" ${p.dostepny === false ? '' : 'checked'}> Teraz dostępny</label>
    <div class="field"><label for="t_n">Notatka</label><textarea class="textarea" id="t_n" maxlength="600">${esc(p.notatka || '')}</textarea></div><div class="err" id="t_x"></div>
    <button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    s.querySelector('#t_u').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) b.classList.toggle('on'); });
    s.querySelector('#tf').addEventListener('submit', async (e) => {
      e.preventDefault(); const imie = s.querySelector('#t_i').value.trim(); if (!imie) { s.querySelector('#t_x').textContent = 'Wpisz imię.'; return; }
      await save('p_dt', { ...p, imie, telefon: s.querySelector('#t_t').value.trim(), miasto: s.querySelector('#t_m').value.trim(), pojemnosc: Math.max(1, +s.querySelector('#t_c').value || 1), umie: [...s.querySelectorAll('#t_u .on')].map((b) => b.dataset.k), dostepny: s.querySelector('#t_d').checked, notatka: s.querySelector('#t_n').value.trim() });
      closeSheet(); toast('Zapisane');
    });
  });
}
