import { api, getToken, setToken, markActive, ApiError } from './api.js';
import { emit } from './bus.js';
import * as db from './db.js';
import { VOL_WRITE } from './config.js';

// Od 1.16 dwie role: wolontariusz (podgląd + własne zgłoszenia) i administrator (wszystko, zostaje zalogowany).
// state.coordinator zostaje jako synonim administratora (dane osobowe: adopcje, DT, finanse).
export const state = { loggedIn: !!getToken(), coordinator: false, admin: false };
const NAME = 'lapa.name', ADMIN = 'lapa.admin', TEL = 'lapa.tel';
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* */ } }
};
export const getName = () => ls.get(NAME) || '';
export const setName = (n) => { ls.set(NAME, n.trim().slice(0, 40)); emit('auth'); };
// Telefon wolontariusza do zgłoszeń: zapamiętany tylko na tym telefonie (podpowiedź w oknie zgłoszenia).
export const getTel = () => ls.get(TEL) || '';
export const setTel = (t) => ls.set(TEL, String(t || '').trim().slice(0, 40) || null);
const setRole = (admin) => { state.admin = !!admin; state.coordinator = !!admin; ls.set(ADMIN, admin ? '1' : null); try { localStorage.removeItem('lapa.coordLast'); } catch { /* */ } };

export async function login(password) {
  const r = await api('/auth/login', { method: 'POST', body: { password }, auth: false });
  setToken(r.token); state.loggedIn = true; setRole(r.admin);
  emit('auth'); return r;
}
export async function unlock(password) {
  const r = await api('/auth/unlock', { method: 'POST', body: { password } });
  setRole(!!r.admin); emit('auth'); emit('unlocked'); return r;
}
export async function lock(notifyServer = true) {
  setRole(false);
  // od 1.16: wolontariusz widzi mniej danych – czyścimy telefon i pobieramy jego wersję od nowa
  await db.przelaczRole(false, VOL_WRITE).catch(() => db.purgePrivate().catch(() => {}));
  await db.metaSet('rola', 'wolontariusz').catch(() => {});
  if (notifyServer && getToken()) api('/auth/lock', { method: 'POST' }).catch(() => {});
  emit('auth'); emit('change', { col: 'p_' });
}
export async function logout() {
  if (getToken()) await api('/auth/logout', { method: 'POST' }).catch(() => {});
  setToken(null); state.loggedIn = false; setRole(false);
  await db.wipeAll().catch(() => {});
  emit('auth');
}
export function sessionLost() {
  setToken(null); state.loggedIn = false; setRole(false);
  db.purgePrivate().catch(() => {}); emit('auth');
}

// Start aplikacji: rola z pamięci telefonu, potwierdzona przez serwer (gdy jest zasięg).
export async function init() {
  if (!state.loggedIn) return;
  setRole(ls.get(ADMIN) === '1');
  try {
    const s = await api('/auth/status');
    if (!!s.admin !== state.admin) { if (s.admin) setRole(true); else await lock(false); emit('auth'); }
  } catch (e) { if (!(e instanceof ApiError) || e.status !== 401) { /* offline – zostajemy zalogowani */ } }
}

['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((ev) => addEventListener(ev, markActive, { passive: true, capture: true }));
