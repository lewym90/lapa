// Zaginione psy: karta alarmowa, tekst posta z aktualizacjami, plakat do wydruku.
import { html, icon, esc, openSheet, closeSheet, toast, actions, pageBar, safeUrl, confirmSheet } from './ui.js';
import { list, save, remove, get } from './store.js';
import { getName } from './auth.js';
import { fmtDate } from './util.js';
import { dogThumb } from './screens-psy.js';
import { hydratePhotos } from './photos.js';

const KONTAKT_DOM = '601 990 017, 667 119 073';
const d10 = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dm = (t) => { const d = new Date(t); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); };
export const aktywne = (z) => z.status !== 'znaleziony';

export function postZ(z) {
  const upd = (z.akt || []).map((a) => `EDIT: ${dm(a.ts)} ${a.text}`).reverse().join('\n');
  return `${upd ? upd + '\n\n' : ''}🆘 SZUKAMY ${String(z.imie || '').toUpperCase()} 🆘\n🔴 Zaginął(a) ${z.gdzie ? 'w miejscowości ' + z.gdzie : ''}${z.kiedy ? ', ' + dm(z.kiedy) : ''}.${z.ostatnio ? ' Ostatnio widziany(a): ' + z.ostatnio + '.' : ''}\n💚 ${z.opis || 'Szczegóły wyglądu w komentarzu.'}\n🐶 ${z.rada || 'Nie goń. Spróbuj zwabić jedzeniem na ogrodzony teren, zrób zdjęcie i zadzwoń.'}\n☎️ ${z.kontakt || KONTAKT_DOM}`;
}

export async function zaginiecia() {
  const [zs, dogs] = await Promise.all([list('zaginiecia'), list('psy')]); const byId = Object.fromEntries(dogs.map((d) => [d.id, d]));
  const a = zs.filter(aktywne).sort((x, y) => y.kiedy - x.kiedy), f = zs.filter((z) => !aktywne(z)).sort((x, y) => y.znaleziony_ts - x.znaleziony_ts);
  const card = (z) => html`<div class="card gap"><button class="gi" data-act="zag-open" data-id="${z.id}" style="text-align:left;background:none;border:0;padding:0"><span class="gp">${byId[z.pies_id] ? dogThumb(byId[z.pies_id]) : icon('paw')}</span><span class="rt"><b>${z.imie}</b><small>${aktywne(z) ? 'Zaginął(a) ' + fmtDate(z.kiedy) + (z.ostatnio ? ' · ' + z.ostatnio : '') : 'Znaleziony(a) ' + fmtDate(z.znaleziony_ts)}</small></span></button></div>`;
  return { tab: 'start', title: 'Zaginięcia', live: true,
    html: html`${pageBar('Zaginięcia', { right: html`<button class="iconbtn" data-act="zag-new" aria-label="Zgłoś zaginięcie">${icon('plus')}</button>` })}
    <div class="pad stack">${a.length ? a.map(card) : html`<div class="empty">${icon('check')}<h3>Nikt nie jest teraz poszukiwany</h3><p>Zgłoś zaginięcie przyciskiem +. Aplikacja przygotuje post i plakat.</p></div>`}
    ${f.length ? html`<h3 style="color:var(--sage);margin:16px 0 0">Odnalezione</h3>${f.slice(0, 10).map(card)}` : ''}</div>`,
    mount(r) { hydratePhotos(r); } };
}
actions['zag-new'] = async () => {
  const dogs = (await list('psy')).filter((d) => d.miejsce !== 'adoptowany' || true).sort((x, y) => (x.imie || '').localeCompare(y.imie || '', 'pl'));
  form({ kiedy: Date.now(), kontakt: KONTAKT_DOM }, dogs);
};
async function form(z, dogs) {
  openSheet(`<h2>Zaginął pies</h2><form id="zf" novalidate>
    <div class="field"><label for="z_p">Pies z aplikacji (lub „inny”)</label><select class="select" id="z_p"><option value="">Inny pies (wpiszę imię)</option>${dogs.map((d) => `<option value="${esc(d.id)}" ${d.id === z.pies_id ? 'selected' : ''}>${esc(d.imie)}</option>`).join('')}</select></div>
    <div class="field"><label for="z_i">Imię</label><input class="input" id="z_i" maxlength="40" value="${esc(z.imie || '')}"></div>
    <div class="field"><label for="z_k">Kiedy zaginął</label><input class="input" id="z_k" type="date" value="${d10(z.kiedy)}"></div>
    <div class="field"><label for="z_g">Gdzie zaginął (miejscowość)</label><input class="input" id="z_g" maxlength="80" value="${esc(z.gdzie || '')}"></div>
    <div class="field"><label for="z_o">Ostatnio widziany</label><input class="input" id="z_o" maxlength="120" value="${esc(z.ostatnio || '')}"></div>
    <div class="field"><label for="z_d">Jak wygląda, jaki jest (obroża, znaki, płochliwy…)</label><textarea class="textarea" id="z_d" maxlength="400">${esc(z.opis || '')}</textarea></div>
    <div class="field"><label for="z_t">Telefony kontaktowe w tej sprawie</label><input class="input" id="z_t" maxlength="80" value="${esc(z.kontakt || KONTAKT_DOM)}"></div>
    <div class="err" id="z_x"></div><p class="hint" style="margin:0 0 10px">Aplikacja niczego nie publikuje. Zapisze zgłoszenie u wolontariuszy i pokaże gotowy tekst, który sam skopiujesz i wstawisz, gdzie zechcesz.</p><button class="btn block" type="submit">Zapisz i pokaż gotowy tekst</button></form>`, (s) => {
    const sel = s.querySelector('#z_p'); sel.onchange = () => { const d = dogs.find((x) => x.id === sel.value); if (d) s.querySelector('#z_i').value = d.imie; };
    s.querySelector('#zf').addEventListener('submit', async (e) => {
      e.preventDefault(); const imie = s.querySelector('#z_i').value.trim(); if (!imie) { s.querySelector('#z_x').textContent = 'Wpisz imię.'; return; }
      const pid = sel.value, o = { ...z, pies_id: pid || null, imie, kiedy: new Date(s.querySelector('#z_k').value + 'T12:00').getTime(), gdzie: s.querySelector('#z_g').value.trim(), ostatnio: s.querySelector('#z_o').value.trim(), opis: s.querySelector('#z_d').value.trim(), kontakt: s.querySelector('#z_t').value.trim(), status: 'poszukiwany', akt: z.akt || [], autor: z.autor || getName() };
      const saved = await save('zaginiecia', o);
      if (pid) { const d = await get('psy', pid); if (d && d.miejsce !== 'zaginiony') await save('psy', { ...d, poprz_miejsce: d.miejsce || 'schronisko', miejsce: 'zaginiony' }); }
      closeSheet(); toast('Zapisane'); actions['zag-open']({ dataset: { id: saved.id } });
    });
  });
}
actions['zag-open'] = async (el) => {
  const z = await get('zaginiecia', el.dataset.id); if (!z) return;
  openSheet(`<h2>${esc(z.imie)}${aktywne(z) ? '' : ' (znaleziony)'}</h2><p class="sub" style="margin:0 0 8px">Zaginął(a) ${esc(fmtDate(z.kiedy))}${z.gdzie ? ' · ' + esc(z.gdzie) : ''}</p>
    <div class="field"><label for="z_pt">Gotowy post (możesz poprawić)</label><textarea class="textarea" id="z_pt" style="min-height:200px"></textarea></div>
    <div class="btnrow"><button class="btn" id="z_c">Kopiuj</button><button class="btn ghost" id="z_s">Wyślij…</button></div>
    <div class="btnrow" style="margin-top:8px"><button class="btn ghost" id="z_pl">Plakat do wydruku</button><a class="btn ghost" id="z_wa" target="_blank" rel="noopener">WhatsApp</a></div>
    ${aktywne(z) ? `<div class="field" style="margin-top:14px"><label for="z_u">Aktualizacja (np. widziany w Wólce)</label><input class="input" id="z_u" maxlength="200"><button class="btn ghost block sm" style="margin-top:6px" id="z_ua">Dodaj aktualizację do posta</button></div>
    <button class="btn gold block" style="margin-top:12px" id="z_f">Znaleziony! 🎉</button>` : ''}
    <div class="btnrow" style="margin-top:12px"><button class="btn ghost" id="z_e">Edytuj</button><button class="btn ghost" style="color:var(--terra-d)" id="z_x">Usuń</button></div>`, async (s) => {
    const t = s.querySelector('#z_pt'); t.value = postZ(z); const wa = () => { s.querySelector('#z_wa').href = 'https://wa.me/?text=' + encodeURIComponent(t.value); }; wa(); t.oninput = wa;
    s.querySelector('#z_c').onclick = async () => { try { await navigator.clipboard.writeText(t.value); toast('Skopiowano'); } catch { t.select(); } };
    s.querySelector('#z_s').onclick = async () => { if (navigator.share) { try { await navigator.share({ text: t.value }); } catch {} } else { try { await navigator.clipboard.writeText(t.value); toast('Skopiowano'); } catch {} } };
    s.querySelector('#z_pl').onclick = () => plakat(z);
    s.querySelector('#z_ua')?.addEventListener('click', async () => { const v = s.querySelector('#z_u').value.trim(); if (!v) return; await save('zaginiecia', { ...z, akt: [...(z.akt || []), { ts: Date.now(), text: v, autor: getName() }] }); closeSheet(); actions['zag-open'](el); });
    s.querySelector('#z_f')?.addEventListener('click', async () => {
      await save('zaginiecia', { ...z, status: 'znaleziony', znaleziony_ts: Date.now() });
      if (z.pies_id) { const d = await get('psy', z.pies_id); if (d && d.miejsce === 'zaginiony') await save('psy', { ...d, miejsce: d.poprz_miejsce || 'schronisko' }); }
      closeSheet(); toast('Super wiadomość! Zapisane');
    });
    s.querySelector('#z_e').onclick = async () => { closeSheet(); form(z, (await list('psy')).sort((x, y) => (x.imie || '').localeCompare(y.imie || '', 'pl'))); };
    s.querySelector('#z_x').onclick = async () => { if (await confirmSheet('Usunąć zgłoszenie?', 'Zniknie u wszystkich.', 'Usuń', true)) { await remove('zaginiecia', z.id); closeSheet(); toast('Usunięto'); } };
  });
};
async function plakat(z) {
  const d = z.pies_id ? await get('psy', z.pies_id) : null; const pic = d && (d.zdjecia || [])[0];
  const box = document.createElement('div'); box.className = 'printonly';
  box.innerHTML = `<div style="font-family:Arial,sans-serif;text-align:center;padding:10mm;max-width:190mm;margin:auto;color:#111">
    <div style="font-size:72px;font-weight:900;color:#b00020;letter-spacing:.04em">ZAGINĄŁ PIES</div>
    <div style="font-size:54px;font-weight:800;margin:6px 0">${esc(String(z.imie).toUpperCase())}</div>
    ${pic && safeUrl(pic) ? `<img src="${esc(safeUrl(pic))}" referrerpolicy="no-referrer" style="width:100%;max-height:300px;object-fit:cover;border-radius:10px;margin:8px 0">` : ''}
    <div style="font-size:24px;margin:10px 0">${esc(z.opis || '')}</div>
    <div style="font-size:22px">Zaginął(a) ${esc(dm(z.kiedy))}${z.gdzie ? ', ' + esc(z.gdzie) : ''}${z.ostatnio ? '.<br>Ostatnio widziany(a): ' + esc(z.ostatnio) : ''}</div>
    <div style="font-size:21px;margin:14px 0;font-weight:700">${esc(z.rada || 'Nie goń. Zwab jedzeniem, zrób zdjęcie i zadzwoń.')}</div>
    <div style="font-size:46px;font-weight:900;border:6px solid #b00020;border-radius:12px;padding:10px;margin-top:10px">${esc(z.kontakt || KONTAKT_DOM)}</div>
    <div style="font-size:15px;margin-top:10px;color:#444">Wolontariat Schroniska dla Psów w Nowodworze</div></div>`;
  document.body.appendChild(box);
  const im = box.querySelector('img'); if (im && !im.complete) await Promise.race([new Promise((r) => { im.onload = im.onerror = r; }), new Promise((r) => setTimeout(r, 4000))]);
  const done = () => { box.remove(); removeEventListener('afterprint', done); }; addEventListener('afterprint', done); print();
}
export async function aktywneLiczba() { return (await list('zaginiecia')).filter(aktywne).length; }
