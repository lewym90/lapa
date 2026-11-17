// Znaczki psa:
// - numer boksu (wpisuje administrator, widzą wszyscy; pole d.boks; tylko gdy pies jest w schronisku) – wszędzie, gdzie pojawia się pies,
// - „Tylko dla wybranych” z powodem i krótki opis psa (administrator; kolekcja „oznaczenia”, doklejana jako d.ozn) – widzi tylko administrator.
// Nie trafiają do tekstów postów, plakatów ani karty PDF.
import { esc } from './ui-core.js';
import { actions } from './ui.js';
import { state } from './auth.js';

export const POWODY = [['wycofany', 'wycofany'], ['trudny', 'trudny'], ['silny', 'silny']];
// Krótki opis psa: zamknięta lista (wybór jednym dotknięciem, bez wpisywania).
export const OPISY = ['specjalny', 'dla każdego', 'dla aktywnych', 'wycofany'];
const POZA = ['adoptowany', 'zmarl', 'dt', 'hotelik', 'zaginiony'];
const gdzie = (d) => d.miejsce || (d.status === 'adoptowany' ? 'adoptowany' : d.status === 'dt' ? 'dt' : d.status === 'hotelik' ? 'hotelik' : 'schronisko');

// Oznaczenie boksu: cyfry i litery (np. 12, 7a, A3, 12 b), bo nie znamy numeracji boksów w schronisku.
export const czyscBoks = (v) => String(v || '').replace(/[^0-9A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż /-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 8);
export const boks = (d) => (d && d.boks && !POZA.includes(gdzie(d)) && d.status !== 'adoptowany' ? String(d.boks) : '');
export const wybrani = (d) => !!(d && d.ozn && d.ozn.wybrani && d.ozn.wybrani.on);
export const powody = (d) => { const w = (d && d.ozn && d.ozn.wybrani) || {}; return [...(w.powody || []), ...(w.inny ? [w.inny] : [])]; };
export const kto = (d) => (wybrani(d) && d.ozn.wybrani.kto) || '';
export const opis = (d) => String((d && d.ozn && d.ozn.opis) || '').trim();
export const wybraniTxt = (d) => (wybrani(d) ? 'Tylko wybrani' + (powody(d).length ? ': ' + powody(d).join(', ') : '') : '');

// ----- kawałki HTML (zwykłe napisy, gotowe do wstawienia także przez raw()) -----
// Od 1.16 oznaczenie „tylko dla wybranych” i krótki opis psa widzi WYŁĄCZNIE administrator (wszędzie: Brama, Psy, karta, Start, Pomoc…).
// Wolontariusz nie dostaje tych danych z serwera; dodatkowo funkcje sprawdzają rolę.
const adm = (d) => !!(state.admin && d);
export const wybCls = (d) => (adm(d) && wybrani(d) ? ' wyb' : '');
export const boksPill = (d, cls = '') => (boks(d) ? `<span class="boks ${cls}">Boks ${esc(boks(d))}</span>` : '');
export const wybPill = (d, cls = '') => (adm(d) && wybrani(d) ? `<span class="wybl ${cls}">${esc(wybraniTxt(d))}</span>` : '');
export const opisLine = (d, cls = '') => (adm(d) && opis(d) ? `<span class="opisl ${cls}">${esc(opis(d))}</span>` : '');
// Pod imieniem w wierszach list (Brama, wybór psa, Start, Pomoc, Nowe psy, Dziś…): opis administratora i „Tylko wybrani”.
export const linie = (d) => (adm(d) ? `${opisLine(d)}${wybrani(d) ? `<span class="wybt">${esc(wybraniTxt(d))}</span>` : ''}` : '');
// Imię ze znaczkami w miejscach bez zdjęcia (terminarz, transport, czat, adopcje, finanse): krótko, w jednej linii.
export const imieZnaki = (d, imie) => {
  const n = esc(imie ?? (d && d.imie) ?? '');
  if (!d) return n;
  if (!adm(d)) return `${n}${boksPill(d, 'in')}`;
  return `${n}${boksPill(d, 'in')}${opis(d) ? ` <span class="opisi">${esc(opis(d))}</span>` : ''}${wybrani(d) ? ` <span class="wybi">${esc(wybraniTxt(d))}</span>` : ''}`;
};
// Brama (zostawione nazwy z wersji roboczej)
export const wybClsB = wybCls;
export const opisLineB = opisLine;
export const linieB = linie;

// ----- kolejność: alfabetycznie albo według boksów (Brama, wybór psa do spaceru, lista Psy) -----
// Według boksów: najpierw psy z boksem w kolejności 1, 2, 7, 7a, 12, A3 (liczby jak liczby, nie jak tekst),
// pod nimi psy bez boksu alfabetycznie. Wybór zapamiętuje telefon, osobno dla każdego ekranu.
const KOL = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });
export const poImieniu = (a, b) => KOL.compare(a.imie || '', b.imie || '');
export function poBoksie(a, b) {
  const x = boks(a), y = boks(b);
  if (x && y) return KOL.compare(x, y) || poImieniu(a, b);
  if (x) return -1;
  if (y) return 1;
  return poImieniu(a, b);
}
const SK = (ekran) => 'lapa.kolejnosc.' + ekran;
export const kolejnosc = (ekran) => { try { return localStorage.getItem(SK(ekran)) === 'boks' ? 'boks' : 'domyslnie'; } catch { return 'domyslnie'; } };
export function kolejnoscHtml(ekran, etykieta = 'Alfabetycznie') {
  const k = kolejnosc(ekran), b = (t, l) => `<button type="button" class="chip dark ${k === t ? 'on' : ''}" data-act="kolejnosc" data-e="${esc(ekran)}" data-t="${t}" aria-pressed="${k === t}">${l}</button>`;
  return `<div class="kolej" role="group" aria-label="Kolejność psów"><span>Kolejność:</span>${b('domyslnie', esc(etykieta))}${b('boks', 'Boks')}</div>`;
}
actions.kolejnosc = (el) => { try { localStorage.setItem(SK(el.dataset.e), el.dataset.t); } catch { /* tryb prywatny */ } dispatchEvent(new HashChangeEvent('hashchange')); };
