import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, pageBar, dogImg, safeUrl, sexSymbol, STATUS, statusChip, confirmSheet } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName, unlock } from './auth.js';
import { api, ApiError } from './api.js';
import { SITE } from './config.js';
import { fmtDate, fmtShort, ago, dogNeeds, NEED_LABELS, MS_DAY, uid } from './util.js';
import { addPhotoFile, hydratePhotos } from './photos.js';
import { dogBlock } from './adopcje.js';
import { teczkaRows, zdrowieDla, etap, aktywny, miejsce, days } from './teczka.js';

const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const favs = () => new Set(lsGet('lapa.fav', []));
const dogPics = (d) => [...(d.zdjecia || []).map((u) => ({ url: u })), ...(d.moje_zdjecia || []).map((id) => ({ id }))];
const picImg = (p, alt, cls = '') => (p.url ? dogImg(p.url, alt, cls) : raw(`<img class="${esc(cls)}" data-photo="${esc(p.id)}" alt="${esc(alt)}" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`));
export const dogThumb = (d) => {
  const p = dogPics(d)[0];
  if (!p) return html`<div class="nophoto">${icon('paw')}</div>`;
  if (p.url) return dogImg(p.url.replace(/_l\.(jpe?g)(\?.*)?$/i, '_m.$1$2'), d.imie, '', p.url);
  return picImg(p, d.imie);
};

// ========== lista psów ==========
let fq = '', ff = 'aktywne';
const FILTERS = [['aktywne', 'Aktywne'], ['nowe', 'Nowe, do publikacji'], ['pilne', 'Pilne'], ['do_adopcji', 'Do adopcji'], ['dt', 'W domu tymczasowym'], ['ulubione', 'Ulubione'], ['adoptowany', 'Adoptowane'], ['wszystkie', 'Wszystkie']];
function filterDogs(dogs) {
  const q = fq.trim().toLowerCase(), f = favs();
  return dogs.filter((d) => {
    if (q && !(d.imie || '').toLowerCase().includes(q)) return false;
    if (ff === 'aktywne') return aktywny(d);
    if (ff === 'nowe') return aktywny(d) && d.nowy && etap(d).done < etap(d).total;
    if (ff === 'ulubione') return f.has(d.id);
    if (ff === 'wszystkie') return true;
    return d.status === ff;
  }).sort((a, b) => (b.status === 'pilne') - (a.status === 'pilne') || (a.imie || '').localeCompare(b.imie || '', 'pl'));
}
function lastWalk(walks, id) { const w = walks.filter((x) => x.pies_id === id); return w.length ? Math.max(...w.map((x) => x.end || x.start)) : 0; }
function grid(dogs, walks) {
  const f = filterDogs(dogs);
  if (!f.length) return html`<div class="empty">${icon('paw')}<h3>${dogs.length ? 'Nikogo tu nie ma' : 'Jeszcze nie ma psów'}</h3><p>${dogs.length ? 'Zmień filtr albo wyszukiwanie.' : 'Dodaj psy przyciskiem poniżej: wklej link do ogłoszenia ze strony schroniska albo zaimportuj wszystkie naraz.'}</p></div>`;
  return html`<div class="dogs">${f.map((d) => { const lw = lastWalk(walks, d.id); return html`<a class="dcard" href="#/psy/${d.id}"><div class="pic">${dogThumb(d)}<span class="st">${d.status && d.status !== 'schronisko' ? statusChip(d.status) : d.nowy ? html`<span class="chip">Nowy</span>` : ''}</span></div>
    <div class="meta"><h3>${d.imie} ${sexSymbol(d.plec)}</h3><div class="m2">${[d.wiek, d.wielkosc].filter(Boolean).join(' · ') || '—'}</div>${d.data_przyjecia && miejsce(d) === 'schronisko' ? html`<div class="m2">W schronisku ${days(d.data_przyjecia)} dni</div>` : ''}${d.nowy && etap(d).done < etap(d).total ? html`<div class="m2" style="color:var(--terra-d);font-weight:600">Nowy · brakuje: ${etap(d).next}</div>` : ''}${lw ? html`<div class="m2">Spacer: ${ago(lw)}</div>` : ''}</div></a>`; })}</div>`;
}
export async function list_() {
  const [dogs, walks] = await Promise.all([list('psy'), list('spacery')]);
  return {
    tab: 'psy', title: 'Psy',
    html: html`<header class="topbar"><span style="width:44px"></span><h1 style="font-size:26px;font-weight:500;flex:1;text-align:center">Psy</h1><span style="width:44px"></span></header>
    <div class="pad"><div class="search">${icon('search')}<input id="fq" type="search" placeholder="Szukaj psa po imieniu" value="${fq}" aria-label="Szukaj psa" autocomplete="off"></div></div>
    <div class="fchips" role="group" aria-label="Filtr">${FILTERS.map(([k, l]) => html`<button class="chip dark ${ff === k ? 'on' : ''}" data-act="dog-filter" data-k="${k}" aria-pressed="${ff === k}">${l}</button>`)}</div>
    <div id="grid">${grid(dogs, walks)}</div>
    <button class="btn gold fab" data-act="a-dog">${icon('plus')} Dodaj psa</button>`,
    mount(root) {
      const inp = root.querySelector('#fq'), g = root.querySelector('#grid');
      inp.addEventListener('input', () => { fq = inp.value; g.innerHTML = grid(dogs, walks).s; hydratePhotos(g); });
      hydratePhotos(root);
    }
  };
}
export { list_ as list };
actions['dog-filter'] = (el) => { ff = el.dataset.k; dispatchEvent(new HashChangeEvent('hashchange')); };

// ========== wybór psa (do spaceru, obserwacji, zdjęcia) ==========
export async function pickDog(cb) {
  const dogs = (await list('psy')).filter((d) => d.status !== 'adoptowany').sort((a, b) => (a.imie || '').localeCompare(b.imie || '', 'pl'));
  if (!dogs.length) { toast('Najpierw dodaj psa (przycisk + → Dodaj psa)', true); return; }
  const paint = (q, root) => {
    const f = dogs.filter((d) => (d.imie || '').toLowerCase().includes(q.toLowerCase()));
    root.innerHTML = f.length ? f.map((d) => `<button class="row" data-pick="${esc(d.id)}"><span class="avatar sm">${dogThumb(d).s}</span><span class="rt"><b>${esc(d.imie)} ${sexSymbol(d.plec)}</b><small>${esc([d.wiek, d.wielkosc].filter(Boolean).join(' · '))}</small></span>${icon('chev').s}</button>`).join('') : '<p class="hint">Nie ma takiego psa.</p>';
    hydratePhotos(root);
  };
  openSheet(`<h2>Wybierz psa</h2><div class="field"><input class="input" id="pq" type="search" placeholder="Szukaj po imieniu" autocomplete="off"></div><div id="pl" class="rows"></div>`, (s) => {
    const l = s.querySelector('#pl'); paint('', l);
    s.querySelector('#pq').addEventListener('input', (e) => paint(e.target.value, l));
    l.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (!b) return; const d = dogs.find((x) => x.id === b.dataset.pick); closeSheet(); cb(d); });
  });
}

// ========== karta psa ==========
export async function card(id) {
  const [d, walks, obsAll, zdr] = await Promise.all([get('psy', id), list('spacery'), list('obserwacje'), zdrowieDla(id)]);
  if (!d) return { tab: 'psy', nav: false, html: html`<div class="empty" style="padding-top:90px">${icon('paw')}<h3>Nie ma takiego psa</h3><a class="btn gold" href="#/psy">Wróć do listy</a></div>` };
  const mine = walks.filter((w) => w.pies_id === id).sort((a, b) => b.start - a.start);
  const km = mine.reduce((s, w) => s + (w.dystans_km || 0), 0);
  const obs = obsAll.filter((o) => o.pies_id === id).sort((a, b) => b.ts - a.ts);
  const pics = dogPics(d), isFav = favs().has(id), needs = dogNeeds(d, walks);
  const adBlock = state.coordinator ? await dogBlock(id) : null;
  return {
    tab: 'psy', nav: false, title: d.imie, live: true,
    html: html`<section class="dogtop"><div class="bar"><button class="iconbtn" data-act="back" aria-label="Wstecz">${icon('back')}</button>
        <span style="display:flex;gap:8px"><button class="iconbtn" data-act="dog-fav" data-id="${id}" aria-pressed="${isFav}" aria-label="Ulubiony">${raw(icon('heart').s.replace('class="ico', isFav ? 'style="fill:var(--terra);stroke:var(--terra)" class="ico' : 'class="ico'))}</button>
        <button class="iconbtn" data-act="dog-share" data-id="${id}" aria-label="Udostępnij">${icon('share')}</button></span></div>
      <div class="gal" id="gal">${pics.length ? pics.map((p) => html`<div>${picImg(p, d.imie)}</div>`) : html`<div><div class="nophoto">${icon('paw')}</div></div>`}</div>
      ${pics.length > 1 ? html`<div class="dots" id="dots">${pics.map((_, i) => html`<i class="${i ? '' : 'on'}"></i>`)}</div>` : ''}</section>
    <section class="dogsheet"><h1>${d.imie} <span class="sex">${sexSymbol(d.plec)}</span></h1>
      <div class="meta">${[d.wiek, d.wielkosc, d.waga && 'ok. ' + d.waga.replace(/^ok\.?\s*/i, ''), d.status && STATUS[d.status]].filter(Boolean).map((x) => html`<span>${x}</span>`)}</div>
      <div class="chips">${(d.tagi || []).map((t) => html`<span class="chip">${t}</span>`)}${needs.map((k) => html`<span class="chip terra">${NEED_LABELS[k]}</span>`)}</div>
      ${d.opis ? html`<p class="desc">${d.opis}</p>` : html`<p class="desc" style="color:#6b736a">Brak opisu. Dodaj go przez „Edytuj” albo odśwież ze strony schroniska.</p>`}
      <div class="rows">
        ${teczkaRows(d, zdr)}
        <button class="row" data-act="dog-walks" data-id="${id}">${icon('paw')}<span class="rt"><b>Historia spacerów</b><small>${mine.length} ${plural(mine.length, 'spacer', 'spacery', 'spacerów')}${km ? ' | ' + km.toFixed(1).replace('.', ',') + ' km' : ''}${mine[0] ? ' | ostatni ' + ago(mine[0].start) : ''}</small></span>${icon('chev')}</button>
        <button class="row" data-act="dog-obs" data-id="${id}">${icon('heart')}<span class="rt"><b>Notatki wolontariuszy</b><small>${obs.length} ${plural(obs.length, 'obserwacja', 'obserwacje', 'obserwacji')}${obs[0] ? ' | ostatnia ' + ago(obs[0].ts) : ''}</small></span>${icon('chev')}</button>
        <button class="row" data-act="dog-needs" data-id="${id}">${icon('medic')}<span class="rt"><b>Czego potrzebuje</b><small>${needs.length ? needs.map((k) => NEED_LABELS[k]).join(', ') : 'Nic pilnego. Kliknij, żeby zgłosić potrzebę'}</small></span>${icon('chev')}</button>
        ${d.zrodlo_url ? html`<a class="row" href="${safeUrl(d.zrodlo_url)}" target="_blank" rel="noopener">${icon('link')}<span class="rt"><b>Ogłoszenie na stronie schroniska</b><small>Otwórz w przeglądarce</small></span>${icon('chev')}</a>` : ''}
      </div>
      ${state.coordinator ? adBlock
        : html`<div class="lockbox">${icon('lock')}<p style="margin:6px 0 10px"><b>Dane osób zainteresowanych adopcją</b><br><span class="hint">Widzi je tylko koordynator.</span></p><button class="btn sm" data-act="unlock-sheet">Odblokuj hasłem koordynatora</button></div>`}
      <div class="btnrow" style="margin-top:20px"><button class="btn block" data-act="dog-obs-add" data-id="${id}">${icon('pencil')} Zapisz obserwację</button></div>
      <div class="btnrow" style="margin-top:10px"><a class="btn ghost" href="#/spacer/${id}">${icon('walk')} Rozpocznij spacer</a><button class="btn ghost" data-act="dog-photo" data-id="${id}">${icon('camera')} Dodaj zdjęcie</button></div>
      <div class="btnrow" style="margin-top:10px"><button class="btn ghost" data-act="dog-print" data-id="${id}">${icon('download')} Karta do wysłania (PDF)</button><button class="btn ghost" data-act="dog-edit" data-id="${id}">${icon('pencil')} Edytuj</button></div>
      <p class="hint" style="margin:18px 0 0;text-align:center">${d.zrodlo_url ? 'Dane ze strony schroniska' + (d.zaimportowano ? ' · ' + fmtDate(d.zaimportowano) : '') : 'Dodano ręcznie'}${d.zrodlo_url ? ' · ' : ''}${d.zrodlo_url ? html`<button class="link" style="color:var(--green)" data-act="dog-refresh" data-id="${id}">odśwież</button>` : ''}</p>
    </section>`,
    mount(root) {
      const gal = root.querySelector('#gal'), dots = root.querySelectorAll('#dots i');
      gal?.addEventListener('scroll', () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); dots.forEach((x, k) => x.classList.toggle('on', k === i)); }, { passive: true });
      hydratePhotos(root);
    }
  };
}
const plural = (n, a, b, c) => (n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);

actions['dog-fav'] = (el) => { const f = favs(); f.has(el.dataset.id) ? f.delete(el.dataset.id) : f.add(el.dataset.id); lsSet('lapa.fav', [...f]); dispatchEvent(new HashChangeEvent('hashchange')); };
actions['dog-walks'] = async (el) => {
  const mine = (await list('spacery')).filter((w) => w.pies_id === el.dataset.id).sort((a, b) => b.start - a.start);
  openSheet(`<h2>Historia spacerów</h2>${mine.length ? mine.map((w) => `<a class="row" href="#/raport/${esc(w.id)}"><span class="rt"><b>${esc(fmtDate(w.start))}</b><small>${esc(w.autor || '')} · ${Math.round((w.czas_min || 0))} min${w.dystans_km ? ' · ' + w.dystans_km.toFixed(1).replace('.', ',') + ' km' : ''}</small></span>${icon('chev').s}</a>`).join('') : '<p class="hint" style="font-size:15px">Brak udokumentowanych spacerów.</p>'}`);
};
actions['dog-obs'] = async (el) => {
  const obs = (await list('obserwacje')).filter((o) => o.pies_id === el.dataset.id).sort((a, b) => b.ts - a.ts);
  openSheet(`<h2>Notatki wolontariuszy</h2>${obs.length ? obs.map((o) => `<div class="obs"><div class="oh"><span>${esc(o.autor || '')}${o.typ ? ' · ' + esc(o.typ) : ''}</span><span>${esc(fmtShort(o.ts))}</span></div><div style="white-space:pre-line">${esc(o.tekst)}</div></div>`).join('') : '<p class="hint" style="font-size:15px">Jeszcze brak notatek.</p>'}<button class="btn block" style="margin-top:16px" data-act="dog-obs-add" data-id="${esc(el.dataset.id)}">${icon('pencil').s} Dodaj obserwację</button>`);
};
actions['dog-obs-add'] = (el) => obsForm(el.dataset.id);
export function obsForm(dogId) {
  openSheet(`<h2>Nowa obserwacja</h2><p class="hint" style="margin:0 0 14px">Zapisz to, co zauważyłeś(-aś). To obserwacja, nie diagnoza. Zalecenia medyczne zatwierdza lekarz weterynarii.</p>
    <form id="of" novalidate><div class="field"><span class="lbl">Rodzaj</span><div class="chips" id="ot">${['Zachowanie', 'Zdrowie', 'Kontakt z ludźmi', 'Kontakt z psami', 'Inne'].map((t, i) => `<button type="button" class="chip outline ${i ? '' : 'on'}" data-v="${t}">${t}</button>`).join('')}</div></div>
    <div class="field"><label for="otx">Co zauważyłeś(-aś)?</label><textarea class="textarea" id="otx" maxlength="1500"></textarea></div><div class="err" id="oe"></div>
    <button class="btn block" type="submit">Zapisz obserwację</button></form>`, (s) => {
    let typ = 'Zachowanie';
    s.querySelector('#ot').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; typ = b.dataset.v; s.querySelectorAll('#ot .chip').forEach((c) => c.classList.toggle('on', c === b)); });
    s.querySelector('#of').addEventListener('submit', async (e) => {
      e.preventDefault(); const t = s.querySelector('#otx').value.trim();
      if (t.length < 3) { s.querySelector('#oe').textContent = 'Opisz krótko, co zauważyłeś(-aś).'; return; }
      await save('obserwacje', { pies_id: dogId, tekst: t, typ, ts: Date.now(), autor: getName() }); closeSheet(); toast('Obserwacja zapisana');
    });
    s.querySelector('#otx').focus();
  });
}
export function addPhoto(dogId) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = async () => {
    const d = await get('psy', dogId); if (!d) return;
    try {
      d.moje_zdjecia ||= [];
      for (const f of inp.files) d.moje_zdjecia.push(await addPhotoFile(f));
      await save('psy', d); toast(inp.files.length > 1 ? 'Zdjęcia dodane' : 'Zdjęcie dodane');
    } catch (e) { toast(e.message, true); }
  };
  inp.click();
}
actions['dog-photo'] = (el) => addPhoto(el.dataset.id);
actions['unlock-sheet'] = () => unlockSheet();
export function unlockSheet(after) {
  openSheet(`<h2>Hasło koordynatora</h2><p class="hint" style="margin:0 0 14px">Odblokuje numery telefonów i dane osób zainteresowanych adopcją. Blokuje się samo po godzinie bez używania aplikacji.</p>
    <form id="uf" novalidate><div class="field"><label for="up">Hasło koordynatora</label><input class="input" id="up" type="password" autocomplete="off" autocapitalize="off"></div><div class="err" id="ue" role="alert"></div><button class="btn block" type="submit">${icon('unlock').s} Odblokuj</button></form>`, (s) => {
    s.querySelector('#uf').addEventListener('submit', async (e) => {
      e.preventDefault(); const b = s.querySelector('button'); b.disabled = true;
      try { await unlock(s.querySelector('#up').value); closeSheet(); toast('Dane osobowe odblokowane'); after?.(); }
      catch (err) { b.disabled = false; s.querySelector('#ue').textContent = err.status === 429 ? 'Za dużo prób. Spróbuj za kilka minut.' : err.status === 0 ? 'Brak połączenia.' : 'Nieprawidłowe hasło koordynatora.'; }
    });
    s.querySelector('#up').focus();
  });
}
actions['dog-needs'] = async (el) => {
  const d = await get('psy', el.dataset.id); const cur = new Set(d.potrzeby || []);
  openSheet(`<h2>Czego potrzebuje ${esc(d.imie)}?</h2><p class="hint" style="margin:0 0 14px">Zaznacz, w czym wolontariusze mogą pomóc. Pojawi się to na ekranie „Pomoc”. Część potrzeb (np. brak zdjęć) aplikacja dodaje sama.</p>
    <div class="chips" id="nc">${Object.entries(NEED_LABELS).map(([k, l]) => `<button class="chip outline ${cur.has(k) ? 'on' : ''}" data-k="${k}" aria-pressed="${cur.has(k)}">${l}</button>`).join('')}</div>
    <button class="btn block" style="margin-top:18px" id="ns">Zapisz</button>`, (s) => {
    s.querySelector('#nc').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); });
    s.querySelector('#ns').onclick = async () => { d.potrzeby = [...s.querySelectorAll('#nc .on')].map((b) => b.dataset.k); await save('psy', d); closeSheet(); toast('Zapisane'); };
  });
};

// ========== edycja / ręczne dodawanie ==========
const SEL = (id, label, opts, val) => `<div class="field"><label for="${id}">${label}</label><select class="select" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
export function dogForm(d = {}) {
  openSheet(`<h2>${d.id ? 'Edytuj psa' : 'Nowy pies'}</h2><form id="df" novalidate>
    <div class="field"><label for="di">Imię</label><input class="input" id="di" maxlength="40" value="${esc(d.imie || '')}"></div>
    ${SEL('dp', 'Płeć', [['', 'Nie wiadomo'], ['samiec', 'Samiec'], ['suka', 'Suka']], d.plec || '')}
    <div class="field"><label for="dw">Wiek</label><input class="input" id="dw" maxlength="40" placeholder="np. ok. 3 lata" value="${esc(d.wiek || '')}"></div>
    <div class="field"><label for="dr">Wielkość</label><input class="input" id="dr" maxlength="30" placeholder="np. średni" value="${esc(d.wielkosc || '')}"></div>
    <div class="field"><label for="dk">Waga</label><input class="input" id="dk" maxlength="30" placeholder="np. 21 kg" value="${esc(d.waga || '')}"></div>
    ${SEL('ds', 'Status', Object.entries(STATUS), d.status || 'do_adopcji')}
    <div class="field"><label for="dt">Cechy (po przecinku)</label><input class="input" id="dt" maxlength="120" placeholder="przyjazny, aktywny, lubi spacery" value="${esc((d.tagi || []).join(', '))}"></div>
    <div class="field"><label for="do">Opis</label><textarea class="textarea" id="do" maxlength="4000">${esc(d.opis || '')}</textarea></div>
    ${d.zrodlo_url ? '' : `<div class="field"><label for="du">Adres zdjęcia (opcjonalnie)</label><input class="input" id="du" type="url" placeholder="https://…" value="${esc((d.zdjecia || [])[0] || '')}"></div>`}
    <div class="err" id="de"></div><button class="btn block" type="submit">Zapisz</button>
    ${d.id ? `<button type="button" class="btn ghost block" style="margin-top:10px;color:var(--terra-d)" id="dd">${icon('trash').s} Usuń psa z aplikacji</button>` : ''}</form>`, (s) => {
    s.querySelector('#df').addEventListener('submit', async (e) => {
      e.preventDefault(); const imie = s.querySelector('#di').value.trim();
      if (!imie) { s.querySelector('#de').textContent = 'Wpisz imię psa.'; return; }
      const o = { ...d, imie, plec: s.querySelector('#dp').value, wiek: s.querySelector('#dw').value.trim(), wielkosc: s.querySelector('#dr').value.trim(), waga: s.querySelector('#dk').value.trim(), status: s.querySelector('#ds').value,
        tagi: s.querySelector('#dt').value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8), opis: s.querySelector('#do').value.trim() };
      const u = s.querySelector('#du')?.value.trim(); if (u !== undefined) o.zdjecia = safeUrl(u) ? [safeUrl(u)] : [];
      if (!o.id) { o.id = 'm' + uid(); o.dodany = Date.now(); }
      await save('psy', o); closeSheet(); toast('Zapisane'); if (!d.id) location.hash = '#/psy/' + o.id;
    });
    s.querySelector('#dd')?.addEventListener('click', async () => { if (await confirmSheet('Usunąć psa?', `Pies „${d.imie}” zniknie z listy u wszystkich wolontariuszy. Historia spacerów zostanie.`, 'Usuń', true)) { await remove('psy', d.id); location.hash = '#/psy'; } });
  });
}
actions['dog-edit'] = async (el) => dogForm(await get('psy', el.dataset.id));

// ========== import ze strony schroniska ==========
const normPlec = (t = '') => (/suk|samic|dziewcz/i.test(t) ? 'suka' : /pies|samiec|piesek|chłop/i.test(t) ? 'samiec' : '');
export function dogFromImport(imp, old = {}) {
  const f = imp.fields || {};
  return {
    ...old,
    id: old.id || (imp.id ? 'd' + imp.id : 'm' + uid()),
    imie: imp.name || old.imie, plec: normPlec(f.plec) || old.plec || '', wiek: f.wiek || old.wiek || '', wielkosc: f.wielkosc || old.wielkosc || '',
    waga: f.waga || old.waga || '', wzrost: f.wzrost || old.wzrost || '', siersc: f.siersc || old.siersc || '',
    status: imp.status || old.status || 'do_adopcji', opis: imp.opis || old.opis || '', zdjecia: imp.zdjecia?.length ? imp.zdjecia : old.zdjecia || [],
    film: imp.film || old.film || '', zrodlo_url: imp.url, zrodlo_id: imp.id, zaimportowano: Date.now(), dodany: old.dodany || Date.now(),
    www_status: imp.status || old.www_status || 'do_adopcji', kanaly: { ...(old.kanaly || {}), www: (old.kanaly || {}).www || Date.now() }
  };
}
export async function importOne(url) {
  const imp = await api('/import?url=' + encodeURIComponent(url));
  if (!imp.name) throw new Error('Nie udało się odczytać imienia psa z tej strony.');
  const id = imp.id ? 'd' + imp.id : null;
  let old = (id && (await get('psy', id))) || {};
  if (!old.id) { // pies dodany wcześniej ręcznie (np. przyjęty, jeszcze bez strony) – połącz po imieniu
    const same = (await list('psy')).find((x) => !x.zrodlo_id && (x.imie || '').trim().toLowerCase() === (imp.name || '').trim().toLowerCase());
    if (same) old = same;
  }
  const dog = dogFromImport(imp, old);
  await save('psy', dog);
  return { dog, updated: !!old.id };
}
const importErr = (e) => (e instanceof ApiError ? (e.status === 0 ? 'Brak połączenia z serwerem.' : e.status === 400 || e.status === 422 || e.status === 502 ? e.message : 'Błąd serwera (' + e.status + ')') : e.message);
export function addDogSheet() {
  openSheet(`<h2>Dodaj psa</h2><p class="hint" style="margin:0 0 14px">Najłatwiej ze strony schroniska: nic nie przepisujesz, zdjęcia i opis dochodzą same.</p>
    <form id="iu" novalidate><div class="field"><label for="iurl">Link do psa na stronie schroniska</label><input class="input" id="iurl" type="url" inputmode="url" placeholder="schronisko-nowodwor.com.pl/psy-do-adopcji/…" autocapitalize="off"></div>
    <div class="err" id="ie" role="alert"></div><button class="btn block" type="submit">${icon('download').s} Importuj psa</button></form>
    <div class="btnrow" style="margin-top:12px"><button class="btn ghost" id="iall">${icon('refresh').s} Importuj wszystkie psy</button><button class="btn ghost" id="iman">${icon('pencil').s} Dodaj ręcznie</button></div>
    <p class="hint" id="ip" style="margin-top:12px"></p>`, (s) => {
    const err = s.querySelector('#ie'), prog = s.querySelector('#ip');
    s.querySelector('#iu').addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = ''; const url = s.querySelector('#iurl').value.trim(); if (!url) { err.textContent = 'Wklej link.'; return; }
      const b = s.querySelector('button[type=submit]'); b.disabled = true; prog.textContent = 'Pobieram dane…';
      try { const { dog, updated } = await importOne(/^https?:/i.test(url) ? url : 'https://' + url); closeSheet(); toast(updated ? `Zaktualizowano: ${dog.imie}` : `Dodano: ${dog.imie}`); location.hash = '#/psy/' + dog.id; }
      catch (x) { b.disabled = false; prog.textContent = ''; err.textContent = importErr(x); }
    });
    s.querySelector('#iman').onclick = () => { closeSheet(); dogForm(); };
    s.querySelector('#iall').onclick = async () => {
      err.textContent = ''; const btn = s.querySelector('#iall'); btn.disabled = true; prog.textContent = 'Szukam psów na stronie…';
      try {
        const r = await api('/import/links'); const links = r.links || []; let ok = 0, fail = 0;
        for (let i = 0; i < links.length; i++) {
          prog.textContent = `Importuję ${i + 1} z ${links.length}…`;
          try { await importOne(links[i]); ok++; } catch { fail++; }
        }
        prog.textContent = `Gotowe: ${ok} psów${fail ? ', nieudane: ' + fail : ''}.`; if (!links.length) err.textContent = 'Nie znalazłem psów na stronie.';
      } catch (x) { err.textContent = importErr(x); prog.textContent = ''; }
      btn.disabled = false;
    };
  });
}
actions['a-dog'] = () => addDogSheet();
actions['dog-refresh'] = async (el) => {
  const d = await get('psy', el.dataset.id); if (!d?.zrodlo_url) return;
  toast('Odświeżam…');
  try { await importOne(d.zrodlo_url); toast('Odświeżono ze strony schroniska'); } catch (x) { toast(importErr(x), true); }
};

// ========== udostępnianie i karta PDF ==========
actions['dog-share'] = async (el) => {
  const d = await get('psy', el.dataset.id), url = d.zrodlo_url || SITE + '/psy-do-adopcji';
  const text = `${d.imie}${d.wiek ? ', ' + d.wiek : ''} szuka domu. ${(d.opis || '').slice(0, 200)}${(d.opis || '').length > 200 ? '…' : ''}`;
  if (navigator.share) { try { await navigator.share({ title: `${d.imie} — Schronisko Nowodwór`, text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Skopiowano opis i link'); } catch { toast('Nie udało się skopiować', true); }
};
actions['dog-print'] = async (el) => {
  const d = await get('psy', el.dataset.id); const pics = (d.zdjecia || []).slice(0, 4);
  const box = document.createElement('div'); box.className = 'printonly';
  box.innerHTML = `<div style="font-family:Georgia,serif;color:#173B32;padding:8mm;max-width:190mm;margin:auto">
    <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px solid #B18A52;padding-bottom:6px"><b style="font-size:30px;letter-spacing:.06em">ŁAPA</b><span style="font-size:11px;letter-spacing:.3em;color:#B18A52">NOWODWÓR</span></div>
    <h1 style="font-size:44px;margin:14px 0 2px">${esc(d.imie)} ${sexSymbol(d.plec)}</h1>
    <div style="font:14px Arial,sans-serif;color:#444;margin-bottom:10px">${esc([d.wiek, d.wielkosc, d.waga && 'waga ' + d.waga, d.wzrost && 'wzrost ' + d.wzrost, d.siersc && 'sierść: ' + d.siersc, STATUS[d.status]].filter(Boolean).join('  ·  '))}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${pics.map((u) => `<img src="${esc(safeUrl(u))}" referrerpolicy="no-referrer" style="width:100%;height:220px;object-fit:cover;border-radius:8px">`).join('')}</div>
    <p style="font:15px/1.5 Arial,sans-serif;color:#222;white-space:pre-line;margin:14px 0">${esc(d.opis || '')}</p>
    <div style="font:13px Arial,sans-serif;border-top:1px solid #ccc;padding-top:8px;color:#333">Więcej o ${esc(d.imie)} i zasady adopcji: ${esc(d.zrodlo_url || SITE)}<br>Wolontariat schroniska dla psów w Nowodworze · schronisko-nowodwor.com.pl</div></div>`;
  document.body.appendChild(box);
  const imgs = [...box.querySelectorAll('img')];
  await Promise.race([Promise.all(imgs.map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })))), new Promise((r) => setTimeout(r, 4000))]);
  const done = () => { box.remove(); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done); print();
};
