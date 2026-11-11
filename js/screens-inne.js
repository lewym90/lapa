import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, pageBar, brandBar, confirmSheet, statusChip, safeUrl } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName, setName, lock, logout } from './auth.js';
import { SITE, VERSION } from './config.js';
import { checkUpdate } from './update.js';
import { status as syncStatus, kick } from './sync.js';
import * as db from './db.js';
import { nextSaturdays, dayKey, fmtShort, fmtDate, fmtDayLong, fmtTime, startOfDay, slug, dogNeeds, NEED_LABELS, uid } from './util.js';
import { pickDog, unlockSheet, dogThumb } from './screens-psy.js';
import { hydratePhotos } from './photos.js';
import { PODZIEKOWANIE } from './tekst.js';
import { api } from './api.js';
import { zgloszenia, udzialBlock, evKey, forKey } from './udzial.js';

const dayParts = (t) => { const d = new Date(t); return { n: d.getDate(), m: new Intl.DateTimeFormat('pl-PL', { month: 'short' }).format(d).replace('.', '') }; };
const names = (a) => (a.length <= 3 ? a.join(', ') : a.slice(0, 3).join(', ') + ' +' + (a.length - 3));

// ================= wydarzenia =================
let evFilter = 'wszystko';
export async function events() {
  const [ev, tr, zg] = await Promise.all([list('wydarzenia'), list('transporty'), zgloszenia()]);
  const me = getName(), today = startOfDay(Date.now());
  const sats = nextSaturdays(4).map((t) => ({ kind: 'walk', t, k: dayKey(t) }));
  const items = [...sats, ...ev.filter((e) => e.start >= today).map((e) => ({ kind: 'ev', t: e.start, e })), ...tr.filter((x) => x.kiedy >= today && x.status !== 'anulowany' && x.status !== 'zrealizowany').map((x) => ({ kind: 'tr', t: x.kiedy, x }))]
    .filter((i) => evFilter === 'wszystko' || (i.kind === 'ev' && (i.e.autor === me || forKey(zg, evKey('ev', i.e.id)).some((z) => z.imie === me && z.status === 'tak'))) || (i.kind === 'walk' && forKey(zg, evKey('walk', i.k)).some((z) => z.imie === me && z.status === 'tak')) || (i.kind === 'tr' && (i.x.kierowca === me || i.x.autor === me)))
    .sort((a, b) => a.t - b.t);
  let lastDay = '';
  return {
    tab: 'wydarzenia', title: 'Wydarzenia',
    html: html`<header class="topbar"><span style="width:44px"></span><h1 style="font-size:26px;font-weight:500;flex:1;text-align:center">Wydarzenia</h1><button class="iconbtn" data-act="a-event" aria-label="Dodaj wydarzenie">${icon('plus')}</button></header>
    <div class="fchips">${[['wszystko', 'Wszystkie'], ['moje', 'Tylko moje']].map(([k, l]) => html`<button class="chip dark ${evFilter === k ? 'on' : ''}" data-act="ev-filter" data-k="${k}" aria-pressed="${evFilter === k}">${l}</button>`)}</div>
    ${evFilter === 'moje' ? html`<p class="hint" style="padding:0 20px;margin:0 0 8px">Wydarzenia, które dodałeś(-aś) albo w których bierzesz udział, i transporty, które wieziesz.</p>` : ''}
    ${items.length ? items.map((i) => { const dk = dayKey(i.t), head = dk !== lastDay ? (lastDay = dk, html`<div class="day">${fmtDayLong(i.t)}</div>`) : ''; const p = dayParts(i.t);
      if (i.kind === 'walk') return html`${head}<div class="ev walk"><div class="when"><b>${p.n}</b><small>${p.m}</small></div><div class="what"><b>Sobotni spacer ze schroniska</b><span>Otwarty dla wszystkich · godz. ${fmtTime(i.t)} pod bramą</span></div>
        <button class="btn sm ghost" data-act="walk-post" data-k="${i.k}" data-t="${i.t}">Post: przypomnienie lub odwołanie</button>${udzialBlock(zg, evKey('walk', i.k), 'walk', 'Sobotni spacer, ' + fmtDayLong(i.t))}</div>`;
      if (i.kind === 'tr') return html`${head}<a class="ev trans" href="#/transport"><div class="when"><b>${p.n}</b><small>${p.m}</small></div><div class="what"><b>Transport: ${i.x.pies_imie || 'pies'}</b><span>${i.x.skad} → ${i.x.dokad}</span><span class="who">${i.x.kierowca ? 'Kierowca: ' + i.x.kierowca : 'Szukamy kierowcy'}</span></div>${icon('chev')}</a>`;
      return html`${head}<button class="ev" style="width:100%;text-align:left" data-act="ev-open" data-id="${i.e.id}"><div class="when"><b>${p.n}</b><small>${p.m}</small></div><div class="what"><b>${i.e.tytul}</b><span>${[fmtTime(i.e.start) !== '00:00' ? 'godz. ' + fmtTime(i.e.start) : '', i.e.miejsce].filter(Boolean).join(' · ')}</span>${(() => { const t = forKey(zg, evKey('ev', i.e.id)).filter((z) => z.status === 'tak'); return t.length ? html`<span class="who">Zgłosili się (${t.length}): ${t.map((z) => z.imie).join(', ')}</span>` : html`<span class="who">Nikt się jeszcze nie zgłosił</span>`; })()}</div>${icon('chev')}</button>`; })
      : html`<div class="empty">${icon('calendar')}<h3>Brak wydarzeń</h3><p>Dodaj wydarzenie przyciskiem +.</p></div>`}
`
  };
}
actions['ev-filter'] = (el) => { evFilter = el.dataset.k; dispatchEvent(new HashChangeEvent('hashchange')); };
function needName() { if (getName()) return true; toast('Najpierw wpisz imię w ustawieniach', true); return false; }
actions['walk-post'] = (el) => {
  const t = +el.dataset.t, dd = fmtDayLong(t);
  const T = {
    przyp: `PSYpominamy! W ${dd} o godz. ${fmtTime(t)} spacery w schronisku w Nowodworze. Przyjedź pod bramę, zabierz psa na spacer. Nie trzeba się zapisywać, smycze i obroże są na miejscu. Pieski czekają!`,
    prze: `PSYpominamy! Spacery w schronisku w Nowodworze są PRZESUNIĘTE: ${dd} o godz. ${fmtTime(t)}. Przyjedź pod bramę, zabierz psa na spacer. Pieski czekają!`,
    odw: `PSYpominamy, że jutrzejsze SPACERY w schronisku są ODWOŁANE. Pieski ZAPRASZAJĄ Was na kolejną sobotę!`,
    pod: `Dziękujemy za dzisiejszy spacer! Przyszło ${'__'} osób, psy były szczęśliwe. Do zobaczenia za tydzień, PSYJACIELE!`
  };
  openSheet(`<h2>Post o spacerze</h2><form novalidate><div class="field"><label for="wk">Rodzaj</label><select class="select" id="wk"><option value="przyp">Przypomnienie</option><option value="prze">Spacery przesunięte</option><option value="odw">Odwołanie spaceru</option><option value="pod">Podsumowanie i podziękowanie</option></select></div>
    <div class="field"><label for="wt">Tekst (możesz poprawić)</label><textarea class="textarea" id="wt" style="min-height:160px"></textarea></div>
    <div class="btnrow"><button type="button" class="btn" id="wc">Kopiuj</button><button type="button" class="btn ghost" id="ws">Wyślij…</button></div></form>`, (s) => {
    const w = s.querySelector('#wk'), x = s.querySelector('#wt'); if (el.dataset.mode) w.value = el.dataset.mode; const fill = () => { x.value = T[w.value]; }; w.onchange = fill; fill();
    s.querySelector('#wc').onclick = async () => { try { await navigator.clipboard.writeText(x.value); toast('Skopiowano'); } catch { x.select(); } };
    s.querySelector('#ws').onclick = async () => { if (navigator.share) { try { await navigator.share({ text: x.value }); } catch {} } else { try { await navigator.clipboard.writeText(x.value); toast('Skopiowano'); } catch {} } };
  });
};
actions['ev-open'] = async (el) => {
  const e = await get('wydarzenia', el.dataset.id); if (!e) return;
  openSheet(`<h2>${esc(e.tytul)}</h2><p class="sub" style="margin:0 0 8px">${esc(fmtDayLong(e.start))}${fmtTime(e.start) !== '00:00' ? ', godz. ' + esc(fmtTime(e.start)) : ''}${e.miejsce ? ' · ' + esc(e.miejsce) : ''}</p>
    ${e.opis ? `<div class="notebox">${esc(e.opis)}</div>` : ''}<div id="zgbox"></div><p class="hint" style="margin-top:10px">Dodał(a): ${esc(e.autor || '')}</p>
    ${e.autor === getName() || state.coordinator ? `<button class="btn ghost block" style="color:var(--terra-d);margin-top:10px" id="ed">${icon('trash').s} Usuń wydarzenie</button>` : ''}`, (s) => {
    zgloszenia().then((all) => { s.querySelector('#zgbox').innerHTML = udzialBlock(all, evKey('ev', e.id), 'ev', e.tytul).s; });
    s.querySelector('#ed')?.addEventListener('click', async () => { await remove('wydarzenia', e.id); closeSheet(); toast('Usunięto'); });
  });
};
export function eventForm() {
  openSheet(`<h2>Nowe wydarzenie</h2><p class="hint" style="margin:0 0 14px">Zobaczą je wszyscy wolontariusze.</p><form id="vf" novalidate>
    <div class="field"><label for="vt">Nazwa</label><input class="input" id="vt" maxlength="100" placeholder="np. wizyta u weterynarza, sesja zdjęciowa"></div>
    <div class="field"><label for="vd">Data i godzina</label><input class="input" id="vd" type="datetime-local"></div>
    <div class="field"><label for="vm">Miejsce (opcjonalnie)</label><input class="input" id="vm" maxlength="80"></div>
    <div class="field"><label for="vo">Opis (opcjonalnie)</label><textarea class="textarea" id="vo" maxlength="600"></textarea></div><div class="err" id="ve"></div>
    <button class="btn block" type="submit">Dodaj wydarzenie</button></form>`, (s) => {
    s.querySelector('#vf').addEventListener('submit', async (e) => {
      e.preventDefault(); const t = s.querySelector('#vt').value.trim(), d = s.querySelector('#vd').value;
      if (!t || !d) { s.querySelector('#ve').textContent = 'Wpisz nazwę i wybierz termin.'; return; }
      await save('wydarzenia', { tytul: t, start: new Date(d).getTime(), miejsce: s.querySelector('#vm').value.trim(), opis: s.querySelector('#vo').value.trim(), autor: getName() });
      closeSheet(); toast('Wydarzenie dodane');
    });
  });
}
actions['a-event'] = () => eventForm();

// ================= transport =================
const TS = { szuka: 'Poszukiwany kierowca', przypisany: 'Przypisany', zrealizowany: 'Zrealizowany', anulowany: 'Anulowany' };
export async function transport() {
  const all = (await list('transporty')).sort((a, b) => a.kiedy - b.kiedy);
  const act = all.filter((x) => x.status === 'szuka' || x.status === 'przypisany'), old = all.filter((x) => x.status === 'zrealizowany' || x.status === 'anulowany').reverse().slice(0, 8);
  const row = (x) => html`<button class="need" style="width:100%;text-align:left" data-act="tr-open" data-id="${x.id}"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><b style="font-size:17px">${x.pies_imie || 'Pies'}</b>${x.pilny ? html` <span class="chip terra" style="min-height:26px;padding:2px 10px">Pilne</span>` : ''}<div class="sub">${x.skad} → ${x.dokad}</div><div class="sub">${fmtShort(x.kiedy)}</div></div><span class="chip ${x.status === 'szuka' ? 'terra' : x.status === 'przypisany' ? '' : 'gold'}">${TS[x.status]}</span></div>${x.kierowca ? html`<div class="who">Kierowca: ${x.kierowca}</div>` : ''}</button>`;
  return {
    tab: 'start', title: 'Transport',
    html: html`${pageBar('Transport', { right: html`<button class="iconbtn" data-act="a-trans" aria-label="Zgłoś transport">${icon('plus')}</button>` })}
    <div class="pad stack">${act.length ? act.map(row) : html`<div class="empty">${icon('truck')}<h3>Brak aktywnych transportów</h3><p>Gdy pies potrzebuje przewozu (do lekarza, domu tymczasowego, adopcji), zgłoś to tutaj. Wolontariusze z samochodem zobaczą prośbę.</p><button class="btn gold" data-act="a-trans">Zgłoś transport</button></div>`}
    ${old.length ? html`<h2 style="font-size:20px;color:var(--gold-l);margin-top:8px">Zakończone</h2>${old.map(row)}` : ''}</div>`
  };
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
      closeSheet(); toast('Transport zgłoszony'); location.hash = '#/transport';
    });
  }));
}
actions['a-trans'] = () => transForm();
actions['tr-open'] = async (el) => {
  const x = await get('transporty', el.dataset.id); if (!x) return;
  openSheet(`<h2>${esc(x.pies_imie || 'Transport')}</h2><p class="sub" style="margin:0 0 8px">${esc(x.skad)} → ${esc(x.dokad)}<br>${esc(fmtDayLong(x.kiedy))}, ${esc(fmtTime(x.kiedy))}</p>
    ${x.uwagi ? `<div class="notebox">${esc(x.uwagi)}</div>` : ''}<p class="hint" style="margin:10px 0">Status: <b>${TS[x.status]}</b>${x.kierowca ? ' · kierowca: ' + esc(x.kierowca) : ''} · zgłosił(a): ${esc(x.autor || '')}</p>
    <div class="btnrow" id="tb">${x.status === 'szuka' ? `<button class="btn" data-s="przypisany">${icon('truck').s} Mogę jechać</button>` : ''}
    ${x.status === 'przypisany' ? `<button class="btn" data-s="zrealizowany">${icon('check').s} Zrealizowany</button><button class="btn ghost" data-s="szuka">Nie mogę już jechać</button>` : ''}
    ${x.status === 'szuka' || x.status === 'przypisany' ? `<button class="btn ghost" data-s="anulowany">Anuluj transport</button>` : ''}</div>`, (s) => {
    s.querySelector('#tb')?.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return; if (b.dataset.s === 'przypisany' && !needName()) return;
      x.status = b.dataset.s; x.kierowca = x.status === 'przypisany' ? getName() : x.status === 'szuka' ? '' : x.kierowca; await save('transporty', x); closeSheet(); toast('Zapisane');
    });
  });
};

// ================= pomoc =================
const CATS = ['Karma mokra', 'Karma sucha', 'Karma weterynaryjna', 'Leki i środki profilaktyczne', 'Podkłady i środki higieniczne', 'Smycze, obroże i szelki', 'Transport', 'Domy tymczasowe', 'Pomoc finansowa', 'Inne potrzeby'];
export async function help() {
  const [dogs, walks, dec, nd] = await Promise.all([list('psy'), list('spacery'), list('deklaracje'), list('potrzeby')]);
  const helpDogs = dogs.map((d) => ({ d, needs: dogNeeds(d, walks) })).filter((x) => x.needs.length || x.d.status === 'pilne').sort((a, b) => (b.d.status === 'pilne') - (a.d.status === 'pilne'));
  const open = nd.filter((n) => n.status !== 'zrealizowana').sort((a, b) => (b.priorytet === 'pilne') - (a.priorytet === 'pilne'));
  return {
    tab: 'pomoc', title: 'Pomoc',
    html: html`<header class="topbar"><span style="width:44px"></span><h1 style="font-size:26px;font-weight:500;flex:1;text-align:center">Pomoc</h1><span style="width:44px"></span></header>
    <div class="sec" style="margin-top:6px"><h2>Pies potrzebuje Ciebie</h2></div><div class="pad stack">
    ${helpDogs.length ? helpDogs.map(({ d, needs }) => html`<div class="need"><a href="#/psy/${d.id}" style="display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit"><span class="avatar sm">${dogThumb(d)}</span><span style="flex:1"><b style="font-family:var(--serif);font-size:19px">${d.imie}</b>${d.status === 'pilne' ? html` <span class="chip terra" style="min-height:24px;padding:1px 9px;font-size:12px">Pilne</span>` : ''}</span>${icon('chev')}</a>
      <div class="chips" style="margin-top:10px">${needs.map((k) => { const who = dec.filter((x) => x.pies_id === d.id && x.potrzeba === k).map((x) => x.imie), mine = who.includes(getName());
        return html`<button class="chip outline ${mine ? 'on' : ''}" data-act="decl" data-dog="${d.id}" data-need="${k}" aria-pressed="${mine}">${NEED_LABELS[k]}${who.length ? html` · ${names(who)}` : ''}</button>`; })}</div>
      ${needs.length ? html`<p class="hint" style="margin:8px 0 0">Kliknij potrzebę, żeby zgłosić, że się tym zajmujesz. Inni zobaczą Twoje imię.</p>` : ''}</div>`)
      : html`<div class="empty" style="padding:24px 10px">${icon('heart')}<h3>Nikt nie czeka na pomoc</h3><p>Gdy pies będzie potrzebował spaceru, zdjęć albo domu tymczasowego, pojawi się tutaj.</p></div>`}</div>
    <div class="sec"><h2>Potrzeby rzeczowe</h2><button class="link" data-act="a-need">+ Dodaj</button></div><div class="pad stack">
    ${open.length ? open.map((n) => { const have = n.zapewniono || 0, pct = Math.min(100, Math.round((have / (n.potrzeba || 1)) * 100)), miss = Math.max(0, (n.potrzeba || 0) - have);
      return html`<div class="need"><div style="display:flex;justify-content:space-between;gap:10px"><div><b style="font-size:17px">${n.nazwa}</b>${n.priorytet === 'pilne' ? html` <span class="chip terra" style="min-height:24px;padding:1px 9px;font-size:12px">Pilne</span>` : ''}<div class="sub">${n.kategoria || ''}</div></div><button class="iconbtn" style="color:var(--green);width:36px;height:36px" data-act="need-edit" data-id="${n.id}" aria-label="Edytuj">${icon('pencil')}</button></div>
        <div class="bar ${pct < 35 ? 'low' : ''}"><i style="width:${pct}%"></i></div><div class="sub">Potrzeba ${n.potrzeba} ${n.jednostka || ''}, zapewniono ${have}, <b>brakuje ${miss}</b></div>
        <button class="btn sm ghost" style="margin-top:10px" data-act="need-give" data-id="${n.id}">${icon('gift')} Przekazuję</button></div>`; })
      : html`<div class="empty" style="padding:24px 10px">${icon('box')}<h3>Brak zgłoszonych potrzeb</h3><p>Dodaj np. „Karma mokra: 60 puszek”. Wolontariusze zobaczą, ile brakuje, i nie będą kupować przypadkowych rzeczy.</p></div>`}</div>`
  };
}
actions.decl = async (el) => {
  if (!needName()) return; const id = `dec_${el.dataset.dog}_${el.dataset.need}_${slug(getName())}`;
  if (await get('deklaracje', id)) { await remove('deklaracje', id); toast('Wycofano zgłoszenie'); } else { await save('deklaracje', { id, pies_id: el.dataset.dog, potrzeba: el.dataset.need, imie: getName(), ts: Date.now() }); toast('Dziękujemy! Inni zobaczą, że się tym zajmujesz'); }
};
export function needForm(n = {}) {
  openSheet(`<h2>${n.id ? 'Edytuj potrzebę' : 'Nowa potrzeba'}</h2><form id="nf3" novalidate>
    <div class="field"><label for="nn">Co jest potrzebne?</label><input class="input" id="nn" maxlength="80" placeholder="np. karma mokra" value="${esc(n.nazwa || '')}"></div>
    <div class="field"><label for="nk">Kategoria</label><select class="select" id="nk">${CATS.map((c) => `<option ${c === n.kategoria ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label for="np">Ile potrzeba</label><input class="input" id="np" inputmode="numeric" value="${n.potrzeba ?? ''}"></div>
    <div class="field"><label for="nj">Jednostka</label><input class="input" id="nj" maxlength="20" placeholder="puszek, kg, szt." value="${esc(n.jednostka || '')}"></div>
    <div class="field"><label for="nz">Ile już zapewniono</label><input class="input" id="nz" inputmode="numeric" value="${n.zapewniono ?? 0}"></div>
    <label class="chip outline" style="margin-bottom:14px;cursor:pointer"><input type="checkbox" id="npi" style="accent-color:var(--terra)" ${n.priorytet === 'pilne' ? 'checked' : ''}> Pilne</label><div class="err" id="ne3"></div>
    <button class="btn block" type="submit">Zapisz</button>${n.id ? `<button type="button" class="btn ghost block" style="margin-top:10px" id="nd">Oznacz jako zrealizowaną</button>` : ''}</form>`, (s) => {
    s.querySelector('#nf3').addEventListener('submit', async (e) => {
      e.preventDefault(); const nazwa = s.querySelector('#nn').value.trim(), p = parseInt(s.querySelector('#np').value, 10), z = parseInt(s.querySelector('#nz').value || '0', 10);
      if (!nazwa || !(p > 0) || !(z >= 0)) { s.querySelector('#ne3').textContent = 'Wpisz nazwę i liczbę (ile potrzeba).'; return; }
      await save('potrzeby', { ...n, nazwa, kategoria: s.querySelector('#nk').value, potrzeba: p, jednostka: s.querySelector('#nj').value.trim(), zapewniono: z, priorytet: s.querySelector('#npi').checked ? 'pilne' : 'zwykle', status: z >= p ? 'zrealizowana' : 'otwarta', autor: n.autor || getName() });
      closeSheet(); toast('Zapisane');
    });
    s.querySelector('#nd')?.addEventListener('click', async () => { await save('potrzeby', { ...n, status: 'zrealizowana' }); closeSheet(); toast('Potrzeba zrealizowana. Dziękujemy!'); });
  });
}
actions['a-need'] = () => needForm();
actions['need-edit'] = async (el) => needForm(await get('potrzeby', el.dataset.id));
actions['need-give'] = async (el) => {
  const n = await get('potrzeby', el.dataset.id);
  openSheet(`<h2>Ile przekazujesz?</h2><p class="hint" style="margin:0 0 12px">${esc(n.nazwa)}. Brakuje ${Math.max(0, n.potrzeba - (n.zapewniono || 0))} ${esc(n.jednostka || '')}.</p><form id="gf"><div class="field"><input class="input" id="gn" inputmode="numeric" placeholder="np. 12"></div><div class="err" id="ge"></div><button class="btn block" type="submit">Dodaj do zapewnionych</button></form>`, (s) => {
    s.querySelector('#gf').addEventListener('submit', async (e) => {
      e.preventDefault(); const q = parseInt(s.querySelector('#gn').value, 10); if (!(q > 0)) { s.querySelector('#ge').textContent = 'Wpisz liczbę większą od zera.'; return; }
      n.zapewniono = (n.zapewniono || 0) + q; if (n.zapewniono >= n.potrzeba) n.status = 'zrealizowana'; await save('potrzeby', n); closeSheet(); toast('Dziękujemy za pomoc!');
    });
    s.querySelector('#gn').focus();
  });
};

// ================= ustawienia =================
export async function settings() {
  const pend = await db.outboxCount();
  return {
    tab: 'start', title: 'Ustawienia', live: false,
    html: html`${pageBar('Ustawienia')}<div class="pad stack">
      <section class="card"><h3>Twoje imię</h3><p class="sub" style="margin:2px 0 12px">Podpisuje Twoje wpisy, spacery i zgłoszenia.</p>
        <form id="sn" class="field" style="margin:0"><input class="input" id="sni" maxlength="40" value="${getName()}" autocomplete="given-name"><button class="btn block" style="margin-top:10px" type="submit">Zapisz imię</button></form></section>
      <section class="card"><h3>${icon('lock')} Dane osobowe</h3><p class="sub" style="margin:2px 0 12px">${state.coordinator ? 'Odblokowane hasłem koordynatora. Zablokują się same po godzinie bez używania aplikacji.' : 'Zablokowane. Numery telefonów i dane osób zainteresowanych adopcją widzi tylko koordynator.'}</p>
        ${state.coordinator ? html`<button class="btn ghost block" data-act="set-lock">${icon('lock')} Zablokuj teraz</button>` : html`<button class="btn block" data-act="unlock-sheet">${icon('unlock')} Odblokuj hasłem koordynatora</button>`}</section>
      <section class="card"><h3>Synchronizacja</h3><p class="sub" style="margin:2px 0 12px" id="sst">${pend ? pend + ' zmian czeka na wysłanie.' : 'Wszystko zapisane na serwerze.'}${syncStatus.last ? ' Ostatnio: ' + fmtTime(syncStatus.last) + '.' : ''}</p>
        <div class="btnrow"><button class="btn ghost" data-act="set-sync">${icon('refresh')} Synchronizuj teraz</button><button class="btn ghost" data-act="set-resync">Pobierz dane od nowa</button></div></section>
      <section class="card"><h3>Kopia zapasowa</h3><p class="sub" style="margin:2px 0 8px" id="bkst">Kopie na serwerze: sprawdzam…</p><p class="sub" style="margin:2px 0 12px">Plik z danymi widocznymi na tym telefonie${state.coordinator ? ' (razem z danymi osobowymi, trzymaj go bezpiecznie)' : ''}.</p>
        <div class="btnrow"><button class="btn ghost" data-act="set-export">${icon('download')} Zapisz kopię</button><button class="btn ghost" data-act="set-import">${icon('upload')} Wczytaj kopię</button></div></section>
      <section class="card"><h3>O aplikacji</h3><p class="sub" style="margin:2px 0 12px">ŁAPA — Nowodwór, wersja <b>${VERSION}</b>. Aplikacja dla wolontariuszy, bezpłatna i bez reklam. Nowe wersje instalują się same po ponownym otwarciu aplikacji.</p><div class="btnrow"><button class="btn ghost" data-act="set-update">${icon('refresh')} Sprawdź aktualizację</button><a class="btn ghost" href="#/dziekujemy">${icon('gift')} Dziękujemy</a></div></section>
      <button class="btn line block" data-act="set-logout">${icon('logout')} Wyloguj z tego telefonu</button></div>`,
    mount(root) { api('/health').then((h) => { const b = h && h.backup; root.querySelector('#bkst').textContent = b && b.t && b.ok ? `Serwer robi kopię bazy co 30 minut. Ostatnia: ${fmtTime(b.t)}.` : 'Serwer robi kopię bazy co 30 minut (pierwsza po aktualizacji serwera).'; }).catch(() => { const e = root.querySelector('#bkst'); if (e) e.textContent = 'Kopie na serwerze: brak połączenia.'; }); root.querySelector('#sn').addEventListener('submit', (e) => { e.preventDefault(); const v = root.querySelector('#sni').value.trim(); if (v.length < 2) { toast('Wpisz imię', true); return; } setName(v); toast('Zapisane'); }); }
  };
}
actions['set-lock'] = async () => { await lock(); toast('Dane osobowe zablokowane'); };
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
