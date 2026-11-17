import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet } from './ui.js';
import { save, get, remove } from './store.js';
import { state } from './auth.js';
import { fmtDate, fmtTime, minutesText } from './util.js';
import { dogThumb } from './screens-psy.js';
import { hydratePhotos } from './photos.js';
import { boksPill, wybCls, linie } from './znak.js';



const GROUPS = [
  ['nastroj', 'Nastrój psa', ['spokojny', 'radosny', 'niepewny', 'zestresowany', 'inny / nie określono']],
  ['aktywnosc', 'Aktywność', ['niska', 'umiarkowana', 'wysoka', 'nie oceniono']],
  ['smycz', 'Zachowanie na smyczy', ['bez problemów', 'ciągnięcie', 'trudności', 'nie oceniono']],
  ['ludzie', 'Kontakty z ludźmi', ['pozytywne', 'neutralne', 'trudne', 'nie wystąpiły / nie testowano']],
  ['psy', 'Kontakty z psami', ['pozytywne', 'neutralne', 'trudne', 'nie wystąpiły / nie testowano']],
  ['apetyt', 'Apetyt i nagrody', ['przyjmował', 'odmawiał', 'nie dotyczy', 'nie sprawdzono']]
];

// Raport spaceru (otwierany z historii spacerów psa). Od 1.19 nie ma osobnego „spaceru z wolontariuszem”: spacery wydaje Brama.
export async function report(id) {
  const w = await get('spacery', id);
  if (!w) return { tab: 'start', nav: false, html: html`${pageBar('Raport')}<div class="empty"><h3>Nie ma takiego raportu</h3></div>` };
  const d = await get('psy', w.pies_id);
  const tags = GROUPS.filter(([k]) => w[k]).map(([k, l]) => html`<span class="chip">${l}: ${w[k]}</span>`);
  return {
    tab: 'start', nav: false, title: 'Raport ze spaceru',
    html: html`${pageBar('Raport ze spaceru')}<div class="pad"><section class="card" style="padding:18px">
      <div style="display:flex;gap:14px;align-items:center"><span class="avatar sm${d ? wybCls(d) : ''}">${d ? dogThumb(d) : html`<div class="nophoto">${icon('paw')}</div>`}</span>
        <div><h2 style="font-size:26px;color:var(--graphite)">${w.pies_imie} ${d ? raw(boksPill(d, 'in')) : ''}</h2>${d ? raw(linie(d)) : ''}<div class="sub">Spacer · ${fmtDate(w.start)} · ${w.autor || ''}</div></div></div>
      <ul class="tl" style="margin-top:14px">${(w.os_czasu || []).map((e) => html`<li><span class="dotp"></span><span class="tm">${fmtTime(e.t)}</span><span>${e.txt}</span></li>`)}</ul>
      <div class="stats">${w.dystans_km ? html`<div class="stat">${icon('route')}<div><small>Dystans</small><b>${w.dystans_km.toFixed(1).replace('.', ',') + ' km'}</b></div></div>` : ''}
        <div class="stat">${icon('clock')}<div><small>Czas</small><b>${!w.end && w.tryb === 'brama' ? 'trwa' : minutesText(w.czas_min || (w.end ? (w.end - w.start) / 60000 : 0))}</b></div></div></div>
      ${tags.length ? html`<div class="chips" style="margin-bottom:14px">${tags}</div>` : ''}
      <h3 style="font-size:18px;margin:6px 0 8px;display:flex;justify-content:space-between">Notatka ze spaceru ${state.admin ? html`<button class="iconbtn" style="width:32px;height:32px;color:var(--green)" data-act="rep-note" data-id="${id}" aria-label="Edytuj notatkę">${icon('pencil')}</button>` : ''}</h3>
      <div class="notebox">${w.notatka || 'Bez notatki.'}</div>
      ${(w.zdjecia || []).length ? html`<h3 style="font-size:18px;margin:16px 0 8px">Zdjęcia (${w.zdjecia.length})</h3><div class="thumbs">${w.zdjecia.map((p) => html`<div class="thumb"><img data-photo="${p}" alt="Zdjęcie ze spaceru" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>`)}</div>` : ''}
      ${w.osoba || w.kontakt ? html`<p class="sub" style="margin:8px 0">Kto szedł: ${[w.osoba, w.kontakt].filter(Boolean).join(' · ')}</p>` : ''}${(w.tagi || []).length ? html`<div class="chips" style="margin-bottom:10px">${w.tagi.map((t) => html`<span class="chip">${t}</span>`)}</div>` : ''}
      <a class="btn block" style="margin-top:20px" href="#/psy/${w.pies_id}">${state.admin ? icon('check') : icon('back')} ${state.admin ? 'Gotowe' : 'Wróć do psa'}</a>
      ${state.admin ? html`<button class="btn ghost block" style="margin-top:10px;color:var(--terra-d)" data-act="rep-del" data-id="${id}">Usuń ten spacer (pomyłka)</button>` : ''}</section></div>`,
    mount(root) { hydratePhotos(root); }
  };
}
actions['rep-del'] = async (el) => {
  const w = await get('spacery', el.dataset.id); if (!w) return;
  if (await confirmSheet('Usunąć spacer?', `Spacer psa ${w.pies_imie} zniknie z historii u wszystkich wolontariuszy.`, 'Usuń', true)) { await remove('spacery', w.id); toast('Usunięto'); location.hash = '#/psy/' + w.pies_id; }
};
actions['rep-note'] = async (el) => {
  const w = await get('spacery', el.dataset.id);
  openSheet(`<h2>Notatka ze spaceru</h2><form id="en"><div class="field"><textarea class="textarea" id="et" maxlength="1500">${esc(w.notatka || '')}</textarea></div><button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    s.querySelector('#en').addEventListener('submit', async (e) => { e.preventDefault(); w.notatka = s.querySelector('#et').value.trim(); await save('spacery', w); closeSheet(); toast('Zapisane'); dispatchEvent(new HashChangeEvent('hashchange')); });
  });
};
