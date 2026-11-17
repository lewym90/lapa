// Wspólne zasady psa (od 1.18 strona schroniska jest jedynym źródłem psów, statusu i miejsca),
// oznaczenie psa (administrator), wpisy zdrowia, stan sprawdzania strony i terminy zabiegów (karta „Dziś” na Starcie).
import { esc, openSheet, closeSheet, toast, actions } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state } from './auth.js';
import { MS_DAY, fmtDate } from './util.js';
import { api } from './api.js';
import { POWODY, OPISY } from './znak.js';

export const ZDROWIE_TYPY = [['szczepienie', 'Szczepienie'], ['odrobaczanie', 'Odrobaczanie'], ['pchly', 'Pchły i kleszcze'], ['kastracja', 'Kastracja / sterylizacja'], ['chip', 'Czip'], ['weterynarz', 'Wizyta u weterynarza'], ['lek', 'Lek / leczenie'], ['badanie', 'Badanie'], ['inne', 'Inne']];
export const TYP = Object.fromEntries(ZDROWIE_TYPY);
export const OCENA_POLA = [['ludzie', 'Do ludzi'], ['dzieci', 'Do dzieci'], ['psy', 'Do innych psów'], ['koty', 'Do kotów'], ['smycz', 'Na smyczy']];
const OCENA_OPC = [['', 'Nie wiadomo'], ['ok', 'Bardzo dobrze'], ['neutral', 'Neutralnie'], ['ostroznie', 'Ostrożnie / z zastrzeżeniem'], ['nie', 'Słabo / nie polecamy']];
export const OCENA_LBL = Object.fromEntries(OCENA_OPC);
export const days = (t) => Math.max(0, Math.floor((Date.now() - t) / MS_DAY));

export const miejsce = (d) => d.miejsce || 'schronisko';
// „Byli u nas”: pies z zakładki „Adoptowane” na stronie schroniska. Pies, którego nie ma nigdzie na stronie, jest ukryty (store.list go pomija).
export const byl = (d) => d.status === 'adoptowany';
export const aktywny = (d) => !byl(d) && !d.zniknal_ze_strony;
export const dostepny = aktywny;

// ===== oznaczenie i krótki opis psa: wyłącznie administrator (kolekcja „oznaczenia”, bez podpisu autora) =====
actions['dog-oznacz'] = async (el) => {
  if (!state.admin) { toast('To może zmienić tylko administrator', true); return; }
  const d = await get('psy', el.dataset.id); if (!d) return;
  const o = d.ozn || {}, w = o.wybrani || {}, sel = new Set(w.powody || []);
  openSheet(`<h2>Wydawanie na spacer: ${esc(d.imie)}</h2><p class="hint" style="margin:0 0 12px">Kto może wyprowadzać psa i krótki opis pod imieniem w Bramie. Widzą to tylko administratorzy (Brama, lista Psy, karta psa). Wolontariusze tego nie widzą. Nie widać, kto to ustawił.</p><form id="of2" novalidate>
    <div class="field"><span class="lbl">Krótki opis (pod imieniem, zamiast hasła ze strony)</span><div class="chips" id="oz_o">${['', ...OPISY].map((k) => `<button type="button" class="chip outline ${(o.opis || '') === k ? 'on' : ''}" data-op="${esc(k)}" aria-pressed="${(o.opis || '') === k}">${k ? esc(k) : 'bez opisu'}</button>`).join('')}</div></div>
    <label class="check" style="margin-top:6px"><input type="checkbox" id="oz_on" ${w.on ? 'checked' : ''}> <b>Wyprowadzają tylko wybrani wolontariusze</b></label>
    <div class="field" style="margin-top:12px"><span class="lbl">Dlaczego (możesz zaznaczyć kilka)</span><div class="chips">${POWODY.map(([k, l]) => `<button type="button" class="chip outline pw ${sel.has(k) ? 'on' : ''}" data-pw="${k}">${l}</button>`).join('')}</div></div>
    <div class="field"><label for="oz_i">Inny powód (opcjonalnie)</label><input class="input" id="oz_i" maxlength="40" placeholder="np. ucieka, gryzie smycz" value="${esc(w.inny || '')}" data-nodraft></div>
    <div class="field"><label for="oz_k">Kto może wyprowadzać (opcjonalnie)</label><input class="input" id="oz_k" maxlength="120" placeholder="np. Justyna, Marek" value="${esc(w.kto || '')}" data-nodraft></div>
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

// ===== zdrowie =====
export const zdrDue = (zdr) => {
  const now = Date.now();
  return zdr.filter((z) => z.termin && z.termin < now + 14 * MS_DAY && !zdr.some((y) => y.typ === z.typ && y.data > z.data && y.data >= z.termin - 14 * MS_DAY && y.id !== z.id));
};
export const zdrowieDla = async (id) => (await list('zdrowie')).filter((z) => z.pies_id === id).sort((a, b) => b.data - a.data);

// ===== stan automatycznego sprawdzania strony (robi je serwer co godzinę 6–22 i o 2 w nocy) =====
let _st = null, _stT = 0;
export const resetSiteStatus = () => { _stT = 0; };
export async function siteStatus() {
  if (_st && Date.now() - _stT < 5 * 60e3) return _st;
  try { const h = await api('/health'); _st = (h && h.site) || null; _stT = Date.now(); } catch { /* brak sieci: zostaje poprzedni stan */ }
  return _st;
}

// ===== terminy zabiegów (np. szczepienie) do karty „Dziś” na Starcie =====
export function gaps(dogs, zdrAll) {
  const out = [], now = Date.now();
  for (const d of dogs) {
    if (!aktywny(d)) continue;
    for (const z of zdrDue(zdrAll.filter((x) => x.pies_id === d.id))) out.push({ d, kind: 'zdrowie', sev: z.termin < now ? 3 : 2, text: `${TYP[z.typ] || z.typ}: ${z.termin < now ? 'termin minął ' + fmtDate(z.termin) : 'do ' + fmtDate(z.termin)}` });
  }
  return out.sort((a, b) => b.sev - a.sev || (a.d.imie || '').localeCompare(b.d.imie || '', 'pl'));
}
