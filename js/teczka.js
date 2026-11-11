// Teczka psa: miejsce pobytu, zdrowie, ocena zachowania, publikacja per kanał, teksty do postów, zaległości.
import { html, icon, esc, openSheet, closeSheet, toast, actions, confirmSheet } from './ui.js';
import { list, save, remove, get } from './store.js';
import { getName } from './auth.js';
import { MS_DAY, fmtDate, uid } from './util.js';
import { SITE } from './config.js';
import { api } from './api.js';
import * as db from './db.js';

export const MIEJSCA = [['schronisko', 'W schronisku'], ['dt', 'W domu tymczasowym'], ['hotelik', 'W hoteliku'], ['adoptowany', 'Adoptowany'], ['zaginiony', 'Zaginiony'], ['zmarl', 'Odszedł za tęczowy most']];
export const KANALY = [['fb', 'Facebook (album)'], ['www', 'Strona schroniska'], ['ig', 'Instagram'], ['tiktok', 'TikTok'], ['puszatek', 'Puszatek'], ['psinder', 'Psinder']];
export const ZDROWIE_TYPY = [['szczepienie', 'Szczepienie'], ['odrobaczanie', 'Odrobaczanie'], ['pchly', 'Pchły i kleszcze'], ['kastracja', 'Kastracja / sterylizacja'], ['chip', 'Czip'], ['weterynarz', 'Wizyta u weterynarza'], ['lek', 'Lek / leczenie'], ['badanie', 'Badanie'], ['inne', 'Inne']];
const TYP = Object.fromEntries(ZDROWIE_TYPY);
const OCENA_POLA = [['ludzie', 'Do ludzi'], ['dzieci', 'Do dzieci'], ['psy', 'Do innych psów'], ['koty', 'Do kotów'], ['smycz', 'Na smyczy']];
const OCENA_OPC = [['', 'Nie wiadomo'], ['ok', 'Bardzo dobrze'], ['neutral', 'Neutralnie'], ['ostroznie', 'Ostrożnie / z zastrzeżeniem'], ['nie', 'Słabo / nie polecamy']];
const OCENA_LBL = Object.fromEntries(OCENA_OPC);
const SEL = (id, label, opts, val) => `<div class="field"><label for="${id}">${label}</label><select class="select" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
const d10 = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const plural = (n, a, b, c) => (n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
export const days = (t) => Math.max(0, Math.floor((Date.now() - t) / MS_DAY));

export const miejsce = (d) => d.miejsce || (d.status === 'adoptowany' ? 'adoptowany' : d.status === 'dt' ? 'dt' : d.status === 'hotelik' ? 'hotelik' : 'schronisko');
const hasPics = (d) => (d.zdjecia || []).length + (d.moje_zdjecia || []).length > 0;
export const aktywny = (d) => !['adoptowany', 'zmarl'].includes(miejsce(d)) && d.status !== 'adoptowany';

// Etap „nowego psa”, liczony z danych (nic nie trzeba przestawiać ręcznie).
export function etap(d) {
  const k = d.kanaly || {};
  const steps = [['Przyjęty', true], ['Ocena', !!d.ocena], ['Sesja', hasPics(d)], ['Opis', !!(d.opis || '').trim()], ['Opublikowany', !!(k.fb || k.www)]];
  const done = steps.filter((s) => s[1]).length;
  return { steps, done, total: steps.length, next: (steps.find((s) => !s[1]) || [])[0] || null };
}

// ===== wiersze do karty psa =====
export function teczkaRows(d, zdr) {
  const m = miejsce(d), k = d.kanaly || {}, e = etap(d);
  const nKan = KANALY.filter(([x]) => k[x]).length;
  const due = zdrDue(zdr);
  const dni = d.data_przyjecia && m === 'schronisko' ? days(d.data_przyjecia) : null;
  return html`
    <button class="row" data-act="dog-miejsce" data-id="${d.id}">${icon('pin')}<span class="rt"><b>${(MIEJSCA.find((x) => x[0] === m) || [])[1]}${d.opiekun ? ' · ' + d.opiekun : ''}</b><small>${d.data_przyjecia ? 'Od ' + fmtDate(d.data_przyjecia) + (dni !== null ? ` · ${dni} ${plural(dni, 'dzień', 'dni', 'dni')} w schronisku` : '') : 'Dodaj datę przyjęcia, czip i opiekuna'}${d.chip ? ' · czip ' + d.chip : ''}</small></span>${icon('chev')}</button>
    ${d.nowy && e.done < e.total ? html`<div class="steps" aria-label="Postęp nowego psa">${e.steps.map(([l, ok]) => html`<span class="${ok ? 'ok' : ''}">${ok ? '✓ ' : ''}${l}</span>`)}</div>` : ''}
    <button class="row" data-act="dog-ocena" data-id="${d.id}">${icon('heart')}<span class="rt"><b>Ocena zachowania${d.ocena && d.ocena.auto ? ' (z opisu, sprawdź)' : ''}</b><small>${d.ocena ? OCENA_POLA.filter(([p]) => d.ocena[p]).map(([p, l]) => l.replace('Do ', '').replace('Na ', '') + ': ' + (OCENA_LBL[d.ocena[p]] || '').toLowerCase()).join(' · ') || 'Zapisana' : 'W opisie brak informacji. Kliknij, żeby ocenić po spacerze'}</small></span>${icon('chev')}</button>
    <button class="row" data-act="dog-zdrowie" data-id="${d.id}">${icon('medic')}<span class="rt"><b>Zdrowie i zabiegi</b><small>${zdr.length ? zdr.length + ' ' + plural(zdr.length, 'wpis', 'wpisy', 'wpisów') + (due.length ? ' · do zrobienia: ' + due.map((z) => TYP[z.typ]).join(', ') : '') : 'Szczepienia, kastracja, leki, koszty'}</small></span>${icon('chev')}</button>
    <button class="row" data-act="dog-kanaly" data-id="${d.id}">${icon('share')}<span class="rt"><b>Gdzie jest ogłoszony</b><small>${nKan ? KANALY.filter(([x]) => k[x]).map(([, l]) => l.split(' ')[0]).join(', ') : 'Nigdzie'}${nKan < KANALY.length ? ' · brakuje: ' + KANALY.filter(([x]) => !k[x]).map(([, l]) => l.split(' ')[0]).slice(0, 3).join(', ') + (KANALY.length - nKan > 3 ? '…' : '') : ''}</small></span>${icon('chev')}</button>
    <button class="row" data-act="dog-teksty" data-id="${d.id}">${icon('pencil')}<span class="rt"><b>Teksty do postów</b><small>Album, post, „zróbmy hałas”, dom tymczasowy, SMS</small></span>${icon('chev')}</button>`;
}

// ===== miejsce pobytu =====
actions['dog-miejsce'] = async (el) => {
  const d = await get('psy', el.dataset.id);
  openSheet(`<h2>Gdzie jest ${esc(d.imie)}?</h2><form id="mf" novalidate>
    ${SEL('mm', 'Miejsce pobytu', MIEJSCA, miejsce(d))}
    <div class="field"><label for="mo">Opiekun / dom tymczasowy / hotelik (opcjonalnie)</label><input class="input" id="mo" maxlength="80" value="${esc(d.opiekun || '')}"></div>
    <div class="field"><label for="md">Data przyjęcia do schroniska</label><input class="input" id="md" type="date" value="${d.data_przyjecia ? d10(d.data_przyjecia) : ''}"></div>
    <div class="field"><label for="mc">Numer czipa (opcjonalnie)</label><input class="input" id="mc" maxlength="20" inputmode="numeric" value="${esc(d.chip || '')}"></div>
    <button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    s.querySelector('#mf').addEventListener('submit', async (e) => {
      e.preventDefault(); const mm = s.querySelector('#mm').value, dd = s.querySelector('#md').value;
      const o = { ...d, miejsce: mm, opiekun: s.querySelector('#mo').value.trim(), chip: s.querySelector('#mc').value.trim(), data_przyjecia: dd ? new Date(dd + 'T12:00').getTime() : null };
      if (mm === 'adoptowany') o.status = 'adoptowany'; else if (mm === 'dt') o.status = o.status === 'adoptowany' ? 'dt' : o.status === 'pilne' ? 'pilne' : 'dt'; else if (mm === 'hotelik') o.status = 'hotelik';
      await save('psy', o); closeSheet(); toast('Zapisane');
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
  openSheet(`<h2>Gdzie jest ${esc(d.imie)}?</h2><p class="hint" style="margin:0 0 12px">Zaznacz, gdzie pies jest już ogłoszony. Na Starcie zobaczysz, czego jeszcze brakuje.</p><form id="kf" novalidate>
    ${KANALY.map(([x, l]) => `<label class="check"><input type="checkbox" data-k="${x}" ${k[x] ? 'checked' : ''}> ${l}${k[x] ? ` <span class="hint">od ${esc(fmtDate(k[x]))}</span>` : ''}</label>`).join('')}
    <button class="btn block" type="submit" style="margin-top:12px">Zapisz</button></form>`, (s) => {
    s.querySelector('#kf').addEventListener('submit', async (e) => {
      e.preventDefault(); const n = {};
      s.querySelectorAll('[data-k]').forEach((c) => { if (c.checked) n[c.dataset.k] = k[c.dataset.k] || Date.now(); });
      await save('psy', { ...d, kanaly: n }); closeSheet(); toast('Zapisane');
    });
  });
};

// ===== teksty do postów =====
const KONTAKT = 'Kontakt w sprawie adopcji: Justyna 691 742 265, Dorota 607 119 526, stowarzyszenie.nowodwor@wp.pl';
export const TEKSTY = {
  album: { l: 'Nazwa albumu', f: (d, h) => `${d.imie.toUpperCase()} - ${h || 'wpisz hasło'}` },
  post: { l: 'Post adopcyjny', f: (d, h) => `${d.imie.toUpperCase()} - ${h || 'wpisz hasło'}\n\n${[d.wiek, d.wielkosc, d.waga && 'waga ' + d.waga].filter(Boolean).join(', ')}\n\n${d.opis || ''}\n\nPrzed adopcją obowiązuje wizyta przedadopcyjna i umowa. Pies jest po kastracji/sterylizacji lub przed zabiegiem na koszt schroniska.\n${KONTAKT}\n${d.zrodlo_url || SITE}` },
  halas: { l: 'Zróbmy hałas', f: (d, h) => { const dn = d.data_przyjecia ? days(d.data_przyjecia) : 0; return `ZRÓBMY HAŁAS wokół ${d.imie.toUpperCase()}!\n${dn > 30 ? `${d.imie} jest w schronisku od ${dn} dni i nikt o ${d.plec === 'suka' ? 'nią' : 'niego'} nie zapytał.` : `${d.imie} czeka na swój dom.`} ${h || ''}\n\n${d.opis ? d.opis.slice(0, 300) : ''}\n\nUdostępnij, to może być jego/jej szansa.\n${KONTAKT}`; } },
  dt: { l: 'Apel o dom tymczasowy', f: (d, h) => `PILNIE SZUKAMY DOMU TYMCZASOWEGO dla ${d.imie.toUpperCase()}\n${h || ''}\n\n${d.opis ? d.opis.slice(0, 300) : ''}\n\nDom tymczasowy to czas, w którym pies odpoczywa od schroniska, a my szukamy mu domu na stałe. Koszty leczenia i karmę pokrywa stowarzyszenie.\n${KONTAKT}` },
  sms: { l: 'SMS / WhatsApp (krótko)', f: (d) => `${d.imie}${d.wiek ? ', ' + d.wiek : ''}${d.wielkosc ? ', ' + d.wielkosc : ''}. Szuka domu. Zdjęcia i opis: ${d.zrodlo_url || SITE}` }
};
actions['dog-teksty'] = async (el) => {
  const d = await get('psy', el.dataset.id);
  openSheet(`<h2>Teksty: ${esc(d.imie)}</h2><form novalidate>
    ${SEL('t_w', 'Rodzaj', Object.entries(TEKSTY).map(([k, v]) => [k, v.l]), 'post')}
    <div class="field"><label for="t_h">Hasło (np. „będziesz ze mnie dumny”)</label><input class="input" id="t_h" maxlength="80" placeholder="krótkie hasło o charakterze"></div>
    <div class="field"><label for="t_t">Gotowy tekst (możesz poprawić)</label><textarea class="textarea" id="t_t" style="min-height:220px"></textarea></div>
    <div class="btnrow"><button type="button" class="btn" id="t_c">Kopiuj</button><button type="button" class="btn ghost" id="t_s">Wyślij…</button></div>
    <div class="btnrow" style="margin-top:10px"><a class="btn ghost" id="t_wa" target="_blank" rel="noopener">WhatsApp</a><a class="btn ghost" id="t_sms">SMS</a></div></form>`, (s) => {
    const w = s.querySelector('#t_w'), h = s.querySelector('#t_h'), t = s.querySelector('#t_t'); h.value = d.haslo || '';
    const fill = () => { t.value = TEKSTY[w.value].f(d, h.value.trim()); links(); };
    const links = () => { const e = encodeURIComponent(t.value); s.querySelector('#t_wa').href = 'https://wa.me/?text=' + e; s.querySelector('#t_sms').href = 'sms:?&body=' + e; };
    w.onchange = fill; h.oninput = fill; t.oninput = links; fill();
    s.querySelector('#t_c').onclick = async () => { try { await navigator.clipboard.writeText(t.value); toast('Skopiowano'); } catch { t.select(); toast('Zaznaczone, skopiuj ręcznie', true); } };
    s.querySelector('#t_s').onclick = async () => { if (navigator.share) { try { await navigator.share({ text: t.value }); } catch {} } else { try { await navigator.clipboard.writeText(t.value); toast('Skopiowano'); } catch {} } };
  });
};

// ===== porównanie ze stroną schroniska (cache w telefonie, odświeżany co 6 godzin) =====
// Pamięć podręczna w pamięci + IndexedDB (localStorage bywa wyłączony, np. w trybie prywatnym).
let _site = null, _siteErr = null, _loaded = false;
export const siteCache = () => _site;
export const siteErr = () => _siteErr;
export async function loadSite() { if (_loaded) return; _loaded = true; try { _site = (await db.metaGet('site')) || null; } catch { /* brak */ } }
const idOf = (u) => (/\/(\d+)\/?$/.exec(u) || [])[1];
export async function siteNew(force = false) {
  await loadSite();
  if (!force && _site && Date.now() - _site.ts < 6 * 3600e3) return _site;
  try {
    const r = await api('/import/links', { timeout: 60000 }); const links = (r.links || []).filter((u) => idOf(u));
    if (links.length >= 5) { _site = { ts: Date.now(), links }; _siteErr = null; try { await db.metaSet('site', _site); } catch { /* tylko w pamięci */ } return _site; }
    _siteErr = `Serwer znalazł na stronie tylko ${links.length} psów. Zaktualizuj serwer (komenda aktualizuj.sh).`;
  } catch (e) { _siteErr = e.status === 404 ? 'Serwer nie ma jeszcze funkcji sprawdzania strony. Zaktualizuj serwer (komenda aktualizuj.sh).' : e.status === 0 ? 'Brak połączenia z serwerem.' : 'Błąd (' + (e.status || '?') + '): ' + (e.message || ''); }
  return _site;
}
export async function siteNewLinks() { await loadSite(); const c = siteCache(); if (!c) return []; const have = new Set((await list('psy')).map((d) => String(d.zrodlo_id || ''))); return c.links.filter((u) => !have.has(idOf(u))); }
actions['site-retry'] = async () => { toast('Sprawdzam stronę schroniska…'); await siteNew(true); dispatchEvent(new HashChangeEvent('hashchange')); };
actions['site-import-new'] = async (el) => {
  const links = await siteNewLinks(); const { importOne } = await import('./screens-psy.js'); el.disabled = true; let ok = 0;
  for (let i = 0; i < links.length; i++) { toast(`Importuję ${i + 1} z ${links.length}…`); try { await importOne(links[i]); ok++; } catch { /* kolejny */ } }
  toast(`Zaimportowano: ${ok}`); dispatchEvent(new HashChangeEvent('hashchange'));
};

// ===== zaległości (ekran „Do zrobienia” i licznik na Starcie) =====
export function gaps(dogs, zdrAll) {
  const out = [], now = Date.now(), sc = siteCache(), onSite = sc && sc.links.length >= 10 ? new Set(sc.links.map(idOf)) : null;
  for (const d of dogs) {
    if (!aktywny(d)) continue; const k = d.kanaly || {};
    if (onSite && d.zrodlo_id && !onSite.has(String(d.zrodlo_id)) && d.status !== 'adoptowany') out.push({ d, kind: 'zniknal', sev: 1, text: 'Nie ma już na liście strony. Adoptowany?', act: 'dog-miejsce' });
    if (d.auto_dodany && Date.now() - d.auto_dodany < 5 * MS_DAY) out.push({ d, kind: 'autonowy', sev: 2, text: 'Dodany automatycznie ze strony. Sprawdź dane i miejsce pobytu', act: 'dog-miejsce' });
    if (d.nowy && !d.ocena) out.push({ d, kind: 'ocena', sev: 2, text: 'Nowy pies bez oceny zachowania', act: 'dog-ocena' });
    if (!hasPics(d)) out.push({ d, kind: 'foto', sev: 2, text: 'Brak zdjęć. Potrzebna sesja', act: 'dog-photo' });
    if (d.nowy && !(d.opis || '').trim()) out.push({ d, kind: 'opis', sev: 1, text: 'Brak opisu do ogłoszenia', act: 'dog-ocena' });
    if (k.fb && !k.www && days(k.fb) >= 2) out.push({ d, kind: 'www', sev: 2, text: `Na Facebooku od ${days(k.fb)} dni, nie ma na stronie`, act: 'dog-kanaly' });
    if (d.www_status && d.status && d.www_status !== d.status && d.status !== 'schronisko' && d.status !== 'w_trakcie') out.push({ d, kind: 'status', sev: 2, text: `Na stronie: ${d.www_status === 'do_adopcji' ? 'do adopcji' : d.www_status}. Zmień status na stronie`, act: 'dog-kanaly' });
    if (d.nowy && (d.opis || '').trim() && hasPics(d) && !k.fb && !k.www) out.push({ d, kind: 'publ', sev: 2, text: 'Gotowy do opublikowania', act: 'dog-teksty' });
    if (d.data_przyjecia && miejsce(d) === 'schronisko' && days(d.data_przyjecia) >= 180 && !d.kampania) out.push({ d, kind: 'halas', sev: 1, text: `W schronisku ${days(d.data_przyjecia)} dni. Czas na „zróbmy hałas”`, act: 'dog-teksty' });
    for (const z of zdrDue(zdrAll.filter((x) => x.pies_id === d.id))) out.push({ d, kind: 'zdrowie', sev: z.termin < now ? 3 : 2, text: `${TYP[z.typ]}: ${z.termin < now ? 'termin minął ' + fmtDate(z.termin) : 'do ' + fmtDate(z.termin)}`, act: 'dog-zdrowie' });
  }
  return out.sort((a, b) => b.sev - a.sev || (a.d.imie || '').localeCompare(b.d.imie || '', 'pl'));
}
import { dzisItems, dzisCard } from './terminarz.js';
export async function zrobic() {
  const [dogs, zdr] = await Promise.all([list('psy'), list('zdrowie')]); const g = gaps(dogs, zdr); await siteNew(); const nw = await siteNewLinks(), err = siteCache() ? null : siteErr();
  const { pageBar } = await import('./ui.js'); const { dogThumb } = await import('./screens-psy.js');
  return {
    tab: 'start', title: 'Dziś i do zrobienia', live: true,
    html: html`${pageBar('Dziś i do zrobienia')}<div class="pad" style="margin-bottom:12px">${dzisCard(await dzisItems())}</div><div class="sec" style="margin-top:0"><h2>Do uzupełnienia u psów</h2></div><div class="pad stack">${err ? html`<div class="card gap"><span class="rt"><b>Nie udało się sprawdzić strony schroniska</b><small>${err}</small></span><button class="btn sm ghost" data-act="site-retry">Spróbuj</button></div>` : ''}${nw.length ? html`<div class="card gap"><span class="rt"><b>Na stronie schroniska: ${nw.length} ${nw.length === 1 ? 'pies, którego' : 'psów, których'} nie ma w aplikacji</b><small>${nw.slice(0, 4).map((u) => decodeURIComponent(u.split('/').slice(-2)[0])).join(', ')}${nw.length > 4 ? '…' : ''}</small></span><button class="btn sm" data-act="site-import-new">Importuj</button></div>` : ''}${g.length ? g.map((x) => html`<div class="card gap"><a class="gi" href="#/psy/${x.d.id}"><span class="gp">${dogThumb(x.d)}</span><span class="rt"><b>${x.d.imie}</b><small>${x.text}</small></span></a><button class="btn sm ghost" data-act="${x.act}" data-id="${x.d.id}">Otwórz</button></div>`)
      : (nw.length || err ? '' : html`<div class="empty">${icon('check')}<h3>Wszystko ogarnięte</h3><p>Brak zaległości. Nowe pojawią się tu same.</p></div>`)}</div>`,
    mount(root) { import('./photos.js').then((m) => m.hydratePhotos(root)); }
  };
}

// ===== szybkie dodanie nowego psa w schronisku =====
export function nowyPies() {
  openSheet(`<h2>Nowy pies w schronisku</h2><p class="hint" style="margin:0 0 14px">Wpisz tyle, ile wiesz. Resztę uzupełnisz po spacerze i sesji zdjęciowej.</p><form id="nf" novalidate>
    <div class="field"><label for="n_i">Imię (nadane przez Was)</label><input class="input" id="n_i" maxlength="40" autocomplete="off"></div>
    ${SEL('n_p', 'Płeć', [['', 'Nie wiadomo'], ['samiec', 'Samiec'], ['suka', 'Suka']], '')}
    <div class="field"><label for="n_w">Wiek / wielkość (opcjonalnie)</label><input class="input" id="n_w" maxlength="60" placeholder="np. ok. 2 lata, średni"></div>
    <div class="field"><label for="n_d">Data przyjęcia</label><input class="input" id="n_d" type="date" value="${d10()}"></div>
    <div class="err" id="n_e"></div><button class="btn block" type="submit">Dodaj</button></form>`, (s) => {
    s.querySelector('#nf').addEventListener('submit', async (e) => {
      e.preventDefault(); const imie = s.querySelector('#n_i').value.trim(); if (!imie) { s.querySelector('#n_e').textContent = 'Wpisz imię (może być robocze).'; return; }
      const [wiek, wielk] = s.querySelector('#n_w').value.split(',').map((x) => x.trim());
      const o = { id: 'm' + uid(), imie, plec: s.querySelector('#n_p').value, wiek: wiek || '', wielkosc: wielk || '', status: 'schronisko', miejsce: 'schronisko', nowy: true, data_przyjecia: new Date(s.querySelector('#n_d').value + 'T12:00').getTime(), dodany: Date.now(), zdjecia: [] };
      await save('psy', o); closeSheet(); toast('Dodano. Teraz zdjęcia i ocena'); location.hash = '#/psy/' + o.id;
    });
  });
}
actions['dog-new'] = () => nowyPies();
