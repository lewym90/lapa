// Tryb „Brama”: sobotni spacer-masówka. Jedno dotknięcie = pies wydany, jedno = zwrócony. Godziny zapisują się same.
import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet } from './ui.js';
import { list, save, get, remove } from './store.js';
import { getName } from './auth.js';
import { uid, fmtTime as hhmm } from './util.js';
import { dogThumb } from './screens-psy.js';
import { hydratePhotos } from './photos.js';
import { miejsce, aktywny } from './teczka.js';
import { boksPill, wybClsB as wybCls, wybrani, wybraniTxt, linieB as linie, kto, opisLineB as opisLine, kolejnosc, kolejnoscHtml, poBoksie } from './znak.js';

// Kontakt do osoby: numer telefonu → „Zadzwoń”, link z Messengera → „Messenger”, inny tekst (np. nazwa z Messengera) bez linku.
const kontaktHtml = (k) => { const t = String(k || '').trim(); if (!t) return ''; const dig = t.replace(/[\s()+-]/g, '');
  if (/^\d{7,}$/.test(dig)) return `<a class="kontakt" href="tel:${esc(t.replace(/[^\d+]/g, ''))}">${icon('phone').s}${esc(t)}</a>`;
  if (/m\.me\/|messenger\.com|facebook\.com/i.test(t)) { const u = /^https?:/i.test(t) ? t : 'https://' + t; return `<a class="kontakt" href="${esc(u)}" target="_blank" rel="noopener">${icon('chat').s}Messenger</a>`; }
  return `<span>Messenger: ${esc(t)}</span>`; };

let tab = 'wydaj', q = '', timer = null;
const DZIEN = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const TAGI = ['spokojny', 'ciągnął na smyczy', 'bał się', 'szczekał na psy', 'załatwił się', 'nie chciał iść', 'bardzo radosny', 'problem zdrowotny'];
const plural = (n, a, b, c) => (n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
const min = (ms) => Math.max(0, Math.round(ms / 60000));
const dur = (m) => m >= 60 ? `${Math.floor(m / 60)} godz. ${m % 60} min` : `${m} min`;

async function stan() {
  const [dogs, walks] = await Promise.all([list('psy'), list('spacery')]);
  const od = DZIEN();
  const dzis = walks.filter((w) => w.tryb === 'brama' && w.start >= od);
  const out = new Map(dzis.filter((w) => !w.end).map((w) => [w.pies_id, w]));
  const bylo = new Set(dzis.map((w) => w.pies_id));
  const boksem = kolejnosc('brama') === 'boks';
  const lista = dogs.filter((d) => aktywny(d) && miejsce(d) === 'schronisko').sort(boksem ? poBoksie : (a, b) => (a.imie || '').localeCompare(b.imie || '', 'pl'));
  // „Poza” i „Wróciły”: według boksów albo jak dotąd według godziny
  const psa = (w) => dogs.find((d) => d.id === w.pies_id) || { imie: w.pies_imie };
  const wgBoksu = (a, b) => poBoksie(psa(a), psa(b));
  return { lista, out, bylo, dzis, wrocily: dzis.filter((w) => w.end).sort(boksem ? wgBoksu : (a, b) => b.end - a.end), wgBoksu: boksem ? wgBoksu : null };
}

export async function brama() {
  const s = await stan();
  const nieWyd = s.lista.filter((d) => !s.out.has(d.id) && !s.bylo.has(d.id));
  const juz = s.lista.filter((d) => !s.out.has(d.id) && s.bylo.has(d.id));
  const ql = q.toLowerCase();
  const f = (d) => (d.imie || '').toLowerCase().includes(ql);
  const dogRow = (d, btn) => `<div class="row card${wybCls(d) ? ' wybr' : ''}" style="gap:12px"><button class="bimie" data-act="dog-oznacz" data-id="${esc(d.id)}" aria-label="Oznaczenie i opis: ${esc(d.imie)}"><span class="avatar sm">${dogThumb(d).s}</span><span class="rt"><b>${esc(d.imie)} ${boksPill(d, 'in')}</b>${linie(d)}<small>${btn.sub}</small></span></button>${btn.html}</div>`;
  let body = '';
  if (tab === 'wydaj') {
    const rows = [...nieWyd.filter(f).map((d) => dogRow(d, { sub: 'dziś jeszcze nie był', html: `<button class="btn gold" data-act="br-out" data-id="${esc(d.id)}">Wydaj</button>` })),
      ...juz.filter(f).map((d) => dogRow(d, { sub: `dziś był już ${s.dzis.filter((w) => w.pies_id === d.id).length}x`, html: `<button class="btn ghost" data-act="br-out" data-id="${esc(d.id)}">Wydaj</button>` }))];
    body = rows.join('') || `<div class="empty">${icon('paw').s}<h3>Brak psów</h3><p>Dodaj psy w zakładce Psy.</p></div>`;
  } else if (tab === 'out') {
    const rows = [...s.out.values()].sort(s.wgBoksu || ((a, b) => a.start - b.start)).filter((w) => (w.pies_imie || '').toLowerCase().includes(ql)).map((w) => {
      const d = s.lista.find((x) => x.id === w.pies_id) || { imie: w.pies_imie };
      const m = min(Date.now() - w.start);
      return dogRow(d, { sub: `<span data-since="${w.start}" ${m > 90 ? 'style="color:var(--terracotta);font-weight:600"' : ''}>${hhmm(w.start)} (${dur(m)})</span>${w.osoba ? ' | ' + esc(w.osoba) : ''}${w.kontakt ? '<br>' + kontaktHtml(w.kontakt) : ''}`, html: `<button class="btn ghost" data-act="br-info" data-id="${esc(w.id)}" aria-label="Dane osoby">${icon('pencil').s}</button><button class="btn gold" data-act="br-back" data-id="${esc(w.id)}">Zwróć</button>` });
    });
    body = rows.join('') || `<div class="empty">${icon('walk').s}<h3>Nikt nie jest na spacerze</h3></div>`;
  } else {
    const rows = s.wrocily.filter((w) => (w.pies_imie || '').toLowerCase().includes(ql)).map((w) => {
      const d = s.lista.find((x) => x.id === w.pies_id) || { imie: w.pies_imie };
      return dogRow(d, { sub: `${hhmm(w.start)} do ${hhmm(w.end)} (${dur(min(w.end - w.start))})${w.osoba ? ' | ' + esc(w.osoba) : ''}${(w.tagi || []).length ? ' | ' + esc(w.tagi.join(', ')) : ''}${w.kontakt ? '<br>' + kontaktHtml(w.kontakt) : ''}`, html: `<button class="btn ghost" data-act="br-info" data-id="${esc(w.id)}" aria-label="Dopisz dane">${icon('pencil').s}</button>` });
    });
    body = rows.join('') || `<div class="empty">${icon('walk').s}<h3>Jeszcze nikt nie wrócił</h3></div>`;
  }
  const tb = (k, t, n) => `<button class="chip" data-act="br-tab" data-t="${k}" style="flex:1;justify-content:center;white-space:nowrap;padding:10px 4px;${tab === k ? 'background:var(--gold);color:#1b1b17;font-weight:600' : ''}">${t} ${n}</button>`;
  return {
    tab: 'start', title: 'Brama', live: false,
    html: html`${pageBar('Brama – spacery')}<div class="pad">
      <p class="sub" style="margin:4px 0 12px">Dziś: <b>${s.dzis.length}</b> ${plural(s.dzis.length, 'spacer', 'spacery', 'spacerów')}, <b>${new Set(s.dzis.map((w) => w.pies_id)).size}</b> z ${s.lista.length} psów. Bez spaceru: <b>${nieWyd.length}</b>.</p>
      <div style="display:flex;gap:8px;margin-bottom:12px">${raw(tb('wydaj', 'Wydaj', s.lista.length - s.out.size) + tb('out', 'Poza', s.out.size) + tb('wrocily', 'Wróciły', s.wrocily.length))}</div>
      <div class="search">${icon('search')}<input id="bq" aria-label="Szukaj psa" type="search" placeholder="Szukaj psa" autocomplete="off" value="${esc(q)}"></div>${raw(kolejnoscHtml('brama', tab === 'wydaj' ? 'Alfabetycznie' : 'Godzina'))}<p class="hint" style="margin:6px 2px 0;color:var(--sage);font-size:13px">Dotknij imienia psa, żeby go oznaczyć (tylko dla wybranych, krótki opis). Widzą to tylko administratorzy.</p></div>
      <div class="pad stack" id="bl" style="margin-top:8px">${raw(body)}</div>
      <div class="pad" style="margin-top:12px"><button class="btn ghost block" data-act="br-sum">Podsumowanie dnia (post)</button><p class="hint" style="margin-top:8px">Dla psa, który wyszedł z wolontariuszem na dłuższy spacer z notatkami i zdjęciami, użyj <a href="#/spacer">spaceru z wolontariuszem</a>.</p></div>`,
    mount(root) {
      const inp = root.querySelector('#bq');
      inp.addEventListener('input', () => { q = inp.value; rerender(false); });
      hydratePhotos(root);
      clearInterval(timer);
      timer = setInterval(() => {
        if (!root.isConnected) return clearInterval(timer);
        root.querySelectorAll('[data-since]').forEach((e) => { const m = min(Date.now() - Number(e.dataset.since)); e.textContent = `${hhmm(Number(e.dataset.since))} (${dur(m)})`; if (m > 90) { e.style.color = 'var(--terracotta)'; e.style.fontWeight = '600'; } });
      }, 30000);
    }
  };
}
const rerender = () => dispatchEvent(new HashChangeEvent('hashchange'));

actions['br-tab'] = (el) => { tab = el.dataset.t; rerender(); };
actions['br-out'] = async (el) => {
  const d = await get('psy', el.dataset.id); if (!d) return;
  const od = DZIEN(), dzis = (await list('spacery')).filter((w) => w.tryb === 'brama' && w.start >= od && w.osoba);
  const ludzie = [...new Map(dzis.sort((a, b) => b.start - a.start).map((w) => [w.osoba.toLowerCase(), { osoba: w.osoba, kontakt: w.kontakt || '' }])).values()].slice(0, 8);
  openSheet(`<h2>Wydaj: ${esc(d.imie)} ${boksPill(d)}</h2>${opisLine(d)}
    ${wybrani(d) ? `<div class="wybbox" style="margin-top:0"><b>${esc(wybraniTxt(d))}</b>${kto(d) ? `<p>Mogą wychodzić: ${esc(kto(d))}</p>` : ''}</div>` : ''}
    <form id="wo" novalidate>
    ${ludzie.length ? `<div class="field"><span class="lbl">Dziś już wyprowadzali (dotknij, żeby wpisać)</span><div class="chips">${ludzie.map((x, i) => `<button type="button" class="chip outline" data-lu="${i}">${esc(x.osoba)}</button>`).join('')}</div></div>` : ''}
    <div class="field"><label for="wo_o">Imię osoby (opcjonalnie)</label><input class="input" id="wo_o" maxlength="60" autocomplete="off" data-nodraft></div>
    <div class="field"><label for="wo_k">Telefon lub Messenger (opcjonalnie)</label><input class="input" id="wo_k" maxlength="120" autocomplete="off" data-nodraft placeholder="np. 600 100 200 albo m.me/jan.kowalski"><p class="hint" style="margin:6px 0 0">Numer zniknie z aplikacji po 30 dniach. Imię zostaje w historii spacerów.</p></div>
    <button class="btn gold block" type="submit">Wydaj</button></form>`, (s) => {
    s.querySelectorAll('[data-lu]').forEach((b) => b.addEventListener('click', () => { const x = ludzie[+b.dataset.lu]; s.querySelector('#wo_o').value = x.osoba; s.querySelector('#wo_k').value = x.kontakt; }));
    s.querySelector('#wo').addEventListener('submit', async (e) => {
      e.preventDefault();
      const w = { id: 'w' + uid(), tryb: 'brama', pies_id: d.id, pies_imie: d.imie, start: Date.now(), end: null, dystans_km: 0, autor: getName(), osoba: s.querySelector('#wo_o').value.trim(), kontakt: s.querySelector('#wo_k').value.trim() };
      await save('spacery', w); closeSheet(); toast(`${d.imie} wydany o ${hhmm(w.start)}`); rerender();
    });
  });
};
actions['br-back'] = async (el) => {
  const w = await get('spacery', el.dataset.id); if (!w || w.end) return;
  w.end = Date.now(); w.czas_min = (w.end - w.start) / 60000; await save('spacery', w);
  toast(`${w.pies_imie} wrócił, spacer ${dur(min(w.end - w.start))}`); rerender();
};
actions['br-info'] = async (el) => {
  const w = await get('spacery', el.dataset.id); if (!w) return;
  const sel = new Set(w.tagi || []);
  openSheet(`<h2>${esc(w.pies_imie)}, dane ze spaceru</h2><p class="hint" style="margin:0 0 12px">Wszystko opcjonalne. Wystarczy to, co osoba sama powie.</p>
    <form id="bf"><div class="field"><label for="bo">Imię osoby</label><input class="input" id="bo" maxlength="60" value="${esc(w.osoba || '')}" data-nodraft></div>
    <div class="field"><label for="bk">Telefon lub Messenger</label><input class="input" id="bk" maxlength="120" value="${esc(w.kontakt || '')}" data-nodraft placeholder="np. 600 100 200 albo m.me/jan.kowalski"><p class="hint" style="margin:6px 0 0">Numer zniknie z aplikacji po 30 dniach.</p></div>
    <div class="field"><label>Jak poszło</label><div style="display:flex;flex-wrap:wrap;gap:8px">${TAGI.map((t) => `<button type="button" class="chip${sel.has(t) ? ' dark' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
    <div class="field"><label for="bn">Uwagi</label><textarea class="textarea" id="bn" maxlength="600">${esc(w.notatka || '')}</textarea></div>
    ${w.end ? '' : '<p class="hint">Godzina zwrotu zapisze się po naciśnięciu „Zwróć”.</p>'}<button class="btn block" type="submit">Zapisz</button><button class="btn ghost block" type="button" id="bdel" style="margin-top:10px;color:var(--terra-d)">Usuń ten wpis (pomyłka)</button></form>`, (s) => {
    s.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => { const t = b.dataset.tag; sel.has(t) ? sel.delete(t) : sel.add(t); b.classList.toggle('dark'); }));
    s.querySelector('#bdel').onclick = async () => { if (await confirmSheet('Usunąć wpis?', `Spacer psa ${w.pies_imie} zniknie z historii.`, 'Usuń', true)) { await remove('spacery', w.id); closeSheet(); toast('Usunięto'); rerender(); } };
    s.querySelector('#bf').addEventListener('submit', async (e) => {
      e.preventDefault(); const cur = await get('spacery', w.id);
      cur.osoba = s.querySelector('#bo').value.trim(); cur.kontakt = s.querySelector('#bk').value.trim(); cur.tagi = [...sel]; cur.notatka = s.querySelector('#bn').value.trim();
      await save('spacery', cur); closeSheet(); toast('Zapisane'); rerender();
    });
  });
};
actions['br-sum'] = async () => {
  const s = await stan(); const n = s.dzis.length; const psy = new Set(s.dzis.map((w) => w.pies_id)).size;
  const ludzie = new Set(s.dzis.map((w) => (w.osoba || '').toLowerCase()).filter(Boolean)).size;
  const text = `DZIĘKUJEMY! Dziś w schronisku w Nowodworze odbyło się ${n} ${plural(n, 'spacer', 'spacery', 'spacerów')}. Na spacerze było ${psy} z ${s.lista.length} psiaków. Każdy wyszedł za bramę, powęszył i choć chwilę poczuł się jak w domu. Jesteście wspaniali! Zapraszamy za tydzień.${s.lista.length - psy ? ` A ${s.lista.length - psy} ${plural(s.lista.length - psy, 'pies czeka', 'psy czekają', 'psów czeka')} na kolejną okazję.` : ''}`;
  void ludzie;
  openSheet(`<h2>Podsumowanie dnia</h2><div class="field"><textarea class="textarea" id="bt" style="min-height:200px">${esc(text)}</textarea></div><button class="btn block" id="bc">Kopiuj</button>`, (sh) => {
    sh.querySelector('#bc').onclick = async () => { const t = sh.querySelector('#bt'); try { await navigator.clipboard.writeText(t.value); toast('Skopiowano'); } catch { t.select(); toast('Zaznaczone, skopiuj ręcznie', true); } };
  });
};
