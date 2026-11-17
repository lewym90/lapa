import { API } from './config.js';
import { emit } from './bus.js';
const KEY = 'lapa.token';
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* tryb prywatny */ } };
let lastActive = Date.now();
// Losowy identyfikator tego telefonu: serwer po nim rozpoznaje własne zgłoszenia wolontariusza (może je wycofać tylko ten telefon).
export function devId() {
  try { let v = localStorage.getItem('lapa.dev'); if (!v) { v = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('lapa.dev', v); } return v; }
  catch { return 'brak-pamieci-telefonu-0000'; }
}
export const markActive = () => { lastActive = Date.now(); };
export const lastActivity = () => lastActive;

export class ApiError extends Error {
  constructor(status, body) { super(body?.error || (status ? 'Błąd serwera (' + status + ')' : 'Brak połączenia z serwerem')); this.status = status; this.body = body || {}; }
}

export async function api(path, { method = 'GET', body, auth = true, timeout = 20000 } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const tok = getToken();
  if (auth && tok) headers.authorization = 'Bearer ' + tok;
  if (Date.now() - lastActive < 60000) headers['x-active'] = '1';
  headers['x-lapa-dev'] = devId();
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout), cache: 'no-store' });
  } catch { throw new ApiError(0); }
  let data = null;
  try { data = await res.json(); } catch { /* pusta odpowiedź */ }
  if (!res.ok) {
    if (res.status === 401 && data?.login && auth) emit('authlost');
    throw new ApiError(res.status, data);
  }
  return data;
}
