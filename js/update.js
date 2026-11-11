// Aktualizacje: porównuje wersję uruchomioną z wersją opublikowaną (version.json) i odświeża aplikację.
import { VERSION } from './config.js';
import { toast } from './ui.js';

const KEY_DONE = 'lapa.updated', KEY_TRY = 'lapa.updtry';
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

export async function remoteVersion() {
  const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('http ' + r.status);
  return String((await r.json()).version || '');
}

async function applyUpdate(v) {
  ls.set(KEY_DONE, v);
  ls.set(KEY_TRY, v + '|' + Date.now());
  try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch {}
  location.reload();
}

// manual=true: przycisk w Ustawieniach. auto: start i powrót do aplikacji.
export async function checkUpdate({ manual = false } = {}) {
  let v;
  try { v = await remoteVersion(); } catch { if (manual) toast('Brak połączenia – nie sprawdzę aktualizacji', true); return 'offline'; }
  if (!v || v === VERSION) { if (manual) toast('Masz najnowszą wersję ' + VERSION); return 'current'; }
  if (!manual) { // ochrona przed pętlą odświeżania (np. opóźnienie sieci dostarczania plików)
    const [tv, ts] = (ls.get(KEY_TRY) || '').split('|');
    if (tv === v && Date.now() - Number(ts) < 120000) return 'wait';
  }
  const busy = document.querySelector('#sheet-root .sheet') || location.hash.startsWith('#/spacer');
  if (!manual && busy && document.visibilityState === 'visible' && window.__lapaStarted) { showBanner(v); return 'later'; }
  toast('Aktualizuję do wersji ' + v + '…');
  setTimeout(() => applyUpdate(v), manual ? 400 : 150);
  return 'updating';
}

function showBanner(v) {
  if (document.getElementById('upd')) return;
  const b = document.createElement('button');
  b.id = 'upd'; b.className = 'btn gold'; b.textContent = 'Jest nowa wersja ' + v + ' – dotknij, aby odświeżyć';
  b.style.cssText = 'position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top) + 8px);z-index:90;box-shadow:0 8px 24px rgba(0,0,0,.35)';
  b.onclick = () => applyUpdate(v);
  document.body.appendChild(b);
}

export function initUpdates() {
  const done = ls.get(KEY_DONE);
  if (done) { ls.del(KEY_DONE); if (done === VERSION) setTimeout(() => toast('Zaktualizowano do wersji ' + VERSION + ' ✓'), 600); }
  checkUpdate();
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (Date.now() - hiddenAt > 60e3 || !hiddenAt) { window.__lapaStarted = true; checkUpdate(); }
  });
  setInterval(() => { if (document.visibilityState === 'visible') checkUpdate(); }, 30 * 60e3);
  window.__lapaStarted = true;
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => {
    // nowy service worker przejął kontrolę – pliki w pamięci są już świeże, kolejna kontrola wersji zadecyduje o odświeżeniu
    checkUpdate();
  });
}
