// Znaczki psa widoczne wszędzie, gdzie pojawia się pies:
// - numer boksu (wpisuje każdy wolontariusz, pole d.boks; tylko gdy pies jest w schronisku),
// - „Tylko dla wybranych” z powodem i krótki opis psa (ustawia wyłącznie administrator; kolekcja „oznaczenia”, doklejana jako d.ozn).
// Nie trafiają do tekstów postów, plakatów ani karty PDF.
import { esc } from './ui-core.js';

export const POWODY = [['wycofany', 'wycofany'], ['trudny', 'trudny'], ['silny', 'silny']];
// Krótki opis psa: zamknięta lista (wybór jednym dotknięciem, bez wpisywania).
export const OPISY = ['specjalny', 'dla każdego', 'dla aktywnych', 'wycofany'];
const POZA = ['adoptowany', 'zmarl', 'dt', 'hotelik', 'zaginiony'];
const gdzie = (d) => d.miejsce || (d.status === 'adoptowany' ? 'adoptowany' : d.status === 'dt' ? 'dt' : d.status === 'hotelik' ? 'hotelik' : 'schronisko');

export const boks = (d) => (d && d.boks && !POZA.includes(gdzie(d)) && d.status !== 'adoptowany' ? String(d.boks) : '');
export const wybrani = (d) => !!(d && d.ozn && d.ozn.wybrani && d.ozn.wybrani.on);
export const powody = (d) => { const w = (d && d.ozn && d.ozn.wybrani) || {}; return [...(w.powody || []), ...(w.inny ? [w.inny] : [])]; };
export const kto = (d) => (wybrani(d) && d.ozn.wybrani.kto) || '';
export const opis = (d) => String((d && d.ozn && d.ozn.opis) || '').trim();
export const wybraniTxt = (d) => (wybrani(d) ? 'Tylko wybrani' + (powody(d).length ? ': ' + powody(d).join(', ') : '') : '');

// ----- kawałki HTML (zwykłe napisy, gotowe do wstawienia także przez raw()) -----
export const wybCls = (d) => (wybrani(d) ? ' wyb' : '');
export const boksPill = (d, cls = '') => (boks(d) ? `<span class="boks ${cls}">Boks ${esc(boks(d))}</span>` : '');
export const wybPill = (d, cls = '') => (wybrani(d) ? `<span class="wybl ${cls}">${esc(wybraniTxt(d))}</span>` : '');
export const opisLine = (d, cls = '') => (opis(d) ? `<span class="opisl ${cls}">${esc(opis(d))}</span>` : '');
// Pod imieniem w wierszach list (Brama, wybór psa, Start, Pomoc, Nowe psy, Dziś…): opis administratora i „Tylko wybrani”.
export const linie = (d) => `${opisLine(d)}${wybrani(d) ? `<span class="wybt">${esc(wybraniTxt(d))}</span>` : ''}`;
// Imię ze znaczkami w miejscach bez zdjęcia (terminarz, transport, czat, adopcje, finanse): krótko, w jednej linii.
export const imieZnaki = (d, imie) => {
  const n = esc(imie ?? (d && d.imie) ?? '');
  if (!d) return n;
  return `${n}${boksPill(d, 'in')}${opis(d) ? ` <span class="opisi">${esc(opis(d))}</span>` : ''}${wybrani(d) ? ` <span class="wybi">${esc(wybraniTxt(d))}</span>` : ''}`;
};
