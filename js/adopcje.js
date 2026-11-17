// Domy tymczasowe i hoteliki (od 1.19): baza jak karta psa. Dane osobowe – tylko administrator (kolekcja p_dt).
// Każde pole dowolne (samo imię albo imię i nazwisko, pełny adres albo sama miejscowość). Do osoby można przypisać psy, które teraz u niej są.
import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet, plusBtn } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state } from './auth.js';
import { dogThumb, pickDog } from './screens-psy.js';
import { hydratePhotos } from './photos.js';

const tel = (t) => String(t || '').replace(/[^\d+]/g, '');
const lockPage = (title) => ({ tab: 'start', title, html: html`${pageBar(title)}<div class="pad"><div class="lockbox">${icon('lock')}<p style="margin:6px 0 10px"><b>Dane osobowe</b><br><span class="hint">Widzi je tylko administrator.</span></p><button class="btn sm" data-act="unlock-sheet">Odblokuj hasłem administratora</button></div></div>` });
const RODZ = { dt: 'Dom tymczasowy', hotelik: 'Hotelik' };
const adres = (p) => p.adres || p.miasto || '';
const pen = () => icon('pencil').s.replace('class="ico', 'class="ico kpen');
// U kogo jest pies (karta psa administratora)
export const uKogo = (osoby, dogId) => osoby.find((p) => (p.psy || []).includes(dogId)) || null;
export const RODZAJ = RODZ;

export async function dt() {
  if (!state.coordinator) return lockPage('Domy tymczasowe i hoteliki');
  const [people, dogs] = await Promise.all([list('p_dt'), list('psy')]); const byId = Object.fromEntries(dogs.map((d) => [d.id, d]));
  const rows = people.sort((a, b) => (a.imie || '').localeCompare(b.imie || '', 'pl'));
  const karta = (p) => { const ps = (p.psy || []).map((i) => byId[i]).filter(Boolean);
    return `<a class="card dtc" href="#/dt/${esc(p.id)}"><span class="rt"><b>${esc(p.imie || 'Bez nazwy')}</b><small>${esc([RODZ[p.rodzaj || 'dt'], adres(p)].filter(Boolean).join(' · '))}</small>${ps.length ? `<small class="dtpsy">Teraz: ${esc(ps.map((d) => d.imie).join(', '))}</small>` : ''}</span>${icon('chev').s}</a>`; };
  return {
    tab: 'start', title: 'Domy tymczasowe i hoteliki', live: true,
    html: html`${pageBar('Domy tymczasowe i hoteliki', { right: html`${plusBtn('dt-add', 'Dodaj')}` })}
    <div class="pad stack">${rows.length ? raw(rows.map(karta).join('')) : html`<p class="pusto">Nikogo jeszcze nie ma. Dodaj przyciskiem +.</p>`}</div>`
  };
}
const POLA = [['imie', 'Imię i nazwisko', 'np. Anna Kowalska albo Ania'], ['telefon', 'Telefon', 'np. 600 100 200'], ['adres', 'Adres', 'pełny adres albo sama miejscowość'], ['notatka', 'Notatka', 'np. przyjmuje małe psy, nie przyjmuje psów z kotami']];
export async function dtKarta(id) {
  if (!state.coordinator) return lockPage('Domy tymczasowe i hoteliki');
  const [p, dogs] = await Promise.all([get('p_dt', id), list('psy')]);
  if (!p) return { tab: 'start', html: html`${pageBar('Domy tymczasowe')}<div class="empty"><h3>Nie ma takiego wpisu</h3><a class="btn gold" href="#/dt">Wróć do listy</a></div>` };
  const byId = Object.fromEntries(dogs.map((d) => [d.id, d])), ps = (p.psy || []).map((i) => byId[i]).filter(Boolean);
  const wart = (k) => (k === 'adres' ? adres(p) : p[k] || '');
  const pola = POLA.map(([k, l]) => `<button type="button" class="kd ed" data-act="dt-edit" data-id="${esc(id)}" data-f="${k}"><span>${l}</span><b>${esc(wart(k)) || '<i>dodaj</i>'}</b>${pen()}</button>`).join('');
  return {
    tab: 'start', title: p.imie || 'Dom tymczasowy', live: true,
    html: html`${pageBar(p.imie || 'Dom tymczasowy')}<div class="pad komp">
      <div class="khead">${raw(Object.entries(RODZ).map(([k, l]) => `<button type="button" class="chip outline${(p.rodzaj || 'dt') === k ? ' on' : ''}" data-act="dt-rodzaj" data-id="${esc(id)}" data-k="${k}" aria-pressed="${(p.rodzaj || 'dt') === k}">${l}</button>`).join(''))}</div>
      <div class="kbox">${raw(pola)}</div>
      ${p.telefon ? html`<div class="btnrow" style="margin-top:10px"><a class="btn" href="tel:${tel(p.telefon)}">${icon('phone')} Zadzwoń</a><a class="btn ghost" href="sms:${tel(p.telefon)}">SMS</a></div>` : ''}
      <h2 class="kh">Psy, które są tu teraz</h2>
      <div class="kbox">${raw(ps.map((d) => `<div class="dtpies"><a href="#/psy/${esc(d.id)}"><span class="avatar sm">${dogThumb(d).s}</span><b>${esc(d.imie)}</b></a><button type="button" class="iconbtn" data-act="dt-pies-x" data-id="${esc(id)}" data-pies="${esc(d.id)}" aria-label="Pies już nie jest tutaj">${icon('x').s}</button></div>`).join(''))}
        ${ps.length ? '' : html`<p class="kpusto">Teraz żadnego psa.</p>`}<button type="button" class="kdodaj in" data-act="dt-pies" data-id="${id}">${icon('plus')} Dodaj psa</button></div>
      <button type="button" class="btn ghost block" style="margin-top:22px;color:var(--terra-d)" data-act="dt-usun" data-id="${id}">Usuń ten wpis</button>
    </div>`,
    mount(r) { hydratePhotos(r); }
  };
}
actions['dt-add'] = () => {
  openSheet(`<h2>Nowy dom tymczasowy lub hotelik</h2><form id="tf" novalidate>
    <div class="field"><label for="t_i">Imię i nazwisko (albo nazwa hoteliku)</label><input class="input" id="t_i" maxlength="80" autocomplete="off"></div>
    <div class="chips" id="t_r" style="margin-bottom:14px">${Object.entries(RODZ).map(([k, l], i) => `<button type="button" class="chip outline${i ? '' : ' on'}" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="err" id="t_x"></div><button class="btn block" type="submit">Dalej</button></form>`, (s) => {
    let rodzaj = 'dt'; const im = s.querySelector('#t_i'); im.focus();
    s.querySelector('#t_r').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; rodzaj = b.dataset.k; s.querySelectorAll('#t_r .chip').forEach((c) => c.classList.toggle('on', c === b)); });
    s.querySelector('#tf').addEventListener('submit', async (e) => {
      e.preventDefault(); const imie = im.value.trim(); if (!imie) { s.querySelector('#t_x').textContent = 'Wpisz imię albo nazwę.'; return; }
      const p = await save('p_dt', { imie, rodzaj, psy: [] }); closeSheet(); location.hash = '#/dt/' + p.id;
    });
  });
};
actions['dt-edit'] = async (el) => {
  const p = await get('p_dt', el.dataset.id), f = el.dataset.f; if (!p) return; const [, l, ph] = POLA.find((x) => x[0] === f) || [];
  const cur = f === 'adres' ? adres(p) : p[f] || '';
  openSheet(`<h2>${esc(l)}</h2><form id="tef" novalidate><div class="field">${f === 'notatka' ? `<textarea class="textarea" id="tev" maxlength="1000" placeholder="${esc(ph)}">${esc(cur)}</textarea>` : `<input class="input" id="tev" maxlength="120" placeholder="${esc(ph)}" value="${esc(cur)}" autocomplete="off"${f === 'telefon' ? ' type="tel"' : ''}>`}</div>
    <button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    const v = s.querySelector('#tev'); v.focus();
    s.querySelector('#tef').addEventListener('submit', async (e) => {
      e.preventDefault(); const n = { ...((await get('p_dt', p.id)) || p), [f]: v.value.trim() }; if (f === 'adres') delete n.miasto;
      await save('p_dt', n); closeSheet(); toast('Zapisane');
    });
  });
};
actions['dt-rodzaj'] = async (el) => { const p = await get('p_dt', el.dataset.id); if (p && p.rodzaj !== el.dataset.k) await save('p_dt', { ...p, rodzaj: el.dataset.k }); };
actions['dt-pies'] = async (el) => {
  const id = el.dataset.id;
  pickDog(async (d) => {
    const all = await list('p_dt');
    for (const o of all) if (o.id !== id && (o.psy || []).includes(d.id)) await save('p_dt', { ...o, psy: o.psy.filter((x) => x !== d.id) }); // pies może być tylko w jednym miejscu
    const p = await get('p_dt', id); if (!p) return; if (!(p.psy || []).includes(d.id)) await save('p_dt', { ...p, psy: [...(p.psy || []), d.id] }); toast(`Dodano: ${d.imie}`);
  });
};
actions['dt-pies-x'] = async (el) => { const p = await get('p_dt', el.dataset.id); if (!p) return; await save('p_dt', { ...p, psy: (p.psy || []).filter((x) => x !== el.dataset.pies) }); toast('Zapisane'); };
actions['dt-usun'] = async (el) => {
  if (!(await confirmSheet('Usunąć wpis?', 'Osoba zniknie z listy domów tymczasowych i hotelików.', 'Usuń', true))) return;
  await remove('p_dt', el.dataset.id); toast('Usunięto'); location.hash = '#/dt';
};
