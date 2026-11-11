// Zgłoszenia udziału: wielu wolontariuszy może zapisać się przy jednym wydarzeniu lub sobotnim spacerze.
import { html, raw, esc, openSheet, closeSheet, toast, actions } from './ui.js';
import { list, save, remove, get } from './store.js';
import { getName } from './auth.js';
import { slug } from './util.js';

export const evKey = (kind, id) => `${kind}_${String(id).replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 40);
const recId = (key, name) => `zg_${key}_${slug(name)}`.slice(0, 64);
const needName = () => { if (getName()) return true; toast('Najpierw wpisz imię w ustawieniach', true); return false; };

export const zgloszenia = async () => (await list('zgloszenia'));
export const forKey = (all, key) => all.filter((z) => z.key === key);
const names = (a) => (a.length <= 4 ? a.map((z) => z.imie).join(', ') : a.slice(0, 4).map((z) => z.imie).join(', ') + ' +' + (a.length - 4));

// Krótki blok pod wydarzeniem: kto się zgłosił + przyciski. Dla spaceru: „Będę / Nie będę”, dla reszty: „Biorę to / Nie mogę”.
export function udzialBlock(all, key, kind = 'ev', title = '') {
  const z = forKey(all, key), me = getName(), mine = z.find((x) => x.imie === me);
  const tak = z.filter((x) => x.status === 'tak'), nie = z.filter((x) => x.status === 'nie');
  const L = kind === 'walk' ? ['Będę', 'Nie będę'] : ['Biorę to', 'Nie mogę'];
  const btn = (st, label) => html`<button class="btn sm ${mine && mine.status === st ? '' : 'ghost'}" data-act="zg-set" data-key="${key}" data-st="${st}" data-kind="${kind}" data-title="${esc(title)}">${label}</button>`;
  return html`<div class="zg" style="margin-top:10px;width:100%">
    <div class="sub" style="margin-bottom:6px">${tak.length ? html`<b>${kind === 'walk' ? 'Będą' : 'Zgłosili się'} (${tak.length}):</b> ${names(tak)}` : (kind === 'walk' ? 'Nikt jeszcze nie potwierdził.' : 'Nikt się jeszcze nie zgłosił.')}${nie.length ? html` <span style="opacity:.7">· Nie będą: ${names(nie)}</span>` : ''}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${btn('tak', L[0])}${btn('nie', L[1])}<button class="btn sm ghost" data-act="zg-open" data-key="${key}" data-title="${esc(title)}">Szczegóły</button></div></div>`;
}

actions['zg-set'] = async (el) => {
  if (!needName()) return; const key = el.dataset.key, st = el.dataset.st, me = getName(), id = recId(key, me);
  const old = await get('zgloszenia', id);
  if (old && old.status === st) { await remove('zgloszenia', id); toast('Wycofano'); }
  else { await save('zgloszenia', { id, key, imie: me, status: st, notatka: old?.notatka || '', ts: Date.now() }); toast(st === 'tak' ? 'Zapisane, dziękujemy!' : 'Zapisane'); }
  const box = document.getElementById('zgbox'); if (box) box.innerHTML = udzialBlock(await zgloszenia(), key, el.dataset.kind, el.dataset.title).s;
  
};
actions['zg-open'] = async (el) => {
  const key = el.dataset.key, title = el.dataset.title || 'Kto bierze udział';
  const all = forKey(await zgloszenia(), key), me = getName(), mine = all.find((x) => x.imie === me);
  const row = (z) => `<div class="row" style="gap:10px"><span class="rt"><b>${esc(z.imie)}</b><small>${esc(z.notatka || '')}</small></span></div>`;
  const grp = (st, label) => { const a = all.filter((x) => x.status === st); return a.length ? `<h3 style="font-size:17px;margin:14px 0 6px">${label} (${a.length})</h3><div class="rows">${a.map(row).join('')}</div>` : ''; };
  openSheet(`<h2>${esc(title)}</h2>${grp('tak', 'Biorą udział')}${grp('nie', 'Nie mogą')}${all.length ? '' : '<p class="hint">Nikt się jeszcze nie zgłosił.</p>'}
    <form id="zf" style="margin-top:16px"><div class="field"><label for="zn">Twoja uwaga (np. „zawiozę o 9:00”, „mogę po 14:00”)</label><input class="input" id="zn" maxlength="120" value="${esc(mine?.notatka || '')}"></div>
    <div class="btnrow"><button type="button" class="btn" id="zt">Biorę udział</button><button type="button" class="btn ghost" id="zx">Nie mogę</button></div>
    ${mine ? '<button type="button" class="btn ghost block" style="margin-top:8px" id="zr">Wycofaj moje zgłoszenie</button>' : ''}</form>`, (s) => {
    const put = async (st) => { if (!needName()) return; await save('zgloszenia', { id: recId(key, me), key, imie: me, status: st, notatka: s.querySelector('#zn').value.trim(), ts: Date.now() }); closeSheet(); toast('Zapisane');  };
    s.querySelector('#zt').onclick = () => put('tak'); s.querySelector('#zx').onclick = () => put('nie');
    s.querySelector('#zr')?.addEventListener('click', async () => { await remove('zgloszenia', recId(key, me)); closeSheet(); toast('Wycofano');  });
  });
};
void raw;
