// Terminarz (wspólny i prywatny) + Sobotnie spacery z edycją, odwołaniami i zgłoszeniami. Poranny komunikat „Dziś”.
import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, confirmSheet, plusBtn } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName } from './auth.js';
import { uid, dayKey, startOfDay, fmtDayLong, fmtTime, nextSaturdays } from './util.js';
import { zgloszenia, udzialBlock, evKey, forKey } from './udzial.js';
import * as db from './db.js';

const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');
const toDate = (t) => dayKey(t);
const toTime = (t) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const hasTime = (t) => t != null && toTime(t) !== '00:00';
const parts = (t) => { const d = new Date(t); return { n: d.getDate(), m: new Intl.DateTimeFormat('pl-PL', { month: 'short' }).format(d).replace('.', '') }; };
const rerender = () => dispatchEvent(new HashChangeEvent('hashchange'));
const me = () => getName();
const visible = (e) => e.widocznosc !== 'ja' || e.owner === me();

export const POWT = [['', 'Nie powtarza się'], ['1d', 'Codziennie'], ['1w', 'Co tydzień'], ['1m', 'Co miesiąc'], ['x', 'Własne…']];
const powtText = (p) => !p ? '' : (p.co === 1 ? ({ d: 'Codziennie', w: 'Co tydzień', m: 'Co miesiąc' })[p.jedn] : `Co ${p.co} ${({ d: 'dni', w: 'tyg.', m: 'mies.' })[p.jedn]}`) + (p.do ? ` do ${new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(p.do)}` : '');

// ===== wystąpienia wpisu w zakresie [from, to) =====
export function occs(e, from, to) {
  if (e.start == null) return [];
  const p = e.powtarzaj; if (!p || !p.jedn) return e.start >= from && e.start < to ? [e.start] : [];
  const base = new Date(e.start), co = Math.max(1, +p.co || 1), lim = p.do ? p.do + DAY - 1 : Infinity, out = [];
  for (let i = 0; i < 3000; i++) {
    const d = new Date(base);
    if (p.jedn === 'd') d.setDate(base.getDate() + i * co); else if (p.jedn === 'w') d.setDate(base.getDate() + i * co * 7); else d.setMonth(base.getMonth() + i * co);
    const t = d.getTime(); if (t >= to || t > lim) break; if (t >= from) out.push(t);
  }
  return out;
}
const isDone = (e, t) => (e.powtarzaj && e.powtarzaj.jedn ? !!(e.zr && e.zr[dayKey(t)]) : !!e.zrobione);

// ===== migracja ze starych list (wydarzenia, moje_zadania) =====
let migrating = null;
export function migruj() {
  migrating ||= (async () => {
    for (const e of await list('wydarzenia')) {
      await save('terminarz', { id: 'm' + e.id, tytul: e.tytul, start: e.start, miejsce: e.miejsce || '', notatka: e.opis || '', widocznosc: 'wszyscy', owner: e.autor || '', autor: e.autor || '', ts: Date.now() });
      await remove('wydarzenia', e.id);
    }
    for (const t of await list('moje_zadania')) {
      await save('terminarz', { id: 'z' + t.id, tytul: t.tytul, start: t.termin || null, widocznosc: 'ja', owner: me(), autor: me(), zadanie: true, zrobione: !!t.done, ts: Date.now() });
      await remove('moje_zadania', t.id);
    }
  })().catch(() => {}).finally(() => { migrating = null; });
  return migrating;
}

// ===== sobotnie spacery =====
export async function soboty(n = 10) {
  const recs = await list('spacery_sob'), byId = new Map(recs.map((r) => [r.id, r])), out = [], today = startOfDay(Date.now());
  for (const t of nextSaturdays(n)) {
    const dk = dayKey(t), id = 'ss_' + dk, r = byId.get(id);
    out.push({ id, dk, orig: t, start: r?.start || t, status: r?.status || 'odbedzie', powod: r?.powod || '', notatka: r?.notatka || '', rec: !!r, extra: false, key: evKey('walk', dk) });
  }
  for (const r of recs) if (r.extra) out.push({ id: r.id, dk: r.id, orig: r.start, start: r.start, status: r.status || 'odbedzie', powod: r.powod || '', notatka: r.notatka || '', rec: true, extra: true, key: evKey('walk', r.id) });
  return out.filter((x) => x.start >= today).sort((a, b) => a.start - b.start);
}
const stLabel = { odbedzie: 'Odbędzie się', odwolany: 'ODWOŁANY' };

// ===== dane na dziś (Start, Do zrobienia, komunikat poranny) =====
export async function dzisItems() {
  await migruj();
  const [tm, tr, sb] = await Promise.all([list('terminarz'), list('transporty'), soboty(10)]);
  const t0 = startOfDay(Date.now()), t1 = t0 + DAY, items = [], overdue = [];
  for (const e of tm.filter(visible)) {
    if (e.status === 'odwolany') continue;
    for (const t of occs(e, t0, t1)) items.push({ e, t, done: isDone(e, t) });
    if (e.zadanie) {
      if (e.powtarzaj && e.powtarzaj.jedn) { for (const t of occs(e, t0 - 7 * DAY, t0)) if (!isDone(e, t)) overdue.push({ e, t }); }
      else if (e.start != null && e.start < t0 && !e.zrobione) overdue.push({ e, t: e.start });
    }
  }
  items.sort((a, b) => a.t - b.t); overdue.sort((a, b) => a.t - b.t);
  return { items, overdue, walk: sb.find((x) => x.start >= t0 && x.start < t1) || null, trans: tr.filter((x) => x.kiedy >= t0 && x.kiedy < t1 && !['anulowany', 'zrealizowany'].includes(x.status)) };
}
export const dzisCount = (d) => d.items.filter((x) => !x.done).length + d.overdue.length + (d.walk && d.walk.status !== 'odwolany' ? 1 : 0) + d.trans.length;

function dzisHtml(d) {
  const row = (t, txt, extra = '') => `<div class="row" style="gap:10px"><span class="rt"><b>${esc(txt)}</b><small>${esc(t)}${extra}</small></span></div>`;
  let h = '';
  if (d.walk) h += row(`${fmtTime(d.walk.start)} pod bramą`, d.walk.status === 'odwolany' ? 'Sobotni spacer ODWOŁANY' + (d.walk.powod ? ': ' + d.walk.powod : '') : 'Spacery w schronisku (Brama)');
  for (const x of d.trans) h += row(`${fmtTime(x.kiedy)} · ${x.skad} → ${x.dokad}`, 'Transport: ' + (x.pies_imie || 'pies'));
  for (const x of d.items) h += row(hasTime(x.t) ? toTime(x.t) : 'cały dzień', (x.done ? '✓ ' : '') + x.e.tytul, x.e.widocznosc === 'ja' ? ' · tylko ja' : '');
  if (d.overdue.length) h += `<h3 style="font-size:17px;margin:14px 0 6px;color:var(--terra-d)">Zaległe (${d.overdue.length})</h3>` + d.overdue.map((x) => row(new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(x.t), x.e.tytul)).join('');
  return h;
}
// Pierwsze otwarcie aplikacji po 6:00: co jest dziś w terminarzu
let briefed = false;
export async function poranny() {
  if (briefed || !state.loggedIn || !getName()) return; const now = new Date(); if (now.getHours() < 6) return;
  const today = dayKey(now); if ((await db.metaGet('poranny').catch(() => null)) === today) { briefed = true; return; }
  briefed = true; await db.metaSet('poranny', today).catch(() => {});
  const d = await dzisItems();
  if (!dzisCount(d) && !d.items.length) { toast('Na dziś nic w terminarzu'); return; }
  openSheet(`<h2>Dziś: ${esc(fmtDayLong(Date.now()))}</h2><p class="hint" style="margin:0 0 10px">Zerknij, żeby nic Ci nie umknęło.</p><div class="rows">${dzisHtml(d)}</div>
    <div class="btnrow" style="margin-top:16px"><button class="btn" data-sheet-close>Rozumiem</button><a class="btn ghost" href="#/wydarzenia">Otwórz terminarz</a></div>`, (s) => { s.querySelectorAll('[data-sheet-close]').forEach((b) => b.addEventListener('click', closeSheet)); s.querySelector('a.btn')?.addEventListener('click', closeSheet); });
}
export function dzisCard(d) {
  const first = d.items.filter((x) => !x.done).slice(0, 3);
  return html`<section class="card" aria-label="Dziś"><div class="card-head"><h3>${icon('calendar')} Dziś w terminarzu</h3><a class="link" href="#/wydarzenia">Otwórz ${icon('arrow')}</a></div>
    ${d.overdue.length ? html`<p class="sub" style="margin:6px 0;color:var(--terra-d)"><b>Zaległe: ${d.overdue.length}</b></p>` : ''}
    ${d.walk && d.walk.status !== 'odwolany' ? html`<p class="sub" style="margin:6px 0">${icon('walk')} Spacery dziś o ${fmtTime(d.walk.start)}</p>` : ''}
    ${first.length ? first.map((x) => html`<div class="task"><span class="tt">${x.e.tytul}</span><span class="dchip">${hasTime(x.t) ? toTime(x.t) : 'cały dzień'}</span></div>`) : (d.overdue.length || d.walk ? '' : html`<p class="sub" style="margin:8px 0 4px">Na dziś nic w terminarzu. Dodaj wpis przyciskiem <b>+</b>.</p>`)}</section>`;
}

// ===== widok: zakładki Sobotnie spacery / Terminarz =====
let tab = 'sob', filt = 'wszystko';
export async function wydarzenia(opts = {}) {
  if (opts.tab) tab = opts.tab; if (opts.filt) filt = opts.filt;
  await migruj();
  const zg = await zgloszenia();
  const body = tab === 'sob' ? await sobView(zg) : await terView(zg);
  const tb = (k, l) => `<button class="chip dark ${tab === k ? 'on' : ''}" data-act="tm-tab" data-t="${k}" style="flex:1;justify-content:center;padding:11px 6px">${l}</button>`;
  return {
    tab: 'wydarzenia', title: 'Wydarzenia',
    html: html`<header class="topbar"><span style="width:44px"></span><h1 style="font-size:26px;font-weight:500;flex:1;text-align:center">${tab === 'sob' ? 'Sobotnie spacery' : 'Terminarz'}</h1>${plusBtn(tab === 'sob' ? 'sb-extra' : 'tm-new', tab === 'sob' ? 'Dodaj termin spaceru' : 'Dodaj wpis')}</header>
    <div class="pad" style="display:flex;gap:8px;margin-bottom:6px">${raw(tb('sob', 'Sobotnie spacery') + tb('ter', 'Terminarz'))}</div>${raw(body)}`
  };
}
export const curTab = () => tab;
// Przełączenie zakładki zawsze przechodzi na ogólny adres #/wydarzenia (adresy #/sobotnie i #/zadania ustawiają zakładkę na sztywno i cofałyby wybór przy odświeżeniu).
const stay = () => { if (location.hash !== '#/wydarzenia') location.hash = '#/wydarzenia'; else rerender(); };
actions['tm-tab'] = (el) => { tab = el.dataset.t; stay(); };

async function sobView(zg) {
  const L = await soboty(10);
  return `<p class="hint" style="padding:0 20px;margin:4px 0 10px">Zwykle sobota 9:00 pod bramą. Termin możesz przesunąć (np. na piątek lub niedzielę), odwołać, albo dodać dodatkowy przyciskiem +.</p>` + L.map((x) => {
    const p = parts(x.start), moved = dayKey(x.start) !== x.dk && !x.extra, off = x.status === 'odwolany';
    const who = udzialBlock(zg, x.key, 'walk', 'Spacery, ' + fmtDayLong(x.start)).s;
    return `<div class="ev walk" style="flex-wrap:wrap;${off ? 'opacity:.85' : ''}"><div class="when"><b>${p.n}</b><small>${esc(p.m)}</small></div><div class="what"><b>${esc(new Intl.DateTimeFormat('pl-PL', { weekday: 'long' }).format(x.start))}${x.extra ? ' (dodatkowy termin)' : ''}${off ? ' · <span style="color:var(--terra-d)">ODWOŁANY</span>' : ''}</b>
      <span>godz. ${esc(fmtTime(x.start))} pod bramą${moved ? ` · przesunięty z ${esc(new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'numeric' }).format(x.orig))}` : ''}</span>${off && x.powod ? `<span> · Powód: ${esc(x.powod)}</span>` : ''}${x.notatka ? `<span> · ${esc(x.notatka)}</span>` : ''}</div>
      <div class="wbtns"><button class="btn sm ghost" data-act="sb-edit" data-id="${esc(x.id)}">Edytuj</button><button class="btn sm ghost" data-act="walk-post" data-k="${esc(x.dk)}" data-t="${x.start}" data-mode="${off ? 'odw' : moved ? 'prze' : 'przyp'}">Post</button></div>
      ${off ? '' : who}</div>`;
  }).join('');
}
function sbForm(x) {
  const isNew = !x;
  x ||= { start: nextSaturdays(1)[0], status: 'odbedzie', powod: '', notatka: '', extra: true, id: 'sx_' + uid() };
  openSheet(`<h2>${isNew ? 'Dodatkowy termin spaceru' : 'Edytuj spacery'}</h2><form id="sf" novalidate>
    <div class="field"><label for="sd">Data</label><input class="input" id="sd" type="date" value="${toDate(x.start)}"></div>
    <div class="field"><label for="st">Godzina</label><input class="input" id="st" type="time" value="${toTime(x.start)}"></div>
    <div class="field"><label for="ss">Czy spacery się odbędą?</label><select class="select" id="ss"><option value="odbedzie" ${x.status !== 'odwolany' ? 'selected' : ''}>Odbędą się</option><option value="odwolany" ${x.status === 'odwolany' ? 'selected' : ''}>ODWOŁANE</option></select></div>
    <div class="field"><label for="sp">Powód odwołania (opcjonalnie)</label><input class="input" id="sp" maxlength="120" value="${esc(x.powod || '')}" placeholder="np. mróz, choroba w schronisku"></div>
    <div class="field"><label for="sn">Uwagi (opcjonalnie)</label><input class="input" id="sn" maxlength="160" value="${esc(x.notatka || '')}"></div>
    <button class="btn block" type="submit">Zapisz</button>
    ${!isNew && x.rec && !x.extra ? '<button class="btn ghost block" type="button" id="sr" style="margin-top:8px">Przywróć domyślny termin (sobota 9:00)</button>' : ''}
    ${!isNew && x.extra ? '<button class="btn ghost block" type="button" id="sx" style="margin-top:8px;color:var(--terra-d)">Usuń ten termin</button>' : ''}</form>`, (s) => {
    s.querySelector('#sf').addEventListener('submit', async (e) => {
      e.preventDefault(); const d = s.querySelector('#sd').value; if (!d) { toast('Wybierz datę', true); return; }
      const start = new Date(`${d}T${s.querySelector('#st').value || '09:00'}`).getTime();
      await save('spacery_sob', { id: x.id, start, status: s.querySelector('#ss').value, powod: s.querySelector('#sp').value.trim(), notatka: s.querySelector('#sn').value.trim(), extra: !!x.extra, edytowal: me(), ts: Date.now() });
      closeSheet(); toast('Zapisane'); rerender();
    });
    s.querySelector('#sr')?.addEventListener('click', async () => { await remove('spacery_sob', x.id); closeSheet(); toast('Przywrócono'); rerender(); });
    s.querySelector('#sx')?.addEventListener('click', async () => { if (await confirmSheet('Usunąć termin?', 'Zgłoszenia osób przy tym terminie przestaną być widoczne.', 'Usuń', true)) { await remove('spacery_sob', x.id); toast('Usunięto'); rerender(); } });
  });
}
actions['sb-extra'] = () => sbForm();
actions['sb-edit'] = async (el) => { const x = (await soboty(10)).find((y) => y.id === el.dataset.id); if (x) sbForm(x); };

// ===== terminarz =====
async function terView(zg) {
  const [tm, tr] = await Promise.all([list('terminarz'), list('transporty')]);
  const t0 = startOfDay(Date.now()), to = t0 + 90 * DAY, name = me(), rows = [], undated = [], over = [];
  const mine = (e) => e.owner === name || e.autor === name || forKey(zg, evKey('tm', e.id)).some((z) => z.imie === name && z.status === 'tak');
  for (const e of tm.filter(visible)) {
    if (filt === 'ja' && e.widocznosc !== 'ja') continue; if (filt === 'moje' && !mine(e)) continue;
    if (e.start == null) { undated.push(e); continue; }
    for (const t of occs(e, t0, to)) rows.push({ k: 'tm', t, e });
    if (e.zadanie && e.status !== 'odwolany') {
      if (e.powtarzaj && e.powtarzaj.jedn) { for (const t of occs(e, t0 - 7 * DAY, t0)) if (!isDone(e, t)) over.push({ k: 'tm', t, e }); }
      else if (e.start < t0 && !e.zrobione) over.push({ k: 'tm', t: e.start, e });
    }
  }
  if (filt !== 'ja') for (const x of tr.filter((x) => x.kiedy >= t0 && x.kiedy < to && !['anulowany', 'zrealizowany'].includes(x.status) && (filt === 'wszystko' || x.kierowca === name || x.autor === name))) rows.push({ k: 'tr', t: x.kiedy, x });
  rows.sort((a, b) => a.t - b.t); over.sort((a, b) => a.t - b.t);
  const chip = (k, l) => `<button class="chip dark ${filt === k ? 'on' : ''}" data-act="tm-filt" data-k="${k}">${l}</button>`;
  const row = (r) => {
    if (r.k === 'tr') { const p = parts(r.t); return `<a class="ev trans" href="#/transport"><div class="when"><b>${p.n}</b><small>${esc(p.m)}</small></div><div class="what"><b>Transport: ${esc(r.x.pies_imie || 'pies')}</b><span>${esc(r.x.skad)} → ${esc(r.x.dokad)}</span></div>${icon('chev').s}</a>`; }
    const e = r.e, p = parts(r.t), done = isDone(e, r.t), priv = e.widocznosc === 'ja', who = priv ? [] : forKey(zg, evKey('tm', e.id)).filter((z) => z.status === 'tak');
    return `<div class="ev" style="width:calc(100% - 32px);${done || e.status === 'odwolany' ? 'opacity:.6' : ''}">${e.zadanie ? `<button class="chk" data-act="tm-done" data-id="${esc(e.id)}" data-t="${r.t}" aria-pressed="${done}" aria-label="Odhacz">${icon('check').s}</button>` : ''}
      <button class="what" style="text-align:left;background:none;border:0;padding:0" data-act="tm-open" data-id="${esc(e.id)}"><div style="display:flex;gap:10px;align-items:center"><div class="when" style="width:46px"><b>${p.n}</b><small>${esc(p.m)}</small></div><div style="min-width:0"><b style="${done ? 'text-decoration:line-through' : ''}">${esc(e.tytul)}${e.status === 'odwolany' ? ' · ODWOŁANE' : ''}</b>
      <span>${[hasTime(r.t) ? toTime(r.t) : 'cały dzień', e.miejsce, e.pies_imie, e.powtarzaj ? powtText(e.powtarzaj) : ''].filter(Boolean).map(esc).join(' · ')}${priv ? ' · <i>tylko ja</i>' : ''}</span>
      ${priv ? '' : `<span class="who">${who.length ? 'Zgłosili się (' + who.length + '): ' + esc(who.map((z) => z.imie).join(', ')) : 'Nikt się jeszcze nie zgłosił'}</span>`}</div></div></button></div>`;
  };
  let lastDay = '', out = `<div class="fchips">${chip('wszystko', 'Wszystko')}${chip('moje', 'Moje')}${chip('ja', 'Tylko ja')}</div>
    <p class="hint" style="padding:0 20px;margin:0 0 8px">${filt === 'ja' ? 'Wpisy, które widzisz tylko Ty (np. przypomnienia, leki, własne zadania).' : filt === 'moje' ? 'Twoje wpisy oraz wydarzenia, w których bierzesz udział.' : 'Wspólny kalendarz wszystkich wolontariuszy oraz Twoje wpisy prywatne.'}</p>`;
  if (over.length) out += `<div class="day" style="color:var(--terra-l,#e0a48d)">Zaległe</div>` + over.map(row).join('');
  for (const r of rows) { const dk = dayKey(r.t); if (dk !== lastDay) { lastDay = dk; out += `<div class="day">${esc(dk === dayKey(t0) ? 'Dziś, ' + fmtDayLong(r.t) : fmtDayLong(r.t))}</div>`; } out += row(r); }
  if (undated.length) out += `<div class="day">Bez terminu</div>` + undated.map((e) => row({ k: 'tm', t: 0, e }).replace(/<div class="when"[\s\S]*?<\/div>/, '')).join('');
  if (!rows.length && !over.length && !undated.length) out += `<div class="empty">${icon('calendar').s}<h3>Pusto</h3><p>Dodaj wpis przyciskiem + u góry: wydarzenie dla wszystkich albo przypomnienie tylko dla siebie.</p></div>`;
  return out;
}
actions['tm-filt'] = (el) => { filt = el.dataset.k; stay(); };
actions['tm-done'] = async (el) => {
  const e = await get('terminarz', el.dataset.id); if (!e) return; const t = +el.dataset.t;
  if (e.powtarzaj && e.powtarzaj.jedn) { e.zr = { ...(e.zr || {}) }; const k = dayKey(t); if (e.zr[k]) delete e.zr[k]; else e.zr[k] = Date.now(); } else e.zrobione = !e.zrobione;
  e.edytowal = me(); await save('terminarz', e);
};

// ===== szczegóły wpisu =====
actions['tm-open'] = async (el) => {
  const e = await get('terminarz', el.dataset.id); if (!e) return; const priv = e.widocznosc === 'ja', canDel = e.owner === me() || e.autor === me() || state.coordinator;
  const when = e.start == null ? 'Bez terminu' : fmtDayLong(e.start) + (hasTime(e.start) ? ', godz. ' + toTime(e.start) : ' (cały dzień)');
  const items = (e.lista || []);
  openSheet(`<h2>${esc(e.tytul)}</h2><p class="sub" style="margin:0 0 8px">${esc(when)}${e.miejsce ? ' · ' + esc(e.miejsce) : ''}${e.powtarzaj ? '<br>' + esc(powtText(e.powtarzaj)) : ''}</p>
    ${e.status === 'odwolany' ? '<p><b style="color:var(--terra-d)">ODWOŁANE</b></p>' : ''}${e.pies_id ? `<p class="sub"><a href="#/psy/${esc(e.pies_id)}" id="tpd">Pies: ${esc(e.pies_imie || '')}</a></p>` : e.pies_imie ? `<p class="sub">Pies: ${esc(e.pies_imie)}</p>` : ''}
    ${e.notatka ? `<div class="notebox">${esc(e.notatka)}</div>` : ''}
    ${items.length ? `<div class="rows" style="margin-top:10px">${items.map((it, i) => `<button class="row" data-li="${i}" style="gap:10px"><span class="chk" aria-pressed="${!!it.ok}" style="pointer-events:none">${icon('check').s}</span><span class="rt"><b style="${it.ok ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(it.t)}</b></span></button>`).join('')}</div>` : ''}
    ${priv ? '<p class="hint" style="margin-top:10px">Wpis prywatny: nie pokazuje się innym w aplikacji.</p>' : '<div id="zgbox"></div>'}
    <p class="hint" style="margin-top:10px">${priv ? '' : 'Dodał(a): ' + esc(e.autor || '') + (e.edytowal && e.edytowal !== e.autor ? ', zmienił(a): ' + esc(e.edytowal) : '')}</p>
    <div class="btnrow" style="margin-top:12px"><button class="btn" id="tme">Edytuj</button>${canDel ? '<button class="btn ghost" style="color:var(--terra-d)" id="tmx">Usuń</button>' : ''}</div>`, (s) => {
    s.querySelector('#tpd')?.addEventListener('click', closeSheet);
    if (!priv) zgloszenia().then((all) => { const b = s.querySelector('#zgbox'); if (b) b.innerHTML = udzialBlock(all, evKey('tm', e.id), 'ev', e.tytul).s; });
    s.querySelectorAll('[data-li]').forEach((b) => b.addEventListener('click', async () => { const cur = await get('terminarz', e.id); cur.lista[+b.dataset.li].ok = !cur.lista[+b.dataset.li].ok; cur.edytowal = me(); await save('terminarz', cur); actions['tm-open'](el); }));
    s.querySelector('#tme').onclick = () => terForm(e);
    s.querySelector('#tmx')?.addEventListener('click', async () => { if (await confirmSheet('Usunąć wpis?', priv ? 'Wpis zniknie.' : 'Wpis zniknie u wszystkich wolontariuszy.', 'Usuń', true)) { await remove('terminarz', e.id); toast('Usunięto'); } });
  });
};

// ===== formularz wpisu (nowy/edycja) =====
export async function terForm(e0, preset = {}) {
  const isNew = !e0; const e = e0 || { widocznosc: preset.widocznosc || 'wszyscy', zadanie: preset.widocznosc === 'ja', ...preset };
  const dogs = (await list('psy')).filter((d) => d.status !== 'adoptowany').sort((a, b) => (a.imie || '').localeCompare(b.imie || '', 'pl'));
  const p = e.powtarzaj, sel = !p ? '' : p.co === 1 ? '1' + p.jedn : 'x';
  openSheet(`<h2>${isNew ? 'Nowy wpis' : 'Edytuj wpis'}</h2><form id="tf" novalidate>
    <div class="field"><label for="tt">Co? (dowolny tekst)</label><input class="input" id="tt" maxlength="140" value="${esc(e.tytul || '')}" placeholder="np. lek dla Alfa, adopcja o 17:00, kastracja Alfa"></div>
    <div class="field"><label for="td">Data (zostaw puste, jeśli bez terminu)</label><input class="input" id="td" type="date" value="${e.start != null ? toDate(e.start) : (preset.data || '')}"></div>
    <div class="field"><label for="th">Godzina (puste = cały dzień)</label><input class="input" id="th" type="time" value="${e.start != null && hasTime(e.start) ? toTime(e.start) : ''}"></div>
    <div class="field"><label for="tw">Kto widzi</label><select class="select" id="tw"><option value="wszyscy" ${e.widocznosc !== 'ja' ? 'selected' : ''}>Wszyscy wolontariusze (można się zgłaszać)</option><option value="ja" ${e.widocznosc === 'ja' ? 'selected' : ''}>Tylko ja</option></select></div>
    <div class="field"><label for="tp">Powtarzanie</label><select class="select" id="tp">${POWT.map(([v, l]) => `<option value="${v}" ${sel === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field" id="tpx" style="display:${sel === 'x' ? 'block' : 'none'}"><label>Co ile?</label><div style="display:flex;gap:8px"><input class="input" id="tpc" type="number" min="1" max="365" value="${p && p.co ? p.co : 2}" style="flex:1"><select class="select" id="tpj" style="flex:2"><option value="d" ${p && p.jedn === 'd' ? 'selected' : ''}>dni</option><option value="w" ${p && p.jedn === 'w' ? 'selected' : ''}>tygodni</option><option value="m" ${p && p.jedn === 'm' ? 'selected' : ''}>miesięcy</option></select></div></div>
    <div class="field" id="tpdo" style="display:${sel ? 'block' : 'none'}"><label for="tpu">Powtarzaj do dnia (puste = bez końca)</label><input class="input" id="tpu" type="date" value="${p && p.do ? toDate(p.do) : ''}"></div>
    <div class="field"><label for="tm1">Miejsce (opcjonalnie)</label><input class="input" id="tm1" maxlength="100" value="${esc(e.miejsce || '')}"></div>
    <div class="field"><label for="tpy">Pies (opcjonalnie)</label><input class="input" id="tpy" list="tpyl" maxlength="60" value="${esc(e.pies_imie || '')}" autocomplete="off"><datalist id="tpyl">${dogs.map((d) => `<option value="${esc(d.imie)}"></option>`).join('')}</datalist></div>
    <div class="field"><label for="tn">Uwagi (opcjonalnie)</label><textarea class="textarea" id="tn" maxlength="1000">${esc(e.notatka || '')}</textarea></div>
    <div class="field"><label for="tl">Lista punktów (jedna linia = jeden punkt, opcjonalnie)</label><textarea class="textarea" id="tl" maxlength="1000">${esc((e.lista || []).map((x) => x.t).join('\n'))}</textarea></div>
    <div class="field"><label><input type="checkbox" id="tz" ${e.zadanie ? 'checked' : ''}> Ma być do odhaczenia (zadanie)</label></div>
    ${isNew ? '' : `<div class="field"><label for="ts">Status</label><select class="select" id="ts"><option value="aktywny" ${e.status !== 'odwolany' ? 'selected' : ''}>Aktualne</option><option value="odwolany" ${e.status === 'odwolany' ? 'selected' : ''}>ODWOŁANE</option></select></div>`}
    <div class="err" id="te"></div><button class="btn block" type="submit">${isNew ? 'Dodaj' : 'Zapisz zmiany'}</button></form>`, (s) => {
    const tp = s.querySelector('#tp'); const sync = () => { s.querySelector('#tpx').style.display = tp.value === 'x' ? 'block' : 'none'; s.querySelector('#tpdo').style.display = tp.value ? 'block' : 'none'; }; tp.onchange = sync;
    s.querySelector('#tw').onchange = (ev) => { if (isNew) s.querySelector('#tz').checked = ev.target.value === 'ja'; };
    s.querySelector('#tf').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const t = s.querySelector('#tt').value.trim(); if (!t) { s.querySelector('#te').textContent = 'Wpisz, co to ma być.'; return; }
      const d = s.querySelector('#td').value, h = s.querySelector('#th').value; let pw = null; const pv = tp.value;
      if (pv) { const co = pv === 'x' ? Math.max(1, +s.querySelector('#tpc').value || 1) : 1, jedn = pv === 'x' ? s.querySelector('#tpj').value : pv.slice(1); const u = s.querySelector('#tpu').value; pw = { co, jedn, do: u ? new Date(u + 'T00:00').getTime() : null }; if (!d) { s.querySelector('#te').textContent = 'Powtarzanie wymaga daty początkowej.'; return; } }
      const dn = s.querySelector('#tpy').value.trim(), dog = dogs.find((x) => (x.imie || '').toLowerCase() === dn.toLowerCase());
      const lines = s.querySelector('#tl').value.split('\n').map((x) => x.trim()).filter(Boolean), old = new Map((e.lista || []).map((x) => [x.t, x.ok]));
      const rec = { ...e, id: e.id, tytul: t, start: d ? new Date(`${d}T${h || '00:00'}`).getTime() : null, powtarzaj: pw, widocznosc: s.querySelector('#tw').value, miejsce: s.querySelector('#tm1').value.trim(), pies_id: dog ? dog.id : '', pies_imie: dog ? dog.imie : dn, notatka: s.querySelector('#tn').value.trim(), lista: lines.map((x) => ({ t: x, ok: !!old.get(x) })), zadanie: s.querySelector('#tz').checked, status: isNew ? 'aktywny' : s.querySelector('#ts').value, owner: e.owner || me(), autor: e.autor || me(), ts: Date.now() };
      if (!isNew) rec.edytowal = me();
      await save('terminarz', rec); closeSheet(); toast(isNew ? 'Dodano' : 'Zapisane');
    });
    s.querySelector('#tt').focus();
  });
}
actions['tm-new'] = () => terForm();
actions['a-event'] = () => terForm(null, { widocznosc: 'wszyscy' });
actions['a-task'] = () => terForm(null, { widocznosc: 'ja' });
