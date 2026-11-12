// Plakat jako obraz (PNG): działa tak samo na iPhone, Androidzie i komputerze.
// Rysowany na canvas, więc można go zapisać, wydrukować albo wrzucić na Facebooka.
import { esc, toast, safeUrl } from './ui.js';
import { photoSrc } from './photos.js';

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); }; // starsze przeglądarki: prostokąt zamiast zaokrąglenia
}
const W = 1240, H = 1754, RED = '#b00020', INK = '#111';
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function loadImg(src, cors) {
  return new Promise((res) => {
    const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.referrerPolicy = 'no-referrer';
    const t = setTimeout(() => res(null), 6000);
    i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); res(null); }; i.src = src;
  });
}
// zdjęcie psa: najpierw własne (lokalne), potem z internetu (jeśli strona pozwala na użycie w obrazie)
export async function zdjecieDoPlakatu(d) {
  const mine = d && (d.moje_zdjecia || []);
  const first = d && d.glowne && mine && mine.includes(d.glowne) ? d.glowne : mine && mine[0];
  if (first) { try { const s = await photoSrc(first); const i = s && await loadImg(s); if (i) return i; } catch { /* dalej */ } }
  const u = d && (d.zdjecia || [])[0];
  if (u && safeUrl(u)) return await loadImg(safeUrl(u), true);
  return null;
}
function wrap(c, text, x, y, maxW, lh, maxLines = 99) {
  const lines = []; for (const para of String(text || '').split('\n')) {
    let line = ''; for (const w of para.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line);
  }
  const cut = lines.slice(0, maxLines); if (lines.length > maxLines) cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  cut.forEach((l, k) => c.fillText(l, x, y + k * lh)); return y + cut.length * lh;
}
function cover(c, im, x, y, w, h, r) {
  c.save(); c.beginPath(); c.roundRect(x, y, w, h, r); c.clip();
  const s = Math.max(w / im.width, h / im.height), dw = im.width * s, dh = im.height * s;
  c.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); c.restore();
}
export function rysujPlakat(z, im, dm) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = INK;
  const F = (px, w = 700) => { c.font = `${w} ${px}px Arial, Helvetica, sans-serif`; };
  c.fillStyle = RED; c.fillRect(0, 0, W, 190); c.fillStyle = '#fff'; F(132, 900); c.fillText('ZAGINĄŁ PIES', W / 2, 140);
  c.fillStyle = INK; let nm = String(z.imie || '').toUpperCase(); let px = 120; F(px, 900); while (c.measureText(nm).width > W - 120 && px > 50) { px -= 6; F(px, 900); }
  c.fillText(nm, W / 2, 330);
  let y = 370; const k = im ? 1 : 1.4;
  if (im) { const h = 640; cover(c, im, 70, y, W - 140, h, 28); y += h + 50; } else y += 20;
  c.fillStyle = INK; F(40 * k, 400); if (z.opis) y = wrap(c, z.opis, W / 2, y + 40, W - 160, 52 * k, 5) + 10;
  F(42 * k, 400); const kiedy = `Zaginął(a) ${dm(z.kiedy)}${z.gdzie ? ', ' + z.gdzie : ''}`; y = wrap(c, kiedy, W / 2, y + 40, W - 160, 54 * k, 3);
  if (z.ostatnio) { y = wrap(c, 'Ostatnio widziany(a): ' + z.ostatnio, W / 2, y + 6, W - 160, 54 * k, 3); }
  F(38 * k, 800); y = wrap(c, z.rada || 'Nie goń. Zwab jedzeniem, zrób zdjęcie i zadzwoń.', W / 2, y + 60, W - 180, 50 * k, 3);
  const by = Math.max(y + 40, H - 380), bh = 190;
  c.lineWidth = 12; c.strokeStyle = RED; c.beginPath(); c.roundRect(60, by, W - 120, bh, 24); c.stroke();
  const tel = z.kontakt || ''; px = 92; F(px, 900); while (c.measureText(tel).width > W - 200 && px > 36) { px -= 4; F(px, 900); }
  c.fillStyle = INK; c.fillText(tel, W / 2, by + bh / 2 + px * 0.35);
  c.fillStyle = '#444'; F(30, 400); c.fillText('Wolontariat Schroniska dla Psów w Nowodworze', W / 2, H - 50);
  return cv;
}

// Podgląd: obraz + Zamknij / Udostępnij / Pobierz / Drukuj / Zmień zdjęcie
export async function pokazObraz({ title, plik, rysuj, zmienZdjecie }) {
  document.querySelector('.ppv')?.remove();
  const box = document.createElement('div'); box.className = 'ppv ppv-img';
  box.innerHTML = `<div class="ppv-bar"><button class="btn ghost" data-ppv="x">Zamknij</button><b>${esc(title)}</b><span style="width:76px"></span></div>
    <div class="ppv-body"><img class="ppv-pic" alt="${esc(title)}"><div class="ppv-btns"></div>
    <p class="ppv-hint">${IOS ? 'Aby zapisać: przytrzymaj obraz i wybierz „Dodaj do Zdjęć”, albo użyj „Udostępnij”.' : 'Obraz zapisze się jako plik PNG, gotowy do wydruku lub publikacji.'}</p></div>`;
  document.body.appendChild(box); document.documentElement.classList.add('ppv-open');
  const img = box.querySelector('.ppv-pic'), btns = box.querySelector('.ppv-btns'); let blob = null, url = null;
  const close = () => { box.remove(); document.documentElement.classList.remove('ppv-open'); if (url) URL.revokeObjectURL(url); document.removeEventListener('keydown', onKey); window.removeEventListener('hashchange', close); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey); window.addEventListener('hashchange', close);
  const build = async () => {
    const cv = await rysuj(); blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!blob) { toast('Nie udało się utworzyć obrazu', true); return; }
    if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob); img.src = url;
    const file = new File([blob], plik, { type: 'image/png' });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    btns.innerHTML = (canShare ? '<button class="btn gold" data-ppv="s">Udostępnij / zapisz</button>' : '')
      + (!IOS ? `<a class="btn ${canShare ? 'ghost' : 'gold'}" data-ppv="d" href="${url}" download="${esc(plik)}">Pobierz obraz</a>` : '')
      + '<button class="btn ghost" data-ppv="p">Drukuj</button>'
      + (zmienZdjecie ? '<button class="btn ghost" data-ppv="f">Zmień zdjęcie</button>' : '');
    btns.querySelector('[data-ppv="s"]')?.addEventListener('click', async () => {
      try { await navigator.share({ files: [file], title }); } catch (e) { if (e.name !== 'AbortError') toast('Nie udało się udostępnić', true); }
    });
  };
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ppv]'); if (!b) return;
    if (b.dataset.ppv === 'x') close();
    else if (b.dataset.ppv === 'p') { try { window.print(); } catch { toast('Drukowanie niedostępne. Zapisz obraz i wydrukuj go z galerii', true); } }
    else if (b.dataset.ppv === 'f') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const u = URL.createObjectURL(f); const im = await loadImg(u); if (im) { zmienZdjecie(im); await build(); } else toast('Nie udało się odczytać zdjęcia', true); URL.revokeObjectURL(u); };
      inp.click();
    }
  });
  await build();
  return { close };
}
