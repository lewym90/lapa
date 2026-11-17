// Nowe psy (od 1.17): przyjęcie i uzupełnianie odbywa się w jednej karcie psa (karta.js, #/karta/:id).
// Tu zostaje: licznik „do uzupełnienia” w menu, automatyczne oznaczenie kompletnej karty i stare adresy (#/nowe…).
import { actions, toast } from './ui.js';
import { list, save } from './store.js';
import { on } from './bus.js';
import { state } from './auth.js';
import { wToku, kompletna } from './teczka.js';
import { list_ as psyLista, ustawFiltr } from './screens-psy.js';

let badgeT;
export function refreshNowe() {
  clearTimeout(badgeT);
  badgeT = setTimeout(async () => {
    if (!state.loggedIn || !state.admin) return;
    const n = (await list('psy')).filter(wToku).length;
    document.querySelectorAll('.nbadge').forEach((el) => { el.textContent = String(n); el.hidden = n === 0; el.setAttribute('aria-label', n + ' do uzupełnienia'); });
  }, 150);
}
// Gdy wszystkie 5 kroków jest wypełnionych, karta zostaje oznaczona jako kompletna (znaczek „Uzupełnij” znika na stałe).
async function zamknijGotowe() {
  for (const d of await list('psy')) {
    if (d.nowy && !d.karta_gotowa && kompletna(d)) {
      await save('psy', { ...d, karta_gotowa: Date.now() });
      if (location.hash.startsWith('#/karta/' + d.id)) toast(`Karta ${d.imie} jest kompletna`);
    }
  }
  refreshNowe();
}
let wt;
on('change', () => { clearTimeout(wt); wt = setTimeout(() => { if (state.loggedIn && state.admin) zamknijGotowe().catch(() => {}); }, 900); });

// #/nowe → lista Psy z filtrem „Do uzupełnienia”; #/nowe/:id → karta psa
export async function nowe(id) {
  if (id) { location.replace(`#/karta/${id}`); return { tab: 'psy', html: { s: '' } }; }
  ustawFiltr('nowe');
  return psyLista();
}
const KROK = { przyjecie: 1, zdrowie: 2, charakter: 3, wyglad: 1, zdjecia: 4, opis: 5, ogloszenie: 5, zaufanie: 1 };
actions['nowe-open'] = (el) => { location.hash = '#/karta/' + el.dataset.id; };
actions['nw-step'] = (el) => { location.hash = `#/karta/${el.dataset.id}/${KROK[el.dataset.k] || 1}`; };
actions['a-newdog'] = () => { location.hash = '#/karta/nowy'; };
actions['dog-new'] = () => { location.hash = '#/karta/nowy'; };
