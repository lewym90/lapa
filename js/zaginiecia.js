// Zaginione psy (od 1.19): baza jak karta psa. Lista → karta zaginięcia z polami (ołówek dla administratora),
// aktualizacjami z datą, gotowym tekstem do skopiowania i „Znaleziony”. Bez plakatu. Zaginięcie nie zmienia miejsca psa (to jest ze strony).
import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet, plusBtn } from './ui.js';
import { list, save, remove, get } from './store.js';
import { getName, state } from './auth.js';
import { parseData, dataTs } from './util.js';
import { dogThumb } from './screens-psy.js';
import { hydratePhotos } from './photos.js';

const KONTAKT_DOM = '601 990 017, 667 119 073';
export const aktywne = (z) => z.status !== 'znaleziony';
const kiedyTxt = (z) => z.kiedy_txt || (z.kiedy ? dataTs(z.kiedy) : '');
const pen = () => icon('pencil').s.replace('class="ico', 'class="ico kpen');

export function postZ(z) {
  const upd = (z.akt || []).map((a) => `EDIT: ${dataTs(a.ts)} ${a.text}`).reverse().join('\n');
  return `${upd ? upd + '\n\n' : ''}🆘 SZUKAMY ${String(z.imie || '').toUpperCase()} 🆘\n🔴 Zaginął(a)${z.gdzie ? ' w miejscowości ' + z.gdzie : ''}${kiedyTxt(z) ? ', ' + kiedyTxt(z) : ''}.${z.ostatnio ? ' Ostatnio widziany(a): ' + z.ostatnio + '.' : ''}\n💚 ${z.opis || 'Szczegóły wyglądu w komentarzu.'}\n🐶 ${z.rada || 'Nie goń. Spróbuj zwabić jedzeniem na ogrodzony teren, zrób zdjęcie i zadzwoń.'}\n☎️ ${z.kontakt || KONTAKT_DOM}`;
}

export async function zaginiecia() {
  const [zs, dogs] = await Promise.all([list('zaginiecia'), list('psy')]); const byId = Object.fromEntries(dogs.map((d) => [d.id, d]));
  const a = zs.filter(aktywne).sort((x, y) => (y.kiedy || 0) - (x.kiedy || 0)), f = zs.filter((z) => !aktywne(z)).sort((x, y) => (y.znaleziony_ts || 0) - (x.znaleziony_ts || 0));
  const card = (z) => { const d = byId[z.pies_id]; return `<a class="card dtc" href="#/zaginiecia/${esc(z.id)}"><span class="avatar sm">${d ? dogThumb(d).s : `<div class="nophoto">${icon('paw').s}</div>`}</span><span class="rt"><b>${esc(z.imie || '')}</b><small>${esc([kiedyTxt(z), z.gdzie].filter(Boolean).join(' · '))}</small></span><span class="kbadge${aktywne(z) ? ' szuk' : ''}">${aktywne(z) ? 'Szukamy' : 'Znaleziony'}</span></a>`; };
  return {
    tab: 'start', title: 'Zaginięcia', live: true,
    html: html`${pageBar(state.admin ? 'Zaginięcia' : 'Zaginione psy', { img: 'img/naglowki/zaginiecia.webp', right: state.admin ? html`${plusBtn('zag-new', 'Zgłoś zaginięcie')}` : '' })}
    <div class="pad stack">${a.length ? raw(a.map(card).join('')) : html`<p class="pusto">Nikt nie jest teraz poszukiwany.</p>`}
    ${f.length ? html`<h3 style="color:var(--sage);margin:16px 0 0;font-size:17px">Odnalezione</h3>${raw(f.slice(0, 15).map(card).join(''))}` : ''}</div>`,
    mount(r) { hydratePhotos(r); }
  };
}

const POLA = [['kiedy', 'Kiedy zaginął'], ['gdzie', 'Gdzie (miejscowość)'], ['ostatnio', 'Ostatnio widziany'], ['opis', 'Wygląd i znaki'], ['kontakt', 'Kontakt w tej sprawie']];
export async function karta(id) {
  const z = await get('zaginiecia', id);
  if (!z) return { tab: 'start', html: html`${pageBar('Zaginięcie')}<div class="empty"><h3>Nie ma takiego zgłoszenia</h3><a class="btn gold" href="#/zaginiecia">Wróć do listy</a></div>` };
  const d = z.pies_id ? await get('psy', z.pies_id) : null, adm = state.admin;
  const wart = (k) => (k === 'kiedy' ? kiedyTxt(z) : k === 'kontakt' ? z.kontakt || KONTAKT_DOM : z[k] || '');
  const pola = POLA.map(([k, l]) => (adm ? `<button type="button" class="kd ed${wart(k).length > 40 ? ' blok' : ''}" data-act="zag-edit" data-id="${esc(id)}" data-f="${k}"><span>${l}</span><b>${esc(wart(k)) || '<i>dodaj</i>'}</b>${pen()}</button>`
    : wart(k) ? `<div class="kd${wart(k).length > 40 ? ' blok' : ''}"><span>${l}</span><b>${esc(wart(k))}</b></div>` : '')).join('');
  const akt = [...(z.akt || [])].sort((a, b) => b.ts - a.ts);
  return {
    tab: 'start', title: z.imie, live: true,
    html: html`${pageBar(z.imie || 'Zaginięcie', { img: 'img/naglowki/zaginiecia.webp' })}<div class="pad komp">
      <div class="khead">${d ? html`<a class="avatar sm" href="#/psy/${d.id}" aria-label="Karta psa: ${d.imie}">${dogThumb(d)}</a>` : ''}<span class="kbadge${aktywne(z) ? ' szuk' : ''}">${aktywne(z) ? 'Szukamy' : 'Znaleziony'}</span></div>
      <div class="kbox">${raw(pola)}</div>
      <h2 class="kh">Aktualizacje</h2>
      <div class="kbox knotki">${akt.length ? raw(akt.map((a) => `<div class="obs"><div class="oh"><span>${esc(a.autor || '')}</span><span>${esc(dataTs(a.ts))}</span></div><div style="white-space:pre-line">${esc(a.text)}</div></div>`).join('')) : html`<p class="kpusto">Brak aktualizacji.</p>`}
        ${adm && aktywne(z) ? html`<button type="button" class="kdodaj in" data-act="zag-akt" data-id="${id}">${icon('plus')} Dodaj aktualizację</button>` : ''}</div>
      <button type="button" class="btn block" style="margin-top:18px" data-act="zag-tekst" data-id="${id}">${icon('share')} Gotowy tekst do skopiowania</button>
      ${adm ? html`${aktywne(z) ? html`<button type="button" class="btn gold block" style="margin-top:10px" data-act="zag-znal" data-id="${id}">Znaleziony! 🎉</button>` : html`<button type="button" class="btn ghost block" style="margin-top:10px" data-act="zag-znal" data-id="${id}">Jednak szukamy dalej</button>`}
        <button type="button" class="btn ghost block" style="margin-top:10px;color:var(--terra-d)" data-act="zag-usun" data-id="${id}">Usuń zgłoszenie</button>` : ''}
    </div>`,
    mount(r) { hydratePhotos(r); }
  };
}

// nowe zgłoszenie: tylko imię (albo pies z listy), resztę uzupełnia się w karcie
actions['zag-new'] = async () => {
  const dogs = (await list('psy')).sort((x, y) => (x.imie || '').localeCompare(y.imie || '', 'pl'));
  openSheet(`<h2>Zaginął pies</h2><form id="zf" novalidate>
    <div class="field"><label for="z_i">Imię psa</label><input class="input" id="z_i" maxlength="40" autocomplete="off"></div>
    <div class="field"><label for="z_p">Pies z aplikacji (opcjonalnie)</label><select class="select" id="z_p"><option value="">—</option>${dogs.map((d) => `<option value="${esc(d.id)}">${esc(d.imie)}</option>`).join('')}</select></div>
    <div class="err" id="z_x"></div><button class="btn block" type="submit">Dalej</button></form>`, (s) => {
    const sel = s.querySelector('#z_p'), im = s.querySelector('#z_i'); im.focus();
    sel.onchange = () => { const d = dogs.find((x) => x.id === sel.value); if (d) im.value = d.imie; };
    s.querySelector('#zf').addEventListener('submit', async (e) => {
      e.preventDefault(); const imie = im.value.trim(); if (!imie) { s.querySelector('#z_x').textContent = 'Wpisz imię.'; return; }
      const z = await save('zaginiecia', { imie, pies_id: sel.value || null, kiedy: Date.now(), kiedy_txt: dataTs(Date.now()), status: 'poszukiwany', akt: [], kontakt: KONTAKT_DOM, autor: getName() });
      closeSheet(); location.hash = '#/zaginiecia/' + z.id;
    });
  });
};
actions['zag-edit'] = async (el) => {
  const z = await get('zaginiecia', el.dataset.id), f = el.dataset.f; if (!z) return;
  const [, l] = POLA.find((x) => x[0] === f) || []; const ta = f === 'opis' || f === 'ostatnio';
  const cur = f === 'kiedy' ? kiedyTxt(z) : f === 'kontakt' ? z.kontakt || KONTAKT_DOM : z[f] || '';
  openSheet(`<h2>${esc(l)}</h2><form id="zef" novalidate><div class="field">${ta ? `<textarea class="textarea" id="zev" maxlength="500">${esc(cur)}</textarea>` : `<input class="input" id="zev" maxlength="120" autocomplete="off" value="${esc(cur)}"${f === 'kiedy' ? ' placeholder="np. 12.11.2026"' : ''}>`}</div>
    <div class="err" id="zee"></div><button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    const v = s.querySelector('#zev'); v.focus();
    s.querySelector('#zef').addEventListener('submit', async (e) => {
      e.preventDefault(); const val = v.value.trim(), n = { ...((await get('zaginiecia', z.id)) || z) };
      if (f === 'kiedy') { if (val) { const r = parseData(val); if (!r) { s.querySelector('#zee').textContent = 'Nie rozumiem tej daty. Wpisz np. 12.11.2026.'; return; } n.kiedy = r.ts; n.kiedy_txt = r.txt; } }
      else n[f] = val;
      await save('zaginiecia', n); closeSheet(); toast('Zapisane');
    });
  });
};
actions['zag-akt'] = async (el) => {
  const z = await get('zaginiecia', el.dataset.id); if (!z) return;
  openSheet(`<h2>Aktualizacja</h2><form id="zaf" novalidate><div class="field"><textarea class="textarea" id="zav" maxlength="300" placeholder="np. widziany w Wólce przy sklepie"></textarea></div><button class="btn block" type="submit">Dodaj</button></form>`, (s) => {
    const v = s.querySelector('#zav'); v.focus();
    s.querySelector('#zaf').addEventListener('submit', async (e) => {
      e.preventDefault(); const t = v.value.trim(); if (!t) return;
      const n = (await get('zaginiecia', z.id)) || z; await save('zaginiecia', { ...n, akt: [...(n.akt || []), { ts: Date.now(), text: t, autor: getName() }] }); closeSheet(); toast('Dodano');
    });
  });
};
actions['zag-tekst'] = async (el) => {
  const z = await get('zaginiecia', el.dataset.id); if (!z) return;
  openSheet(`<h2>Gotowy tekst</h2><p class="hint" style="margin:0 0 10px">Aplikacja niczego nie publikuje. Skopiuj i wklej tam, gdzie chcesz.</p><div class="field"><textarea class="textarea" data-nodraft id="z_pt" style="min-height:220px"></textarea></div>
    <div class="btnrow"><button class="btn" id="z_c">Kopiuj</button><button class="btn ghost" id="z_s">Wyślij…</button></div>`, (s) => {
    const t = s.querySelector('#z_pt'); t.value = postZ(z);
    s.querySelector('#z_c').onclick = async () => { try { await navigator.clipboard.writeText(t.value); toast('Skopiowano'); } catch { t.select(); toast('Zaznaczone, skopiuj ręcznie', true); } };
    s.querySelector('#z_s').onclick = async () => { if (navigator.share) { try { await navigator.share({ text: t.value }); } catch { /* */ } } else { try { await navigator.clipboard.writeText(t.value); toast('Skopiowano'); } catch { /* */ } } };
  });
};
actions['zag-znal'] = async (el) => {
  const z = await get('zaginiecia', el.dataset.id); if (!z) return;
  if (aktywne(z)) { await save('zaginiecia', { ...z, status: 'znaleziony', znaleziony_ts: Date.now() }); toast('Super wiadomość! Zapisane'); }
  else { await save('zaginiecia', { ...z, status: 'poszukiwany' }); toast('Szukamy dalej'); }
};
actions['zag-usun'] = async (el) => {
  if (!(await confirmSheet('Usunąć zgłoszenie?', 'Zniknie u wszystkich.', 'Usuń', true))) return;
  await remove('zaginiecia', el.dataset.id); toast('Usunięto'); location.hash = '#/zaginiecia';
};
// dawny adres okna (lista → karta)
actions['zag-open'] = (el) => { location.hash = '#/zaginiecia/' + el.dataset.id; };
export async function aktywneLiczba() { return (await list('zaginiecia')).filter(aktywne).length; }
