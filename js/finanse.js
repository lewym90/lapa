// Finanse: wpłaty i wydatki, koszty leczenia z teczek psów, podsumowania i eksport do sprawozdania. Tylko koordynator.
import { html, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet } from './ui.js';
import { list, save, remove } from './store.js';
import { state, getName } from './auth.js';
import { fmtDate } from './util.js';

const KAT_WYD = [['leczenie', 'Leczenie i weterynarz'], ['karma', 'Karma'], ['hotel', 'Hotelik / dom tymczasowy'], ['transport', 'Transport'], ['kastracja', 'Kastracje'], ['inne', 'Inne']];
const ZRODLA = [['przelew', 'Przelew / darowizna'], ['podatek', '1,5% podatku'], ['licytacja', 'Licytacja / bazarek'], ['zbiorka', 'Zbiórka'], ['gotowka', 'Gotówka'], ['inne', 'Inne']];
const L = Object.fromEntries([...KAT_WYD, ...ZRODLA]);
const SEL = (id, label, opts, val) => `<div class="field"><label for="${id}">${label}</label><select class="select" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
const zl = (n) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
const d10 = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
let rok = new Date().getFullYear();

export async function finanse() {
  if (!state.coordinator) return { tab: 'start', title: 'Finanse', html: html`${pageBar('Finanse')}<div class="pad"><div class="lockbox">${icon('lock')}<p style="margin:6px 0 10px"><b>Finanse</b><br><span class="hint">Widzi je tylko koordynator.</span></p><button class="btn sm" data-act="unlock-sheet">Odblokuj hasłem koordynatora</button></div></div>` };
  const [fin, zdr, dogs] = await Promise.all([list('p_finanse'), list('zdrowie'), list('psy')]); const byId = Object.fromEntries(dogs.map((d) => [d.id, d]));
  const inY = (t) => new Date(t).getFullYear() === rok;
  const wp = fin.filter((x) => x.typ === 'wplata' && inY(x.data)), wy = fin.filter((x) => x.typ === 'wydatek' && inY(x.data)), zk = zdr.filter((z) => z.koszt && inY(z.data));
  const sum = (a, f = 'kwota') => a.reduce((s, x) => s + (+x[f] || 0), 0);
  const przych = sum(wp), wyd = sum(wy) + sum(zk, 'koszt');
  const perDog = {}; zk.forEach((z) => { perDog[z.pies_id] = (perDog[z.pies_id] || 0) + z.koszt; }); wy.filter((x) => x.pies_id).forEach((x) => { perDog[x.pies_id] = (perDog[x.pies_id] || 0) + x.kwota; });
  const byKat = {}; wy.forEach((x) => { byKat[x.kat] = (byKat[x.kat] || 0) + x.kwota; }); if (sum(zk, 'koszt')) byKat.leczenie = (byKat.leczenie || 0) + sum(zk, 'koszt');
  const bySrc = {}; wp.forEach((x) => { bySrc[x.zrodlo] = (bySrc[x.zrodlo] || 0) + x.kwota; });
  const recent = [...fin].sort((a, b) => b.data - a.data).slice(0, 25);
  return { tab: 'start', title: 'Finanse', live: true,
    html: html`${pageBar('Finanse', { right: html`<button class="iconbtn" data-act="fin-add" aria-label="Dodaj">${icon('plus')}</button>` })}
    <div class="fchips">${[rok - 1, rok].map((y) => html`<button class="chip dark ${rok === y ? 'on' : ''}" data-act="fin-rok" data-y="${y}">${y}</button>`)}</div>
    <div class="pad stack"><section class="card"><h3>Rok ${rok}</h3><p style="margin:6px 0">Wpłaty: <b>${zl(przych)}</b><br>Wydatki: <b>${zl(wyd)}</b><br>Saldo: <b style="color:${przych - wyd < 0 ? 'var(--terra-d)' : 'var(--green)'}">${zl(przych - wyd)}</b></p>
      <p class="hint" style="margin:0">Wydatki zawierają koszty z teczek zdrowia psów (${zl(sum(zk, 'koszt'))}).</p></section>
    ${Object.keys(bySrc).length ? html`<section class="card"><h3>Skąd pieniądze</h3>${Object.entries(bySrc).sort((a, b) => b[1] - a[1]).map(([k, v]) => html`<div class="oh"><span>${L[k] || k}</span><b>${zl(v)}</b></div>`)}</section>` : ''}
    ${Object.keys(byKat).length ? html`<section class="card"><h3>Na co idą</h3>${Object.entries(byKat).sort((a, b) => b[1] - a[1]).map(([k, v]) => html`<div class="oh"><span>${L[k] || k}</span><b>${zl(v)}</b></div>`)}</section>` : ''}
    ${Object.keys(perDog).length ? html`<section class="card"><h3>Koszty na psa</h3>${Object.entries(perDog).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => html`<div class="oh"><span>${byId[k]?.imie || '—'}</span><b>${zl(v)}</b></div>`)}</section>` : ''}
    <section class="card"><h3>Ostatnie wpisy</h3>${recent.length ? recent.map((x) => html`<button class="row" data-act="fin-open" data-id="${x.id}" style="min-height:52px"><span class="rt"><b>${x.typ === 'wplata' ? '+' : '−'}${zl(x.kwota)}</b><small>${fmtDate(x.data)} · ${L[x.kat || x.zrodlo] || ''}${x.pies_id && byId[x.pies_id] ? ' · ' + byId[x.pies_id].imie : ''}${x.opis ? ' · ' + x.opis : ''}</small></span>${icon('chev')}</button>`) : html`<p class="hint">Brak wpisów.</p>`}</section>
    <button class="btn ghost block" data-act="fin-csv">${icon('download')} Pobierz zestawienie roku (CSV)</button></div>` };
}
actions['fin-rok'] = (el) => { rok = +el.dataset.y; dispatchEvent(new HashChangeEvent('hashchange')); };
actions['fin-add'] = async () => form({ typ: 'wydatek', data: Date.now() });
actions['fin-open'] = async (el) => { const { get } = await import('./store.js'); const x = await get('p_finanse', el.dataset.id); if (x) form(x); };
async function form(x) {
  const dogs = (await list('psy')).sort((a, b) => (a.imie || '').localeCompare(b.imie || '', 'pl'));
  openSheet(`<h2>${x.id ? 'Edytuj wpis' : 'Nowy wpis'}</h2><form id="ff" novalidate>
    ${SEL('f_t', 'Rodzaj', [['wydatek', 'Wydatek'], ['wplata', 'Wpłata / darowizna']], x.typ)}
    <div class="field"><label for="f_k">Kwota w zł</label><input class="input" id="f_k" inputmode="decimal" value="${x.kwota ? String(x.kwota).replace('.', ',') : ''}"></div>
    <div class="field"><label for="f_d">Data</label><input class="input" id="f_d" type="date" value="${d10(x.data)}"></div>
    <div id="f_cat"></div>
    <div class="field"><label for="f_p">Dotyczy psa (opcjonalnie)</label><select class="select" id="f_p"><option value="">—</option>${dogs.map((d) => `<option value="${esc(d.id)}" ${d.id === x.pies_id ? 'selected' : ''}>${esc(d.imie)}</option>`).join('')}</select></div>
    <div class="field"><label for="f_o">Opis (opcjonalnie)</label><input class="input" id="f_o" maxlength="140" value="${esc(x.opis || '')}"></div><div class="err" id="f_x"></div>
    <button class="btn block" type="submit">Zapisz</button>${x.id ? '<button type="button" class="btn ghost block" style="margin-top:8px;color:var(--terra-d)" id="f_del">Usuń wpis</button>' : ''}</form>`, (s) => {
    const t = s.querySelector('#f_t'), cat = s.querySelector('#f_cat'); const paint = () => { cat.innerHTML = t.value === 'wplata' ? SEL('f_z', 'Źródło', ZRODLA, x.zrodlo || 'przelew') : SEL('f_c', 'Na co', KAT_WYD, x.kat || 'leczenie'); }; t.onchange = paint; paint();
    s.querySelector('#ff').addEventListener('submit', async (e) => {
      e.preventDefault(); const kw = parseFloat(s.querySelector('#f_k').value.replace(',', '.')); if (!(kw > 0)) { s.querySelector('#f_x').textContent = 'Wpisz kwotę.'; return; }
      const o = { ...x, typ: t.value, kwota: Math.round(kw * 100) / 100, data: new Date(s.querySelector('#f_d').value + 'T12:00').getTime(), pies_id: s.querySelector('#f_p').value || null, opis: s.querySelector('#f_o').value.trim(), autor: x.autor || getName() };
      if (o.typ === 'wplata') { o.zrodlo = s.querySelector('#f_z').value; delete o.kat; } else { o.kat = s.querySelector('#f_c').value; delete o.zrodlo; }
      await save('p_finanse', o); closeSheet(); toast('Zapisane');
    });
    s.querySelector('#f_del')?.addEventListener('click', async () => { if (await confirmSheet('Usunąć wpis?', 'Nie da się tego cofnąć.', 'Usuń', true)) { await remove('p_finanse', x.id); closeSheet(); toast('Usunięto'); } });
  });
}
actions['fin-csv'] = async () => {
  const [fin, zdr, dogs] = await Promise.all([list('p_finanse'), list('zdrowie'), list('psy')]); const byId = Object.fromEntries(dogs.map((d) => [d.id, d.imie]));
  const rows = [['data', 'rodzaj', 'kwota', 'kategoria', 'pies', 'opis']];
  fin.filter((x) => new Date(x.data).getFullYear() === rok).forEach((x) => rows.push([d10(x.data), x.typ, x.kwota, L[x.kat || x.zrodlo] || '', byId[x.pies_id] || '', x.opis || '']));
  zdr.filter((z) => z.koszt && new Date(z.data).getFullYear() === rok).forEach((z) => rows.push([d10(z.data), 'wydatek', z.koszt, 'Leczenie i weterynarz', byId[z.pies_id] || '', z.typ + (z.notatka ? ': ' + z.notatka : '')]));
  rows.sort((a, b) => (a[0] > b[0] ? 1 : -1)); const head = rows.shift(); rows.unshift(head);
  const csv = '﻿' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `lapa-finanse-${rok}.csv`; document.body.appendChild(a); a.click(); a.remove(); toast('Zapisano plik CSV');
};
