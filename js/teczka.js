// Teczka psa: miejsce pobytu, zdrowie, ocena zachowania, publikacja per kanał, teksty do postów, zaległości.
import { html, icon, esc, openSheet, closeSheet, toast, actions, confirmSheet } from './ui.js';
import { list, save, remove, get } from './store.js';
import { getName, state } from './auth.js';
import { MS_DAY, fmtDate, uid } from './util.js';
import { SITE } from './config.js';
import { api } from './api.js';
import { on } from './bus.js';
import { czyscBoks, boks, wybrani, POWODY, OPISY, opis as opisAdm, powody, boksPill, wybCls, linie } from './znak.js';
import { raw } from './ui-core.js';

export const MIEJSCA = [['schronisko', 'W schronisku'], ['dt', 'W domu tymczasowym'], ['hotelik', 'W hoteliku'], ['adoptowany', 'Adoptowany'], ['zaginiony', 'Zaginiony'], ['zmarl', 'Odszedł za tęczowy most']];
export const KANALY = [['fb', 'Facebook (album)'], ['www', 'Strona schroniska'], ['ig', 'Instagram'], ['tiktok', 'TikTok'], ['yt', 'YouTube'], ['puszatek', 'Puszatek'], ['psinder', 'Psinder']];
export const ZDROWIE_TYPY = [['szczepienie', 'Szczepienie'], ['odrobaczanie', 'Odrobaczanie'], ['pchly', 'Pchły i kleszcze'], ['kastracja', 'Kastracja / sterylizacja'], ['chip', 'Czip'], ['weterynarz', 'Wizyta u weterynarza'], ['lek', 'Lek / leczenie'], ['badanie', 'Badanie'], ['inne', 'Inne']];
const TYP = Object.fromEntries(ZDROWIE_TYPY);
export const OCENA_POLA = [['ludzie', 'Do ludzi'], ['dzieci', 'Do dzieci'], ['psy', 'Do innych psów'], ['koty', 'Do kotów'], ['smycz', 'Na smyczy']];
const OCENA_OPC = [['', 'Nie wiadomo'], ['ok', 'Bardzo dobrze'], ['neutral', 'Neutralnie'], ['ostroznie', 'Ostrożnie / z zastrzeżeniem'], ['nie', 'Słabo / nie polecamy']];
export const OCENA_LBL = Object.fromEntries(OCENA_OPC);
const SEL = (id, label, opts, val) => `<div class="field"><label for="${id}">${label}</label><select class="select" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
const d10 = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const plural = (n, a, b, c) => (n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
export const days = (t) => Math.max(0, Math.floor((Date.now() - t) / MS_DAY));

export const miejsce = (d) => d.miejsce || (d.status === 'adoptowany' ? 'adoptowany' : d.status === 'dt' ? 'dt' : d.status === 'hotelik' ? 'hotelik' : 'schronisko');
const hasPics = (d) => (d.zdjecia || []).length + (d.moje_zdjecia || []).length > 0;
export const aktywny = (d) => !['adoptowany', 'zmarl'].includes(miejsce(d)) && d.status !== 'adoptowany';
// Dostępny = czeka na dom (schronisko, dom tymczasowy, hotelik). Psy w procesie adopcji są w zakładce Adopcje (widzi je tylko administrator, także w Bramie).
export const dostepny = (d) => aktywny(d) && d.status !== 'w_trakcie' && !d.archiwum;
// Los psa – jedno miejsce, w którym administrator zmienia, „co z psem”: dostępny / w procesie adopcji / adoptowany / archiwum (z przyczyną).
export const LOSY = [
  ['dostepny', 'Dostępny do adopcji', 'W schronisku, w domu tymczasowym lub w hoteliku. Widoczny na liście Psy.'],
  ['w_trakcie', 'W procesie adopcji', 'Przenosi psa do zakładki Adopcje. Wolontariusze go nie widzą (administrator widzi go w Bramie).'],
  ['adoptowany', 'Adoptowany', 'Filtr „Adoptowane” na liście Psy.'],
  ['zmarl', 'Za Tęczowym Mostem', 'Do archiwum (Ustawienia → Archiwum psów).'],
  ['wlasciciel', 'Wrócił do właściciela', 'Do archiwum.'],
  ['inne', 'Inne', 'Do archiwum.']
];
export const losPsa = (d) => (d.archiwum ? d.archiwum_los || 'inne' : d.status === 'w_trakcie' ? 'w_trakcie' : !aktywny(d) ? 'adoptowany' : 'dostepny');
export function ustawLos(d, k) {
  const n = { ...d }, now = Date.now();
  const bezArch = () => { delete n.archiwum; delete n.archiwum_los; delete n.archiwum_zrodlo; };
  if (k === 'dostepny') { bezArch(); delete n.adopcja_potw; if (['adoptowany', 'w_trakcie'].includes(n.status) || !n.status) n.status = n.status_www && !['adoptowany', 'w_trakcie'].includes(n.status_www) ? n.status_www : 'do_adopcji'; if (!['schronisko', 'dt', 'hotelik'].includes(n.miejsce)) n.miejsce = 'schronisko'; }
  else if (k === 'w_trakcie') { bezArch(); delete n.adopcja_potw; n.status = 'w_trakcie'; n.w_trakcie_od = d.status === 'w_trakcie' ? d.w_trakcie_od || now : now; if (!['schronisko', 'dt', 'hotelik'].includes(n.miejsce)) n.miejsce = 'schronisko'; }
  else if (k === 'adoptowany') { bezArch(); n.status = 'adoptowany'; n.miejsce = 'adoptowany'; n.data_adopcji = n.data_adopcji || now; n.adopcja_potw = now; }
  else { n.archiwum = d.archiwum || now; n.archiwum_los = k; n.archiwum_zrodlo = 'admin'; if (k === 'zmarl') n.miejsce = 'zmarl'; }
  return n;
}

// ===== Wspólne zasady postępu psa =====
// Jedno miejsce, z którego korzystają: karta przyjęcia (Nowe psy), Droga psa na karcie, lista Psy i „Dziś i do zrobienia”.
// Dzięki temu wszędzie widać to samo: ten sam pies nie może być „gotowy” w jednym miejscu i „z brakami” w drugim.
export const przyjecieOk = (d) => !!((d.imie || '').trim() && d.plec && d.data_przyjecia && (d.wiek || d.wielkosc));
export const ocenaPominieta = (d) => !d.ocena && !!(d.pominiete || {}).ocena;
export const maOpis = (d) => !!(d.opis || '').trim();
// Ogłoszony = zaznaczony dowolny kanał w „Gdzie jest ogłoszony” (Facebook, strona, Instagram, TikTok, YouTube, Puszatek, Psinder).
export const ogloszony = (d) => KANALY.some(([x]) => (d.kanaly || {})[x]);

// Droga psa: to długi proces, nie lista do odhaczenia w jeden dzień. Etapy liczone z danych;
// tylko „zdobywamy zaufanie” zaznacza człowiek (pies przestraszony lub agresywny, na spacer może wyjść po tygodniach).
export const zaufanieAktywne = (d, walks) => !!d.zaufanie && !(walks || []).some((w) => (w.start || 0) >= d.zaufanie);
export function droga(d, walks = []) {
  const adopted = miejsce(d) === 'adoptowany' || d.status === 'adoptowany', trust = zaufanieAktywne(d, walks), skip = ocenaPominieta(d);
  const steps = [
    ['Przyjęty', !d.nowy || przyjecieOk(d) ? 'ok' : ''],
    ['Zaufanie i spacery', walks.length ? 'ok' : trust ? 'now' : ''],
    [skip ? 'Ocena: na razie pominięta' : 'Ocena', d.ocena ? 'ok' : ''],
    ['Zdjęcia', hasPics(d) ? 'ok' : ''],
    ['Opis', maOpis(d) ? 'ok' : ''],
    ['Ogłoszony', ogloszony(d) ? 'ok' : ''],
    ['Adopcja', adopted ? 'ok' : d.status === 'w_trakcie' ? 'now' : '']
  ];
  // Następny krok otwiera to samo okno co odpowiedni krok karty przyjęcia.
  let next = null;
  if (!trust && !adopted) {
    if (d.nowy && !przyjecieOk(d)) next = { txt: 'Następny krok: uzupełnij podstawy (płeć, wiek, wielkość)', href: '#/karta/' + d.id + '/1' };
    else if (!walks.length && d.nowy) next = { txt: 'Następny krok: pierwszy spacer z psem', href: '#/spacer/' + d.id };
    else if (!d.ocena && !skip) next = { txt: 'Następny krok: charakter (po spacerze)', href: '#/karta/' + d.id + '/3' };
    else if (!hasPics(d)) next = { txt: 'Następny krok: zdjęcia', href: '#/karta/' + d.id + '/4' };
    else if (!maOpis(d)) next = { txt: 'Następny krok: opis i hasło do ogłoszenia', href: '#/karta/' + d.id + '/5' };
    else if (!ogloszony(d)) next = { txt: 'Następny krok: ogłoszenie', href: '#/social/adopcja/' + d.id };
  }
  return { steps, trust, next };
}
// Karta psa (#/karta/:id): 5 kroków, każdy zapisuje się od razu. Wymagane jest tylko imię.
// Pies dodany przez „Przyjmij nowego psa” (d.nowy) ma znaczek „Uzupełnij n/5”, dopóki wszystkie kroki nie są wypełnione.
export const KROKI = [['podstawy', 'Podstawy'], ['zdrowie', 'Zdrowie'], ['charakter', 'Charakter'], ['zdjecia', 'Zdjęcia'], ['opis', 'Opis i ogłoszenie']];
const zdrOk = (d) => ['czip', 'szczep', 'odrob', 'kastr'].every((k) => (d.zdr || {})[k]);
const ocenaJest = (d) => !!d.ocena && Object.entries(d.ocena).some(([k, v]) => k !== 'auto' && v);
export function kroki(d) {
  return [
    { k: 'podstawy', l: 'Podstawy', done: !!((d.imie || '').trim() && d.plec && (d.wiek || d.wiek_kat) && d.wielkosc) },
    { k: 'zdrowie', l: 'Zdrowie', done: zdrOk(d) },
    { k: 'charakter', l: 'Charakter', done: ocenaJest(d) || (d.tagi || []).length > 0 },
    { k: 'zdjecia', l: 'Zdjęcia', done: hasPics(d) },
    { k: 'opis', l: 'Opis i ogłoszenie', done: maOpis(d) && !!(d.haslo || '').trim() }
  ];
}
// Krótki stan karty (lista Psy, karta psa, „Dziś i do zrobienia”): „3 z 5”, czego brakuje i od którego kroku zacząć.
export function stanKarty(d) {
  const st = kroki(d), i = st.findIndex((x) => !x.done);
  return { st, done: st.filter((x) => x.done).length, total: st.length, brak: st.filter((x) => !x.done).map((x) => x.l.toLowerCase()), pierwszy: i < 0 ? 1 : i + 1 };
}
export const kompletna = (d) => kroki(d).every((s) => s.done);
export const wToku = (d) => !!d.nowy && !d.karta_gotowa && aktywny(d) && !kompletna(d);

actions['karta-open'] = (el) => { location.hash = `#/karta/${el.dataset.id}/${el.dataset.k || 1}`; };
actions['dog-zaufanie-on'] = async (el) => { const d = await get('psy', el.dataset.id); await save('psy', { ...d, zaufanie: Date.now() }); toast('Zapisane. Bez pośpiechu, nic nie ponagla'); };
actions['dog-zaufanie-off'] = async (el) => { const d = await get('psy', el.dataset.id); await save('psy', { ...d, zaufanie: null }); toast('Zapisane. Świetna wiadomość!'); };

// ===== wiersze do karty psa =====
export function teczkaRows(d, zdr, ctx = {}) {
  const m = miejsce(d), k = d.kanaly || {}, dr = droga(d, ctx.walks || []), lastObs = (ctx.obs || [])[0];
  const nKan = KANALY.filter(([x]) => k[x]).length;
  const due = zdrDue(zdr);
  const dni = d.data_przyjecia && m === 'schronisko' ? days(d.data_przyjecia) : null;
  return html`
    <button class="row" data-act="dog-miejsce" data-id="${d.id}">${icon('pin')}<span class="rt"><b>${(MIEJSCA.find((x) => x[0] === m) || [])[1]}${boks(d) ? ' · boks ' + boks(d) : m === 'schronisko' ? ' · boks: uzupełnij' : ''}${d.opiekun ? ' · ' + d.opiekun : ''}</b><small>${d.data_przyjecia ? 'Od ' + fmtDate(d.data_przyjecia) + (dni !== null ? ` · ${dni} ${plural(dni, 'dzień', 'dni', 'dni')} w schronisku` : '') : 'Dodaj datę przyjęcia, czip i opiekuna'}${d.chip ? ' · czip ' + d.chip : ''}</small></span>${icon('chev')}</button>
    ${state.admin ? html`<button class="row adminrow" data-act="dog-oznacz" data-id="${d.id}">${icon('star')}<span class="rt"><b>Oznaczenie i opis psa (administrator)</b><small>${[wybrani(d) ? 'Tylko dla wybranych' + (powody(d).length ? ': ' + powody(d).join(', ') : '') : 'Bez oznaczenia', opisAdm(d) ? 'opis: „' + opisAdm(d) + '”' : 'bez opisu'].join(' · ')}</small></span>${icon('chev')}</button>` : ''}
    ${(() => { const sk = stanKarty(d), tok = wToku(d); return html`<a class="row${tok ? ' kartarow' : ''}" href="#/karta/${d.id}/${tok ? sk.pierwszy : 1}">${icon('pencil')}<span class="rt"><b>${tok ? `Karta psa: ${sk.done} z ${sk.total} · uzupełnij` : 'Karta psa: dane, zdrowie, charakter, zdjęcia, opis'}</b><small>${tok ? 'Brakuje: ' + sk.brak.join(', ') : 'Popraw w 5 prostych krokach'}</small></span>${icon('chev')}</a>`; })()}
    ${m === 'zmarl' || m === 'zaginiony' ? '' : html`<div class="droga" aria-label="Droga psa"><div class="steps">${dr.steps.map(([l, st]) => html`<span class="${st}">${st === 'ok' ? '✓ ' : ''}${l}</span>`)}</div>
      ${dr.trust ? html`<div class="teraz"><b>Zdobywamy zaufanie od ${days(d.zaufanie)} ${plural(days(d.zaufanie), 'dnia', 'dni', 'dni')}</b><p>Bez pośpiechu. Liczy się każda drobna zmiana: podszedł, wziął smakołyk, nie odsunął się.${lastObs ? ' Ostatnia notatka: ' + (days(lastObs.ts) ? days(lastObs.ts) + ' ' + plural(days(lastObs.ts), 'dzień', 'dni', 'dni') + ' temu' : 'dziś') + '.' : ''}</p>
        <div class="btnrow"><button class="btn sm" data-act="dog-obs-add" data-id="${d.id}">Dodaj notatkę o postępach</button><button class="btn sm ghost" data-act="dog-zaufanie-off" data-id="${d.id}">Już wychodzi na spacery</button></div></div>`
      : dr.next ? html`<div class="teraz"><b>${dr.next.txt}</b><div class="btnrow">${dr.next.href ? html`<a class="btn sm" href="${dr.next.href}">Zacznij</a>` : html`<button class="btn sm" data-act="${dr.next.act}" data-id="${d.id}" data-k="${dr.next.k || ''}">Otwórz</button>`}${!(ctx.walks || []).length && d.nowy ? html`<button class="btn sm ghost" data-act="dog-zaufanie-on" data-id="${d.id}">Jeszcze nie wychodzi: zdobywamy zaufanie</button>` : ''}</div></div>` : ''}</div>`}
    <button class="row" data-act="dog-ocena" data-id="${d.id}">${icon('heart')}<span class="rt"><b>Ocena zachowania${d.ocena && d.ocena.auto ? ' (z opisu, sprawdź)' : ''}</b><small>${d.ocena ? OCENA_POLA.filter(([p]) => d.ocena[p]).map(([p, l]) => l.replace('Do ', '').replace('Na ', '') + ': ' + (OCENA_LBL[d.ocena[p]] || '').toLowerCase()).join(' · ') || 'Zapisana' : 'W opisie brak informacji. Kliknij, żeby ocenić po spacerze'}</small></span>${icon('chev')}</button>
    <button class="row" data-act="dog-zdrowie" data-id="${d.id}">${icon('medic')}<span class="rt"><b>Zdrowie i zabiegi</b><small>${zdr.length ? zdr.length + ' ' + plural(zdr.length, 'wpis', 'wpisy', 'wpisów') + (due.length ? ' · do zrobienia: ' + due.map((z) => TYP[z.typ]).join(', ') : '') : 'Szczepienia, kastracja, leki, koszty'}</small></span>${icon('chev')}</button>
    <button class="row" data-act="dog-kanaly" data-id="${d.id}">${icon('share')}<span class="rt"><b>Gdzie jest ogłoszony</b><small>${nKan ? KANALY.filter(([x]) => k[x]).map(([, l]) => l.split(' ')[0]).join(', ') : 'Nigdzie'}${nKan < KANALY.length ? ' · brakuje: ' + KANALY.filter(([x]) => !k[x]).map(([, l]) => l.split(' ')[0]).slice(0, 3).join(', ') + (KANALY.length - nKan > 3 ? '…' : '') : ''}</small></span>${icon('chev')}</button>
    <button class="row" data-act="dog-teksty" data-id="${d.id}">${icon('pencil')}<span class="rt"><b>Teksty do postów</b><small>Album, post, „zróbmy hałas”, dom tymczasowy, SMS</small></span>${icon('chev')}</button>`;
}

// ===== miejsce pobytu =====
actions['dog-miejsce'] = async (el) => {
  const d = await get('psy', el.dataset.id);
  openSheet(`<h2>Gdzie jest ${esc(d.imie)}?</h2><form id="mf" novalidate>
    ${SEL('mm', 'Miejsce pobytu', MIEJSCA.filter(([k]) => ['schronisko', 'dt', 'hotelik', 'zaginiony'].includes(k) || k === miejsce(d)), miejsce(d))}
    <p class="hint" style="margin:-4px 0 12px">Adopcję, adoptowanie i odejście psa zmieniasz przyciskiem „Status psa” na karcie.</p>
    <div class="field"><label for="mb">Boks (gdy pies jest w schronisku): numer lub numer z literą</label><input class="input" id="mb" maxlength="8" autocomplete="off" autocapitalize="off" placeholder="np. 12, 7a, A3" value="${esc(d.boks || '')}"></div>
    <div class="field"><label for="mo">Opiekun / dom tymczasowy / hotelik (opcjonalnie)</label><input class="input" id="mo" maxlength="80" value="${esc(d.opiekun || '')}"></div>
    <div class="field"><label for="md">Data przyjęcia do schroniska</label><input class="input" id="md" type="date" value="${d.data_przyjecia ? d10(d.data_przyjecia) : ''}"></div>
    <div class="field"><label for="mc">Numer czipa (opcjonalnie)</label><input class="input" id="mc" maxlength="20" inputmode="numeric" value="${esc(d.chip || '')}"></div>
    <button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    s.querySelector('#mf').addEventListener('submit', async (e) => {
      e.preventDefault(); const mm = s.querySelector('#mm').value, dd = s.querySelector('#md').value;
      const o = { ...d, boks: czyscBoks(s.querySelector('#mb').value), miejsce: mm, opiekun: s.querySelector('#mo').value.trim(), chip: s.querySelector('#mc').value.trim(), data_przyjecia: dd ? new Date(dd + 'T12:00').getTime() : null };
      if (mm === 'adoptowany') o.status = 'adoptowany';
      await save('psy', o); closeSheet(); toast('Zapisane');
    });
  });
};

// ===== status psa („co z psem”): dostępny / w procesie adopcji / adoptowany / archiwum – tylko administrator =====
actions['dog-los'] = async (el) => {
  if (!state.admin) { toast('To może zmienić tylko administrator', true); return; }
  const d = await get('psy', el.dataset.id); if (!d) return; const cur = losPsa(d);
  const intro = d.zniknal_ze_strony && !d.adopcja_potw && cur === 'adoptowany' ? `Zniknął${d.plec === 'suka' ? 'a' : ''} ze strony schroniska ${esc(fmtDate(d.zniknal_ze_strony))}. Co się naprawdę stało?` : 'Wybierz, co teraz dzieje się z psem.';
  openSheet(`<h2>Status: ${esc(d.imie)}</h2><p class="hint" style="margin:0 0 12px">${intro}</p><div class="losy">${LOSY.map(([k, l, o]) => `<button type="button" class="los${k === cur ? ' on' : ''}" data-los="${k}"><b>${esc(l)}${k === cur ? ' ✓' : ''}</b><small>${esc(o)}</small></button>`).join('')}</div>`, (s) => {
    s.querySelectorAll('[data-los]').forEach((b) => b.addEventListener('click', async () => {
      const k = b.dataset.los, fresh = (await get('psy', d.id)) || d;
      if (k === cur && !(k === 'adoptowany' && fresh.zniknal_ze_strony && !fresh.adopcja_potw)) { closeSheet(); return; }
      await save('psy', ustawLos(fresh, k)); closeSheet();
      toast(k === 'w_trakcie' ? `${d.imie}: w procesie adopcji (zakładka Adopcje)` : k === 'adoptowany' ? `${d.imie}: adoptowany` : k === 'dostepny' ? `${d.imie} jest znów na liście Psy` : `${d.imie}: w archiwum`);
    }));
  });
};
// ===== oznaczenie i krótki opis psa: wyłącznie administrator (kolekcja „oznaczenia”, bez podpisu autora) =====
actions['dog-oznacz'] = async (el) => {
  if (!state.admin) { toast('To może zmienić tylko administrator', true); return; }
  const d = await get('psy', el.dataset.id); if (!d) return;
  const o = d.ozn || {}, w = o.wybrani || {}, sel = new Set(w.powody || []);
  openSheet(`<h2>Oznaczenie: ${esc(d.imie)}</h2><p class="hint" style="margin:0 0 12px">Widzą je tylko administratorzy: w Bramie, na liście Psy, na karcie psa i w innych miejscach. Wolontariusze tego nie widzą. Nie widać, kto je ustawił.</p><form id="of2" novalidate>
    <div class="field"><span class="lbl">Krótki opis psa (pod imieniem, zamiast hasła ze strony)</span><div class="chips" id="oz_o">${['', ...OPISY].map((k) => `<button type="button" class="chip outline ${(o.opis || '') === k ? 'on' : ''}" data-op="${esc(k)}" aria-pressed="${(o.opis || '') === k}">${k ? esc(k) : 'bez opisu'}</button>`).join('')}</div></div>
    <label class="check" style="margin-top:6px"><input type="checkbox" id="oz_on" ${w.on ? 'checked' : ''}> <b>Tylko dla wybranych wolontariuszy</b> (czerwona obwódka)</label>
    <div class="field" style="margin-top:12px"><span class="lbl">Dlaczego (możesz zaznaczyć kilka)</span><div class="chips">${POWODY.map(([k, l]) => `<button type="button" class="chip outline pw ${sel.has(k) ? 'on' : ''}" data-pw="${k}">${l}</button>`).join('')}</div></div>
    <div class="field"><label for="oz_i">Inny powód (opcjonalnie)</label><input class="input" id="oz_i" maxlength="40" placeholder="np. ucieka, gryzie smycz" value="${esc(w.inny || '')}" data-nodraft></div>
    <div class="field"><label for="oz_k">Kto może z nim wychodzić (opcjonalnie)</label><input class="input" id="oz_k" maxlength="120" placeholder="np. Justyna, Marek" value="${esc(w.kto || '')}" data-nodraft></div>
    <div class="err" id="oz_e" role="alert"></div><button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    const on = s.querySelector('#oz_on'); let op = OPISY.includes(o.opis) ? o.opis : '';
    s.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => { op = b.dataset.op; s.querySelectorAll('[data-op]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); }));
    s.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.pw; sel.has(k) ? sel.delete(k) : sel.add(k); b.classList.toggle('on'); if (sel.size) on.checked = true; }));
    s.querySelector('#oz_i').addEventListener('input', (e) => { if (e.target.value.trim()) on.checked = true; });
    s.querySelector('#of2').addEventListener('submit', async (e) => {
      e.preventDefault();
      const inny = s.querySelector('#oz_i').value.trim();
      if (on.checked && !sel.size && !inny) { s.querySelector('#oz_e').textContent = 'Zaznacz powód (wycofany, trudny, silny) albo wpisz inny.'; return; }
      const wyb = on.checked ? { on: true, powody: POWODY.map(([k]) => k).filter((k) => sel.has(k)), inny, kto: s.querySelector('#oz_k').value.trim() } : null;
      if (!op && !wyb) await remove('oznaczenia', d.id);
      else await save('oznaczenia', { id: d.id, opis: op, wybrani: wyb });
      closeSheet(); toast('Zapisane'); if (location.hash.startsWith('#/brama')) dispatchEvent(new HashChangeEvent('hashchange'));
    });
  });
};

// ===== ocena zachowania =====
// Automatyczna ocena z opisu ze strony: proste reguły słów kluczowych (bez AI), liczone po fragmentach zdań.
// Zawsze do sprawdzenia przez wolontariusza. „Nie” ustawiamy tylko przy jednoznacznym zdaniu, w razie wątpliwości „ostrożnie”.
import { ocenaZOpisu } from './dogmerge.js';
export { ocenaZOpisu };
export function opisZOceny(d, o) {
  const w = d.plec === 'suka' ? { on: 'Ona', ma: 'Jest', ltr: 'Lubi' } : { on: 'On', ma: 'Jest', ltr: 'Lubi' };
  const t = {
    ludzie: { ok: `${w.ltr} kontakt z człowiekiem i chętnie się przytula.`, neutral: 'Do ludzi podchodzi neutralnie.', ostroznie: 'Wobec ludzi jest ostrożny/a i potrzebuje czasu na zaufanie.', nie: 'Wobec obcych ludzi bywa trudny/a i potrzebuje doświadczonego opiekuna.' },
    dzieci: { ok: 'Dobrze znosi dzieci.', neutral: 'Z dziećmi bez problemów, ale nie testowaliśmy bliższego kontaktu.', ostroznie: 'Wymaga ostrożności przy dzieciach.', nie: 'Nie polecamy do domu z małymi dziećmi.' },
    psy: { ok: 'Z innymi psami żyje w zgodzie.', neutral: 'W relacjach z psami jest neutralny/a.', ostroznie: 'Wobec innych psów bywa selektywny/a, potrzebuje spokojnego wprowadzenia.', nie: 'Nie dogaduje się z innymi psami. Powinien/powinna być jedynakiem.' },
    koty: { ok: 'Z kotami żyje zgodnie.', neutral: 'Koty zbytnio go/jej nie interesują.', ostroznie: 'Do kotów trzeba go/ją ostrożnie przyzwyczajać.', nie: 'Nie nadaje się do domu z kotami.' },
    smycz: { ok: 'Pięknie chodzi na smyczy.', neutral: 'Na smyczy chodzi poprawnie.', ostroznie: 'Na smyczy ciągnie lub się płoszy, potrzebuje treningu.', nie: 'Na smyczy sprawia duże trudności.' }
  };
  const parts = OCENA_POLA.map(([p]) => t[p][o[p]]).filter(Boolean);
  if (o.lek) parts.push('Lęki i trudności: ' + o.lek.trim().replace(/\.$/, '') + '.');
  if (o.notatka) parts.push(o.notatka.trim());
  return parts.join(' ');
}
actions['dog-ocena'] = async (el) => {
  const d = await get('psy', el.dataset.id), o = d.ocena || {};
  openSheet(`<h2>Ocena: ${esc(d.imie)}</h2><p class="hint" style="margin:0 0 12px">${o.auto ? 'Wstępnie uzupełnione automatycznie z opisu na stronie. Sprawdź i popraw po spacerze.' : 'Wypełnij po spacerze, wszystko jest opcjonalne. Z tego powstanie rzetelny opis do ogłoszenia.'}</p><form id="of" novalidate>
    ${OCENA_POLA.map(([p, l]) => SEL('o_' + p, l, OCENA_OPC, o[p] || '')).join('')}
    <div class="field"><label for="o_lek">Lęki, trudności (opcjonalnie)</label><input class="input" id="o_lek" maxlength="200" placeholder="np. boi się hałasu, nie lubi być dotykany po głowie" value="${esc(o.lek || '')}"></div>
    <div class="field"><label for="o_n">Twoje obserwacje (opcjonalnie)</label><textarea class="textarea" id="o_n" maxlength="800">${esc(o.notatka || '')}</textarea></div>
    <label class="check"><input type="checkbox" id="o_opis" ${(d.opis || '').trim() ? '' : 'checked'}> Wstaw z tego opis do ogłoszenia ${(d.opis || '').trim() ? '(zastąpi obecny)' : ''}</label>
    <button class="btn block" type="submit" style="margin-top:12px">Zapisz ocenę</button></form>`, (s) => {
    s.querySelector('#of').addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = { autor: getName(), ts: Date.now(), lek: s.querySelector('#o_lek').value.trim(), notatka: s.querySelector('#o_n').value.trim() };
      OCENA_POLA.forEach(([p]) => { n[p] = s.querySelector('#o_' + p).value; });
      const upd = { ...d, ocena: n };
      if (s.querySelector('#o_opis').checked) upd.opis = opisZOceny(d, n);
      await save('psy', upd); closeSheet(); toast('Ocena zapisana');
    });
  });
};

// ===== zdrowie =====
const zdrDue = (zdr) => {
  const now = Date.now();
  return zdr.filter((z) => z.termin && z.termin < now + 14 * MS_DAY && !zdr.some((y) => y.typ === z.typ && y.data > z.data && y.data >= z.termin - 14 * MS_DAY && y.id !== z.id));
};
export const zdrowieDla = async (id) => (await list('zdrowie')).filter((z) => z.pies_id === id).sort((a, b) => b.data - a.data);
actions['dog-zdrowie'] = async (el) => {
  const id = el.dataset.id, d = await get('psy', id); const zdr = await zdrowieDla(id);
  const koszt = zdr.reduce((s, z) => s + (+z.koszt || 0), 0);
  openSheet(`<h2>Zdrowie: ${esc(d.imie)}</h2>
    ${zdr.length ? `<p class="hint" style="margin:0 0 8px">Łączny koszt: <b>${koszt.toFixed(2).replace('.', ',')} zł</b></p>` : ''}
    <div class="zl">${zdr.map((z) => `<div class="obs"><div class="oh"><b>${esc(TYP[z.typ] || z.typ)}</b><span>${esc(fmtDate(z.data))}</span></div>
      ${z.notatka ? `<div style="white-space:pre-line">${esc(z.notatka)}</div>` : ''}
      <div class="hint">${z.termin ? 'Następny termin: ' + esc(fmtDate(z.termin)) : ''}${z.koszt ? (z.termin ? ' · ' : '') + esc(String(z.koszt).replace('.', ',')) + ' zł' : ''}${z.autor ? ' · ' + esc(z.autor) : ''} <button class="link" data-zdel="${esc(z.id)}" style="color:var(--terra-d)">usuń</button></div></div>`).join('') || '<p class="hint">Brak wpisów.</p>'}</div>
    <h3 style="margin:16px 0 8px">Dodaj wpis</h3><form id="zf" novalidate>
    ${SEL('z_t', 'Co', ZDROWIE_TYPY, 'szczepienie')}
    <div class="field"><label for="z_d">Data</label><input class="input" id="z_d" type="date" value="${d10()}"></div>
    <div class="field"><label for="z_n">Następny termin (opcjonalnie, aplikacja przypomni)</label><input class="input" id="z_n" type="date"></div>
    <div class="field"><label for="z_k">Koszt w zł (opcjonalnie)</label><input class="input" id="z_k" inputmode="decimal" maxlength="10"></div>
    <div class="field"><label for="z_o">Notatka (lek, dawka, wynik…)</label><textarea class="textarea" id="z_o" maxlength="600"></textarea></div>
    <button class="btn block" type="submit">Dodaj</button></form>`, (s) => {
    s.querySelector('#zf').addEventListener('submit', async (e) => {
      e.preventDefault(); const dd = s.querySelector('#z_d').value, nn = s.querySelector('#z_n').value;
      if (!dd) { toast('Wybierz datę', true); return; }
      await save('zdrowie', { pies_id: id, typ: s.querySelector('#z_t').value, data: new Date(dd + 'T12:00').getTime(), termin: nn ? new Date(nn + 'T12:00').getTime() : null, koszt: parseFloat(s.querySelector('#z_k').value.replace(',', '.')) || 0, notatka: s.querySelector('#z_o').value.trim(), autor: getName() });
      closeSheet(); toast('Dodano'); actions['dog-zdrowie'](el);
    });
    s.querySelectorAll('[data-zdel]').forEach((b) => b.addEventListener('click', async () => { if (await confirmSheet('Usunąć wpis?', 'Wpis zniknie u wszystkich.', 'Usuń', true)) { await remove('zdrowie', b.dataset.zdel); toast('Usunięto'); actions['dog-zdrowie'](el); } }));
  });
};

// ===== kanały publikacji =====
actions['dog-kanaly'] = async (el) => {
  const d = await get('psy', el.dataset.id), k = d.kanaly || {};
  openSheet(`<h2>Gdzie ogłoszony: ${esc(d.imie)}</h2><p class="hint" style="margin:0 0 12px">Zaznacz, gdzie pies jest już ogłoszony. Na Starcie zobaczysz, czego jeszcze brakuje.</p><form id="kf" novalidate>
    ${KANALY.map(([x, l]) => `<label class="check"><input type="checkbox" data-k="${x}" ${k[x] ? 'checked' : ''}> ${l}${k[x] ? ` <span class="hint">od ${esc(fmtDate(k[x]))}</span>` : ''}</label>`).join('')}
    <button class="btn block" type="submit" style="margin-top:12px">Zapisz</button></form>`, (s) => {
    s.querySelector('#kf').addEventListener('submit', async (e) => {
      e.preventDefault(); const n = {};
      s.querySelectorAll('[data-k]').forEach((c) => { if (c.checked) n[c.dataset.k] = k[c.dataset.k] || Date.now(); });
      await save('psy', { ...d, kanaly: n }); closeSheet(); toast('Zapisane');
    });
  });
};

// ===== teksty do postów (okno „Teksty do postów” na karcie psa) =====
// Teksty powstają z szablonów. Domyślne szablony dają dokładnie te same teksty co wcześniej (sprawdzane testem).
// Każdy szablon można zmienić: zmiana zapisuje się wspólnie dla wszystkich wolontariuszy (kolekcja szablony_karta),
// „Przywróć domyślny” ją usuwa. Słowa w nawiasach klamrowych, np. {imie}, zamieniają się na dane psa.
const KONTAKT = 'Kontakt w sprawie adopcji: Justyna 691 742 265, Dorota 607 119 526, stowarzyszenie.nowodwor@wp.pl';
const TPL_COL = 'szablony_karta';
export const TEKSTY = {
  album: { l: 'Nazwa albumu', t: '{IMIE} - {haslo_tytul}' },
  post: { l: 'Post adopcyjny', t: '{IMIE} - {haslo_tytul}\n\n{dane}\n\n{opis}\n\nPrzed adopcją obowiązuje wizyta przedadopcyjna i umowa. Pies jest po kastracji/sterylizacji lub przed zabiegiem na koszt schroniska.\n{kontakt}\n{link}' },
  halas: { l: 'Zróbmy hałas', t: 'ZRÓBMY HAŁAS wokół {IMIE}!\n{ile_czeka} {haslo}\n\n{opis_krotki}\n\nUdostępnij, to może być jego/jej szansa.\n{kontakt}' },
  dt: { l: 'Apel o dom tymczasowy', t: 'PILNIE SZUKAMY DOMU TYMCZASOWEGO dla {IMIE}\n{haslo}\n\n{opis_krotki}\n\nDom tymczasowy to czas, w którym pies odpoczywa od schroniska, a my szukamy mu domu na stałe. Koszty leczenia i karmę pokrywa stowarzyszenie.\n{kontakt}' },
  sms: { l: 'SMS / WhatsApp (krótko)', t: '{imie}{dane_krotko}. Szuka domu. Zdjęcia i opis: {link}' }
};
// Zmienne do wstawienia w szablon (kolejność = kolejność przycisków „Wstaw zmienną”).
export const ZMIENNE_KARTA = [['imie', 'Imię'], ['IMIE', 'IMIĘ'], ['haslo', 'Hasło'], ['haslo_tytul', 'Hasło (gdy puste: „wpisz hasło”)'], ['dane', 'Wiek, wielkość, waga'], ['dane_krotko', ', wiek, wielkość'], ['opis', 'Opis'], ['opis_krotki', 'Opis (do 300 znaków)'], ['ile_czeka', 'Ile czeka w schronisku'], ['wiek', 'Wiek'], ['wielkosc', 'Wielkość'], ['waga', 'Waga'], ['go', 'go/ją'], ['mu', 'mu/jej'], ['niego', 'niego/nią'], ['gotowy', 'gotowy/gotowa'], ['kontakt', 'Kontakt'], ['link', 'Link do ogłoszenia']];
export function zmienneKarta(d, h = '') {
  const imie = String(d.imie || ''), suka = d.plec === 'suka', dn = d.data_przyjecia ? days(d.data_przyjecia) : 0, opis = d.opis || '';
  return {
    imie, IMIE: imie.toUpperCase(), haslo: h, haslo_tytul: h || 'wpisz hasło',
    dane: [d.wiek, d.wielkosc, d.waga && 'waga ' + d.waga].filter(Boolean).join(', '),
    dane_krotko: [d.wiek, d.wielkosc].filter(Boolean).map((x) => ', ' + x).join(''),
    opis, opis_krotki: opis ? opis.slice(0, 300) : '',
    ile_czeka: dn > 30 ? `${imie} jest w schronisku od ${dn} dni i nikt o ${suka ? 'nią' : 'niego'} nie zapytał.` : `${imie} czeka na swój dom.`,
    wiek: d.wiek || '', wielkosc: d.wielkosc || '', waga: d.waga || '',
    go: suka ? 'ją' : 'go', mu: suka ? 'jej' : 'mu', niego: suka ? 'nią' : 'niego', gotowy: suka ? 'gotowa' : 'gotowy',
    kontakt: KONTAKT, link: d.zrodlo_url || SITE
  };
}
// Proste podstawianie: {nazwa} → wartość. Nieznane słowa w klamrach zostają bez zmian.
export const wypelnijKarta = (tpl, v) => String(tpl).replace(/\{([A-Za-z_]+)\}/g, (m, n) => (Object.prototype.hasOwnProperty.call(v, n) ? String(v[n]) : m));
async function szablonyKarta() { const o = {}; for (const r of await list(TPL_COL)) if (r && r.rodzaj && TEKSTY[r.rodzaj]) o[r.rodzaj] = r; return o; }
export const tekstKarta = (rodzaj, d, h, ov = {}) => wypelnijKarta(ov[rodzaj]?.tekst ?? TEKSTY[rodzaj].t, zmienneKarta(d, h));

actions['dog-teksty'] = (el) => tekstyOkno(el.dataset.id);
async function tekstyOkno(id, start = {}) {
  const d = await get('psy', id); if (!d) return; let ov = await szablonyKarta();
  openSheet(`<h2>Teksty: ${esc(d.imie)}</h2><form novalidate>
    ${SEL('t_w', 'Rodzaj', Object.entries(TEKSTY).map(([k, v]) => [k, v.l]), start.rodzaj || 'post')}
    <div class="field"><label for="t_h">Hasło (np. „będziesz ze mnie dumny”)</label><input class="input" id="t_h" maxlength="80" placeholder="krótkie hasło o charakterze"></div>
    <div class="field"><label for="t_t">Gotowy tekst (możesz poprawić)</label><textarea class="textarea" data-nodraft id="t_t" style="min-height:220px"></textarea></div>
    <div class="btnrow"><button type="button" class="btn" id="t_c">Kopiuj</button><button type="button" class="btn ghost" id="t_s">Wyślij…</button></div>
    <div class="btnrow" style="margin-top:10px"><a class="btn ghost" id="t_wa" target="_blank" rel="noopener">WhatsApp</a><a class="btn ghost" id="t_sms">SMS</a></div>
    <div class="btnrow" style="margin-top:10px"><button type="button" class="btn ghost" id="t_e">${icon('pencil').s} Edytuj szablon</button></div>
    <p class="hint" id="t_i" style="margin:8px 0 0"></p></form>`, (s) => {
    const w = s.querySelector('#t_w'), h = s.querySelector('#t_h'), t = s.querySelector('#t_t'), info = s.querySelector('#t_i');
    h.value = start.haslo !== undefined ? start.haslo : d.haslo || '';
    const fill = () => {
      t.value = tekstKarta(w.value, d, h.value.trim(), ov); links();
      const o = ov[w.value]; info.textContent = o ? `Szablon zmieniony${o.autor ? ' przez ' + o.autor : ''}${o.ts ? ', ' + fmtDate(o.ts) : ''}` : '';
    };
    const links = () => { const e = encodeURIComponent(t.value); s.querySelector('#t_wa').href = 'https://wa.me/?text=' + e; s.querySelector('#t_sms').href = 'sms:?&body=' + e; };
    w.onchange = fill; h.oninput = fill; t.oninput = links; fill();
    s.querySelector('#t_c').onclick = async () => { try { await navigator.clipboard.writeText(t.value); toast('Skopiowano'); } catch { t.select(); toast('Zaznaczone, skopiuj ręcznie', true); } };
    s.querySelector('#t_s').onclick = async () => { if (navigator.share) { try { await navigator.share({ text: t.value }); } catch {} } else { try { await navigator.clipboard.writeText(t.value); toast('Skopiowano'); } catch {} } };
    s.querySelector('#t_e').onclick = () => szablonOkno(id, w.value, h.value);
    // szablon zmieniony przez kogoś innego w trakcie: odśwież tekst (bez ruszania ręcznej poprawki, jeśli ktoś akurat pisze)
    s._tplRefresh = async () => { ov = await szablonyKarta(); if (document.activeElement !== t) fill(); };
  });
}
on('change', ({ col } = {}) => {
  if (col !== TPL_COL && col !== '*') return;
  const sh = document.querySelector('#sheet-root .sheet'); if (sh && sh._tplRefresh) sh._tplRefresh();
});
async function szablonOkno(id, rodzaj, haslo) {
  const d = await get('psy', id); if (!d) return; const ov = await szablonyKarta(), o = ov[rodzaj], def = TEKSTY[rodzaj].t;
  const wroc = () => tekstyOkno(id, { rodzaj, haslo });
  openSheet(`<h2>Szablon: ${esc(TEKSTY[rodzaj].l)}</h2>
    <p class="hint" style="margin:0 0 10px">Zmiana obowiązuje wszystkich wolontariuszy i wszystkie psy. Słowa w nawiasach klamrowych, np. {imie}, same zamieniają się na dane psa.</p>
    <div class="field"><label for="ks_t">Treść szablonu</label><textarea class="textarea" id="ks_t" data-nodraft style="min-height:180px">${esc(o ? o.tekst : def)}</textarea></div>
    <details style="margin:0 0 12px"><summary style="cursor:pointer;font-weight:600;padding:8px 0">Wstaw zmienną</summary><div class="chips" style="margin-top:8px">${ZMIENNE_KARTA.map(([k, l]) => `<button type="button" class="chip outline" data-ins="{${esc(k)}}">${esc(l)}</button>`).join('')}</div></details>
    <div class="field"><span class="lbl">Tak to będzie wyglądać (${esc(d.imie)})</span><div class="socout" id="ks_p" style="white-space:pre-wrap"></div></div>
    <div class="err" id="ks_e" role="alert"></div>
    <div class="btnrow"><button type="button" class="btn" id="ks_s">Zapisz szablon</button><button type="button" class="btn ghost" id="ks_r">Przywróć domyślny</button></div>
    <button type="button" class="btn ghost block" id="ks_b" style="margin-top:10px">Wróć do tekstów</button>`, (s) => {
    const ta = s.querySelector('#ks_t'), pv = s.querySelector('#ks_p'), er = s.querySelector('#ks_e');
    const prev = () => { pv.textContent = wypelnijKarta(ta.value, zmienneKarta(d, String(haslo || '').trim())) || ' '; er.textContent = ''; };
    ta.addEventListener('input', prev); prev();
    s.querySelectorAll('[data-ins]').forEach((b) => b.addEventListener('click', () => {
      const a = ta.selectionStart ?? ta.value.length, z = ta.selectionEnd ?? a;
      ta.value = ta.value.slice(0, a) + b.dataset.ins + ta.value.slice(z); const pos = a + b.dataset.ins.length; ta.focus(); try { ta.setSelectionRange(pos, pos); } catch { /* */ } prev();
    }));
    s.querySelector('#ks_b').onclick = wroc;
    s.querySelector('#ks_s').onclick = async () => {
      const txt = ta.value.replace(/\s+$/, ''); if (!txt.trim()) { er.textContent = 'Szablon nie może być pusty. Użyj „Przywróć domyślny”, żeby wrócić do początkowego.'; return; }
      if (txt === def) { if (o) await remove(TPL_COL, rodzaj); }
      else await save(TPL_COL, { id: rodzaj, rodzaj, tekst: txt, autor: getName(), ts: Date.now() });
      toast('Szablon zapisany'); wroc();
    };
    s.querySelector('#ks_r').onclick = async () => {
      if (!o) { ta.value = def; prev(); toast('To już jest szablon domyślny'); return; }
      if (await confirmSheet('Przywrócić domyślny szablon?', 'Twoja zmiana zniknie u wszystkich wolontariuszy.', 'Przywróć', true)) { await remove(TPL_COL, rodzaj); toast('Przywrócono domyślny'); wroc(); } else szablonOkno(id, rodzaj, haslo);
    };
  });
}

// ===== stan automatycznego sprawdzania strony (robi je serwer 3 razy dziennie) =====
let _st = null, _stT = 0;
export const resetSiteStatus = () => { _stT = 0; };
export async function siteStatus() {
  if (_st && Date.now() - _stT < 5 * 60e3) return _st;
  try { const h = await api('/health'); _st = (h && h.site) || null; _stT = Date.now(); } catch { /* brak sieci: zostaje poprzedni stan */ }
  return _st;
}

// ===== zaległości (ekran „Do zrobienia” i licznik na Starcie) =====
export function gaps(dogs, zdrAll, walksAll = []) {
  const out = [], now = Date.now();
  for (const d of dogs) {
    if (!aktywny(d)) continue; const k = d.kanaly || {}; const walksD = walksAll.filter((w) => w.pies_id === d.id), quiet = zaufanieAktywne(d, walksD), nt = wToku(d);
    // Nowy pies (karta przyjęcia w toku): jedno przypomnienie zamiast osobnych o ocenie, zdjęciach, opisie i ogłoszeniu.
    // Po zamknięciu karty nowy pies jest traktowany jak każdy inny (bez osobnych przypomnień „dla nowych”).
    if (nt && !quiet) { const sk = stanKarty(d); out.push({ d, kind: 'karta', sev: 2, text: `Karta psa: ${sk.done} z ${sk.total}. Brakuje: ${sk.brak.join(', ')}`, act: 'karta-open', k: sk.pierwszy }); }
    if (!quiet && !nt && (!hasPics(d))) out.push({ d, kind: 'foto', sev: 2, text: 'Brak zdjęć. Potrzebna sesja', act: 'dog-photo' });
    if (k.fb && !k.www && days(k.fb) >= 2) out.push({ d, kind: 'www', sev: 2, text: `Na Facebooku od ${days(k.fb)} dni, nie ma na stronie`, act: 'dog-kanaly' });
    if (!quiet && (d.data_przyjecia && miejsce(d) === 'schronisko' && days(d.data_przyjecia) >= 180 && !d.kampania)) out.push({ d, kind: 'halas', sev: 1, text: `W schronisku ${days(d.data_przyjecia)} dni. Czas na „zróbmy hałas”`, act: 'dog-teksty' });
    for (const z of zdrDue(zdrAll.filter((x) => x.pies_id === d.id))) out.push({ d, kind: 'zdrowie', sev: z.termin < now ? 3 : 2, text: `${TYP[z.typ]}: ${z.termin < now ? 'termin minął ' + fmtDate(z.termin) : 'do ' + fmtDate(z.termin)}`, act: 'dog-zdrowie' });
  }
  return out.sort((a, b) => b.sev - a.sev || (a.d.imie || '').localeCompare(b.d.imie || '', 'pl'));
}
import { dzisItems, dzisCard } from './terminarz.js';
export async function zrobic() {
  const [dogs, zdr, walksA] = await Promise.all([list('psy'), list('zdrowie'), list('spacery')]); const g = gaps(dogs, zdr, walksA); const st = await siteStatus(), err = st && st.enabled !== false && st.ok === false ? st.blad || 'Nieznany błąd.' : null;
  const { pageBar } = await import('./ui.js'); const { dogThumb } = await import('./screens-psy.js');
  return {
    tab: 'start', title: 'Dziś i do zrobienia', live: true,
    html: html`${pageBar('Dziś i do zrobienia')}<div class="pad" style="margin-bottom:12px">${dzisCard(await dzisItems())}</div><div class="sec" style="margin-top:0"><h2>Do uzupełnienia u psów</h2></div><div class="pad stack">${err ? html`<div class="card gap"><span class="rt"><b>Serwer nie mógł sprawdzić strony schroniska</b><small>${err}</small></span><button class="btn sm ghost" data-act="set-site">Sprawdź teraz</button></div>` : ''}${g.length ? g.map((x) => html`<div class="card gap"><a class="gi" href="#/psy/${x.d.id}"><span class="gp${wybCls(x.d)}">${dogThumb(x.d)}</span><span class="rt"><b>${x.d.imie} ${raw(boksPill(x.d, 'in'))}</b>${raw(linie(x.d))}<small>${x.text}</small></span></a><button class="btn sm ghost" data-act="${x.act}" data-id="${x.d.id}" data-k="${x.k || ''}">Otwórz</button></div>`)
      : (err ? '' : html`<div class="empty">${icon('check')}<h3>Wszystko ogarnięte</h3><p>Brak zaległości. Nowe pojawią się tu same.</p></div>`)}</div>`,
    mount(root) { import('./photos.js').then((m) => m.hydratePhotos(root)); }
  };
}

// ===== szybkie dodanie nowego psa w schronisku =====
// Nowy pies: „Przyjmij nowego psa” otwiera kartę psa (karta.js, #/karta/nowy).
export function nowyPies() { location.hash = '#/karta/nowy'; }
