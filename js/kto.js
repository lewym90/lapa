// Podpis: kto dodał i kto ostatnio zmienił wpis (z danych zapisanych przy każdym zapisie).
import * as db from './db.js';
import { esc } from './ui.js';
import { fmtTime } from './util.js';

const pl = 'pl-PL';
const when = (t) => {
  const d = new Date(t), now = new Date();
  const same = d.toDateString() === now.toDateString();
  return same ? 'dziś ' + fmtTime(d) : new Intl.DateTimeFormat(pl, { day: 'numeric', month: 'short' }).format(d).replace('.', '') + ', ' + fmtTime(d);
};
const nameOf = (by) => (by === 'strona' ? 'automat (strona schroniska)' : by || '');

// Tekst (bez HTML) do wstawienia w kartę lub arkusz.
export function ktoText(rec, autor) {
  if (!rec) return '';
  const by = nameOf(rec.by), au = nameOf(autor);
  const last = by ? `${by}, ${when(rec.updated_at)}` : '';
  if (au && by && au !== by) return `Dodał(a): ${au} · Ostatnia zmiana: ${last}`;
  if (au) return `Dodał(a): ${au}${last ? ' · ' + last : ''}`;
  return last ? `Ostatnia zmiana: ${last}` : '';
}
export async function ktoHtml(col, id, autor) {
  const t = ktoText(await db.getRec(col, id), autor);
  return t ? `<p class="hint kto">${esc(t)}</p>` : '';
}
// Wypełnia element o danym selektorze w korzeniu.
export async function ktoInto(root, sel, col, id, autor) {
  const el = root.querySelector(sel); if (el) el.innerHTML = await ktoHtml(col, id, autor);
}
