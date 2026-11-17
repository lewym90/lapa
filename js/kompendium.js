// Karta psa dla administratora (od 1.18): kompendium wiedzy o psie, żeby nic nie zginęło.
// Dane ze strony schroniska są tylko do odczytu (aktualizują się same). Ołówek jest przy tym, co wpisuje administrator.
import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, confirmSheet, sexSymbol, safeUrl } from './ui.js';
import { list, save, remove, get } from './store.js';
import { getName } from './auth.js';
import { dogNeeds, NEED_LABELS, needLabel, ago, parseData, dataTs, odKiedy } from './util.js';
import { addPhotoFile, hydratePhotos } from './photos.js';
import { boksPill, wybCls, wybrani, powody, kto, opis as opisAdm, opisLine, czyscBoks } from './znak.js';
import { ZDROWIE_TYPY, TYP, zdrowieDla, byl, miejsce } from './teczka.js';
import { uKogo, RODZAJ } from './adopcje.js';

const pen = () => icon('pencil').s.replace('class="ico', 'class="ico kpen');
const plural = (n, a, b, c) => (n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
const zl = (v) => (+v || 0).toFixed(2).replace('.', ',').replace(',00', '') + ' zł';
const dz = (z) => z.data_txt || (z.data ? dataTs(z.data) : '');
const KAFLE = [['szczepienie', 'Szczepienie'], ['odrobaczanie', 'Odrobaczenie'], ['pchly', 'Pchły i kleszcze'], ['kastracja', 'Kastracja']];
const STARE_ZDR = { szczepienie: 'szczep', odrobaczanie: 'odrob', kastracja: 'kastr' }; // „tak/nie” z dawnej karty psa (1.17)

// Znaczek ze strony: w procesie adopcji / dom tymczasowy / hotelik / byli u nas
export function znaczekStrony(d) {
  if (byl(d)) return '<span class="kbadge byl">Byli u nas</span>';
  const m = miejsce(d), t = [];
  if (d.status === 'w_trakcie') t.push('<span class="kbadge ad">W procesie adopcji</span>');
  if (m === 'dt') t.push('<span class="kbadge">Dom tymczasowy</span>');
  if (m === 'hotelik') t.push('<span class="kbadge">Hotelik</span>');
  return t.join('');
}
const pole = (label, val, f) => (f
  ? `<button type="button" class="kd ed" data-act="k-edit" data-f="${f}" data-id="{ID}"><span>${label}</span><b>${val || '<i>dodaj</i>'}</b>${pen()}</button>`
  : val ? `<div class="kd"><span>${label}</span><b>${val}</b></div>` : '');

export async function cardAdm(id, { pics, picImg, isFav }) {
  const [d, walks, obsAll, zdr, osoby] = await Promise.all([get('psy', id), list('spacery'), list('obserwacje'), zdrowieDla(id), list('p_dt')]);
  if (!d) return null;
  const mine = walks.filter((w) => w.pies_id === id).sort((a, b) => b.start - a.start), km = mine.reduce((s, w) => s + (w.dystans_km || 0), 0);
  const obs = obsAll.filter((o) => o.pies_id === id).sort((a, b) => b.ts - a.ts), needs = dogNeeds(d, walks), od = odKiedy(d);
  const najn = (typ) => zdr.find((z) => z.typ === typ);
  const kafle = KAFLE.map(([k, l]) => {
    const z = najn(k), stare = (d.zdr || {})[STARE_ZDR[k]];
    const v = z ? esc(dz(z)) : stare === 'tak' ? 'tak' : stare === 'nie' ? 'nie' : '';
    return `<button type="button" class="kafel${v ? ' jest' : ''}" data-act="k-zdr" data-id="${esc(id)}" data-typ="${k}"><span>${l}</span><b>${v || 'brak wpisu'}</b></button>`;
  }).join('');
  const koszt = zdr.reduce((s, z) => s + (+z.koszt || 0), 0), dok = d.dokumenty || [];
  const wpis = (z) => `<button type="button" class="kwpis" data-act="k-zdr" data-id="${esc(id)}" data-zid="${esc(z.id)}"><span class="kwd">${esc(dz(z))}</span><span class="kwt"><b>${esc(TYP[z.typ] || z.typ)}</b>${z.notatka ? `<small>${esc(z.notatka)}</small>` : ''}</span>${z.koszt ? `<span class="kwk">${esc(zl(z.koszt))}</span>` : ''}</button>`;
  const notka = (o) => `<div class="obs"><div class="oh"><span>${esc(o.autor || '')}</span><span>${esc(dataTs(o.ts))}</span></div><div style="white-space:pre-line">${esc(o.tekst)}</div></div>`;
  const dane = [
    pole('Płeć', d.plec === 'suka' ? 'Suka' : d.plec === 'samiec' ? 'Samiec' : ''), pole('Wiek', esc(d.wiek || '')), pole('Waga', esc(d.waga || '')), pole('Wielkość', esc(d.wielkosc || '')),
    pole('W schronisku od', od ? esc(od.txt) + (byl(d) ? '' : ` <em>· ${esc(od.ile)}</em>`) : '', 'od'), pole('Boks', esc(d.boks || ''), 'boks'), pole('Czip', esc(d.chip || ''), 'chip')
  ].join('').replaceAll('{ID}', esc(id)) + (() => { const u = uKogo(osoby, id); return u ? `<a class="kd ed" href="#/dt/${esc(u.id)}"><span>${esc(RODZAJ[u.rodzaj || 'dt'])}</span><b>${esc(u.imie || '')}</b>${icon('chev').s}</a>` : ''; })();
  const oz = [wybrani(d) ? 'Tylko dla wybranych' + (powody(d).length ? ': ' + powody(d).join(', ') : '') + (kto(d) ? ` · mogą wychodzić: ${kto(d)}` : '') : '', opisAdm(d) ? '„' + opisAdm(d) + '”' : ''].filter(Boolean).join(' · ');
  return {
    tab: 'psy', title: d.imie, live: true,
    html: html`<section class="dogtop${wybCls(d)}"><div class="topact"><button class="iconbtn" data-act="back" aria-label="Wstecz">${icon('back')}</button>
        <span style="display:flex;gap:8px"><button class="iconbtn" data-act="dog-fav" data-id="${id}" aria-pressed="${isFav}" aria-label="Ulubiony">${raw(icon('heart').s.replace('class="ico', isFav ? 'style="fill:var(--terra);stroke:var(--terra)" class="ico' : 'class="ico'))}</button></span></div>
      <div class="gal" id="gal">${pics.length ? pics.map((p) => html`<div>${picImg(p, d.imie)}</div>`) : html`<div><div class="nophoto">${icon('paw')}</div></div>`}</div>
      ${pics.length > 1 ? html`<div class="dots" id="dots">${pics.map((_, i) => html`<i class="${i ? '' : 'on'}"></i>`)}</div>` : ''}</section>
    <section class="dogsheet komp">
      <h1>${d.imie} <span class="sex">${sexSymbol(d.plec)}</span></h1>${raw(opisLine(d))}
      <div class="khead">${raw(boksPill(d, 'big'))}${raw(znaczekStrony(d))}</div>
      ${d.wazne ? html`<button type="button" class="kwazne" data-act="k-edit" data-f="wazne" data-id="${id}"><b>Ważne</b><span>${d.wazne}</span>${raw(pen())}</button>`
        : html`<button type="button" class="kdodaj" data-act="k-edit" data-f="wazne" data-id="${id}">${icon('plus')} Dodaj ważną informację</button>`}

      <h2 class="kh">Dane</h2><div class="kbox">${raw(dane)}</div>

      <h2 class="kh">Oznaczenie i opis</h2>
      <div class="kbox"><button type="button" class="kd ed" data-act="dog-oznacz" data-id="${id}"><span>Oznaczenie</span><b>${oz || raw('<i>bez oznaczenia i opisu</i>')}</b>${raw(pen())}</button></div>

      <h2 class="kh">Zdrowie</h2>
      <div class="kafle">${raw(kafle)}</div>
      <div class="kbox">${raw([pole('Stałe leki', esc(d.leki || ''), 'leki'), pole('Choroby, alergie, dieta', esc(d.choroby || ''), 'choroby')].join('').replaceAll('{ID}', esc(id)))}</div>
      <div class="ksub"><b>Wizyty i zabiegi</b>${koszt ? html`<span>razem ${zl(koszt)}</span>` : ''}</div>
      <div class="kbox">${zdr.length ? raw(zdr.slice(0, 5).map(wpis).join('')) : html`<p class="kpusto">Brak wpisów.</p>`}
        ${zdr.length > 5 ? html`<button type="button" class="kwiecej" data-act="k-zdr-all" data-id="${id}">Pokaż wszystkie (${zdr.length})</button>` : ''}
        <button type="button" class="kdodaj in" data-act="k-zdr" data-id="${id}">${icon('plus')} Dodaj wpis</button></div>

      <h2 class="kh">Dokumenty</h2>
      <div class="kbox"><div class="kdok">${raw(dok.map((p) => `<button type="button" class="kdokp" data-act="k-dok" data-id="${esc(id)}" data-p="${esc(p)}"><img data-photo="${esc(p)}" alt="Dokument" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></button>`).join(''))}
        <label class="kdokadd">${icon('camera')}<span>Dodaj zdjęcie</span><input type="file" accept="image/*" multiple hidden data-kdok="${id}"></label></div>
        <p class="kstat" id="kdst" aria-live="polite"></p></div>

      <h2 class="kh">Dla wolontariuszy</h2>
      <div class="kbox">
        <button type="button" class="kd ed" data-act="dog-needs" data-id="${id}"><span>Czego potrzebuje</span><b>${needs.length ? needs.map((k) => needLabel(k)).join(', ') : raw('<i>nic pilnego</i>')}</b>${raw(pen())}</button>
        <button type="button" class="kd ed" data-act="dog-walks" data-id="${id}"><span>Historia spacerów</span><b>${mine.length ? `${mine.length} ${plural(mine.length, 'spacer', 'spacery', 'spacerów')}${km ? ' · ' + km.toFixed(1).replace('.', ',') + ' km' : ''} · ostatni ${ago(mine[0].start)}` : raw('<i>brak</i>')}</b>${icon('chev')}</button>
      </div>

      <h2 class="kh">Notatki</h2>
      <div class="kbox knotki">${obs.length ? raw(obs.slice(0, 3).map(notka).join('')) : html`<p class="kpusto">Brak notatek.</p>`}
        ${obs.length > 3 ? html`<button type="button" class="kwiecej" data-act="dog-obs" data-id="${id}">Pokaż wszystkie (${obs.length})</button>` : ''}
        <button type="button" class="kdodaj in" data-act="dog-obs-add" data-id="${id}">${icon('plus')} Dodaj notatkę</button></div>

      ${d.zrodlo_url && !byl(d) ? html`<a class="kd klink" href="${safeUrl(d.zrodlo_url)}" target="_blank" rel="noopener"><span>Ogłoszenie na stronie schroniska</span>${icon('link')}</a>` : ''}
    </section>`,
    mount(root) {
      const gal = root.querySelector('#gal'), dots = root.querySelectorAll('#dots i');
      gal?.addEventListener('scroll', () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); dots.forEach((x, k) => x.classList.toggle('on', k === i)); }, { passive: true });
      const inp = root.querySelector('[data-kdok]');
      inp?.addEventListener('change', () => { dodajDokumenty(id, inp.files, root.querySelector('#kdst')); inp.value = ''; });
      hydratePhotos(root);
    }
  };
}

// ===== edycja pól (ołówek) =====
const POLA = {
  wazne: { t: 'Ważne', l: 'Co trzeba wiedzieć od razu', ta: true, max: 500, ph: 'np. bierze leki 2× dziennie, nie dotykać łap, tylko karma hipoalergiczna', hint: 'Pokazuje się na górze karty. Zostaw puste, żeby usunąć.' },
  od: { t: 'W schronisku od', l: 'Data', max: 30, ph: 'np. 2019, 03.2019 albo 12.03.2019', hint: 'Wystarczy sam rok. Zostaw puste, żeby wrócić do daty ze strony schroniska.' },
  boks: { t: 'Boks', l: 'Numer boksu', max: 8, ph: 'np. 12, 7a' },
  chip: { t: 'Czip', l: 'Numer czipa', max: 20, ph: 'np. 616093900123456', num: true },
  leki: { t: 'Stałe leki', l: 'Co, dawka, kiedy', ta: true, max: 800, ph: 'np. Vetmedin 5 mg, rano i wieczorem' },
  choroby: { t: 'Choroby, alergie, dieta', l: 'Co trzeba pamiętać', ta: true, max: 800, ph: 'np. alergia na kurczaka, karma hipoalergiczna; kuleje na tylną łapę' }
};
actions['k-edit'] = async (el) => {
  const f = el.dataset.f, P = POLA[f], d = await get('psy', el.dataset.id); if (!P || !d) return;
  const cur = f === 'od' ? (odKiedy(d) || {}).txt || '' : d[f] || '';
  openSheet(`<h2>${esc(P.t)}: ${esc(d.imie)}</h2><form id="kef" novalidate><div class="field"><label for="kev">${esc(P.l)}</label>
    ${P.ta ? `<textarea class="textarea" id="kev" maxlength="${P.max}" placeholder="${esc(P.ph)}">${esc(cur)}</textarea>` : `<input class="input" id="kev" maxlength="${P.max}" placeholder="${esc(P.ph)}" value="${esc(cur)}" autocomplete="off"${P.num ? ' inputmode="numeric"' : ''}>`}</div>
    ${P.hint ? `<p class="hint" style="margin:-4px 0 12px">${esc(P.hint)}</p>` : ''}<div class="err" id="kee" role="alert"></div><button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    const v = s.querySelector('#kev'); v.focus();
    s.querySelector('#kef').addEventListener('submit', async (e) => {
      e.preventDefault(); const val = v.value.trim(), n = { ...((await get('psy', d.id)) || d) };
      if (f === 'od') {
        if (!val) { delete n.od; delete n.data_przyjecia; }
        else if (val !== cur) { const r = parseData(val); if (!r) { s.querySelector('#kee').textContent = 'Nie rozumiem tej daty. Wpisz np. 2019, 03.2019 albo 12.03.2019.'; return; } n.od = r.txt; delete n.data_przyjecia; }
      } else if (f === 'boks') n.boks = czyscBoks(val);
      else if (val) n[f] = val; else delete n[f];
      await save('psy', n); closeSheet(); toast('Zapisane');
    });
  });
};

// ===== zdrowie: wpis (dodanie z kafelka albo „Dodaj wpis”, edycja po dotknięciu wpisu) =====
actions['k-zdr'] = async (el) => {
  const id = el.dataset.id, d = await get('psy', id); if (!d) return;
  const z = el.dataset.zid ? (await zdrowieDla(id)).find((x) => x.id === el.dataset.zid) : null;
  const typ = z ? z.typ : el.dataset.typ || 'weterynarz';
  openSheet(`<h2>${z ? 'Wpis' : 'Nowy wpis'}: ${esc(d.imie)}</h2><form id="kzf" novalidate>
    <div class="field"><label for="kz_t">Co</label><select class="select" id="kz_t">${ZDROWIE_TYPY.map(([k, l]) => `<option value="${k}" ${k === typ ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label for="kz_d">Kiedy</label><input class="input" id="kz_d" maxlength="30" autocomplete="off" placeholder="np. 12.03.2024, 03.2024 albo 2024" value="${esc(z ? dz(z) : dataTs(Date.now()))}"></div>
    <div class="field"><label for="kz_n">Co dokładnie (opcjonalnie)</label><textarea class="textarea" id="kz_n" maxlength="600" placeholder="np. szczepionka na wściekliznę; lek i dawka; wynik badania">${esc(z?.notatka || '')}</textarea></div>
    <div class="field"><label for="kz_k">Koszt w zł (opcjonalnie)</label><input class="input" id="kz_k" inputmode="decimal" maxlength="10" value="${z?.koszt ? esc(String(z.koszt).replace('.', ',')) : ''}"></div>
    <div class="field"><label for="kz_x">Następny termin (opcjonalnie, przypomni w „Dziś i do zrobienia”)</label><input class="input" id="kz_x" maxlength="30" autocomplete="off" placeholder="np. 12.03.2025" value="${esc(z?.termin_txt || (z?.termin ? dataTs(z.termin) : ''))}"></div>
    <div class="err" id="kz_e" role="alert"></div><button class="btn block" type="submit">Zapisz</button>
    ${z ? '<button type="button" class="btn ghost block" id="kz_del" style="margin-top:8px;color:var(--terra-d)">Usuń wpis</button>' : ''}</form>`, (s) => {
    const er = s.querySelector('#kz_e');
    s.querySelector('#kzf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const dd = parseData(s.querySelector('#kz_d').value); if (!dd) { er.textContent = 'Wpisz, kiedy to było, np. 12.03.2024, 03.2024 albo sam rok.'; return; }
      const tv = s.querySelector('#kz_x').value.trim(), tt = tv ? parseData(tv) : null; if (tv && !tt) { er.textContent = 'Nie rozumiem daty następnego terminu. Wpisz np. 12.03.2025.'; return; }
      await save('zdrowie', { ...(z || {}), pies_id: id, typ: s.querySelector('#kz_t').value, data: dd.ts, data_txt: dd.txt, termin: tt ? tt.ts : null, termin_txt: tt ? tt.txt : '', koszt: parseFloat(s.querySelector('#kz_k').value.replace(',', '.')) || 0, notatka: s.querySelector('#kz_n').value.trim(), autor: z?.autor || getName() });
      closeSheet(); toast('Zapisane');
    });
    s.querySelector('#kz_del')?.addEventListener('click', async () => { if (await confirmSheet('Usunąć wpis?', 'Wpis zniknie z karty psa.', 'Usuń', true)) { await remove('zdrowie', z.id); toast('Usunięto'); } });
  });
};
actions['k-zdr-all'] = async (el) => {
  const id = el.dataset.id, d = await get('psy', id), zdr = await zdrowieDla(id);
  openSheet(`<h2>Wizyty i zabiegi: ${esc(d?.imie || '')}</h2><div class="kbox">${zdr.map((z) => `<button type="button" class="kwpis" data-act="k-zdr" data-id="${esc(id)}" data-zid="${esc(z.id)}"><span class="kwd">${esc(dz(z))}</span><span class="kwt"><b>${esc(TYP[z.typ] || z.typ)}</b>${z.notatka ? `<small>${esc(z.notatka)}</small>` : ''}</span>${z.koszt ? `<span class="kwk">${esc(zl(z.koszt))}</span>` : ''}</button>`).join('')}</div>`);
};

// ===== dokumenty: zdjęcia kart szczepień, wyników, karteczek =====
async function dodajDokumenty(id, files, st) {
  files = [...files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name)); if (!files.length) return;
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    if (st) st.textContent = `Dodaję zdjęcie ${i + 1} z ${files.length}…`;
    try { const pid = await addPhotoFile(files[i], true); const d = await get('psy', id); await save('psy', { ...d, dokumenty: [...(d.dokumenty || []), pid] }); ok++; } catch { /* pominięte */ }
  }
  toast(ok ? `Dodano: ${ok}` : 'Nie udało się odczytać zdjęcia', !ok);
  try { (await import('./sync.js')).kick(50); } catch { /* */ }
}
actions['k-dok'] = async (el) => {
  const id = el.dataset.id, p = el.dataset.p;
  openSheet(`<h2>Dokument</h2><img class="kdokbig" data-photo="${esc(p)}" alt="Dokument" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
    <button type="button" class="btn ghost block" id="kd_x" style="margin-top:12px;color:var(--terra-d)">Usuń zdjęcie</button>`, (s) => {
    hydratePhotos(s);
    s.querySelector('#kd_x').onclick = async () => {
      if (!(await confirmSheet('Usunąć zdjęcie dokumentu?', 'Zniknie z karty psa.', 'Usuń', true))) return;
      const d = await get('psy', id); await save('psy', { ...d, dokumenty: (d.dokumenty || []).filter((x) => x !== p) }); toast('Usunięto');
    };
  });
};
