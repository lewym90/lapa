import { raw } from './ui-core.js';
import { boksPill, wybCls, linie, opisLine, wybPill } from './znak.js';
import { html, icon, esc, openSheet, closeSheet, toast, actions, brandBar, pageBar, dogImg, plusBtn } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName } from './auth.js';
import { gaps, siteStatus } from './teczka.js';
import { dzisItems, dzisWiersze } from './terminarz.js';
import { noweZgloszenia } from './wolontariusz.js';
import { greeting, dogOfDay, dogNeeds, fmtShort, NEED_LABELS, fmtDate } from './util.js';

const seenK = 'lapa.kseen';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

// Start administratora: komunikat, pies dnia i jedna karta „Dziś” (tylko to, co wymaga uwagi). Bez kafelków: wszystko inne jest na dolnym pasku.
export async function start() {
  const [dogs, kom, zdr, zag] = await Promise.all([list('psy'), list('komunikaty'), list('zdrowie'), list('zaginiecia')]);
  const todo = gaps(dogs, zdr), dog = dogOfDay(dogs), dzis = await dzisItems(), nZgl = await noweZgloszenia(), lost = zag.filter((z) => z.status !== 'znaleziony');
  const st = await siteStatus(), err = st && st.enabled !== false && st.ok === false ? st.blad || 'Nieznany błąd.' : null;
  kom.sort((a, b) => b.ts - a.ts);
  const kLast = kom[0], dot = !!kLast && kLast.ts > (+lsGet(seenK) || 0);
  const now = Date.now();
  const wiersz = (href, t, txt, cls = '') => `<a class="dzw${cls}" href="${esc(href)}"><span class="dzt">${esc(t)}</span><span class="dzx">${esc(txt)}</span>${icon('chev').s}</a>`;
  const rows = [
    ...lost.map((z) => wiersz('#/zaginiecia/' + z.id, 'szukamy', 'Zaginął: ' + z.imie, ' pilne')),
    ...(err ? [wiersz('#/ustawienia', 'strona', 'Serwer nie mógł sprawdzić strony schroniska', ' pilne')] : []),
    ...dzisWiersze(dzis).map((x) => wiersz(x.href, x.t, x.txt, x.late ? ' pilne' : x.done ? ' zrob' : '')),
    ...todo.map((x) => wiersz('#/psy/' + x.d.id, x.sev > 2 ? 'po terminie' : 'wkrótce', x.d.imie + ': ' + x.text, x.sev > 2 ? ' pilne' : '')),
    ...(nZgl ? [wiersz('#/zgloszenia', 'nowe', `Zgłoszenia wolontariuszy: ${nZgl}`)] : [])
  ];
  const hero = dog
    ? html`<section class="hero" aria-label="Pies dnia">${dogImg(dog.zdjecia[0], dog.imie, 'ph')}
        <div class="copy"><h2>Dziś możesz zmienić czyjś dzień</h2><div class="goldline"></div>
        <a class="dogtag" href="#/psy/${dog.id}">${icon('paw')}<span>Piesek dnia:</span> <b>${dog.imie}</b> ${raw(boksPill(dog, 'in'))} ${icon('chev')}</a>${raw(opisLine(dog, 'na-ciemnym'))}${raw(wybPill(dog, 'pill'))}</div></section>`
    : html`<section class="hero nodog"><span class="pawbig">${icon('paw')}</span>
        <div class="copy"><h2>Dziś możesz zmienić czyjś dzień</h2><div class="goldline"></div></div></section>`;
  return {
    tab: 'start', title: 'Start', live: true,
    html: html`${brandBar(dot)}
    <section class="hello"><h1>${greeting()}</h1><p>Wolontariat Schroniska dla Psów w Nowodworze</p><a class="nchip" href="#/czat" hidden>${icon('chat')}<span class="nchip-t"></span></a></section>
    ${kLast && now - kLast.ts < 7 * 864e5 ? html`<div class="pad" style="margin-top:14px"><div class="card" style="background:rgba(244,240,231,.1);color:var(--ivory);border:1px solid var(--line-l);box-shadow:none"><div class="card-head"><h3 style="color:var(--ivory);font-size:17px">${icon('bell')} Komunikat</h3><span class="hint" style="color:var(--sage)">${kLast.autor || ''} · ${fmtShort(kLast.ts)}</span></div><div style="white-space:pre-line">${kLast.tekst}</div></div></div>` : ''}
    ${hero}
    <div class="pad" style="margin-top:16px"><section class="card dzis" aria-label="Dziś"><h3>Dziś</h3>${rows.length ? raw(rows.join('')) : html`<p class="sub" style="margin:6px 0 2px">Na dziś nic. Spokojnego dnia!</p>`}</section></div>
    <div style="height:16px"></div>`,
    mount(r) { import('./photos.js').then((m) => m.hydratePhotos(r)); }
  };
}

export async function komunikatySheet() {
  const kom = (await list('komunikaty')).sort((a, b) => b.ts - a.ts).slice(0, 20);
  try { localStorage.setItem(seenK, String(Date.now())); } catch {}
  openSheet(html`<h2>Komunikaty</h2>
    ${kom.length ? kom.map((k) => html`<div class="obs"><div class="oh"><span>${k.autor || 'Schronisko'}</span><span>${fmtDate(k.ts)}</span></div><div style="white-space:pre-line">${k.tekst}</div></div>`) : html`<p class="hint" style="font-size:15px">Brak komunikatów. Gdy schronisko coś ogłosi, pojawi się tutaj i na ekranie Start.</p>`}
    ${state.admin ? html`<form id="kf" style="margin-top:16px"><div class="field"><label for="kt">Nowy komunikat dla wszystkich</label><textarea class="textarea" id="kt" maxlength="800"></textarea></div><button class="btn block" type="submit">Opublikuj</button></form>` : ''}`.s, (s) => {
    s.querySelector('#kf')?.addEventListener('submit', async (e) => {
      e.preventDefault(); const t = s.querySelector('#kt').value.trim(); if (!t) return;
      await save('komunikaty', { tekst: t, ts: Date.now(), autor: getName() }); closeSheet(); toast('Komunikat opublikowany');
    });
  });
}
