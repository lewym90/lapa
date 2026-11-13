// Nowe psy: karta przyjęcia, która rośnie tygodniami. Każdy krok zapisuje się od razu, można do niego wracać.
// Pies ma kartę w sekcji Psy od chwili wpisania imienia. Gdy komplet wymaganych kroków jest gotowy, znika z tej listy.
import { html, icon, esc, openSheet, closeSheet, toast, actions, pageBar, plusBtn } from './ui.js';
import { list, save, get } from './store.js';
import { on } from './bus.js';
import { state } from './auth.js';
import { fmtDate, MS_DAY } from './util.js';
import { dogThumb, addPhoto, obsForm } from './screens-psy.js';
import { hydratePhotos } from './photos.js';
import { wToku, kroki, kompletna, zaufanieAktywne, KANALY } from './teczka.js';

const dniOd = (t) => Math.max(0, Math.floor((Date.now() - t) / MS_DAY));
const plural = (n, a, b, c) => (n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
const d10 = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const hasloPlain = (d) => String(d.haslo || '').replace(/^.*?\s[-–—]\s/, '').trim();

// ---------- plakietka w menu i automatyczne zamknięcie kompletnej karty ----------
let badgeT;
export function refreshNowe() {
  clearTimeout(badgeT);
  badgeT = setTimeout(async () => {
    if (!state.loggedIn) return;
    const n = (await list('psy')).filter(wToku).length;
    document.querySelectorAll('.nbadge').forEach((el) => { el.textContent = String(n); el.hidden = n === 0; el.setAttribute('aria-label', n + ' w toku'); });
  }, 150);
}
// Zapisujemy najnowszą wersję psa tuż przed zmianą, żeby dwie osoby uzupełniające różne kroki nie nadpisały sobie pól.
async function zmien(id, fn) {
  const d = await get('psy', id); if (!d) throw new Error('Nie ma takiego psa');
  const n = fn({ ...d }); await save('psy', n); return n;
}
async function zamknijGotowe(announceId) {
  for (const d of await list('psy')) {
    if (wToku(d) && !d.karta_otwarta && kompletna(d)) {
      await save('psy', { ...d, karta_gotowa: Date.now() });
      if (announceId === d.id || location.hash === '#/nowe/' + d.id) toast(`Karta ${d.imie} jest kompletna. Pies jest teraz w sekcji Psy`);
    }
  }
  refreshNowe();
}
let wt;
on('change', () => { clearTimeout(wt); wt = setTimeout(() => { if (state.loggedIn) zamknijGotowe().catch(() => {}); }, 700); });

// ---------- lista: Nowe psy ----------
export async function nowe() {
  const [dogs, walks, zdr] = await Promise.all([list('psy'), list('spacery'), list('zdrowie')]);
  const items = dogs.filter(wToku).sort((a, b) => (b.dodany || 0) - (a.dodany || 0));
  return {
    tab: 'psy', title: 'Nowe psy', live: true,
    html: html`${pageBar('Nowe psy', { right: plusBtn('a-newdog', 'Nowy pies') })}
    <div class="pad stack"><p class="hint" style="color:var(--sage);margin:0">Psy, których karta jeszcze rośnie. Wpisujesz jeden krok, zamykasz i wracasz, kiedy się uda: za dzień, za tydzień, za miesiąc. Gdy wymagane kroki są gotowe, pies zostaje już tylko w sekcji Psy. Każdy pies ma kartę w sekcji Psy od pierwszego dnia.</p>
    ${items.length ? items.map((d) => {
      const w = walks.filter((x) => x.pies_id === d.id), st = kroki(d, { walks: w, zdr: zdr.filter((z) => z.pies_id === d.id) });
      const br = st.filter((x) => x.req && !x.done).map((x) => x.l.toLowerCase());
      const trust = zaufanieAktywne(d, w);
      return html`<a class="row card" style="border:0" href="#/nowe/${d.id}"><span class="avatar sm">${dogThumb(d)}</span><span class="rt"><b>${d.imie}</b><small>${st.filter((x) => x.done).length} z ${st.length}${trust ? ' · zdobywamy zaufanie od ' + dniOd(d.zaufanie) + ' ' + plural(dniOd(d.zaufanie), 'dnia', 'dni', 'dni') : ''}${br.length ? ' · brakuje: ' + br.join(', ') : ''}</small></span>${icon('chev')}</a>`;
    }) : html`<div class="empty">${icon('paw')}<h3>Nie ma psów w toku</h3><p>Nowego psa dodasz przyciskiem + u góry albo dużym plusem na dole.</p></div>`}</div>`,
    mount(root) { hydratePhotos(root); }
  };
}

// ---------- ekran kroków jednego psa ----------
function opis(d, s, ctx) {
  const k = d.kanaly || {};
  switch (s.k) {
    case 'przyjecie': return s.done ? [d.plec === 'suka' ? 'Suka' : 'Samiec', [d.wiek, d.wielkosc].filter(Boolean).join(', '), 'przyjęty ' + fmtDate(d.data_przyjecia)].filter(Boolean).join(' · ') : 'Uzupełnij: ' + [!d.plec && 'płeć', !(d.wiek || d.wielkosc) && 'wiek lub wielkość', !d.data_przyjecia && 'datę'].filter(Boolean).join(', ');
    case 'zaufanie': return s.now ? `Zdobywamy zaufanie od ${dniOd(d.zaufanie)} ${plural(dniOd(d.zaufanie), 'dnia', 'dni', 'dni')}` : ctx.walks.length ? `${ctx.walks.length} ${plural(ctx.walks.length, 'spacer', 'spacery', 'spacerów')}` : 'Jeszcze bez spaceru. Bez pośpiechu';
    case 'zdrowie': return ctx.zdr.length ? `${ctx.zdr.length} ${plural(ctx.zdr.length, 'wpis', 'wpisy', 'wpisów')}` : 'Szczepienia, odrobaczanie, kastracja, czip';
    case 'charakter': return d.ocena ? 'Ocena zapisana' : s.skipped ? 'Pominięte na razie' : 'Po pierwszych spacerach';
    case 'wyglad': return [d.waga && 'waga ' + d.waga, d.wzrost && 'wzrost ' + d.wzrost, d.siersc, (d.tagi || []).join(', ')].filter(Boolean).join(' · ') || 'Waga, wzrost, sierść, cechy';
    case 'zdjecia': { const n = (d.zdjecia || []).length + (d.moje_zdjecia || []).length; return n ? `${n} ${plural(n, 'zdjęcie', 'zdjęcia', 'zdjęć')}` : 'Brak zdjęć'; }
    case 'opis': return (d.opis || '').trim() ? (d.opis.trim().length > 70 ? d.opis.trim().slice(0, 70) + '…' : d.opis.trim()) : 'Brak opisu';
    case 'ogloszenie': return KANALY.filter(([x]) => k[x]).map(([, l]) => l.split(' ')[0]).join(', ') || 'Jeszcze nigdzie nie ogłoszony';
    default: return '';
  }
}
export async function przyjecie(id) {
  const [d, walksA, zdrA] = await Promise.all([get('psy', id), list('spacery'), list('zdrowie')]);
  if (!d) return { tab: 'psy', title: 'Nowe psy', html: html`${pageBar('Nowe psy')}<div class="empty">${icon('paw')}<h3>Nie ma takiego psa</h3><a class="btn gold" href="#/nowe">Wróć do listy</a></div>` };
  const ctx = { walks: walksA.filter((w) => w.pies_id === id), zdr: zdrA.filter((z) => z.pies_id === id) };
  const st = kroki(d, ctx), done = st.filter((x) => x.done).length, br = st.filter((x) => x.req && !x.done).map((x) => x.l.toLowerCase());
  const gotowa = !!(d.nowy && d.karta_gotowa);
  return {
    tab: 'psy', title: 'Karta przyjęcia: ' + d.imie, live: true,
    html: html`${pageBar(d.imie, { right: html`<a class="iconbtn" href="#/psy/${id}" aria-label="Otwórz kartę psa">${icon('paw')}</a>` })}
    <div class="pad stack">
      <div><div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${st.length}" aria-valuenow="${done}"><i style="width:${Math.round(done / st.length * 100)}%"></i></div><p class="hint" style="color:var(--sage);margin:6px 0 0">${done} z ${st.length} kroków. Każdy krok zapisuje się od razu i możesz do niego wrócić.</p></div>
      ${gotowa ? html`<div class="teraz"><b>Karta jest kompletna</b><p>Pies jest już tylko w sekcji Psy. Kroki dalej możesz poprawiać.</p><div class="btnrow"><button class="btn sm ghost" data-act="nw-reopen" data-id="${id}">Wróć do uzupełniania</button></div></div>`
        : d.nowy && d.karta_otwarta && !br.length ? html`<div class="teraz"><b>Wymagane kroki są gotowe</b><div class="btnrow"><button class="btn sm" data-act="nw-close" data-id="${id}">Zakończ uzupełnianie</button></div></div>`
        : d.nowy && br.length ? html`<div class="teraz"><b>Do zakończenia brakuje: ${br.join(', ')}</b><p>Nic nie ponagla. Dokończ, kiedy się uda.</p></div>` : ''}
      <div class="card" style="padding:4px 16px"><div class="rows">${st.map((s, i) => html`<div class="stp"><button class="row" data-act="nw-step" data-k="${s.k}" data-id="${id}"><span class="stk ${s.done ? 'ok' : s.now ? 'now' : ''}">${s.done ? icon('check') : String(i + 1)}</span><span class="rt"><b>${s.l}${s.req ? html` <em class="req">wymagane</em>` : ''}</b><small>${opis(d, s, ctx)}</small></span>${icon('chev')}</button>${s.k === 'charakter' && !d.ocena ? html`<button class="link stp-skip" data-act="nw-skip" data-id="${id}">${s.skipped ? 'Cofnij pominięcie' : 'Pomiń na razie (np. pies jeszcze nie wychodzi)'}</button>` : ''}</div>`)}</div></div>
      <a class="btn ghost block" href="#/psy/${id}">${icon('paw')} Otwórz kartę psa</a>
      <a class="btn ghost block" href="#/nowe">Wróć do listy Nowe psy</a>
    </div>`
  };
}

// ---------- kroki ----------
const SEL = (id, label, opts, val) => `<div class="field"><label for="${id}">${label}</label><select class="select" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
const done = async (id, msg = 'Zapisane') => { closeSheet(); toast(msg); await zamknijGotowe(id); };

actions['nowe-open'] = (el) => { location.hash = '#/nowe/' + el.dataset.id; };
actions['nw-skip'] = async (el) => { await zmien(el.dataset.id, (d) => ({ ...d, pominiete: { ...(d.pominiete || {}), ocena: (d.pominiete || {}).ocena ? null : Date.now() } })); await zamknijGotowe(el.dataset.id); };
actions['nw-reopen'] = async (el) => { await zmien(el.dataset.id, (d) => ({ ...d, karta_gotowa: null, karta_otwarta: true })); toast('Karta wróciła do uzupełniania'); refreshNowe(); };
actions['nw-close'] = async (el) => { await zmien(el.dataset.id, (d) => ({ ...d, karta_gotowa: Date.now(), karta_otwarta: false })); toast('Karta zakończona. Pies jest w sekcji Psy'); refreshNowe(); };

actions['nw-step'] = async (el) => {
  const id = el.dataset.id, k = el.dataset.k, d = await get('psy', id); if (!d) return;
  const fake = { dataset: { id } };
  if (k === 'zdrowie') return actions['dog-zdrowie'](fake);
  if (k === 'charakter') return actions['dog-ocena'](fake);
  if (k === 'zdjecia') return addPhoto(id);
  if (k === 'przyjecie') {
    openSheet(`<h2>Przyjęcie: ${esc(d.imie)}</h2><form id="f1" novalidate>
      <div class="field"><label for="p_i">Imię</label><input class="input" id="p_i" maxlength="40" autocomplete="off" value="${esc(d.imie || '')}"><p class="hint" style="margin:6px 0 0">Może być robocze. Gdy schronisko doda psa na stronie, wpisz tu dokładnie takie imię jak na stronie. Wtedy karta połączy się ze stroną, a nie powstanie drugi pies.</p></div>
      ${SEL('p_p', 'Płeć', [['', 'Nie wiadomo'], ['samiec', 'Samiec'], ['suka', 'Suka']], d.plec || '')}
      <div class="field"><label for="p_w">Wiek</label><input class="input" id="p_w" maxlength="40" placeholder="np. ok. 2 lata" value="${esc(d.wiek || '')}"></div>
      <div class="field"><label for="p_r">Wielkość</label><input class="input" id="p_r" maxlength="30" placeholder="np. średni" value="${esc(d.wielkosc || '')}"></div>
      <div class="field"><label for="p_d">Data przyjęcia</label><input class="input" id="p_d" type="date" value="${d.data_przyjecia ? d10(d.data_przyjecia) : ''}"></div>
      <div class="field"><label for="p_c">Numer czipa (opcjonalnie)</label><input class="input" id="p_c" maxlength="20" inputmode="numeric" value="${esc(d.chip || '')}"></div>
      <div class="err" id="p_e"></div><button class="btn block" type="submit">Zapisz</button>
      <button type="button" class="btn ghost block" style="margin-top:10px" data-sheet-close>Zamknij</button></form>`, (s) => {
      s.querySelector('#f1').addEventListener('submit', async (e) => {
        e.preventDefault(); const imie = s.querySelector('#p_i').value.trim(); if (!imie) { s.querySelector('#p_e').textContent = 'Wpisz imię (może być robocze).'; return; }
        const dd = s.querySelector('#p_d').value;
        await zmien(id, (x) => ({ ...x, imie, plec: s.querySelector('#p_p').value, wiek: s.querySelector('#p_w').value.trim(), wielkosc: s.querySelector('#p_r').value.trim(), chip: s.querySelector('#p_c').value.trim(), data_przyjecia: dd ? new Date(dd + 'T12:00').getTime() : null }));
        await done(id);
      });
    });
    return;
  }
  if (k === 'wyglad') {
    openSheet(`<h2>Wygląd i cechy: ${esc(d.imie)}</h2><form id="f5" novalidate>
      <div class="field"><label for="w_k">Waga</label><input class="input" id="w_k" maxlength="30" placeholder="np. 21 kg" value="${esc(d.waga || '')}"></div>
      <div class="field"><label for="w_z">Wzrost w kłębie</label><input class="input" id="w_z" maxlength="30" placeholder="np. 55 cm" value="${esc(d.wzrost || '')}"></div>
      <div class="field"><label for="w_s">Sierść</label><input class="input" id="w_s" maxlength="40" placeholder="np. krótka, czarna" value="${esc(d.siersc || '')}"></div>
      <div class="field"><label for="w_t">Cechy (po przecinku)</label><input class="input" id="w_t" maxlength="120" placeholder="przyjazny, aktywny, lubi spacery" value="${esc((d.tagi || []).join(', '))}"></div>
      <button class="btn block" type="submit">Zapisz</button>
      <button type="button" class="btn ghost block" style="margin-top:10px" data-sheet-close>Zamknij</button></form>`, (s) => {
      s.querySelector('#f5').addEventListener('submit', async (e) => {
        e.preventDefault();
        await zmien(id, (x) => ({ ...x, waga: s.querySelector('#w_k').value.trim(), wzrost: s.querySelector('#w_z').value.trim(), siersc: s.querySelector('#w_s').value.trim(), tagi: s.querySelector('#w_t').value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8) }));
        await done(id);
      });
    });
    return;
  }
  if (k === 'opis') {
    openSheet(`<h2>Opis i hasło: ${esc(d.imie)}</h2><form id="f7" novalidate>
      <div class="field"><label for="o_h">Hasło (to, co po myślniku w tytule)</label><input class="input" id="o_h" maxlength="120" placeholder="np. będziesz ze mnie dumny" value="${esc(hasloPlain(d))}"></div>
      <div class="field"><label for="o_o">Opis do ogłoszenia</label><textarea class="textarea" id="o_o" maxlength="4000" style="min-height:160px">${esc(d.opis || '')}</textarea><p class="hint" style="margin:6px 0 0">Opis możesz też wstawić z oceny zachowania (krok Charakter).</p></div>
      <button class="btn block" type="submit">Zapisz</button>
      <button type="button" class="btn ghost block" style="margin-top:10px" data-sheet-close>Zamknij</button></form>`, (s) => {
      s.querySelector('#f7').addEventListener('submit', async (e) => {
        e.preventDefault();
        await zmien(id, (x) => ({ ...x, haslo: s.querySelector('#o_h').value.trim(), opis: s.querySelector('#o_o').value.trim() }));
        await done(id);
      });
    });
    return;
  }
  if (k === 'ogloszenie') {
    const kan = d.kanaly || {};
    openSheet(`<h2>Ogłoszenie: ${esc(d.imie)}</h2><p class="hint" style="margin:0 0 12px">${KANALY.filter(([x]) => kan[x]).map(([, l]) => l).join(', ') || 'Jeszcze nigdzie nie ogłoszony.'}</p><div class="actions">
      <button class="act primary" id="g_t">${icon('share').s}Przygotuj teksty do postów<small>Facebook, Instagram, TikTok, YouTube, strona</small></button>
      <button class="act" id="g_k">${icon('check').s}Zaznacz, gdzie opublikowano<small>Po wrzuceniu posta</small></button></div>
      <button type="button" class="btn ghost block" style="margin-top:10px" data-sheet-close>Zamknij</button>`, (s) => {
      s.querySelector('#g_t').onclick = () => { closeSheet(); location.hash = '#/social/adopcja/' + id; };
      s.querySelector('#g_k').onclick = () => { closeSheet(); actions['dog-kanaly'](fake); };
    });
    return;
  }
  if (k === 'zaufanie') {
    const [walksA, obsA] = await Promise.all([list('spacery'), list('obserwacje')]);
    const w = walksA.filter((x) => x.pies_id === id), trust = zaufanieAktywne(d, w), obs = obsA.filter((o) => o.pies_id === id).sort((a, b) => b.ts - a.ts).slice(0, 3);
    openSheet(`<h2>Zaufanie i spacery: ${esc(d.imie)}</h2>
      <p class="hint" style="margin:0 0 12px">${trust ? `Zdobywamy zaufanie od ${dniOd(d.zaufanie)} ${plural(dniOd(d.zaufanie), 'dnia', 'dni', 'dni')}. Bez pośpiechu: liczy się każda drobna zmiana.` : w.length ? `${w.length} ${plural(w.length, 'spacer', 'spacery', 'spacerów')} za nami.` : 'Pies jeszcze nie wychodzi na spacery. Jeśli się boi albo jest nieufny, zaznacz to, a aplikacja nie będzie ponaglać.'}</p>
      ${obs.length ? `<div class="zl">${obs.map((o) => `<div class="obs"><div class="oh"><b>${esc(o.typ || 'Notatka')}</b><span>${esc(fmtDate(o.ts))}</span></div><div style="white-space:pre-line">${esc(o.tekst || '')}</div></div>`).join('')}</div>` : ''}
      <div class="actions" style="margin-top:12px">
      <button class="act primary" id="z_n">${icon('pencil').s}Dodaj notatkę o postępach<small>Co się zmieniło, co działa</small></button>
      <button class="act" id="z_t">${icon('heart').s}${trust ? 'Już wychodzi na spacery' : 'Zdobywamy zaufanie'}<small>${trust ? 'Wyłącza tryb bez ponaglania' : 'Włącza tryb bez ponaglania'}</small></button>
      <button class="act" id="z_s">${icon('walk').s}Zacznij spacer z wolontariuszem<small>Notatki, zdjęcia</small></button></div>
      <button type="button" class="btn ghost block" style="margin-top:10px" data-sheet-close>Zamknij</button>`, (s) => {
      s.querySelector('#z_n').onclick = () => { closeSheet(); obsForm(id); };
      s.querySelector('#z_s').onclick = () => { closeSheet(); location.hash = '#/spacer/' + id; };
      s.querySelector('#z_t').onclick = async () => { await zmien(id, (x) => ({ ...x, zaufanie: trust ? null : Date.now() })); done(id, trust ? 'Zapisane. Świetna wiadomość!' : 'Zapisane. Nic nie ponagla'); };
    });
  }
};
