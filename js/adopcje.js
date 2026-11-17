// Droga adopcji i domy tymczasowe: dane osobowe, tylko dla administratora (kolekcje p_*).
import { raw } from './ui-core.js';
import { wybCls, imieZnaki, boksPill } from './znak.js';
import { html, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet, plusBtn } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName } from './auth.js';
import { MS_DAY, fmtDate, uid } from './util.js';
import { aktywny, ustawLos } from './teczka.js';
import { dogThumb } from './screens-psy.js';
import { hydratePhotos } from './photos.js';

export const ETAPY = [
  ['kontakt', 'Kontakt'], ['rozmowa', 'Rozmowa'], ['poznanie', 'Poznanie z psem'], ['wizyta', 'Wizyta przedadopcyjna'],
  ['umowa', 'Umowa i kastracja'], ['wydanie', 'Wydanie psa'], ['po', 'Wizyta poadopcyjna'], ['koniec', 'Zakończone'], ['rez', 'Rezygnacja']
];
const ETAP = Object.fromEntries(ETAPY);
const ORDER = ETAPY.map((e) => e[0]);
const AKTYWNE = ['kontakt', 'rozmowa', 'poznanie', 'wizyta', 'umowa', 'wydanie', 'po'];
const STARE = { Zainteresowanie: 'kontakt', Rozmowa: 'rozmowa', 'Spotkanie z psem': 'poznanie', 'Wizyta przedadopcyjna': 'wizyta', Adopcja: 'wydanie', Rezygnacja: 'rez' };
const etapOf = (a) => a.etap || STARE[a.status] || 'kontakt';
const SEL = (id, label, opts, val) => `<div class="field"><label for="${id}">${label}</label><select class="select" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
const d10 = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const tel = (t) => String(t || '').replace(/[^\d+]/g, '');
const lockPage = (title) => ({ tab: 'start', title, html: html`${pageBar(title)}<div class="pad"><div class="lockbox">${icon('lock')}<p style="margin:6px 0 10px"><b>Dane osobowe</b><br><span class="hint">Widzi je tylko administrator.</span></p><button class="btn sm" data-act="unlock-sheet">Odblokuj hasłem administratora</button></div></div>` });

// ===== Adopcje (od 1.17): prosto. Lista psów w procesie adopcji; o statusie psa decyduje wyłącznie administrator. =====
// Pies trafia tu, gdy administrator wybierze „W procesie adopcji” (karta psa → Zmień status) albo gdy tak jest na stronie schroniska.
// Stąd: „Adoptowany” (filtr Adoptowane w Psy) albo „Wraca do schroniska” (znów na liście Psy). Dane osoby adoptującej – opcjonalnie.
const osobyDla = (osoby, id) => osoby.filter((o) => o.pies_id === id).sort((a, b) => (b.ts || 0) - (a.ts || 0));
const osobaHtml = (o) => `<div class="adosoba">Adoptuje: <b>${esc(o.imie || '')}</b>${o.telefon ? ` · <a class="kontakt" href="tel:${esc(tel(o.telefon))}">${esc(o.telefon)}</a>` : ''}${o.notatka ? `<br><span class="hint">${esc(o.notatka)}</span>` : ''}</div>`;
export async function adopcje() {
  if (!state.admin) return lockPage('Adopcje');
  const [dogs, osoby] = await Promise.all([list('psy'), list('p_adopcje')]);
  const w = dogs.filter((d) => d.status === 'w_trakcie').sort((a, b) => (b.w_trakcie_od || 0) - (a.w_trakcie_od || 0));
  const nAdopt = dogs.filter((d) => !aktywny(d)).length;
  return {
    tab: 'start', title: 'Adopcje', live: true,
    html: html`${pageBar('Adopcje')}<div class="pad stack">
      <p class="hint" style="color:var(--sage);margin:0">Psy w procesie adopcji. Wolontariusze ich nie widzą; w Bramie są oznaczone i można je wydać na spacer.</p>
      ${w.length ? raw(w.map((d) => { const o = osobyDla(osoby, d.id)[0]; return `<div class="card adcard"><span class="avatar">${dogThumb(d).s}</span><div><h3>${esc(d.imie)} ${boksPill(d, 'in')}</h3>
          <div class="hint">w procesie adopcji${d.w_trakcie_od ? ' od ' + esc(fmtDate(d.w_trakcie_od)) : ''}</div>${o ? osobaHtml(o) : ''}</div>
          <div class="btnrow"><button class="btn" data-act="ad-adoptowany" data-id="${esc(d.id)}">${icon('check').s} Adoptowany</button><button class="btn ghost" data-act="ad-wraca" data-id="${esc(d.id)}">Wraca do schroniska</button></div>
          <div class="btnrow" style="grid-column:1/-1;margin-top:6px"><button class="btn ghost sm" data-act="ad-osoba" data-id="${esc(d.id)}">${icon('user').s} ${o ? 'Zmień dane osoby' : 'Kto adoptuje (opcjonalnie)'}</button><a class="btn ghost sm" href="#/psy/${esc(d.id)}">Karta psa</a></div></div>`; }).join(''))
        : html`<div class="empty">${icon('heart')}<h3>Nie ma psów w procesie adopcji</h3><p>Na karcie psa dotknij „Status” i wybierz „W procesie adopcji”.</p></div>`}
      <a class="card" href="#/adoptowane" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--graphite)">${icon('heart')}<span style="flex:1"><b>Adoptowane: ${nAdopt}</b><br><span class="hint">Lista Psy, filtr „Adoptowane”</span></span>${icon('chev')}</a></div>`,
    mount(root) { hydratePhotos(root); }
  };
}
actions['ad-adoptowany'] = async (el) => {
  const d = await get('psy', el.dataset.id); if (!d) return;
  if (!(await confirmSheet(`${d.imie} adoptowany?`, 'Pies przejdzie do „Adoptowanych” (lista Psy, filtr Adoptowane).', 'Tak, adoptowany'))) return;
  await save('psy', ustawLos(d, 'adoptowany')); toast(`${d.imie}: adoptowany. Brawo!`);
};
actions['ad-wraca'] = async (el) => {
  const d = await get('psy', el.dataset.id); if (!d) return;
  if (!(await confirmSheet(`${d.imie} wraca do schroniska?`, 'Adopcja nie doszła do skutku. Pies będzie znów na liście Psy, widoczny dla wolontariuszy.', 'Wraca do schroniska'))) return;
  await save('psy', ustawLos(d, 'dostepny')); toast(`${d.imie} jest znów na liście Psy`);
};
actions['ad-osoba'] = async (el) => {
  const id = el.dataset.id, d = await get('psy', id); if (!d) return;
  const o = osobyDla(await list('p_adopcje'), id)[0] || {};
  openSheet(`<h2>Kto adoptuje: ${esc(d.imie)}</h2><p class="hint" style="margin:0 0 12px">Opcjonalnie. Widzi to tylko administrator.</p><form id="af" novalidate>
    <div class="field"><label for="a_i">Imię i nazwisko</label><input class="input" id="a_i" maxlength="80" value="${esc(o.imie || '')}"></div>
    <div class="field"><label for="a_t">Telefon</label><input class="input" id="a_t" type="tel" maxlength="30" value="${esc(o.telefon || '')}"></div>
    <div class="field"><label for="a_n">Notatka</label><textarea class="textarea" id="a_n" maxlength="800" placeholder="np. dom z ogrodem, umówiona wizyta w sobotę">${esc(o.notatka || '')}</textarea></div>
    <button class="btn block" type="submit">Zapisz</button>${o.id ? '<button type="button" class="btn ghost block" style="margin-top:8px;color:var(--terra-d)" id="a_x">Usuń dane osoby</button>' : ''}</form>`, (s) => {
    s.querySelector('#af').addEventListener('submit', async (e) => {
      e.preventDefault(); const imie = s.querySelector('#a_i').value.trim();
      await save('p_adopcje', { ...o, id: o.id || 'a' + uid(), pies_id: id, imie, telefon: s.querySelector('#a_t').value.trim(), notatka: s.querySelector('#a_n').value.trim(), ts: Date.now(), autor: getName() });
      closeSheet(); toast('Zapisane');
    });
    s.querySelector('#a_x')?.addEventListener('click', async () => { await remove('p_adopcje', o.id); closeSheet(); toast('Usunięto'); });
  });
};
// Na karcie psa (administrator): osoba adoptująca, gdy pies jest w procesie adopcji albo adoptowany
export async function dogBlock(dogId) {
  const d = await get('psy', dogId); if (!d || !['w_trakcie', 'adoptowany'].includes(d.status)) return null;
  const o = osobyDla(await list('p_adopcje'), dogId)[0];
  return html`<div class="sec"><h2>Adopcja</h2></div>${o ? raw(osobaHtml(o)) : ''}<button class="btn ghost block sm" style="margin-top:10px" data-act="ad-osoba" data-id="${dogId}">${icon('user')} ${o ? 'Zmień dane osoby adoptującej' : 'Kto adoptuje (opcjonalnie)'}</button>`;
}
export async function zalegle() { return 0; } // dawne „zaległe kroki adopcji” – od 1.17 adopcja nie ma etapów

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
