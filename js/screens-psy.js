import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, dogImg, safeUrl, sexSymbol, STATUS, statusChip, confirmSheet, pageBar } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName, unlock } from './auth.js';
import { SITE } from './config.js';
import { fmtDate, fmtShort, ago, dogNeeds, NEED_LABELS } from './util.js';
import { hydratePhotos } from './photos.js';
import { boksPill, wybPill, wybCls, boks, opis, opisLine, linie, kolejnosc, kolejnoscHtml, poBoksie } from './znak.js';
import { aktywny, byl, miejsce, OCENA_POLA, OCENA_LBL } from './teczka.js';
import { cardAdm, znaczekStrony } from './kompendium.js';
import { zglDane, chipyPotrzeb } from './wolontariusz.js';

const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const favs = () => new Set(lsGet('lapa.fav', []));
const dogPics = (d) => (d.zdjecia || []).map((u) => ({ url: u })); // zdjęcia ze strony schroniska
const picImg = (p, alt, cls = '') => (p.url ? dogImg(p.url, alt, cls) : raw(`<img class="${esc(cls)}" data-photo="${esc(p.id)}" alt="${esc(alt)}" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`));
export const dogThumb = (d) => {
  const p = dogPics(d)[0];
  if (!p) return html`<div class="nophoto">${icon('paw')}</div>`;
  if (p.url) return dogImg(p.url.replace(/_l\.(jpe?g)(\?.*)?$/i, '_m.$1$2'), d.imie, '', p.url);
  return picImg(p, d.imie);
};

// ========== lista psów ==========
let fq = '', ff = 'aktywne';
// Filtry listy Psy: Wszystkie, W schronisku, Ulubione i „Byli u nas” (psy z zakładki „Adoptowane” na stronie schroniska).
const FILTERS = [['aktywne', 'Wszystkie'], ['schronisko', 'W schronisku'], ['ulubione', 'Ulubione'], ['byli', 'Byli u nas']];
const lata = (d) => {
  if (!d.od_www) return '';
  const a = new Date(d.od_www).getFullYear(), b = d.adoptowany_od ? new Date(d.adoptowany_od).getFullYear() : 0;
  return !b ? 'u nas od ' + a : a === b ? 'u nas w ' + a : `u nas ${a}–${b}`;
};
function filterDogs(dogs, walks = []) {
  const q = fq.trim().toLowerCase(), f = favs();
  return dogs.filter((d) => {
    if (q && !(d.imie || '').toLowerCase().includes(q)) return false;
    if (ff === 'byli') return byl(d);
    if (byl(d)) return false;
    if (ff === 'aktywne') return true;
    if (ff === 'ulubione') return f.has(d.id);
    if (ff === 'schronisko' || ff === 'dt' || ff === 'hotelik') return miejsce(d) === ff;
    return d.status === ff;
  }).sort(ff === 'byli' ? (a, b) => (b.adoptowany_od || 0) - (a.adoptowany_od || 0) || (b.od_www || 0) - (a.od_www || 0) : kolejnosc('psy') === 'boks' ? poBoksie : (a, b) => (b.status === 'pilne') - (a.status === 'pilne') || (a.imie || '').localeCompare(b.imie || '', 'pl'));
}
function lastWalk(walks, id) { const w = walks.filter((x) => x.pies_id === id); return w.length ? Math.max(...w.map((x) => x.end || x.start)) : 0; }
function grid(dogs, walks, zdr = []) {
  const f = filterDogs(dogs, walks);
  if (!f.length) return html`<div class="empty">${icon('paw')}<h3>${dogs.length ? 'Nikogo tu nie ma' : 'Jeszcze nie ma psów'}</h3><p>${dogs.length ? 'Zmień filtr albo wyszukiwanie.' : 'Psy pojawią się same, gdy serwer sprawdzi stronę schroniska.'}</p></div>`;
  return html`<div class="dogs">${f.map((d) => { const lw = lastWalk(walks, d.id), b = byl(d); return html`<a class="dcard${wybCls(d)}" href="#/psy/${d.id}"><div class="pic">${dogThumb(d)}<span class="bx">${raw(boksPill(d))}</span>${raw(wybPill(d))}<span class="st">${b ? '' : (miejsce(d) === 'dt' || miejsce(d) === 'hotelik') ? statusChip(miejsce(d)) : ['pilne', 'w_trakcie'].includes(d.status) ? statusChip(d.status) : ''}</span></div>
    <div class="meta"><h3>${d.imie} ${sexSymbol(d.plec)}</h3>${opisLine(d) ? raw(opisLine(d)) : d.haslo ? html`<div class="m2" style="font-style:italic;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${String(d.haslo).replace(/^.*?\s[-–—]\s/, '')}</div>` : ''}${d.wiek || d.wielkosc ? html`<div class="m2">${[d.wiek, d.wielkosc].filter(Boolean).join(' · ')}</div>` : ''}${b ? html`<div class="m2">${lata(d)}</div>` : lw ? html`<div class="m2">Spacer: ${ago(lw)}</div>` : ''}</div></a>`; })}</div>`;
}
export async function list_() {
  if (!FILTERS.some(([k]) => k === ff)) ff = 'aktywne';
  const [dogs, walks] = await Promise.all([list('psy'), list('spacery')]); const zdr = [];
  return {
    tab: 'psy', title: 'Psy',
    html: html`${pageBar('Psy', { back: false, ico: 'paw', img: 'img/naglowki/psy.webp' })}
    <div class="pad"><div class="search">${icon('search')}<input id="fq" type="search" placeholder="Szukaj psa po imieniu" value="${fq}" aria-label="Szukaj psa" autocomplete="off"></div></div>
    <div class="fchips" role="group" aria-label="Filtr">${FILTERS.map(([k, l]) => html`<button class="chip dark ${ff === k ? 'on' : ''}" data-act="dog-filter" data-k="${k}" aria-pressed="${ff === k}">${l}</button>`)}</div>
    <div class="pad" style="margin-top:-6px">${raw(kolejnoscHtml('psy'))}</div>
    <div id="grid">${grid(dogs, walks, zdr)}</div>`,
    mount(root) {
      const inp = root.querySelector('#fq'), g = root.querySelector('#grid');
      inp.addEventListener('input', () => { fq = inp.value; g.innerHTML = grid(dogs, walks, zdr).s; hydratePhotos(g); });
      hydratePhotos(root);
    }
  };
}
export { list_ as list };
// #/byli (dawniej #/adoptowane i #/archiwum) – lista Psy z filtrem „Byli u nas”
export async function byli() { ff = 'byli'; return list_(); }
export const ustawFiltr = (k) => { ff = k; };
actions['dog-filter'] = (el) => { ff = el.dataset.k; dispatchEvent(new HashChangeEvent('hashchange')); };

// ========== wybór psa (notatka, transport, dom tymczasowy) ==========
export async function pickDog(cb) {
  const dogs = (await list('psy')).filter(aktywny).sort((a, b) => (a.imie || '').localeCompare(b.imie || '', 'pl'));
  if (!dogs.length) { toast('Nie ma jeszcze psów. Pojawią się same ze strony schroniska.', true); return; }
  const paint = (q, root) => {
    const f = dogs.filter((d) => (d.imie || '').toLowerCase().includes(q.toLowerCase()));
    root.innerHTML = f.length ? f.map((d) => `<button class="row" data-pick="${esc(d.id)}"><span class="avatar sm${wybCls(d)}">${dogThumb(d).s}</span><span class="rt"><b>${esc(d.imie)} ${sexSymbol(d.plec)} ${boksPill(d, 'in')}</b>${linie(d)}<small>${esc([d.wiek, d.wielkosc].filter(Boolean).join(' · '))}</small></span>${icon('chev').s}</button>`).join('') : '<p class="hint">Nie ma takiego psa.</p>';
    hydratePhotos(root);
  };
  openSheet(`<h2>Wybierz psa</h2><div class="field"><input class="input" id="pq" type="search" placeholder="Szukaj po imieniu" autocomplete="off"></div><div id="pl" class="rows"></div>`, (s) => {
    const l = s.querySelector('#pl'); paint('', l);
    s.querySelector('#pq').addEventListener('input', (e) => paint(e.target.value, l));
    l.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (!b) return; const d = dogs.find((x) => x.id === b.dataset.pick); closeSheet(); cb(d); });
  });
}

// ========== karta psa ==========
const brakPsa = () => ({ tab: 'psy', nav: false, html: html`<div class="empty" style="padding-top:90px">${icon('paw')}<h3>Nie ma takiego psa</h3><a class="btn gold" href="#/psy">Wróć do listy</a></div>` });
export async function card(id) {
  const d = await get('psy', id);
  if (!d || d.zniknal_ze_strony) return brakPsa(); // psa nie ma nigdzie na stronie schroniska
  if (!state.admin) return cardWol(id);
  return (await cardAdm(id, { pics: dogPics(d), picImg, isFav: favs().has(id) })) || brakPsa();
}
const plural = (n, a, b, c) => (n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);

actions['dog-fav'] = (el) => { const f = favs(); f.has(el.dataset.id) ? f.delete(el.dataset.id) : f.add(el.dataset.id); lsSet('lapa.fav', [...f]); dispatchEvent(new HashChangeEvent('hashchange')); };
actions['dog-walks'] = async (el) => {
  const mine = (await list('spacery')).filter((w) => w.pies_id === el.dataset.id).sort((a, b) => b.start - a.start);
  openSheet(`<h2>Historia spacerów</h2>${mine.length ? mine.map((w) => `<a class="row" href="#/raport/${esc(w.id)}"><span class="rt"><b>${esc(fmtDate(w.start))}</b><small>${esc([w.osoba || w.autor || '', !w.end && w.tryb === 'brama' ? 'teraz na spacerze' : Math.round(w.czas_min || (w.end ? (w.end - w.start) / 60000 : 0)) + ' min', w.dystans_km ? w.dystans_km.toFixed(1).replace('.', ',') + ' km' : ''].filter(Boolean).join(' · '))}</small></span>${icon('chev').s}</a>`).join('') : '<p class="hint" style="font-size:15px">Brak udokumentowanych spacerów.</p>'}`);
};
actions['dog-obs'] = async (el) => {
  const obs = (await list('obserwacje')).filter((o) => o.pies_id === el.dataset.id).sort((a, b) => b.ts - a.ts);
  openSheet(`<h2>Notatki</h2>${obs.length ? obs.map((o) => `<div class="obs"><div class="oh"><span>${esc(o.autor || '')}</span><span>${esc(fmtShort(o.ts))} <button class="iconbtn" style="width:28px;height:28px;color:var(--terra-d)" data-act="obs-del" data-id="${esc(o.id || '')}" aria-label="Usuń">${icon('trash').s}</button></span></div><div style="white-space:pre-line">${esc(o.tekst)}</div></div>`).join('') : '<p class="hint" style="font-size:15px">Brak notatek.</p>'}<button class="btn block" style="margin-top:16px" data-act="dog-obs-add" data-id="${esc(el.dataset.id)}">${icon('pencil').s} Dodaj notatkę</button>`);
};
actions['obs-del'] = async (el) => { if (!el.dataset.id) return; if (await confirmSheet('Usunąć notatkę?', 'Zniknie u wszystkich wolontariuszy.', 'Usuń', true)) { await remove('obserwacje', el.dataset.id); toast('Usunięto'); closeSheet(); } };
actions['dog-obs-add'] = (el) => obsForm(el.dataset.id);
export function obsForm(dogId) {
  openSheet(`<h2>Nowa notatka</h2><form id="of" novalidate><div class="field"><label for="otx">Notatka o psie</label><textarea class="textarea" id="otx" maxlength="1500" placeholder="np. dziś pierwszy raz podszedł do ręki; po zabiegu oszczędza łapę"></textarea></div><div class="err" id="oe"></div>
    <button class="btn block" type="submit">Zapisz notatkę</button></form>`, (s) => {
    s.querySelector('#of').addEventListener('submit', async (e) => {
      e.preventDefault(); const t = s.querySelector('#otx').value.trim();
      if (t.length < 3) { s.querySelector('#oe').textContent = 'Napisz krótko, co chcesz zapamiętać.'; return; }
      await save('obserwacje', { pies_id: dogId, tekst: t, ts: Date.now(), autor: getName() }); closeSheet(); toast('Notatka zapisana');
    });
    s.querySelector('#otx').focus();
  });
}
actions['unlock-sheet'] = () => unlockSheet();
export function unlockSheet(after) {
  openSheet(`<h2>Hasło administratora</h2><p class="hint" style="margin:0 0 14px">Dla osób pracujących w schronisku. Odblokuje pełną aplikację (Brama, terminarz, karty psów, domy tymczasowe, finanse) i zostanie włączone na stałe na tym telefonie.</p>
    <form id="uf" novalidate><div class="field"><label for="up">Hasło administratora</label><input class="input" id="up" type="password" autocomplete="off" autocapitalize="off"></div><div class="err" id="ue" role="alert"></div><button class="btn block" type="submit">${icon('unlock').s} Odblokuj</button></form>`, (s) => {
    s.querySelector('#uf').addEventListener('submit', async (e) => {
      e.preventDefault(); const b = s.querySelector('button'); b.disabled = true;
      try { const r = await unlock(s.querySelector('#up').value); closeSheet(); toast('Tryb administratora włączony'); after?.(); }
      catch (err) { b.disabled = false; s.querySelector('#ue').textContent = err.status === 429 ? 'Za dużo prób. Spróbuj za kilka minut.' : err.status === 0 ? 'Brak połączenia.' : 'Nieprawidłowe hasło administratora.'; }
    });
    s.querySelector('#up').focus();
  });
}
actions['dog-needs'] = async (el) => {
  const d = await get('psy', el.dataset.id); const cur = new Set(d.potrzeby || []), inne = [...cur].find((k) => String(k).startsWith('inne:'));
  openSheet(`<h2>Czego potrzebuje ${esc(d.imie)}?</h2><p class="hint" style="margin:0 0 14px">Zaznacz, w czym wolontariusze mogą pomóc. Pojawi się to na ekranie „Pomoc”. Część potrzeb (np. brak zdjęć) aplikacja dodaje sama.</p>
    <div class="chips" id="nc">${Object.entries(NEED_LABELS).map(([k, l]) => `<button class="chip outline ${cur.has(k) ? 'on' : ''}" data-k="${k}" aria-pressed="${cur.has(k)}">${l}</button>`).join('')}<button class="chip outline ${inne ? 'on' : ''}" data-k="inne" aria-pressed="${!!inne}">Inne</button></div>
    <div class="field" id="ni_f" style="margin-top:12px"${inne ? '' : ' hidden'}><label for="ni">Czego jeszcze potrzebuje?</label><input class="input" id="ni" maxlength="80" autocomplete="off" placeholder="np. ciepły kocyk, kaganiec" value="${esc(inne ? inne.slice(5) : '')}"></div>
    <div class="err" id="ne"></div><button class="btn block" style="margin-top:18px" id="ns">Zapisz</button>`, (s) => {
    const pole = s.querySelector('#ni_f'), ni = s.querySelector('#ni');
    s.querySelector('#nc').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); if (b.dataset.k === 'inne') { pole.hidden = !b.classList.contains('on'); if (!pole.hidden) ni.focus(); } });
    s.querySelector('#ns').onclick = async () => {
      const wyb = [...s.querySelectorAll('#nc .on')].map((b) => b.dataset.k), t = ni.value.trim().replace(/\s+/g, ' ');
      if (wyb.includes('inne') && !t) { s.querySelector('#ne').textContent = 'Wpisz, czego jeszcze potrzebuje, albo odznacz „Inne”.'; return; }
      d.potrzeby = wyb.map((k) => (k === 'inne' ? 'inne:' + t : k)); await save('psy', d); closeSheet(); toast('Zapisane');
    };
  });
};

// ========== karta psa dla wolontariusza: tylko podgląd tego, co jest na stronie schroniska ==========
// Zdjęcia, dane, opis, charakter (z opisu), czego potrzebuje (ze zgłoszeniem), historia spacerów, link do ogłoszenia, Udostępnij.
// Pies z „Byli u nas”: tylko zdjęcia, dane, hasło i opis.
async function cardWol(id) {
  const [d, walks, z] = await Promise.all([get('psy', id), list('spacery'), zglDane()]);
  if (!d) return { tab: 'psy', nav: false, html: html`<div class="empty" style="padding-top:90px">${icon('paw')}<h3>Nie ma takiego psa</h3><a class="btn gold" href="#/psy">Wróć do listy</a></div>` };
  const mine = walks.filter((w) => w.pies_id === id).sort((a, b) => b.start - a.start), km = mine.reduce((s, w) => s + (w.dystans_km || 0), 0);
  const b = byl(d), pics = dogPics(d), isFav = favs().has(id), needs = b ? [] : dogNeeds(d, walks), o = b ? {} : d.ocena || {};
  const ocena = OCENA_POLA.filter(([p]) => o[p]).map(([p, l]) => `<div class="ocr"><span>${esc(l)}</span><b class="oc-${esc(o[p])}">${esc(OCENA_LBL[o[p]] || '')}</b></div>`).join('');
  return {
    tab: 'psy', title: d.imie, live: true,
    html: html`<section class="dogtop"><div class="topact"><button class="iconbtn" data-act="back" aria-label="Wstecz">${icon('back')}</button>
        <span style="display:flex;gap:8px"><button class="iconbtn" data-act="dog-fav" data-id="${id}" aria-pressed="${isFav}" aria-label="Ulubiony">${raw(icon('heart').s.replace('class="ico', isFav ? 'style="fill:var(--terra);stroke:var(--terra)" class="ico' : 'class="ico'))}</button>
        ${b ? '' : html`<button class="iconbtn" data-act="dog-share" data-id="${id}" aria-label="Udostępnij">${icon('share')}</button>`}</span></div>
      <div class="gal" id="gal">${pics.length ? pics.map((p) => html`<div>${picImg(p, d.imie)}</div>`) : html`<div><div class="nophoto">${icon('paw')}</div></div>`}</div>
      ${pics.length > 1 ? html`<div class="dots" id="dots">${pics.map((_, i) => html`<i class="${i ? '' : 'on'}"></i>`)}</div>` : ''}</section>
    <section class="dogsheet"><h1>${d.imie} <span class="sex">${sexSymbol(d.plec)}</span></h1>
      ${b ? html`<div class="khead">${raw(znaczekStrony(d))}<span class="hint">${lata(d)}</span></div>` : ''}
      <div class="meta">${b ? '' : raw(boksPill(d, 'big'))}${[d.wiek, d.wielkosc, d.waga && 'ok. ' + String(d.waga).replace(/^ok\.?\s*/i, ''), !b && d.status && STATUS[d.status]].filter(Boolean).map((t) => html`<span>${t}</span>`)}</div>
      <div class="chips">${[d.wzrost && 'Wzrost ' + d.wzrost, d.siersc && 'Sierść: ' + String(d.siersc).toLowerCase(), d.haslo].filter(Boolean).map((t) => html`<span class="chip">${t}</span>`)}</div>
      ${d.opis ? html`<p class="desc">${d.opis}</p>` : ''}
      ${ocena ? html`<h3 class="wolh">Charakter</h3><div class="ocena">${raw(ocena)}</div>` : ''}
      ${needs.length ? html`<h3 class="wolh">Czego potrzebuje</h3><div class="chips">${raw(chipyPotrzeb(d, needs, z.dek))}</div><p class="hint" style="margin:6px 0 0">Dotknij, żeby zgłosić, że się tym zajmiesz.</p>` : ''}
      ${b ? '' : html`<div class="rows" style="margin-top:14px">
        <button class="row" data-act="dog-walks" data-id="${id}">${icon('paw')}<span class="rt"><b>Historia spacerów</b><small>${mine.length} ${plural(mine.length, 'spacer', 'spacery', 'spacerów')}${km ? ' | ' + km.toFixed(1).replace('.', ',') + ' km' : ''}${mine[0] ? ' | ostatni ' + ago(mine[0].start) : ''}</small></span>${icon('chev')}</button>
        ${d.zrodlo_url ? html`<a class="row" href="${safeUrl(d.zrodlo_url)}" target="_blank" rel="noopener">${icon('link')}<span class="rt"><b>Ogłoszenie na stronie schroniska</b><small>Otwórz w przeglądarce</small></span>${icon('chev')}</a>` : ''}
      </div>`}
    </section>`,
    mount(root) {
      const gal = root.querySelector('#gal'), dots = root.querySelectorAll('#dots i');
      gal?.addEventListener('scroll', () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); dots.forEach((x, k) => x.classList.toggle('on', k === i)); }, { passive: true });
      hydratePhotos(root);
    }
  };
}

// ========== udostępnianie ==========
actions['dog-share'] = async (el) => {
  const d = await get('psy', el.dataset.id), url = d.zrodlo_url || SITE + '/psy-do-adopcji';
  const text = `${d.imie}${d.wiek ? ', ' + d.wiek : ''} szuka domu. ${(d.opis || '').slice(0, 200)}${(d.opis || '').length > 200 ? '…' : ''}`;
  if (navigator.share) { try { await navigator.share({ title: `${d.imie} — Schronisko Nowodwór`, text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Skopiowano opis i link'); } catch { toast('Nie udało się skopiować', true); }
};
