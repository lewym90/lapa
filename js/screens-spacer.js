import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet } from './ui.js';
import { list, save, get, remove } from './store.js';
import { getName } from './auth.js';
import { fmtDate, fmtTime, hhmm, minutesText, ago, distanceKm, uid } from './util.js';
import { dogThumb } from './screens-psy.js';
import { addPhotoFile, hydratePhotos } from './photos.js';

const WK = 'lapa.walk';
const readWalk = () => { try { return JSON.parse(localStorage.getItem(WK)); } catch { return null; } };
const writeWalk = (w) => { try { w ? localStorage.setItem(WK, JSON.stringify(w)) : localStorage.removeItem(WK); } catch {} };
let watchId = null, wakeLock = null;

const GROUPS = [
  ['nastroj', 'Nastrój psa', ['spokojny', 'radosny', 'niepewny', 'zestresowany', 'inny / nie określono']],
  ['aktywnosc', 'Aktywność', ['niska', 'umiarkowana', 'wysoka', 'nie oceniono']],
  ['smycz', 'Zachowanie na smyczy', ['bez problemów', 'ciągnięcie', 'trudności', 'nie oceniono']],
  ['ludzie', 'Kontakty z ludźmi', ['pozytywne', 'neutralne', 'trudne', 'nie wystąpiły / nie testowano']],
  ['psy', 'Kontakty z psami', ['pozytywne', 'neutralne', 'trudne', 'nie wystąpiły / nie testowano']],
  ['apetyt', 'Apetyt i nagrody', ['przyjmował', 'odmawiał', 'nie dotyczy', 'nie sprawdzono']]
];

// ===== wybór psa do spaceru =====
export async function pick() {
  const w = readWalk();
  if (w) { location.hash = '#/spacer/' + w.dogId; return { tab: 'start', nav: false, html: html`` }; }
  const dogs = (await list('psy')).filter((d) => d.status !== 'adoptowany').sort((a, b) => (a.imie || '').localeCompare(b.imie || '', 'pl'));
  const walks = await list('spacery');
  const last = (id) => { const x = walks.filter((v) => v.pies_id === id); return x.length ? Math.max(...x.map((v) => v.start)) : 0; };
  return {
    tab: 'start', nav: false, title: 'Spacer', live: false,
    html: html`${pageBar('Spacer')}<div class="pad"><h2 style="font-size:28px;font-weight:500;margin:6px 0 14px">Z kim idziesz na spacer?</h2>
      <div class="search">${icon('search')}<input id="wq" type="search" placeholder="Szukaj psa po imieniu" autocomplete="off"></div>
      <label class="chip dark" style="margin:14px 0 6px;cursor:pointer"><input type="checkbox" id="gps" style="accent-color:var(--gold);width:18px;height:18px"> Mierz dystans (GPS). Ekran musi być włączony</label></div>
      <div class="pad stack" id="wl" style="margin-top:8px">${dogs.length ? '' : html`<div class="empty">${icon('paw')}<h3>Nie ma jeszcze psów</h3><a class="btn gold" href="#/psy" data-act="a-dog">Dodaj psa</a></div>`}</div>`,
    mount(root) {
      const l = root.querySelector('#wl');
      const paint = (q) => {
        l.innerHTML = dogs.filter((d) => (d.imie || '').toLowerCase().includes(q.toLowerCase())).map((d) => `<button class="row card" style="border:0" data-dog="${esc(d.id)}"><span class="avatar sm">${dogThumb(d).s}</span><span class="rt"><b>${esc(d.imie)}</b><small>${last(d.id) ? 'ostatni spacer: ' + ago(last(d.id)) : 'bez udokumentowanego spaceru'}</small></span>${icon('chev').s}</button>`).join('');
        hydratePhotos(l);
      };
      paint('');
      root.querySelector('#wq')?.addEventListener('input', (e) => paint(e.target.value));
      l.addEventListener('click', (e) => {
        const b = e.target.closest('[data-dog]'); if (!b) return;
        const d = dogs.find((x) => x.id === b.dataset.dog);
        writeWalk({ dogId: d.id, dogName: d.imie, start: Date.now(), events: [{ t: Date.now(), txt: 'Start spaceru' }], photos: [], gps: root.querySelector('#gps').checked, dist: 0, notes: [] });
        location.hash = '#/spacer/' + d.id;
      });
    }
  };
}

// ===== trwający spacer =====
export async function walk(dogId) {
  let w = readWalk();
  if (w && w.dogId !== dogId) { location.hash = '#/spacer/' + w.dogId; return { tab: 'start', nav: false, html: html`` }; }
  const d = await get('psy', dogId);
  if (!d) { writeWalk(null); location.hash = '#/spacer'; return { tab: 'start', nav: false, html: html`` }; }
  if (!w) { w = { dogId, dogName: d.imie, start: Date.now(), events: [{ t: Date.now(), txt: 'Start spaceru' }], photos: [], gps: false, dist: 0, notes: [] }; writeWalk(w); }
  return {
    tab: 'start', nav: false, title: 'Spacer', live: false,
    html: html`${pageBar('Spacer', { back: true })}
    <section class="walkhero"><div class="avatar">${dogThumb(d)}</div><h2 style="font-size:32px;margin-top:12px">${d.imie}</h2>
      <div class="pulse" style="margin-top:8px">Spacer trwa</div><div class="timer" id="timer" aria-live="off">${hhmm(Date.now() - w.start)}</div>
      <div class="hint" style="color:var(--sage)" id="dist">${w.gps ? 'Dystans: ' + w.dist.toFixed(2).replace('.', ',') + ' km' : 'Rozpoczęto o ' + fmtTime(w.start)}</div></section>
    <div class="quick">
      <button class="act" data-act="w-photo">${icon('camera')}Zdjęcie<small style="color:var(--sage)">Dodaj do raportu</small></button>
      <button class="act" data-act="w-note">${icon('pencil')}Notatka<small style="color:var(--sage)">Co zauważyłeś(-aś)</small></button>
      <button class="act" data-act="w-break">${icon('clock')}Przerwa<small style="color:var(--sage)">Woda, odpoczynek</small></button>
      <button class="act" data-act="w-dog">${icon('paw')}Spotkanie z psem<small style="color:var(--sage)">Zapisz reakcję</small></button></div>
    <div class="pad" style="margin-top:6px"><section class="card"><h3 style="font-size:18px">Przebieg</h3><ul class="tl" id="tl"></ul></section>
      <button class="btn gold block" style="margin-top:16px;min-height:60px;font-size:18px" data-act="w-end">${icon('check')} Zakończ spacer</button>
      <button class="btn line block sm" style="margin-top:10px" data-act="w-cancel">Anuluj spacer</button></div>`,
    mount(root) {
      const tl = root.querySelector('#tl'), timer = root.querySelector('#timer'), dist = root.querySelector('#dist');
      paintTl(tl);
      const iv = setInterval(() => { if (!document.body.contains(timer)) { clearInterval(iv); return; } timer.textContent = hhmm(Date.now() - readWalk().start); }, 1000);
      if (w.gps) startGps(dist);
      navigator.wakeLock?.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
    }
  };
}
function paintTl(tl) {
  const w = readWalk(); if (!w || !tl) return;
  tl.innerHTML = w.events.map((e) => `<li><span class="dotp"></span><span class="tm">${esc(fmtTime(e.t))}</span><span>${esc(e.txt)}</span></li>`).join('');
}
function addEvent(txt) { const w = readWalk(); w.events.push({ t: Date.now(), txt }); writeWalk(w); paintTl(document.getElementById('tl')); }
function startGps(el) {
  if (!navigator.geolocation || watchId != null) return;
  let prev = null;
  watchId = navigator.geolocation.watchPosition((p) => {
    if (p.coords.accuracy > 35) return;
    const cur = { lat: p.coords.latitude, lon: p.coords.longitude };
    if (prev) { const km = distanceKm(prev, cur); if (km * 1000 >= 8 && km * 1000 < 400) { const w = readWalk(); w.dist += km; writeWalk(w); prev = cur; if (el) el.textContent = 'Dystans: ' + w.dist.toFixed(2).replace('.', ',') + ' km'; } } else prev = cur;
  }, () => toast('GPS niedostępny. Dystans możesz wpisać na końcu', true), { enableHighAccuracy: true, maximumAge: 5000 });
}
function stopGps() { if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null; wakeLock?.release?.().catch(() => {}); wakeLock = null; }

actions['w-photo'] = () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
  inp.onchange = async () => { if (!inp.files[0]) return; try { const id = await addPhotoFile(inp.files[0]); const w = readWalk(); w.photos.push(id); writeWalk(w); addEvent('Zdjęcie'); toast('Zdjęcie dodane'); } catch (e) { toast(e.message, true); } };
  inp.click();
};
actions['w-note'] = () => openSheet(`<h2>Notatka ze spaceru</h2><form id="nf2"><div class="field"><textarea class="textarea" id="wn" maxlength="800" placeholder="Co zauważyłeś(-aś)?"></textarea></div><button class="btn block" type="submit">Dodaj</button></form>`, (s) => {
  s.querySelector('#nf2').addEventListener('submit', (e) => { e.preventDefault(); const t = s.querySelector('#wn').value.trim(); if (!t) return; const w = readWalk(); w.notes.push(t); writeWalk(w); addEvent('Notatka: ' + (t.length > 60 ? t.slice(0, 57) + '…' : t)); closeSheet(); });
  s.querySelector('#wn').focus();
});
actions['w-break'] = () => { addEvent('Przerwa: woda, odpoczynek'); toast('Zapisano'); };
actions['w-dog'] = () => { addEvent('Spotkanie z innym psem'); toast('Zapisano. Opisz reakcję w notatce'); };
actions['w-cancel'] = async () => { if (await confirmSheet('Anulować spacer?', 'Nic nie zostanie zapisane w historii psa.', 'Anuluj spacer', true)) { stopGps(); writeWalk(null); location.hash = '#/psy'; } };
actions['w-end'] = () => {
  const w = readWalk(); const end = Date.now(); const sel = {};
  openSheet(`<h2>Jak poszło?</h2><p class="hint" style="margin:0 0 12px">Czas: ${esc(minutesText((end - w.start) / 60000))}. Zaznacz tylko to, co wiesz. Resztę możesz pominąć.</p>
    <form id="rf" novalidate>${GROUPS.map(([k, l, o]) => `<div class="field"><span class="lbl">${l}</span><div class="chips" data-g="${k}">${o.map((x) => `<button type="button" class="chip outline" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`).join('')}
    <div class="field"><label for="rd">Dystans (km, opcjonalnie)</label><input class="input" id="rd" inputmode="decimal" placeholder="np. 2,5" value="${w.dist > 0.05 ? w.dist.toFixed(1).replace('.', ',') : ''}"></div>
    <div class="field"><label for="rn">Notatka ze spaceru</label><textarea class="textarea" id="rn" maxlength="1500">${esc(w.notes.join('\n'))}</textarea></div>
    <div class="err" id="re"></div><button class="btn gold block" type="submit" style="min-height:58px">${icon('check').s} Zapisz raport</button></form>`, (s) => {
    s.querySelectorAll('[data-g]').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return; const on = !b.classList.contains('on');
      g.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); if (on) { b.classList.add('on'); sel[g.dataset.g] = b.dataset.v; } else delete sel[g.dataset.g];
    }));
    s.querySelector('#rf').addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = s.querySelector('button[type=submit]'); btn.disabled = true;
      const km = parseFloat(s.querySelector('#rd').value.replace(',', '.'));
      if (s.querySelector('#rd').value && !(km >= 0 && km < 60)) { s.querySelector('#re').textContent = 'Dystans wpisz jako liczbę, np. 2,5.'; btn.disabled = false; return; }
      const events = [...w.events, { t: end, txt: 'Koniec spaceru' }];
      const rec = { id: 'w' + uid(), pies_id: w.dogId, pies_imie: w.dogName, start: w.start, end, czas_min: (end - w.start) / 60000, dystans_km: km > 0 ? km : 0, ...sel, notatka: s.querySelector('#rn').value.trim(), os_czasu: events, zdjecia: w.photos, autor: getName() };
      await save('spacery', rec); stopGps(); writeWalk(null); closeSheet(); toast('Raport zapisany. Dziękujemy!'); location.hash = '#/raport/' + rec.id;
    });
  });
};

// ===== raport ze spaceru =====
export async function report(id) {
  const w = await get('spacery', id);
  if (!w) return { tab: 'start', nav: false, html: html`${pageBar('Raport')}<div class="empty"><h3>Nie ma takiego raportu</h3></div>` };
  const d = await get('psy', w.pies_id);
  const tags = GROUPS.filter(([k]) => w[k]).map(([k, l]) => html`<span class="chip">${l}: ${w[k]}</span>`);
  return {
    tab: 'start', nav: false, title: 'Raport ze spaceru',
    html: html`${pageBar('Raport ze spaceru')}<div class="pad"><section class="card" style="padding:18px">
      <div style="display:flex;gap:14px;align-items:center"><span class="avatar sm">${d ? dogThumb(d) : html`<div class="nophoto">${icon('paw')}</div>`}</span>
        <div><h2 style="font-size:26px;color:var(--graphite)">${w.pies_imie}</h2><div class="sub">Spacer · ${fmtDate(w.start)} · ${w.autor || ''}</div></div></div>
      <ul class="tl" style="margin-top:14px">${(w.os_czasu || []).map((e) => html`<li><span class="dotp"></span><span class="tm">${fmtTime(e.t)}</span><span>${e.txt}</span></li>`)}</ul>
      <div class="stats"><div class="stat">${icon('route')}<div><small>Dystans</small><b>${w.dystans_km ? w.dystans_km.toFixed(1).replace('.', ',') + ' km' : '—'}</b></div></div>
        <div class="stat">${icon('clock')}<div><small>Czas</small><b>${minutesText(w.czas_min || 0)}</b></div></div></div>
      ${tags.length ? html`<div class="chips" style="margin-bottom:14px">${tags}</div>` : ''}
      <h3 style="font-size:18px;margin:6px 0 8px;display:flex;justify-content:space-between">Notatka ze spaceru <button class="iconbtn" style="width:32px;height:32px;color:var(--green)" data-act="rep-note" data-id="${id}" aria-label="Edytuj notatkę">${icon('pencil')}</button></h3>
      <div class="notebox">${w.notatka || 'Bez notatki.'}</div>
      ${(w.zdjecia || []).length ? html`<h3 style="font-size:18px;margin:16px 0 8px">Zdjęcia (${w.zdjecia.length})</h3><div class="thumbs">${w.zdjecia.map((p) => html`<div class="thumb"><img data-photo="${p}" alt="Zdjęcie ze spaceru" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>`)}</div>` : ''}
      ${w.osoba ? html`<p class="sub" style="margin:8px 0">Kto szedł: ${w.osoba}</p>` : ''}${(w.tagi || []).length ? html`<div class="chips" style="margin-bottom:10px">${w.tagi.map((t) => html`<span class="chip">${t}</span>`)}</div>` : ''}
      <a class="btn block" style="margin-top:20px" href="#/psy/${w.pies_id}">${icon('check')} Gotowe</a>
      <button class="btn ghost block" style="margin-top:10px;color:var(--terra-d)" data-act="rep-del" data-id="${id}">Usuń ten spacer (pomyłka)</button></section></div>`,
    mount(root) { hydratePhotos(root); }
  };
}
actions['rep-del'] = async (el) => {
  const w = await get('spacery', el.dataset.id); if (!w) return;
  if (await confirmSheet('Usunąć spacer?', `Spacer psa ${w.pies_imie} zniknie z historii u wszystkich wolontariuszy.`, 'Usuń', true)) { await remove('spacery', w.id); toast('Usunięto'); location.hash = '#/psy/' + w.pies_id; }
};
actions['rep-note'] = async (el) => {
  const w = await get('spacery', el.dataset.id);
  openSheet(`<h2>Notatka ze spaceru</h2><form id="en"><div class="field"><textarea class="textarea" id="et" maxlength="1500">${esc(w.notatka || '')}</textarea></div><button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    s.querySelector('#en').addEventListener('submit', async (e) => { e.preventDefault(); w.notatka = s.querySelector('#et').value.trim(); await save('spacery', w); closeSheet(); toast('Zapisane'); dispatchEvent(new HashChangeEvent('hashchange')); });
  });
};
