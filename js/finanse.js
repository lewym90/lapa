// Finanse (od 1.19): prosta baza wpisów. Wpis = wydatek albo wpłata, kwota, kiedy, opis, opcjonalnie pies.
// Na górze saldo roku (z kosztami leczenia z kart psów), na dole zestawienie roku (CSV) do sprawozdania. Tylko administrator.
import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet, plusBtn } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName } from './auth.js';
import { parseData, dataTs } from './util.js';
import { TYP } from './teczka.js';

const zl = (n) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
const opisW = (x) => x.opis || (x.typ === 'wplata' ? 'Wpłata' : 'Wydatek');
const kiedy = (x) => x.data_txt || dataTs(x.data);
let rok = new Date().getFullYear();

export async function finanse() {
  if (!state.coordinator) return { tab: 'start', title: 'Finanse', html: html`${pageBar('Finanse', { img: 'img/naglowki/finanse.webp' })}<div class="pad"><div class="lockbox">${icon('lock')}<p style="margin:6px 0 10px"><b>Finanse</b><br><span class="hint">Widzi je tylko administrator.</span></p></div></div>` };
  const [fin, zdr, dogs] = await Promise.all([list('p_finanse'), list('zdrowie'), list('psy')]); const byId = Object.fromEntries(dogs.map((d) => [d.id, d]));
  const inY = (t) => new Date(t).getFullYear() === rok;
  const wpisy = fin.filter((x) => inY(x.data)).sort((a, b) => b.data - a.data), zk = zdr.filter((z) => z.koszt && inY(z.data));
  const sum = (a, f = 'kwota') => a.reduce((s, x) => s + (+x[f] || 0), 0);
  const wp = sum(wpisy.filter((x) => x.typ === 'wplata')), leczenie = sum(zk, 'koszt'), wy = sum(wpisy.filter((x) => x.typ !== 'wplata')) + leczenie;
  const lata = [...new Set([rok, new Date().getFullYear(), ...fin.map((x) => new Date(x.data).getFullYear())])].sort((a, b) => a - b).slice(-4);
  const wiersz = (x) => `<button type="button" class="kwpis" data-act="fin-open" data-id="${esc(x.id)}"><span class="kwd">${esc(kiedy(x))}</span><span class="kwt"><b>${esc(opisW(x))}</b>${byId[x.pies_id] ? `<small>${esc(byId[x.pies_id].imie)}</small>` : ''}</span><span class="kwk${x.typ === 'wplata' ? ' plus' : ''}">${x.typ === 'wplata' ? '+' : '−'}${esc(zl(x.kwota))}</span></button>`;
  return { tab: 'start', title: 'Finanse', live: true,
    html: html`${pageBar('Finanse', { img: 'img/naglowki/finanse.webp' })}
    <div class="fchips">${lata.map((y) => html`<button class="chip dark ${rok === y ? 'on' : ''}" data-act="fin-rok" data-y="${y}">${y}</button>`)}<span style="margin-left:auto">${plusBtn('fin-add', 'Dodaj wpis')}</span></div>
    <div class="pad komp">
      <div class="kbox"><div class="kd"><span>Wpłaty</span><b>${zl(wp)}</b></div><div class="kd"><span>Wydatki</span><b>${zl(wy)}${leczenie ? html` <em>· w tym leczenie z kart psów ${zl(leczenie)}</em>` : ''}</b></div>
        <div class="kd"><span>Saldo ${rok}</span><b style="color:${wp - wy < 0 ? 'var(--terra-d)' : '#8fd0a4'}">${zl(wp - wy)}</b></div></div>
      <h2 class="kh">Wpisy</h2>
      <div class="kbox">${wpisy.length ? raw(wpisy.map(wiersz).join('')) : html`<p class="kpusto">Brak wpisów w ${rok}.</p>`}</div>
      <button class="btn ghost block" style="margin-top:18px" data-act="fin-csv">${icon('download')} Zestawienie roku ${rok} (CSV)</button>
    </div>` };
}
actions['fin-rok'] = (el) => { rok = +el.dataset.y; dispatchEvent(new HashChangeEvent('hashchange')); };
actions['fin-add'] = () => form({ typ: 'wydatek', data: Date.now() });
actions['fin-open'] = async (el) => { const x = await get('p_finanse', el.dataset.id); if (x) form(x); };
async function form(x) {
  const dogs = (await list('psy')).sort((a, b) => (a.imie || '').localeCompare(b.imie || '', 'pl'));
  openSheet(`<h2>${x.id ? 'Wpis' : 'Nowy wpis'}</h2><form id="ff" novalidate>
    <div class="chips" id="f_t" style="margin-bottom:14px">${[['wydatek', 'Wydatek'], ['wplata', 'Wpłata']].map(([k, l]) => `<button type="button" class="chip outline${(x.typ || 'wydatek') === k ? ' on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="field"><label for="f_k">Kwota w zł</label><input class="input" id="f_k" inputmode="decimal" autocomplete="off" value="${x.kwota ? String(x.kwota).replace('.', ',') : ''}"></div>
    <div class="field"><label for="f_o">Opis</label><input class="input" id="f_o" maxlength="140" autocomplete="off" placeholder="np. weterynarz, szczepienia; darowizna od pani Ani" value="${esc(x.id ? opisW(x) : '')}"></div>
    <div class="field"><label for="f_d">Kiedy</label><input class="input" id="f_d" maxlength="30" autocomplete="off" value="${esc(kiedy(x))}"></div>
    <div class="field"><label for="f_p">Pies (opcjonalnie)</label><select class="select" id="f_p"><option value="">—</option>${dogs.map((d) => `<option value="${esc(d.id)}" ${d.id === x.pies_id ? 'selected' : ''}>${esc(d.imie)}</option>`).join('')}</select></div>
    <div class="err" id="f_x"></div><button class="btn block" type="submit">Zapisz</button>${x.id ? '<button type="button" class="btn ghost block" style="margin-top:8px;color:var(--terra-d)" id="f_del">Usuń wpis</button>' : ''}</form>`, (s) => {
    let typ = x.typ || 'wydatek';
    s.querySelector('#f_t').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; typ = b.dataset.k; s.querySelectorAll('#f_t .chip').forEach((c) => c.classList.toggle('on', c === b)); });
    s.querySelector('#ff').addEventListener('submit', async (e) => {
      e.preventDefault(); const er = s.querySelector('#f_x'), kw = parseFloat(s.querySelector('#f_k').value.replace(/\s/g, '').replace(',', '.'));
      if (!(kw > 0)) { er.textContent = 'Wpisz kwotę.'; return; }
      const d = parseData(s.querySelector('#f_d').value); if (!d) { er.textContent = 'Wpisz datę, np. 12.03.2026.'; return; }
      const o = { ...x, typ, kwota: Math.round(kw * 100) / 100, data: d.ts, data_txt: d.txt, opis: s.querySelector('#f_o').value.trim(), pies_id: s.querySelector('#f_p').value || null, autor: x.autor || getName() };
      await save('p_finanse', o); closeSheet(); toast('Zapisane');
    });
    s.querySelector('#f_del')?.addEventListener('click', async () => { if (await confirmSheet('Usunąć wpis?', 'Nie da się tego cofnąć.', 'Usuń', true)) { await remove('p_finanse', x.id); toast('Usunięto'); } });
  });
}
actions['fin-csv'] = async () => {
  const [fin, zdr, dogs] = await Promise.all([list('p_finanse'), list('zdrowie'), list('psy')]); const byId = Object.fromEntries(dogs.map((d) => [d.id, d.imie]));
  const iso = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const rows = [];
  fin.filter((x) => new Date(x.data).getFullYear() === rok).forEach((x) => rows.push([iso(x.data), x.typ === 'wplata' ? 'wpłata' : 'wydatek', x.kwota, opisW(x), byId[x.pies_id] || '']));
  zdr.filter((z) => z.koszt && new Date(z.data).getFullYear() === rok).forEach((z) => rows.push([iso(z.data), 'wydatek', z.koszt, 'Leczenie: ' + (TYP[z.typ] || z.typ) + (z.notatka ? ', ' + z.notatka : ''), byId[z.pies_id] || '']));
  rows.sort((a, b) => (a[0] > b[0] ? 1 : -1)); rows.unshift(['data', 'rodzaj', 'kwota', 'opis', 'pies']);
  const csv = '﻿' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `lapa-finanse-${rok}.csv`; document.body.appendChild(a); a.click(); a.remove(); toast('Zapisano plik CSV');
};
