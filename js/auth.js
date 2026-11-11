import { api, getToken, setToken, markActive, ApiError } from './api.js';
import { COORD_IDLE_MS } from './config.js';
import { emit } from './bus.js';
import * as db from './db.js';

export const state = { loggedIn: !!getToken(), coordinator: false };
const NAME = 'lapa.name', COORD = 'lapa.coordLast';
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* */ } }
};
export const getName = () => ls.get(NAME) || '';
export const setName = (n) => { ls.set(NAME, n.trim().slice(0, 40)); emit('auth'); };

export async function login(password) {
  const r = await api('/auth/login', { method: 'POST', body: { password }, auth: false });
  setToken(r.token); state.loggedIn = true; state.coordinator = !!r.coordinator;
  if (r.coordinator) ls.set(COORD, String(Date.now())); else ls.set(COORD, null);
  emit('auth'); return r;
}
export async function unlock(password) {
  const r = await api('/auth/unlock', { method: 'POST', body: { password } });
  state.coordinator = true; ls.set(COORD, String(Date.now())); emit('auth'); emit('unlocked'); return r;
}
export async function lock(notifyServer = true) {
  state.coordinator = false; ls.set(COORD, null);
  await db.purgePrivate().catch(() => {});
  if (notifyServer && getToken()) api('/auth/lock', { method: 'POST' }).catch(() => {});
  emit('auth'); emit('change', { col: 'p_' });
}
export async function logout() {
  if (getToken()) await api('/auth/logout', { method: 'POST' }).catch(() => {});
  setToken(null); state.loggedIn = false; state.coordinator = false; ls.set(COORD, null);
  await db.wipeAll().catch(() => {});
  emit('auth');
}
export function sessionLost() {
  setToken(null); state.loggedIn = false; state.coordinator = false; ls.set(COORD, null);
  db.purgePrivate().catch(() => {}); emit('auth');
}

// Start aplikacji: sprawdź sesję na serwerze (gdy jest zasięg) i stan odblokowania koordynatora.
export async function init() {
  if (!state.loggedIn) return;
  const last = +ls.get(COORD) || 0;
  state.coordinator = last > 0 && Date.now() - last < COORD_IDLE_MS;
  if (last && !state.coordinator) await lock(false);
  try {
    const s = await api('/auth/status');
    if (state.coordinator && !s.coordinator) await lock(false);
  } catch (e) { if (!(e instanceof ApiError) || e.status !== 401) { /* offline – zostajemy zalogowani */ } }
}

// Aktywność użytkownika przedłuża odblokowanie koordynatora; po godzinie bez dotyku telefon blokuje dane osobowe.
let lastSave = 0;
function activity() {
  markActive();
  if (state.coordinator && Date.now() - lastSave > 15000) { lastSave = Date.now(); ls.set(COORD, String(lastSave)); }
}
['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((ev) => addEventListener(ev, activity, { passive: true, capture: true }));
setInterval(() => {
  if (state.coordinator && Date.now() - (+ls.get(COORD) || 0) > COORD_IDLE_MS) lock();
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.coordinator && Date.now() - (+ls.get(COORD) || 0) > COORD_IDLE_MS) lock();
});
