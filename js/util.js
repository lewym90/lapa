export const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const MS_DAY = 86400000;
const pl = 'pl-PL';
export const fmtDate = (t) => new Intl.DateTimeFormat(pl, { day: 'numeric', month: 'long', year: 'numeric' }).format(t);
export const fmtDayLong = (t) => new Intl.DateTimeFormat(pl, { weekday: 'long', day: 'numeric', month: 'long' }).format(t);
export const fmtTime = (t) => new Intl.DateTimeFormat(pl, { hour: '2-digit', minute: '2-digit' }).format(t);
export const fmtShort = (t) => {
  const d = new Date(t), td = startOfDay(Date.now()), dd = startOfDay(t), diff = Math.round((dd - td) / MS_DAY);
  const wd = new Intl.DateTimeFormat(pl, { weekday: 'short' }).format(d).replace('.', '');
  const cap = wd[0].toUpperCase() + wd.slice(1) + '.';
  const time = d.getHours() || d.getMinutes() ? ', ' + fmtTime(d) : '';
  if (diff === 0) return 'Dziś' + time;
  if (diff === 1) return 'Jutro' + time;
  return cap + ', ' + new Intl.DateTimeFormat(pl, { day: 'numeric', month: 'numeric' }).format(d) + time;
};
export const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const ago = (t) => {
  const days = Math.floor((startOfDay(Date.now()) - startOfDay(t)) / MS_DAY);
  if (days <= 0) return 'dziś'; if (days === 1) return 'wczoraj';
  return days + ' dni temu';
};
export function nextSaturdays(n = 4) {
  const out = [], now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  const add = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + add);
  if (add === 0 && now.getHours() >= 14) d.setDate(d.getDate() + 7); // sobota po południu: pokaż następną
  for (let i = 0; i < n; i++) { out.push(d.getTime()); d.setDate(d.getDate() + 7); }
  return out;
}
export const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Dobry wieczór' : h < 18 ? 'Dzień dobry' : 'Dobry wieczór'; };
export const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '').slice(0, 24);
export const hhmm = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return [h, m, x].map((v) => String(v).padStart(2, '0')).join(':'); };
export const minutesText = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`; };
export function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Pies dnia: wszyscy widzą tego samego psa tego samego dnia; każdy pies po kolei, zanim któryś się powtórzy.
export function dogOfDay(dogs, now = Date.now()) {
  // tylko psy, które są z nami (bez adoptowanych, zaginionych i tych, które odeszły)
  const pool = dogs.filter((d) => (d.zdjecia || []).length && !['adoptowany', 'w_trakcie'].includes(d.status) && !d.archiwum && !d.zniknal_ze_strony && !['adoptowany', 'zmarl', 'zaginiony'].includes(d.miejsce));
  if (!pool.length) return null;
  pool.sort((a, b) => hash(a.id + 'lapa') - hash(b.id + 'lapa') || (a.id < b.id ? -1 : 1));
  const dn = Math.floor((startOfDay(now) - new Date(2026, 0, 1).getTime()) / MS_DAY + 0.5);
  return pool[((dn % pool.length) + pool.length) % pool.length];
}

export function distanceKm(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export async function compressImage(file, max = 1280, q = 0.82, maxBytes = 0) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file).catch(() => null));
  if (!bmp) throw new Error('Nie udało się odczytać zdjęcia');
  let k = Math.min(1, max / Math.max(bmp.width, bmp.height)), blob;
  for (let i = 0; i < 8; i++) { // przy limicie rozmiaru: obniżamy jakość, a potem wymiary, aż zdjęcie się zmieści
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Błąd kompresji'))), 'image/jpeg', q));
    if (!maxBytes || blob.size <= maxBytes) break;
    if (q > 0.7) q -= 0.06; else k *= 0.85;
  }
  if (bmp.close) bmp.close();
  return blob;
}

export const NEED_LABELS = { spacer: 'Spokojny spacer', zdjecia: 'Aktualne zdjęcia', obserwacja: 'Obserwacja zachowania', dt: 'Dom tymczasowy', transport: 'Transport', promocja: 'Promocja adopcyjna', specjalista: 'Pomoc specjalisty' };
// Potrzeby psa: ręcznie zaznaczone + wyliczone regułami (bez AI).
export function dogNeeds(d, walks = []) {
  const out = new Set(d.potrzeby || []);
  if (['adoptowany', 'w_trakcie'].includes(d.status) || d.archiwum || d.zniknal_ze_strony || ['adoptowany', 'zmarl'].includes(d.miejsce)) return [];
  if (!(d.zdjecia || []).length) out.add('zdjecia');
  const mine = walks.filter((w) => w.pies_id === d.id);
  if (mine.length) {
    const last = Math.max(...mine.map((w) => w.end || w.start || 0));
    if (Date.now() - last > 21 * MS_DAY) out.add('spacer');
  }
  return [...out];
}

// ===== Daty „tyle, ile pamiętasz” (karta psa): „2014”, „03.2014”, „marzec 2014”, „12.03.2014”, „2014-03-12”, „ok. 2014” =====
const MIES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const MIES_ALT = { maj: 4, maja: 4, paz: 9, 'paźdz': 9 };
// Zwraca { ts, txt } (txt: „2014”, „03.2014” albo „12.03.2014”) lub null, gdy nie da się odczytać.
export function parseData(v) {
  const t = String(v || '').trim().toLowerCase().replace(/^ok(oło|\.)?\s*/, '').replace(/\s*r(ok|\.)?\s*$/, '').replace(/[/-]/g, '.').replace(/\s+/g, ' ');
  if (!t) return null;
  const now = new Date(), maxY = now.getFullYear() + 20;
  const ok = (y, m, d) => y >= 1990 && y <= maxY && (!m || (m >= 1 && m <= 12)) && (!d || (d >= 1 && d <= new Date(y, m, 0).getDate()));
  const two = (n) => String(n).padStart(2, '0');
  let m;
  if ((m = /^(\d{4})$/.exec(t))) { const y = +m[1]; return ok(y) ? { ts: new Date(y, 6, 1, 12).getTime(), txt: String(y) } : null; }
  if ((m = /^(\d{1,2})\.(\d{4})$/.exec(t))) { const mo = +m[1], y = +m[2]; return ok(y, mo) ? { ts: new Date(y, mo - 1, 15, 12).getTime(), txt: two(mo) + '.' + y } : null; }
  if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t))) { const d = +m[1], mo = +m[2], y = +m[3]; return ok(y, mo, d) ? { ts: new Date(y, mo - 1, d, 12).getTime(), txt: two(d) + '.' + two(mo) + '.' + y } : null; }
  if ((m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(t))) { const y = +m[1], mo = +m[2], d = +m[3]; return ok(y, mo, d) ? { ts: new Date(y, mo - 1, d, 12).getTime(), txt: two(d) + '.' + two(mo) + '.' + y } : null; }
  if ((m = /^(\d{1,2} )?([a-ząćęłńóśźż]+) (\d{4})$/.exec(t))) {
    const w = m[2]; let mo = MIES_ALT[w] ?? MIES.findIndex((x) => w.startsWith(x)); if (mo < 0) return null; mo += 1;
    const y = +m[3], d = m[1] ? +m[1] : 0; if (!ok(y, mo, d || undefined)) return null;
    return d ? { ts: new Date(y, mo - 1, d, 12).getTime(), txt: two(d) + '.' + two(mo) + '.' + y } : { ts: new Date(y, mo - 1, 15, 12).getTime(), txt: two(mo) + '.' + y };
  }
  return null;
}
export const dataTs = (ts) => { const d = new Date(ts); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); };
// Ile czasu minęło: „2 dni”, „5 mies.”, „3 lata”. Przy samym roku liczymy pełne lata.
export function ileCzasu(ts, tylkoRok = false) {
  const now = new Date(), d = new Date(ts);
  if (tylkoRok) { const y = now.getFullYear() - d.getFullYear(); return y <= 0 ? 'poniżej roku' : y + ' ' + (y === 1 ? 'rok' : y % 10 >= 2 && y % 10 <= 4 && (y % 100 < 10 || y % 100 >= 20) ? 'lata' : 'lat'); }
  const dni = Math.max(0, Math.floor((now - d) / MS_DAY));
  if (dni < 31) return dni + ' ' + (dni === 1 ? 'dzień' : 'dni');
  let mies = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth(); if (now.getDate() < d.getDate()) mies--;
  if (mies < 12) return Math.max(1, mies) + ' mies.';
  const y = Math.floor(mies / 12); return y + ' ' + (y === 1 ? 'rok' : y % 10 >= 2 && y % 10 <= 4 && (y % 100 < 10 || y % 100 >= 20) ? 'lata' : 'lat');
}
// „W schronisku od” psa: wpis administratora (d.od, tekst) albo data publikacji ogłoszenia na stronie (d.od_www).
export function odKiedy(d) {
  const r = d.od ? parseData(d.od) : null;
  if (r) return { txt: r.txt, ile: ileCzasu(r.ts, /^\d{4}$/.test(r.txt)) };
  const ts = d.data_przyjecia || d.od_www;
  return ts ? { txt: dataTs(ts), ile: ileCzasu(ts) } : null;
}
