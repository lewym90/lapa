// Bezpieczne składanie HTML: wszystko, co nie jest oznaczone jako raw(), jest zamieniane na tekst.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
const one = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(one).join('') : v === false || v == null ? '' : esc(v));
export function html(strs, ...vals) {
  let o = strs[0];
  for (let i = 0; i < vals.length; i++) o += one(vals[i]) + strs[i + 1];
  return new Raw(o);
}
// tylko adresy http(s) trafiają do src/href
export const safeUrl = (u) => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
