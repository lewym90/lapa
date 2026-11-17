import { html, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet } from './ui.js';
import { list, save, get } from './store.js';
import { state, getName, setName, getTel, setTel, lock, logout } from './auth.js';
import { VERSION } from './config.js';
import { checkUpdate } from './update.js';
import { status as syncStatus, kick } from './sync.js';
import * as db from './db.js';
import { hydratePhotos } from './photos.js';
import { opisPotrzeby, dayKey, fmtShort, fmtDate, fmtDayLong, fmtTime } from './util.js';
import { pickDog } from './screens-psy.js';
import { raw } from './ui-core.js';
import { imieZnaki } from './znak.js';
import { zglDane, transportZgl, pomocPsyHtml, potrzebyHtml } from './wolontariusz.js';
import { PODZIEKOWANIE } from './tekst.js';
import { api } from './api.js';
import { resetSiteStatus } from './teczka.js';
import { ktoInto } from './kto.js';
import { settingsCard, syncPush } from './push.js';

const dayParts = (t) => { const d = new Date(t); return { n: d.getDate(), m: new Intl.DateTimeFormat('pl-PL', { month: 'short' }).format(d).replace('.', '') }; };
const names = (a) => (a.length <= 3 ? a.join(', ') : a.slice(0, 3).join(', ') + ' +' + (a.length - 3));

function needName() { if (getName()) return true; toast('Najpierw wpisz imię w ustawieniach', true); return false; }

// ================= transport =================
const TS = { szuka: 'Poszukiwany kierowca', przypisany: 'Przypisany', zrealizowany: 'Zrealizowany', anulowany: 'Anulowany' };
// Transport: lista na ekranie Pomoc (obie role). Osobnego ekranu nie ma.
export async function transportHtml() {
  const all = (await list('transporty')).sort((a, b) => a.kiedy - b.kiedy), psy = Object.fromEntries((await list('psy')).map((d) => [d.id, d])), of = await list('oferty');
  const act = all.filter((x) => x.status === 'szuka' || x.status === 'przypisany');
  const row = (x) => html`<button class="need" style="width:100%;text-align:left" data-act="tr-open" data-id="${x.id}"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><b style="font-size:17px">${raw(imieZnaki(psy[x.pies_id], x.pies_imie || 'Pies'))}</b>${x.pilny ? html` <span class="chip terra" style="min-height:26px;padding:2px 10px">Pilne</span>` : ''}<div class="sub">${x.skad} → ${x.dokad}</div><div class="sub">${fmtShort(x.kiedy)}</div></div><span class="chip ${x.status === 'szuka' ? 'terra' : ''}">${TS[x.status]}</span></div>${x.kierowca ? html`<div class="who">Kierowca: ${x.kierowca}</div>` : ''}${(() => { const o = of.filter((y) => y.typ === 'transport' && y.ref === x.id && y.stan !== 'odrzucona'); return o.length && x.status === 'szuka' ? html`<div class="who">Mogą pojechać: ${o.map((y) => y.imie).join(', ')}</div>` : ''; })()}</button>`;
  return act.length ? act.map((x) => row(x).s).join('') : '<p class="pusto">Teraz nikt nie potrzebuje transportu.</p>';
}
export function transForm() {
  pickDog((d) => openSheet(`<h2>Transport: ${esc(d.imie)}</h2><form id="tf2" novalidate>
    <div class="field"><label for="ts">Skąd</label><input class="input" id="ts" maxlength="80" value="Schronisko Nowodwór"></div>
    <div class="field"><label for="tdk">Dokąd</label><input class="input" id="tdk" maxlength="80" placeholder="np. lecznica, dom tymczasowy, miasto"></div>
    <div class="field"><label for="tk">Kiedy</label><input class="input" id="tk" type="datetime-local"></div>
    <div class="field"><label for="tu">Uwagi (opcjonalnie)</label><textarea class="textarea" id="tu" maxlength="400" placeholder="wymagania przewozu, kontakt do osoby odbierającej…"></textarea></div>
    <label class="chip outline" style="margin-bottom:14px;cursor:pointer"><input type="checkbox" id="tp" style="accent-color:var(--terra)"> Pilne</label><div class="err" id="te2"></div>
    <button class="btn block" type="submit">Zgłoś transport</button></form>`, (s) => {
    s.querySelector('#tf2').addEventListener('submit', async (e) => {
      e.preventDefault(); const skad = s.querySelector('#ts').value.trim(), dokad = s.querySelector('#tdk').value.trim(), k = s.querySelector('#tk').value;
      if (!skad || !dokad || !k) { s.querySelector('#te2').textContent = 'Uzupełnij: skąd, dokąd i kiedy.'; return; }
      await save('transporty', { pies_id: d.id, pies_imie: d.imie, skad, dokad, kiedy: new Date(k).getTime(), uwagi: s.querySelector('#tu').value.trim(), pilny: s.querySelector('#tp').checked, status: 'szuka', kierowca: '', autor: getName() });
      closeSheet(); toast('Transport zgłoszony');
    });
  }));
}
actions['a-trans'] = () => transForm();
actions['tr-open'] = async (el) => {
  const x = await get('transporty', el.dataset.id); if (!x) return; const pd = x.pies_id ? await get('psy', x.pies_id) : null; const z = await zglDane();
  openSheet(`<h2>${esc(x.pies_imie || 'Transport')}</h2>${pd && imieZnaki(pd, '').trim() ? `<p style="margin:-4px 0 8px">${imieZnaki(pd, '').trim()}</p>` : ''}<p class="sub" style="margin:0 0 8px">${esc(x.skad)} → ${esc(x.dokad)}<br>${esc(fmtDayLong(x.kiedy))}, ${esc(fmtTime(x.kiedy))}</p>
    ${x.uwagi ? `<div class="notebox">${esc(x.uwagi)}</div>` : ''}<p class="hint" style="margin:10px 0">Status: <b>${TS[x.status]}</b>${x.kierowca ? ' · kierowca: ' + esc(x.kierowca) : ''} · zgłosił(a): ${esc(x.autor || '')}</p>
    ${transportZgl(x, z.of, z.tel)}
    ${state.admin ? `<div class="btnrow" id="tb" style="margin-top:10px">${x.status === 'szuka' ? `<button class="btn" data-s="przypisany">${icon('truck').s} Jadę sam(a)</button>` : ''}
    ${x.status === 'przypisany' ? `<button class="btn" data-s="zrealizowany">${icon('check').s} Zrealizowany</button><button class="btn ghost" data-s="szuka">Nie mogę już jechać</button>` : ''}
    ${x.status === 'szuka' || x.status === 'przypisany' ? `<button class="btn ghost" data-s="anulowany">Anuluj transport</button>` : ''}</div>` : ''}`, (s) => {
    s.querySelector('#tb')?.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return; if (b.dataset.s === 'przypisany' && !needName()) return;
      x.status = b.dataset.s; x.kierowca = x.status === 'przypisany' ? getName() : x.status === 'szuka' ? '' : x.kierowca; await save('transporty', x); closeSheet(); toast('Zapisane');
    });
  });
};

// ================= pomoc =================
// Jeden ekran Pomoc (administrator i wolontariusz): psy, którym trzeba pomóc, potrzeby rzeczowe i transport.
export async function pomocEkran() {
  const [psyHtml, potrzHtml, trHtml] = await Promise.all([pomocPsyHtml(), potrzebyHtml(), transportHtml()]);
  return {
    tab: 'pomoc', title: 'Pomoc', live: true,
    html: html`${pageBar('Pomoc', { back: false })}
    <div class="sec" style="margin-top:6px"><h2>Potrzeby rzeczowe</h2>${state.admin ? html`<button class="link" data-act="a-need">+ Dodaj</button>` : ''}</div><div class="pad stack">${raw(potrzHtml)}</div>
    <div class="sec"><h2>Transport</h2>${state.admin ? html`<button class="link" data-act="a-trans">+ Dodaj</button>` : ''}</div><div class="pad stack">${raw(trHtml)}</div>
    <div class="sec"><h2>Psy</h2></div><div class="pad stack">${raw(psyHtml)}</div><div style="height:20px"></div>`,
    mount(r) { hydratePhotos(r); }
  };
}
export const help = pomocEkran;
// Potrzeba rzeczowa: jedno pole (np. „Karma mokra 20 kg”) i „Pilne”. Bez kategorii, jednostek i liczenia.
export function needForm(n = {}) {
  openSheet(`<h2>${n.id ? 'Potrzeba' : 'Nowa potrzeba'}</h2><div id="n_kto"></div><form id="nf3" novalidate>
    <div class="field"><label for="nn">Co jest potrzebne?</label><input class="input" id="nn" maxlength="120" placeholder="np. karma mokra 20 kg" value="${esc(opisPotrzeby(n))}" autocomplete="off"></div>
    <label class="check" style="margin:0 0 14px"><input type="checkbox" id="npi" ${n.priorytet === 'pilne' ? 'checked' : ''}> Pilne</label><div class="err" id="ne3"></div>
    <button class="btn block" type="submit">Zapisz</button>${n.id ? `<button type="button" class="btn gold block" style="margin-top:10px" id="nd">${icon('check').s} Już mamy</button>` : ''}</form>`, (s) => {
    if (n.id) ktoInto(s, '#n_kto', 'potrzeby', n.id, n.autor);
    s.querySelector('#nf3').addEventListener('submit', async (e) => {
      e.preventDefault(); const nazwa = s.querySelector('#nn').value.trim();
      if (!nazwa) { s.querySelector('#ne3').textContent = 'Wpisz, co jest potrzebne.'; return; }
      const o = { ...n, nazwa, priorytet: s.querySelector('#npi').checked ? 'pilne' : 'zwykle', status: 'otwarta', autor: n.autor || getName() };
      for (const k of ['kategoria', 'potrzeba', 'jednostka', 'zapewniono']) delete o[k];
      await save('potrzeby', o); closeSheet(); toast('Zapisane');
    });
    s.querySelector('#nd')?.addEventListener('click', async () => { await save('potrzeby', { ...n, status: 'zrealizowana' }); closeSheet(); toast('Super, zamknięte. Dziękujemy!'); });
  });
}
actions['a-need'] = () => needForm();
actions['need-edit'] = async (el) => needForm(await get('potrzeby', el.dataset.id));
// ================= ustawienia =================
export async function settings() {
  if (!state.admin) return settingsWol();
  const pend = await db.outboxCount(), notif = await settingsCard();
  return {
    tab: 'start', title: 'Ustawienia', live: false,
    html: html`${pageBar('Ustawienia')}<div class="pad stack">
      <section class="card"><h3>Twoje imię</h3><p class="sub" style="margin:2px 0 12px">Podpisuje Twoje wpisy, spacery i zgłoszenia.</p>
        <form id="sn" class="field" style="margin:0"><input class="input" id="sni" aria-label="Twoje imię" maxlength="40" value="${getName()}" autocomplete="given-name"><button class="btn block" style="margin-top:10px" type="submit">Zapisz imię</button></form></section>
      ${notif}
      <section class="card"><h3>${icon('lock')} Administrator</h3><p class="sub" style="margin:2px 0 12px">Tryb administratora: wszystkie uprawnienia, w tym dane osobowe (domy tymczasowe i hoteliki, finanse, telefony zgłoszeń), Brama, terminarz, karty psów. Zostaje włączony na stałe na tym telefonie.</p>
        <button class="btn ghost block" data-act="set-lock">${icon('lock')} Wyłącz tryb administratora</button></section>
      <section class="card"><h3>Synchronizacja</h3><p class="sub" style="margin:2px 0 12px" id="sst">${pend ? pend + ' zmian czeka na wysłanie.' : 'Wszystko zapisane na serwerze.'}${syncStatus.last ? ' Ostatnio: ' + fmtTime(syncStatus.last) + '.' : ''}</p>
        <div class="btnrow"><button class="btn ghost" data-act="set-sync">${icon('refresh')} Synchronizuj teraz</button><button class="btn ghost" data-act="set-resync">Pobierz dane od nowa</button></div></section>
      <section class="card"><h3>Strona schroniska</h3><p class="sub" style="margin:2px 0 12px" id="sitest">Sprawdzam…</p>
        <div class="btnrow"><button class="btn ghost" data-act="set-site">${icon('refresh')} Sprawdź stronę teraz</button></div></section>
      <section class="card"><h3>Kopia zapasowa</h3><p class="sub" style="margin:2px 0 8px" id="bkst">Kopie na serwerze: sprawdzam…</p><p class="sub" style="margin:2px 0 12px">Plik z danymi widocznymi na tym telefonie (razem z danymi osobowymi). Przechowuj go bezpiecznie.</p>
        <div class="btnrow"><button class="btn ghost" data-act="set-export">${icon('download')} Zapisz kopię</button><button class="btn ghost" data-act="set-import">${icon('upload')} Wczytaj kopię</button></div></section>
      ${oAplikacji()}
      <button class="btn line block" data-act="set-logout">${icon('logout')} Wyloguj z tego telefonu</button></div>`,
    mount(root) { api('/health').then((h) => { const b = h && h.backup; root.querySelector('#sitest').textContent = siteText(h && h.site); root.querySelector('#bkst').textContent = b && b.t && b.ok ? `Serwer robi kopię bazy co 30 minut. Ostatnia: ${fmtTime(b.t)}.` : 'Serwer robi kopię bazy co 30 minut (pierwsza po aktualizacji serwera).'; }).catch(() => { const e = root.querySelector('#bkst'); if (e) e.textContent = 'Kopie na serwerze: brak połączenia.'; }); imieForm(root); }
  };
}
const oAplikacji = () => html`<section class="card"><h3>O aplikacji</h3><p class="sub" style="margin:2px 0 12px">ŁAPA — Nowodwór, wersja <b>${VERSION}</b>. Aplikacja dla wolontariuszy, bezpłatna i bez reklam. Nowe wersje instalują się same po ponownym otwarciu aplikacji.</p><div class="btnrow"><button class="btn ghost" data-act="set-update">${icon('refresh')} Sprawdź aktualizację</button></div></section>`;
function imieForm(root) { root.querySelector('#sn').addEventListener('submit', (e) => { e.preventDefault(); const v = root.querySelector('#sni').value.trim(); if (v.length < 2) { toast('Wpisz imię', true); return; } setName(v); if (state.admin) syncPush(); toast('Zapisane'); }); }
// Ustawienia wolontariusza: imię, telefon do zgłoszeń, odblokowanie administratora, synchronizacja, wylogowanie.
async function settingsWol() {
  const pend = await db.outboxCount();
  return {
    tab: 'start', title: 'Ustawienia', live: false,
    html: html`${pageBar('Ustawienia')}<div class="pad stack">
      <section class="card"><h3>Twoje imię</h3><p class="sub" style="margin:2px 0 12px">Widzą je inni wolontariusze przy Twoich zgłoszeniach.</p>
        <form id="sn" class="field" style="margin:0"><input class="input" id="sni" aria-label="Twoje imię" maxlength="40" value="${getName()}" autocomplete="given-name"><button class="btn block" style="margin-top:10px" type="submit">Zapisz imię</button></form></section>
      <section class="card"><h3>Twój telefon</h3><p class="sub" style="margin:2px 0 12px">Podpowiada się przy zgłoszeniach („Mogę przywieźć”, „Mogę pojechać”, „Będę”). Zapisany tylko na tym telefonie. Przy zgłoszeniu widzi go wyłącznie administrator (przez 30 dni).</p>
        <form id="stl" class="field" style="margin:0"><input class="input" id="stli" type="tel" aria-label="Twój telefon" maxlength="20" value="${getTel()}" autocomplete="tel" placeholder="np. 600 100 200"><button class="btn block" style="margin-top:10px" type="submit">Zapisz telefon</button></form></section>
      <section class="card"><h3>${icon('lock')} Pracujesz w schronisku?</h3><p class="sub" style="margin:2px 0 12px">Hasło administratora odblokuje pełną aplikację: Bramę, terminarz, karty psów i resztę.</p>
        <button class="btn block" data-act="unlock-sheet">${icon('unlock')} Odblokuj hasłem administratora</button></section>
      <section class="card"><h3>Synchronizacja</h3><p class="sub" style="margin:2px 0 12px" id="sst">${pend ? pend + ' zmian czeka na wysłanie.' : 'Wszystko zapisane na serwerze.'}${syncStatus.last ? ' Ostatnio: ' + fmtTime(syncStatus.last) + '.' : ''}</p>
        <div class="btnrow"><button class="btn ghost" data-act="set-sync">${icon('refresh')} Synchronizuj teraz</button></div></section>
      ${oAplikacji()}
      <button class="btn line block" data-act="set-logout">${icon('logout')} Wyloguj z tego telefonu</button></div>`,
    mount(root) {
      imieForm(root);
      root.querySelector('#stl').addEventListener('submit', (e) => { e.preventDefault(); const v = root.querySelector('#stli').value.trim(); if (v && v.replace(/\D/g, '').length < 9) { toast('Wpisz pełny numer (9 cyfr)', true); return; } setTel(v); toast('Zapisane'); });
    }
  };
}
const siteText = (s) => !s ? 'Serwer nie ma jeszcze automatycznego sprawdzania strony. Zaktualizuj serwer.' : s.enabled === false ? 'Serwer nie ma pliku do sprawdzania strony. Zaktualizuj serwer.' : s.running ? 'Sprawdzam stronę teraz…' : !s.t ? 'Serwer sprawdza stronę co godzinę od 6 do 22 i o 2 w nocy. Pierwsze sprawdzenie nastąpi zaraz po aktualizacji serwera.' : s.ok ? `Serwer sprawdza stronę co godzinę od 6 do 22 i o 2 w nocy. Ostatnio: ${fmtDate(s.t)} ${fmtTime(s.t)}. Psów na stronie: ${s.razem}, nowych: ${s.nowych}, zmienionych: ${s.zmienionych}${s.zniknelo ? ', zniknęło ze strony (→ Byli u nas): ' + s.zniknelo : ''}${s.wrocilo ? ', wróciło na stronę: ' + s.wrocilo : ''}.${s.nazwy && s.nazwy.length ? ' Nowe: ' + s.nazwy.join(', ') + '.' : ''}${s.zniknelo_nazwy && s.zniknelo_nazwy.length ? ' Zniknęły: ' + s.zniknelo_nazwy.join(', ') + '.' : ''}` : `Ostatnie sprawdzenie strony (${fmtDate(s.t)} ${fmtTime(s.t)}) nie udało się: ${s.blad}`;
actions['set-site'] = async () => {
  const h0 = await api('/health').catch(() => null), t0 = (h0 && h0.site && h0.site.t) || 0; toast('Sprawdzam stronę schroniska…');
  try { await api('/site/sync', { method: 'POST', body: {} }); } catch { toast('Brak połączenia z serwerem', true); return; }
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2500)); const h = await api('/health').catch(() => null), s = h && h.site, el = document.getElementById('sitest'); if (!s) continue; if (el) el.textContent = siteText(s);
    if (!s.running && s.t > t0) { resetSiteStatus(); kick(10); if (location.hash === '#/start' || location.hash === '') dispatchEvent(new HashChangeEvent('hashchange')); toast(s.ok ? ([s.nowych ? `nowych psów: ${s.nowych}` : '', s.zniknelo ? `zniknęło ze strony: ${s.zniknelo}` : '', s.wrocilo ? `wróciło: ${s.wrocilo}` : ''].filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase()) || 'Sprawdzone. Bez zmian') : 'Nie udało się sprawdzić strony', !s.ok); return; }
    if (i >= 3 && !s.running && s.t === t0) { toast('Serwer sprawdzał stronę przed chwilą'); return; }
  }
};
actions['set-lock'] = async () => { const a = state.admin; await lock(); toast('Tryb administratora wyłączony'); location.hash = '#/start'; };
actions['set-update'] = () => { toast('Sprawdzam…'); checkUpdate({ manual: true }); };
actions['set-sync'] = () => { kick(10); toast('Synchronizuję…'); };
actions['set-resync'] = async () => { await db.metaSet('cursor', 0); await db.metaSet('cursor_private', 0); kick(10); toast('Pobieram wszystko od nowa…'); };
actions['set-export'] = async () => {
  const recs = (await db.allRecs()).filter((r) => !r.deleted && (state.coordinator || !r.col.startsWith('p_')));
  const blob = new Blob([JSON.stringify({ app: 'lapa', wersja: VERSION, data: Date.now(), rekordy: recs }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lapa-kopia-${dayKey(Date.now())}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
actions['set-import'] = () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const j = JSON.parse(await inp.files[0].text()); if (j.app !== 'lapa' || !Array.isArray(j.rekordy)) throw new Error('To nie jest kopia ŁAPY');
      if (!(await confirmSheet('Wczytać kopię?', `Wczytam ${j.rekordy.length} rekordów. Nowsze wersje zostaną zachowane po synchronizacji.`, 'Wczytaj'))) return;
      let n = 0; for (const r of j.rekordy) { if (!r.col || !r.data || (r.col.startsWith('p_') && !state.coordinator)) continue; await save(r.col, r.data); n++; }
      toast(`Wczytano ${n} rekordów`);
    } catch (e) { toast(e.message || 'Nie udało się wczytać kopii', true); }
  };
  inp.click();
};
actions['set-logout'] = async () => {
  const p = await db.outboxCount();
  if (await confirmSheet('Wylogować?', p ? `Uwaga: ${p} zmian nie zostało jeszcze wysłanych i zostanie utraconych. Połącz się z internetem i poczekaj na synchronizację.` : 'Dane zostaną usunięte z tego telefonu. Po ponownym zalogowaniu pobiorą się z serwera.', 'Wyloguj', true)) await logout();
};

// ================= podziękowanie =================
export async function thanks() {
  return {
    tab: 'start', nav: false, title: 'Dziękujemy',
    html: html`<div class="login" style="min-height:100dvh"><span class="pawbig">${icon('paw')}</span><div class="box" style="text-align:center">
      <span style="font-size:60px;color:var(--gold);display:grid;place-items:center;animation:rise 1s both">${icon('heart')}</span>
      <h1 style="font-size:46px;font-weight:500;margin:10px 0 6px;animation:rise 1s .15s both">Dziękujemy</h1><div style="width:54px;height:2px;background:var(--gold);margin:0 auto 22px"></div>
      ${PODZIEKOWANIE.akapity.map((t, i) => html`<p style="font-family:var(--serif);font-size:19px;line-height:1.6;margin:0 0 16px;color:rgba(244,240,231,.92);animation:rise 1s ${0.3 + i * 0.25}s both">${t}</p>`)}
      <p style="font-style:italic;color:var(--gold-l);margin:20px 0 28px">${PODZIEKOWANIE.podpis}</p>
      <a class="btn gold block" href="#/start">Wchodzę ${icon('arrow')}</a></div></div>`
  };
}
