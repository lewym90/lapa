// Karta psa (administrator): przyjęcie nowego psa i poprawianie każdego psa w 5 krokach.
// Każde pole zapisuje się samo (po chwili od wpisania albo od razu po dotknięciu przycisku). Można wyjść w każdej chwili i wrócić.
// Wymagane jest tylko imię. Na telefonie: jeden krok na ekran, „Wstecz / Dalej”. Na komputerze: kroki z lewej, pola w dwóch kolumnach, podgląd z prawej.
import { raw, esc, icon, toast, confirmSheet, actions, STATUS, sexSymbol } from './ui.js';
import { get, save } from './store.js';
import { uid } from './util.js';
import { OCENA_POLA, KANALY, kroki, KROKI } from './teczka.js';
import { czyscBoks } from './znak.js';
import { dogThumb, usunPsa } from './screens-psy.js';
import { addPhotoFile, hydratePhotos, removeLocalPhoto } from './photos.js';
import { szkicHasla, szkicOpisu } from './szkic.js';

const d10 = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const g = (d, m, f) => (d && d.plec === 'suka' ? f : m);
const WIEK = [['szczeniak', 'Szczeniak'], ['mlody', 'Młody'], ['dorosly', 'Dorosły'], ['senior', 'Senior']];
const WIELK = [['mały', 'Mały'], ['średni', 'Średni'], ['duży', 'Duży']];
const SKAD = [['znaleziony', 'Znaleziony'], ['oddany', 'Oddany przez właściciela'], ['interwencja', 'Interwencja'], ['inne', 'Inne']];
const ZDR = [['czip', 'Czip'], ['szczep', 'Szczepienie'], ['odrob', 'Odrobaczenie'], ['kastr', 'Kastracja / sterylizacja']];
const TRI = [['tak', 'Tak'], ['nie', 'Nie'], ['?', 'Nie wiem']];
const OCENY = [['ok', 'Bardzo dobrze'], ['neutral', 'Neutralnie'], ['ostroznie', 'Ostrożnie'], ['nie', 'Słabo']];
const CECHY = [['przyjazny', 'przyjazna'], ['spokojny', 'spokojna'], ['energiczny', 'energiczna'], ['wesoły', 'wesoła'], ['łagodny', 'łagodna'], ['przytulas', 'przytulaska'],
  ['nieśmiały', 'nieśmiała'], ['czujny', 'czujna'], ['mądry', 'mądra'], ['posłuszny', 'posłuszna'], ['lubi zabawę', 'lubi zabawę'], ['lubi spacery', 'lubi spacery'], ['kanapowiec', 'kanapowa'], ['zna komendy', 'zna komendy']];
const STATUSY = ['schronisko', 'do_adopcji', 'pilne', 'w_trakcie'];
const OPISY_KROKOW = [
  'Wystarczy imię. Resztę wpisz, jeśli wiesz. Możesz wrócić w każdej chwili.',
  'Zaznacz, co wiadomo. „Nie wiem” też jest odpowiedzią.',
  'Najlepiej po pierwszych spacerach. Dotknij jeszcze raz, żeby odznaczyć.',
  'Dodaj zdjęcia z telefonu albo przeciągnij je z komputera. Gwiazdka oznacza zdjęcie główne.',
  'Hasło i opis do ogłoszenia. „Napisz szkic za mnie” ułoży tekst z danych z poprzednich kroków.'
];

// ---------- drobne kawałki HTML ----------
const pole = (f, label, val, o = {}) => `<div class="field${o.full ? ' full' : ''}"><label for="k_${f.replace('.', '_')}">${label}${o.req ? ' <span class="kreq">wymagane</span>' : ''}</label>
  <input class="input" id="k_${f.replace('.', '_')}" data-f="${f}" value="${esc(val ?? '')}" maxlength="${o.max || 60}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.type ? `type="${o.type}"` : ''} ${o.mode ? `inputmode="${o.mode}"` : ''} autocomplete="off"></div>`;
const obszar = (f, label, val, o = {}) => `<div class="field full"><label for="k_${f}">${label}</label><textarea class="textarea" id="k_${f}" data-f="${f}" maxlength="${o.max || 4000}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} style="min-height:${o.h || 110}px">${esc(val ?? '')}</textarea></div>`;
const wybor = (f, label, opts, val, o = {}) => `<div class="field${o.full ? ' full' : ''}"><span class="lbl">${label}</span><div class="kseg" role="group" aria-label="${esc(label)}">${opts.map(([v, l]) => `<button type="button" class="chip outline${String(val ?? '') === v ? ' on' : ''}" data-seg="${f}" data-v="${esc(v)}" aria-pressed="${String(val ?? '') === v}">${esc(l)}</button>`).join('')}</div></div>`;

function krok1(d) {
  const p = d.pochodzenie || {};
  return `<div class="kfoto full">${fotoGlowne(d)}</div>
    ${pole('imie', 'Imię', d.imie, { req: true, max: 40, ph: 'np. Saba (może być robocze)', full: true })}
    ${wybor('plec', 'Płeć', [['samiec', 'Samiec ♂'], ['suka', 'Suka ♀']], d.plec, { full: true })}
    ${wybor('wiek_kat', 'Wiek', WIEK, d.wiek_kat)}
    ${pole('wiek', 'Wiek dokładniej', d.wiek, { ph: 'np. ok. 3 lata' })}
    ${wybor('wielkosc', 'Wielkość', WIELK, (WIELK.find(([v]) => String(d.wielkosc || '').toLowerCase().startsWith(v.slice(0, 3))) || [''])[0])}
    ${pole('waga', 'Waga', d.waga, { ph: 'np. 18 kg' })}
    ${pole('boks', 'Boks', d.boks, { ph: 'np. 12, 7a', max: 8 })}
    ${pole('data_przyjecia', 'Data przyjęcia', d.data_przyjecia ? d10(d.data_przyjecia) : '', { type: 'date' })}
    ${wybor('pochodzenie.typ', 'Skąd trafił do schroniska', SKAD, p.typ, { full: true })}
    ${pole('pochodzenie.gdzie', 'Gdzie / szczegóły', p.gdzie, { ph: 'np. znaleziony w Rykach przy stacji', full: true, max: 120 })}`;
}
function krok2(d) {
  const z = d.zdr || {};
  return `${ZDR.map(([k, l]) => `<div class="krow full"><span class="krl">${l}</span><div class="kseg" role="group" aria-label="${l}">${TRI.map(([v, t]) => `<button type="button" class="chip outline${z[k] === v ? ' on' : ''}" data-seg="zdr.${k}" data-v="${v}" aria-pressed="${z[k] === v}">${t}</button>`).join('')}</div></div>
      ${k === 'czip' ? `<div class="full" id="kchip"${z.czip === 'tak' ? '' : ' hidden'}>${pole('chip', 'Numer czipa', d.chip, { mode: 'numeric', max: 20, full: true })}</div>` : ''}`).join('')}
    ${obszar('zdr_uwagi', 'Uwagi o zdrowiu', d.zdr_uwagi, { ph: 'np. alergia pokarmowa, kuleje na tylną łapę', h: 90, max: 600 })}
    <div class="full"><button type="button" class="btn ghost sm" data-k="zdrowie-wpisy">${icon('medic').s} Wizyty, leki i terminy (szczegóły)</button></div>`;
}
function krok3(d) {
  const o = d.ocena || {}, tagi = d.tagi || [], znane = new Set(CECHY.flat());
  const cechy = [...CECHY.map(([m, f]) => g(d, m, f)), ...tagi.filter((t) => !znane.has(t))];
  return `${OCENA_POLA.map(([k, l]) => `<div class="krow full"><span class="krl">${l}</span><div class="kseg" role="group" aria-label="${l}">${OCENY.map(([v, t]) => `<button type="button" class="chip outline${o[k] === v ? ' on' : ''}" data-seg="ocena.${k}" data-v="${v}" data-toggle="1" aria-pressed="${o[k] === v}">${t}</button>`).join('')}</div></div>`).join('')}
    <div class="field full"><span class="lbl">Cechy</span><div class="kseg" role="group" aria-label="Cechy">${[...new Set(cechy)].map((t) => `<button type="button" class="chip outline${tagi.includes(t) ? ' on' : ''}" data-tag="${esc(t)}" aria-pressed="${tagi.includes(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="kadd"><input class="input" id="k_tag" maxlength="30" placeholder="Inna cecha, np. boi się burzy" autocomplete="off"><button type="button" class="btn ghost" data-k="tag-dodaj">Dodaj</button></div></div>`;
}
function krok4() {
  return `<label class="drop full" id="kdrop" tabindex="0"><b>${icon('camera').s} Dodaj zdjęcia</b><span>Na telefonie: aparat lub galeria. Na komputerze: przeciągnij tu pliki albo kliknij i wybierz kilka naraz.</span>
      <input type="file" id="kpf" accept="image/*" multiple hidden></label>
    <p class="hint full" id="kpst" aria-live="polite" style="margin:0"></p>
    <div class="full" id="kfotki"></div>`;
}
function krok5(d) {
  const k = d.kanaly || {};
  return `<div class="full kszkic"><button type="button" class="btn gold block" data-k="szkic">✨ Napisz szkic za mnie</button><p class="hint" style="margin:6px 2px 0">Ułoży hasło i opis z danych z kroków 1–3. Potem po prostu popraw, co chcesz.</p></div>
    ${pole('haslo', 'Hasło (tytuł ogłoszenia)', d.haslo, { ph: 'np. SABA – czeka na swój dom', full: true, max: 140 })}
    ${obszar('opis', 'Opis do ogłoszenia', d.opis, { h: 220 })}
    ${wybor('status', 'Status', STATUSY.map((s) => [s, STATUS[s]]), d.status || 'schronisko', { full: true })}
    <div class="field full"><span class="lbl">Gdzie już jest ogłoszony</span><div class="kseg" role="group" aria-label="Gdzie ogłoszony">${KANALY.map(([x, l]) => `<button type="button" class="chip outline${k[x] ? ' on' : ''}" data-kanal="${x}" aria-pressed="${!!k[x]}">${esc(l.split(' (')[0])}</button>`).join('')}</div></div>
    <div class="full"><a class="btn ghost sm" href="#/social/adopcja/${esc(d.id || '')}">${icon('share').s} Gotowe teksty postów (Facebook, Instagram…)</a></div>
    <div class="full kpodglad-in"><h3 class="ph">Podgląd ogłoszenia</h3><div class="kpv"></div></div>`;
}
function fotoGlowne(d) {
  const ma = (d.moje_zdjecia || []).length + (d.zdjecia || []).length;
  return `<button type="button" class="kfotobtn" data-k="foto1" aria-label="${ma ? 'Dodaj kolejne zdjęcie' : 'Dodaj zdjęcie'}">${ma ? `<span class="kfotomin">${dogThumb(d).s}</span>` : `<span class="kfotoikona">${icon('camera').s}</span>`}<span><b>${ma ? 'Zdjęcie jest' : 'Zrób lub dodaj zdjęcie'}</b><small>${ma ? `${ma} ${ma === 1 ? 'zdjęcie' : ma < 5 ? 'zdjęcia' : 'zdjęć'} · dotknij, żeby dodać kolejne` : 'Od razu z aparatu albo z galerii'}</small></span></button><input type="file" id="kpf1" accept="image/*" capture="environment" hidden>`;
}

// ---------- podgląd (jak zobaczą to ludzie) ----------
function podglad(d) {
  const z = d.zdr || {}, o = d.ocena || {};
  const chips = [d.wiek || (WIEK.find(([v]) => v === d.wiek_kat) || [])[1], d.wielkosc, d.waga, d.boks ? 'Boks ' + d.boks : ''].filter(Boolean);
  const zd = ZDR.filter(([k]) => z[k] === 'tak').map(([, l]) => l.split(' /')[0]);
  const oc = OCENA_POLA.filter(([k]) => o[k] && k !== 'auto').map(([k, l]) => `${l.replace(/^(Do|Na) /, '')}: ${(OCENY.find(([v]) => v === o[k]) || [])[1] || ''}`);
  return `<div class="kpcard"><div class="kpfoto">${dogThumb(d).s}</div><div class="kpbody">
    <h3>${esc(d.imie || 'Imię psa')} <span class="sx">${sexSymbol(d.plec)}</span></h3>
    ${chips.length ? `<div class="kpchips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
    ${d.haslo ? `<p class="kphaslo">${esc(d.haslo)}</p>` : ''}
    ${d.opis ? `<p class="kpopis">${esc(String(d.opis).slice(0, 700))}${String(d.opis).length > 700 ? '…' : ''}</p>` : '<p class="hint">Tu pojawi się opis.</p>'}
    ${zd.length ? `<p class="kpmini">✓ ${esc(zd.join(' · '))}</p>` : ''}
    ${oc.length ? `<p class="kpmini">${esc(oc.join(' · '))}</p>` : ''}
    ${(d.tagi || []).length ? `<div class="kpchips">${d.tagi.map((t) => `<span class="chip gold">${esc(t)}</span>`).join('')}</div>` : ''}
  </div></div>`;
}
function kropki(d, n, maId) {
  const st = kroki(d || {});
  return KROKI.map(([, l], i) => {
    const s = st[i], on = i + 1 === n;
    return `<button type="button" class="kst${s.done ? ' ok' : ''}${on ? ' on' : ''}" data-go="${i + 1}" ${!maId && i ? 'disabled' : ''} aria-current="${on ? 'step' : 'false'}" aria-label="Krok ${i + 1}: ${l}${s.done ? ' (uzupełniony)' : ''}">
      <span class="kdot">${s.done ? '✓' : i + 1}</span><span class="kl">${l}</span><span class="ks">${s.done ? 'uzupełnione' : on ? 'teraz' : 'do uzupełnienia'}</span></button>`;
  }).join('');
}

// ---------- ekran ----------
export async function karta(idArg, krokArg) {
  const nowy = idArg === 'nowy';
  const d0 = nowy ? null : await get('psy', idArg);
  if (!nowy && !d0) return { tab: 'psy', nav: false, html: raw(`<div class="empty" style="padding-top:90px">${icon('paw').s}<h3>Nie ma takiego psa</h3><a class="btn gold" href="#/psy">Wróć do listy</a></div>`) };
  const n = Math.min(5, Math.max(1, +krokArg || 1));
  const d = d0 || { imie: '', data_przyjecia: Date.now() };
  const forms = [krok1, krok2, krok3, krok4, krok5];
  const [, label] = KROKI[n - 1];
  return {
    tab: 'psy', title: (d.imie || 'Nowy pies') + ' · karta', nav: false, live: false,
    html: raw(`<div class="karta">
      <header class="topbar kbar"><button class="iconbtn" data-k="wyjdz" aria-label="Zamknij kartę">${icon('back').s}</button>
        <h1 id="ktyt">${esc(d.imie || 'Przyjmij nowego psa')}</h1><span class="kzap" id="kzap" aria-live="polite">${nowy ? '' : 'Zapisane ✓'}</span></header>
      <div class="kgrid">
        <nav class="kkroki" aria-label="Kroki karty" id="kkroki">${kropki(d, n, !nowy)}</nav>
        <section class="kform card">
          <div class="khead"><span class="knr">Krok ${n} z 5</span><h2>${label}</h2><p class="hint">${OPISY_KROKOW[n - 1]}</p></div>
          <form class="kpola" id="kpola" novalidate autocomplete="off">${forms[n - 1](d)}</form>
          <p class="err" id="kerr" role="alert"></p>
          <div class="knav">
            ${n > 1 ? `<button type="button" class="btn ghost" data-k="prev">${icon('back').s} Wstecz</button>` : '<span></span>'}
            ${n < 5 ? `<button type="button" class="btn" data-k="next">Dalej ${icon('chev').s}</button>` : `<button type="button" class="btn" data-k="koniec">${icon('check').s} Gotowe</button>`}
          </div>
          ${nowy ? '' : `<div class="kfoot"><button type="button" class="link kusun" data-k="usun">${icon('trash').s} Usuń psa (pomyłka)</button></div>`}
        </section>
        <aside class="kpodglad" aria-label="Podgląd"><h3 class="ph">Podgląd</h3><div class="kpv"></div></aside>
      </div></div>`),
    mount(root) { mountKarta(root, d0, n); }
  };
}

function setPath(o, p, v) {
  const ks = p.split('.'); let c = o;
  for (let i = 0; i < ks.length - 1; i++) { c[ks[i]] = c[ks[i]] && typeof c[ks[i]] === 'object' ? { ...c[ks[i]] } : {}; c = c[ks[i]]; }
  if (v === undefined || v === null || v === '') delete c[ks[ks.length - 1]]; else c[ks[ks.length - 1]] = v;
}
const wartosc = (f, v) => (f === 'boks' ? czyscBoks(v) : f === 'data_przyjecia' ? (v ? new Date(v + 'T12:00').getTime() : null) : typeof v === 'string' ? v.trim() : v);

function mountKarta(app, d0, n) {
  // nasłuchy tylko na elemencie karty (#app zostaje między ekranami, więc nie wolno do niego dopinać)
  const root = app.querySelector('.karta'); if (!root) return;
  const el = (s) => root.querySelector(s);
  let id = d0 ? d0.id : null, cur = d0 ? { ...d0 } : { imie: '', data_przyjecia: Date.now() }, pend = {}, timer = null, busy = Promise.resolve();
  const zap = el('#kzap'), err = el('#kerr');
  const pokaz = (t) => { zap.textContent = t; zap.classList.toggle('kok', t.includes('✓')); };
  const odswiez = () => {
    el('#kkroki').innerHTML = kropki(cur, n, !!id);
    root.querySelectorAll('.kpv').forEach((x) => { x.innerHTML = podglad(cur); }); hydratePhotos(root);
    el('#ktyt').textContent = cur.imie || 'Przyjmij nowego psa';
  };
  // zapis: zbieramy zmiany i zapisujemy na świeżej wersji psa (żeby nie nadpisać tego, co zmienił ktoś inny)
  const zapisz = () => (busy = busy.then(async () => {
    clearTimeout(timer); const p = pend; pend = {};
    if (!Object.keys(p).length) return;
    if (!id) {
      const imie = String(p.imie ?? cur.imie ?? '').trim();
      if (!imie) { pend = { ...p, ...pend }; pokaz(''); return; }
      const o = { id: 'm' + uid(), imie, status: 'schronisko', miejsce: 'schronisko', nowy: true, data_przyjecia: cur.data_przyjecia || Date.now(), dodany: Date.now(), zdjecia: [] };
      for (const [k, v] of Object.entries(p)) setPath(o, k, wartosc(k, v));
      o.imie = imie; await save('psy', o); id = o.id; cur = o;
      history.replaceState(null, '', `#/karta/${id}/${n}`);
      const kf = root.querySelector('.kfoot'); if (!kf) root.querySelector('.knav').insertAdjacentHTML('afterend', `<div class="kfoot"><button type="button" class="link kusun" data-k="usun">${icon('trash').s} Usuń psa (pomyłka)</button></div>`);
      pokaz('Zapisano ✓'); odswiez(); toast(`${imie} ma już kartę w sekcji Psy`); return;
    }
    pokaz('Zapisuję…');
    const fresh = (await get('psy', id)) || cur, nd = { ...fresh };
    for (const [k, v] of Object.entries(p)) { setPath(nd, k, wartosc(k, v)); if (k.startsWith('ocena.')) delete (nd.ocena || {}).auto; }
    if (!String(nd.imie || '').trim()) nd.imie = fresh.imie || cur.imie; // imienia nie da się wyczyścić
    await save('psy', nd); cur = nd; pokaz('Zapisano ✓'); odswiez();
  }).catch((e) => { pokaz(''); toast('Nie udało się zapisać: ' + e.message, true); }));
  const zmiana = (f, v, odRazu = false) => { pend[f] = v; err.textContent = ''; pokaz('…'); clearTimeout(timer); timer = setTimeout(zapisz, odRazu ? 0 : 600); };
  const idzDo = async (k) => {
    await zapisz();
    if (!id) { err.textContent = 'Wpisz imię psa. To jedyne wymagane pole.'; el('#k_imie')?.focus(); return; }
    location.hash = `#/karta/${id}/${k}`;
  };
  // pola tekstowe
  const pola = el('#kpola');
  pola.addEventListener('input', (e) => { const f = e.target.dataset.f; if (f) zmiana(f, e.target.value); if (f === 'imie') el('#ktyt').textContent = e.target.value || 'Przyjmij nowego psa'; });
  pola.addEventListener('change', (e) => { const f = e.target.dataset.f; if (f) { zmiana(f, e.target.value, true); if (f === 'boks') e.target.value = czyscBoks(e.target.value); } });
  pola.addEventListener('submit', (e) => e.preventDefault());
  // Enter = następne pole (na komputerze szybciej), Ctrl+Enter = Dalej
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); idzDo(Math.min(5, n + 1)); return; }
    if (e.key === 'Enter' && e.target.matches('input.input')) {
      e.preventDefault(); if (e.target.id === 'k_tag') { root.querySelector('[data-k=tag-dodaj]').click(); return; }
      const all = [...root.querySelectorAll('#kpola input.input:not([type=file]), #kpola textarea')].filter((x) => x.offsetParent); const i = all.indexOf(e.target);
      if (all[i + 1]) all[i + 1].focus(); else root.querySelector('[data-k=next],[data-k=koniec]')?.focus();
    }
  });
  root.addEventListener('click', async (e) => {
    const go = e.target.closest('[data-go]'); if (go && !go.disabled) { idzDo(+go.dataset.go); return; }
    const seg = e.target.closest('[data-seg]');
    if (seg) {
      const f = seg.dataset.seg, grp = seg.parentElement, was = seg.classList.contains('on');
      const v = was && (seg.dataset.toggle || f.startsWith('pochodzenie') || f === 'wiek_kat' || f === 'wielkosc') ? '' : seg.dataset.v;
      grp.querySelectorAll('[data-seg]').forEach((b) => { const on = b === seg && !!v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      if (f === 'zdr.czip') el('#kchip')?.toggleAttribute('hidden', v !== 'tak');
      if (f === 'plec' && (cur.tagi || []).length) { /* cechy zostają w dotychczasowej formie */ }
      zmiana(f, v, true); return;
    }
    const tag = e.target.closest('[data-tag]');
    if (tag) { const t = tag.dataset.tag, on = !tag.classList.contains('on'); tag.classList.toggle('on', on); tag.setAttribute('aria-pressed', on); const s = new Set(cur.tagi || []); on ? s.add(t) : s.delete(t); cur.tagi = [...s]; zmiana('tagi', [...s].length ? [...s] : '', true); return; }
    const kan = e.target.closest('[data-kanal]');
    if (kan) { const on = !kan.classList.contains('on'); kan.classList.toggle('on', on); kan.setAttribute('aria-pressed', on); zmiana('kanaly.' + kan.dataset.kanal, on ? Date.now() : '', true); return; }
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'next') idzDo(n + 1);
    else if (k === 'prev') idzDo(n - 1);
    else if (k === 'wyjdz') { await zapisz(); location.hash = id ? `#/psy/${id}` : '#/psy'; }
    else if (k === 'koniec') { await zapisz(); if (!id) { err.textContent = 'Wpisz imię psa.'; return; } toast('Zapisane'); location.hash = `#/psy/${id}`; }
    else if (k === 'usun') { await zapisz(); if (id) usunPsa(id); }
    else if (k === 'zdrowie-wpisy') { await zapisz(); if (!id) { err.textContent = 'Najpierw wpisz imię psa (krok 1).'; return; } actions['dog-zdrowie']({ dataset: { id } }); }
    else if (k === 'tag-dodaj') {
      const inp = el('#k_tag'), t = inp.value.trim().toLowerCase(); if (!t) return; inp.value = '';
      const s = new Set(cur.tagi || []); s.add(t); cur.tagi = [...s]; zmiana('tagi', cur.tagi, true);
      const grp = b.closest('.field').querySelector('.kseg'); if (!grp.querySelector(`[data-tag="${CSS.escape(t)}"]`)) grp.insertAdjacentHTML('beforeend', `<button type="button" class="chip outline on" data-tag="${esc(t)}" aria-pressed="true">${esc(t)}</button>`);
    } else if (k === 'szkic') {
      await zapisz(); const d = (id && await get('psy', id)) || cur;
      if ((String(d.opis || '').trim() || String(d.haslo || '').trim()) && !(await confirmSheet('Zastąpić obecny tekst?', 'Hasło i opis zostaną zastąpione szkicem ułożonym z danych psa. Potem możesz go poprawić.', 'Zastąp'))) return;
      const h = szkicHasla(d), o = szkicOpisu(d);
      el('#k_haslo').value = h; el('#k_opis').value = o; pend.haslo = h; pend.opis = o; await zapisz(); toast('Szkic gotowy. Przeczytaj i popraw, co chcesz');
      el('#k_opis').focus();
    } else if (k === 'foto1') {
      if (!id) { await zapisz(); if (!id) { err.textContent = 'Najpierw wpisz imię psa, potem dodaj zdjęcie.'; el('#k_imie')?.focus(); return; } }
      el('#kpf1').click();
    }
  });
  // zdjęcia: krok 1 (jedno szybkie) i krok 4 (wiele, główne, usuwanie)
  const dodajPliki = async (files, st) => {
    files = [...files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name)); if (!files.length || !id) return;
    let ok = 0, bad = 0;
    for (let i = 0; i < files.length; i++) {
      if (st) st.textContent = `Przetwarzam zdjęcie ${i + 1} z ${files.length}…`;
      try {
        const pid = await addPhotoFile(files[i], true); await zapisz();
        const d = await get('psy', id); d.moje_zdjecia = [...(d.moje_zdjecia || []), pid];
        if (!d.glowne && !(d.zdjecia || []).length && d.moje_zdjecia.length === 1) d.glowne = pid;
        await save('psy', d); cur = d; ok++;
      } catch { bad++; }
    }
    if (st) st.textContent = `Dodano: ${ok}${bad ? '. Nie udało się odczytać: ' + bad : ''}. Wysyłają się na serwer w tle.`;
    try { (await import('./sync.js')).kick(50); } catch { /* */ }
    pokaz('Zapisano ✓'); odswiez(); malujFotki(); const kf = el('.kfoto'); if (kf) { kf.innerHTML = fotoGlowne(cur); hydratePhotos(kf); }
  };
  const f1 = el('#kpf1'); if (f1) f1.onchange = () => { dodajPliki(f1.files); f1.value = ''; };
  const malujFotki = () => {
    const box = el('#kfotki'); if (!box) return; const mine = cur.moje_zdjecia || [], site = cur.zdjecia || [];
    box.innerHTML = (mine.length ? `<div class="pgrid">${mine.map((pid) => `<div class="pt"><img data-photo="${esc(pid)}" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><div class="pb"><button type="button" class="${cur.glowne === pid ? 'on' : ''}" data-ph="main" data-id="${esc(pid)}">${cur.glowne === pid ? '★ Główne' : '☆ Ustaw główne'}</button><button type="button" class="red" data-ph="del" data-id="${esc(pid)}">Usuń</button></div></div>`).join('')}</div>` : '<p class="hint">Jeszcze nie ma zdjęć dodanych w aplikacji.</p>')
      + (site.length ? `<h3 class="ph">Ze strony schroniska (${site.length})</h3><div class="pgrid small">${site.slice(0, 24).map((u) => `<div class="pt"><img src="${esc(u.replace(/_l\.(jpe?g)(\?.*)?$/i, '_m.$1$2'))}" loading="lazy" alt=""></div>`).join('')}</div>` : '');
    hydratePhotos(box);
  };
  const drop = el('#kdrop'), pf = el('#kpf');
  if (drop && pf) {
    pf.onchange = () => { dodajPliki(pf.files, el('#kpst')); pf.value = ''; };
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => dodajPliki(e.dataTransfer.files, el('#kpst')));
    el('#kfotki').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ph]'); if (!b) return; const pid = b.dataset.id, d = await get('psy', id); if (!d) return;
      if (b.dataset.ph === 'main') { d.glowne = d.glowne === pid ? '' : pid; }
      else {
        if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Na pewno?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Usuń'; } }, 3000); return; }
        d.moje_zdjecia = (d.moje_zdjecia || []).filter((x) => x !== pid); if (d.glowne === pid) d.glowne = ''; await removeLocalPhoto(pid);
      }
      await save('psy', d); cur = d; malujFotki(); odswiez(); pokaz('Zapisano ✓');
    });
    malujFotki();
  }
  // opis rośnie razem z tekstem
  const op = el('#k_opis'); if (op) { const fit = () => { op.style.height = 'auto'; op.style.height = Math.max(220, op.scrollHeight + 4) + 'px'; }; op.addEventListener('input', fit); fit(); }
  // wyjście z karty innym sposobem (menu, przycisk Wstecz) też zapisuje
  const naWyjscie = () => { if (Object.keys(pend).length) zapisz(); };
  addEventListener('hashchange', naWyjscie, { once: true });
  odswiez();
  if (!id) setTimeout(() => el('#k_imie')?.focus(), 50);
}
