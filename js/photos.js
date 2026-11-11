// Zdjęcia zrobione w aplikacji: zapis w telefonie od razu, wysyłka na serwer w tle, wyświetlanie także offline.
import * as db from './db.js';
import { api, getToken, ApiError } from './api.js';
import { API } from './config.js';
import { uid, compressImage } from './util.js';

const urls = new Map();
export async function addPhotoFile(file, big = false) {
  const blob = big ? await compressImage(file, 2400, 0.88, 1_400_000) : await compressImage(file); // zdjęcia z sesji: większe (limit serwera 1,5 MB)
  const id = uid();
  await db.blobPut('photo:' + id, blob);
  const q = (await db.metaGet('photo_queue')) || [];
  q.push(id); await db.metaSet('photo_queue', q);
  return id;
}
export async function photoSrc(id) {
  if (urls.has(id)) return urls.get(id);
  let blob = await db.blobGet('photo:' + id);
  if (!blob) {
    if (!navigator.onLine || !getToken()) return '';
    try {
      const res = await fetch(API + '/photo/' + encodeURIComponent(id), { headers: { authorization: 'Bearer ' + getToken() }, cache: 'force-cache' });
      if (!res.ok) return '';
      blob = await res.blob(); await db.blobPut('photo:' + id, blob);
    } catch { return ''; }
  }
  const u = URL.createObjectURL(blob); urls.set(id, u); return u;
}
// <img data-photo="ID"> → podstawia zdjęcie, gdy tylko jest dostępne
export function hydratePhotos(root = document) {
  root.querySelectorAll('img[data-photo]').forEach(async (img) => {
    const u = await photoSrc(img.dataset.photo);
    if (u) img.src = u;
  });
}
export async function uploadPending() {
  let q = (await db.metaGet('photo_queue')) || [];
  const left = [];
  for (const id of q) {
    const blob = await db.blobGet('photo:' + id);
    if (!blob) continue;
    try {
      const res = await fetch(API + '/photo/' + encodeURIComponent(id), { method: 'POST', headers: { authorization: 'Bearer ' + getToken(), 'content-type': 'image/jpeg' }, body: blob });
      if (res.status === 401) { left.push(id); throw new ApiError(401, { login: true }); }
      if (!res.ok && res.status !== 409) { if (res.status >= 500 || res.status === 429) left.push(id); }
    } catch (e) { left.push(id); if (e instanceof ApiError) throw e; break; }
  }
  const rest = q.filter((id) => left.includes(id));
  await db.metaSet('photo_queue', rest);
  return rest.length;
}
export async function removeLocalPhoto(id) { urls.delete(id); await db.blobDel('photo:' + id); }
