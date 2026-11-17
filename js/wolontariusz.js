// Wolontariusz (od 1.16): podgląd Psy, Pomoc, Potrzeby, Transport, Sobotnie spacery, Zaginięcia
// oraz zgłoszenia „ja to ogarnę” (imię + telefon). Telefon widzi tylko administrator, znika po 30 dniach (serwer: p_tel).
// Wspólne kawałki (lista zgłoszeń, przyciski) są używane też na ekranach administratora.
import { html, raw, esc, icon, openSheet, closeSheet, toast, actions, brandBar, pageBar, dogImg, confirmSheet } from './ui.js';
import { list, listRecs, save, remove, get } from './store.js';
import { ktoText } from './kto.js';
import { state, getName, getTel, setTel } from './auth.js';
import { opisPotrzeby, uid, dogOfDay, dogNeeds, NEED_LABELS, needLabel, greeting, fmtDayLong, fmtTime, fmtDate, fmtShort, dayKey } from './util.js';
import { boksPill, wybCls, linie } from './znak.js';
import { soboty } from './terminarz.js';
import { hydratePhotos } from './photos.js';

// ----- moje zgłoszenia (ten telefon) -----
const MK = 'lapa.moje.zgl';
const moje = () => { try { return new Set(JSON.parse(localStorage.getItem(MK) || '[]')); } catch { return new Set(); } };
const zapiszMoje = (s) => { try { localStorage.setItem(MK, JSON.stringify([...s].slice(-300))); } catch { /* */ } };
export const czyMoje = (id) => moje().has(id);

// ----- dane zgłoszeń -----
export async function zglDane() {
  const [dek, zg, of, tel] = await Promise.all([list('deklaracje'), list('zgloszenia'), list('oferty'), state.admin ? list('p_tel') : Promise.resolve([])]);
  return { dek, zg, of, tel: Object.fromEntries(tel.map((t) => [t.id, t.tel])) };
}
const cyfry = (t) => String(t || '').replace(/\D/g, '');
export const telLink = (t) => (t ? `<a class="kontakt" href="tel:${esc(String(t).replace(/[^\d+]/g, ''))}">${icon('phone').s}${esc(t)}</a>` : '<span class="hint">bez telefonu</span>');
const imiona = (a) => (a.length <= 4 ? a.map((z) => z.imie).join(', ') : a.slice(0, 4).map((z) => z.imie).join(', ') + ' +' + (a.length - 4));

// Okno zgłoszenia: imię, telefon (zapamiętane na telefonie), opcjonalnie ilość.
export function zglosSie({ tytul, opis = '', ilosc = null, przycisk = 'Zgłaszam się', dzieki = 'Dziękujemy! Administrator się z Tobą skontaktuje' }, zapisz) {
  openSheet(`<h2>${esc(tytul)}</h2>${opis}<form id="zw" novalidate>
    ${ilosc ? `<div class="field"><label for="zw_q">Ile możesz przywieźć?${ilosc.jedn ? ' (' + esc(ilosc.jedn) + ')' : ''}</label><input class="input" id="zw_q" inputmode="numeric" maxlength="6" data-nodraft placeholder="np. ${Math.max(1, Math.min(10, ilosc.brak || 5))}"></div>` : ''}
    <div class="field"><label for="zw_i">Twoje imię</label><input class="input" id="zw_i" maxlength="40" autocomplete="given-name" data-nodraft value="${esc(getName())}"></div>
    <div class="field"><label for="zw_t">Twój telefon</label><input class="input" id="zw_t" type="tel" maxlength="20" autocomplete="tel" data-nodraft placeholder="np. 600 100 200" value="${esc(getTel())}">
      <p class="hint" style="margin:6px 0 0">Telefon zobaczy tylko administrator, żeby się z Tobą skontaktować. Zniknie po 30 dniach. Inni wolontariusze zobaczą tylko imię.</p></div>
    <div class="err" id="zw_e" role="alert"></div><button class="btn gold block" type="submit">${esc(przycisk)}</button></form>`, (s) => {
    s.querySelector('#zw').addEventListener('submit', async (e) => {
      e.preventDefault(); const er = s.querySelector('#zw_e');
      const imie = s.querySelector('#zw_i').value.trim(), tel = s.querySelector('#zw_t').value.trim(), q = ilosc ? parseInt(s.querySelector('#zw_q').value, 10) : null;
      if (ilosc && !(q > 0)) { er.textContent = 'Wpisz, ile możesz przywieźć (liczba większa od zera).'; return; }
      if (imie.length < 2) { er.textContent = 'Wpisz swoje imię.'; return; }
      if (cyfry(tel).length < 9) { er.textContent = 'Wpisz numer telefonu (9 cyfr), żeby administrator mógł się z Tobą skontaktować.'; return; }
      setTel(tel);
      await zapisz({ imie, tel, ilosc: q }); closeSheet(); toast(dzieki);
    });
  });
}
// Zapis zgłoszenia: publiczna część (imię) + telefon osobno (kolekcja prywatna, czyta tylko administrator).
async function nowe(col, dane, imie, tel) {
  const id = col[0] + uid(), ts = Date.now();
  await save(col, { ...dane, id, imie, ts });
  await save('p_tel', { id, ref_col: col, ref_id: id, tel, imie, ts });
  const m = moje(); m.add(id); zapiszMoje(m);
  return id;
}
actions['of-cofnij'] = async (el) => {
  const col = el.dataset.col, id = el.dataset.id;
  if (!(await confirmSheet('Wycofać zgłoszenie?', 'Administrator zobaczy, że już się tym nie zajmujesz.', 'Wycofaj', true))) return;
  await remove(col, id); await remove('p_tel', id).catch(() => {}); const m = moje(); m.delete(id); zapiszMoje(m); toast('Wycofano zgłoszenie');
};
// administrator: usunięcie dowolnego zgłoszenia
actions['zg-usun'] = async (el) => {
  if (!(await confirmSheet('Usunąć zgłoszenie?', 'Zniknie u wszystkich, razem z telefonem.', 'Usuń', true))) return;
  await remove(el.dataset.col, el.dataset.id); await remove('p_tel', el.dataset.id).catch(() => {}); toast('Usunięto');
};
// lista zgłoszeń dla administratora: imię, telefon, data, usuń
export const zglAdminList = (zgl, tel, col, extra = () => '') => (zgl.length ? `<div class="zgl">${zgl.sort((a, b) => (b.ts || 0) - (a.ts || 0)).map((z) => `<div class="zglr"><span><b>${esc(z.imie || '')}</b>${z.ilosc ? ' · ' + esc(String(z.ilosc)) : ''} ${telLink(tel[z.id])}<small>${z.ts ? esc(fmtDate(z.ts)) : ''}${z.stan === 'przyjeta' ? ' · przyjęte' : ''}</small></span><span class="zgla">${extra(z)}<button class="btn sm ghost" data-act="zg-usun" data-col="${col}" data-id="${esc(z.id)}" aria-label="Usuń zgłoszenie">${icon('trash').s}</button></span></div>`).join('')}</div>` : '');

// ===== pomoc dla psów =====
// chip potrzeby: imiona zgłoszonych; dotknięcie = zgłoś się albo wycofaj własne
export function chipyPotrzeb(d, needs, dek) {
  return needs.map((k) => {
    const z = dek.filter((x) => x.pies_id === d.id && x.potrzeba === k), mine = z.find((x) => czyMoje(x.id));
    return `<button class="chip outline ${mine ? 'on' : ''}" data-act="decl" data-dog="${esc(d.id)}" data-need="${esc(k)}" ${mine ? `data-mine="${esc(mine.id)}"` : ''} aria-pressed="${!!mine}">${esc(needLabel(k))}${z.length ? ' · ' + esc(imiona(z)) : ''}</button>`;
  }).join('');
}
actions.decl = async (el) => {
  if (el.dataset.mine) return actions['of-cofnij']({ dataset: { col: 'deklaracje', id: el.dataset.mine } });
  const d = await get('psy', el.dataset.dog); if (!d) return; const k = el.dataset.need;
  zglosSie({ tytul: `${d.imie}: ${needLabel(k)}`, opis: `<p class="hint" style="margin:0 0 12px">Zgłoś, że możesz się tym zająć. Administrator schroniska skontaktuje się z Tobą i ustali szczegóły.</p>` },
    ({ imie, tel }) => nowe('deklaracje', { pies_id: d.id, potrzeba: k }, imie, tel));
};
export async function pomocPsyHtml() {
  const [dogs, walks, z] = await Promise.all([list('psy'), list('spacery'), zglDane()]);
  const help = dogs.map((d) => ({ d, needs: dogNeeds(d, walks) })).filter((x) => x.needs.length || x.d.status === 'pilne').sort((a, b) => (b.d.status === 'pilne') - (a.d.status === 'pilne'));
  if (!help.length) return '<p class="pusto">Teraz żaden pies nie czeka na pomoc.</p>';
  return (state.admin ? '' : '<p class="pomhint">Dotknij potrzeby, żeby zgłosić, że się tym zajmiesz.</p>') + help.map(({ d, needs }) => `<div class="need"><a href="#/psy/${esc(d.id)}" style="display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit"><span class="avatar sm${wybCls(d)}">${dogImg(d.zdjecia?.[0], d.imie).s}</span><span style="flex:1"><b style="font-family:var(--serif);font-size:19px">${esc(d.imie)}</b> ${boksPill(d, 'in')}${d.status === 'pilne' ? ' <span class="chip terra" style="min-height:24px;padding:1px 9px;font-size:12px">Pilne</span>' : ''}${linie(d) ? `<span style="display:block">${linie(d)}</span>` : ''}</span>${icon('chev').s}</a>
    <div class="chips" style="margin-top:10px">${chipyPotrzeb(d, needs, z.dek)}</div>
    ${state.admin ? zglAdminList(z.dek.filter((x) => x.pies_id === d.id), z.tel, 'deklaracje', (x) => `<span class="chip" style="min-height:26px;font-size:12px">${esc(needLabel(x.potrzeba))}</span>`) : ''}</div>`).join('');
}
export async function pomocWol() { return (await import('./screens-inne.js')).pomocEkran(); }

// ===== potrzeby rzeczowe =====
export async function potrzebyHtml() {
  const [ndr, z] = await Promise.all([listRecs('potrzeby'), zglDane()]); const nd = ndr.map((r) => r.data);
  const open = nd.filter((n) => n.status !== 'zrealizowana').sort((a, b) => (b.priorytet === 'pilne') - (a.priorytet === 'pilne'));
  if (!open.length) return '<p class="pusto">Teraz niczego nie brakuje.</p>';
  return open.map((n) => {
    const of = z.of.filter((o) => o.typ === 'potrzeba' && o.ref === n.id && o.stan !== 'odrzucona'), mine = of.find((o) => czyMoje(o.id));
    const glowa = `<b style="font-size:17px">${esc(opisPotrzeby(n))}</b>${n.priorytet === 'pilne' ? ' <span class="chip terra" style="min-height:24px;padding:1px 9px;font-size:12px">Pilne</span>' : ''}`;
    return `<div class="need">${state.admin ? `<button class="needh" data-act="need-edit" data-id="${esc(n.id)}">${glowa}${icon('pencil').s}</button>` : `<div>${glowa}</div>`}
      ${of.length ? `<div class="sub" style="margin-top:6px"><b>Przywiozą:</b> ${esc(imiona(of))}</div>` : ''}
      ${state.admin ? zglAdminList(of, z.tel, 'oferty') : `<div class="btnrow" style="margin-top:10px">${mine ? `<button class="btn sm ghost" data-act="of-cofnij" data-col="oferty" data-id="${esc(mine.id)}">${icon('check').s} Przywiozę · Wycofaj</button>` : `<button class="btn sm gold" data-act="of-potrzeba" data-id="${esc(n.id)}">${icon('gift').s} Mogę przywieźć</button>`}</div>`}</div>`;
  }).join('');
}
actions['of-potrzeba'] = async (el) => {
  const n = await get('potrzeby', el.dataset.id); if (!n) return;
  zglosSie({ tytul: opisPotrzeby(n), opis: `<p class="hint" style="margin:0 0 12px">Zgłoś, że możesz to przywieźć. Administrator się z Tobą skontaktuje.</p>`, przycisk: 'Przywiozę' },
    ({ imie, tel }) => nowe('oferty', { typ: 'potrzeba', ref: n.id, stan: 'nowa' }, imie, tel));
};

// ===== transport: zgłoszenie „mogę pojechać” =====
export function transportZgl(x, of, tel) {
  const lista = of.filter((o) => o.typ === 'transport' && o.ref === x.id && o.stan !== 'odrzucona'), mine = lista.find((o) => czyMoje(o.id) && o.stan !== 'przyjeta');
  return `${lista.length ? `<p class="sub" style="margin:8px 0"><b>Mogą pojechać:</b> ${esc(imiona(lista))}</p>` : ''}
    ${state.admin ? zglAdminList(lista, tel, 'oferty', (o) => (x.status === 'szuka' ? `<button class="btn sm" data-act="of-kierowca" data-id="${esc(o.id)}">Przypisz</button>` : '')) : ''}
    ${!state.admin && x.status === 'szuka' ? (mine ? `<button class="btn ghost block" data-act="of-cofnij" data-col="oferty" data-id="${esc(mine.id)}">Wycofaj moje zgłoszenie</button>` : `<button class="btn gold block" data-act="of-transport" data-id="${esc(x.id)}">${icon('truck').s} Mogę pojechać</button>`) : ''}`;
}
actions['of-transport'] = async (el) => {
  const x = await get('transporty', el.dataset.id); if (!x) return;
  zglosSie({ tytul: `Transport: ${x.pies_imie || 'pies'}`, opis: `<p class="hint" style="margin:0 0 12px">${esc(x.skad)} → ${esc(x.dokad)}, ${esc(fmtDayLong(x.kiedy))}, ${esc(fmtTime(x.kiedy))}. Administrator potwierdzi, kto jedzie.</p>`, przycisk: 'Mogę pojechać' },
    ({ imie, tel }) => nowe('oferty', { typ: 'transport', ref: x.id, stan: 'nowa' }, imie, tel));
};
actions['of-kierowca'] = async (el) => {
  const o = await get('oferty', el.dataset.id); if (!o || o.stan === 'przyjeta') return; const x = await get('transporty', o.ref); if (!x) return;
  await save('transporty', { ...x, status: 'przypisany', kierowca: o.imie }); await save('oferty', { ...o, stan: 'przyjeta', przyjeto: Date.now() });
  closeSheet(); toast(`Kierowca: ${o.imie}`);
};

// ===== sobotnie spacery =====
export async function sobotyWol() {
  const [L, z] = await Promise.all([soboty(10), zglDane()]);
  const rows = L.map((x) => {
    const off = x.status === 'odwolany', ludzie = z.zg.filter((r) => r.key === x.key && r.status === 'tak'), mine = ludzie.find((r) => czyMoje(r.id));
    const d = new Date(x.start), moved = dayKey(x.start) !== x.dk && !x.extra;
    return `<div class="ev walk" style="flex-wrap:wrap;${off ? 'opacity:.85' : ''}"><div class="when"><b>${d.getDate()}</b><small>${esc(new Intl.DateTimeFormat('pl-PL', { month: 'short' }).format(d))}</small></div>
      <div class="what"><b>${esc(new Intl.DateTimeFormat('pl-PL', { weekday: 'long' }).format(d))}${off ? ' · <span style="color:var(--terra-d)">ODWOŁANE</span>' : ''}</b><span>godz. ${esc(fmtTime(x.start))} pod bramą${moved ? ' · termin przesunięty' : ''}</span>${off && x.powod ? `<span> · Powód: ${esc(x.powod)}</span>` : ''}${x.notatka ? `<span> · ${esc(x.notatka)}</span>` : ''}</div>
      ${off ? '' : `<div style="width:100%;margin-top:10px"><div class="sub" style="margin-bottom:8px">${ludzie.length ? `<b>Będą (${ludzie.length}):</b> ${esc(imiona(ludzie))}` : 'Nikt jeszcze nie potwierdził.'}</div>
        ${mine ? `<button class="btn sm ghost" data-act="of-cofnij" data-col="zgloszenia" data-id="${esc(mine.id)}">${icon('check').s} Będę · Wycofaj</button>` : `<button class="btn sm gold" data-act="sob-bede" data-key="${esc(x.key)}" data-t="${x.start}">Będę</button>`}</div>`}</div>`;
  }).join('');
  return { tab: 'spacery', title: 'Sobotnie spacery', live: true,
    html: html`${pageBar('Sobotnie spacery', { back: false })}<p class="hint" style="padding:0 20px;margin:4px 0 10px;color:var(--sage)">Zwykle w sobotę pod bramą schroniska. Daj znać, że będziesz – administrator zobaczy Twoje imię i telefon, inni tylko imię.</p><div class="evlist">${raw(rows)}</div>` };
}
actions['sob-bede'] = (el) => {
  const key = el.dataset.key, t = +el.dataset.t;
  zglosSie({ tytul: `Spacery: ${fmtDayLong(t)}`, opis: `<p class="hint" style="margin:0 0 12px">Godz. ${esc(fmtTime(t))} pod bramą schroniska.</p>`, przycisk: 'Będę', dzieki: 'Dziękujemy! Do zobaczenia pod bramą' },
    ({ imie, tel }) => nowe('zgloszenia', { key, status: 'tak' }, imie, tel));
};

// ===== administrator: wszystkie zgłoszenia wolontariuszy (z telefonami) =====
export const ZGL_SEEN = 'lapa.zgl.seen';
export async function noweZgloszenia() {
  if (!state.admin) return 0; const seen = +(localStorage.getItem(ZGL_SEEN) || 0);
  return (await list('p_tel')).filter((t) => (t.ts || 0) > seen).length;
}
export async function zgloszeniaAdmin() {
  const [z, psy, nd, tr, sob] = await Promise.all([zglDane(), list('psy', { archiwum: true }), list('potrzeby'), list('transporty'), soboty(10)]);
  const seen = +(localStorage.getItem(ZGL_SEEN) || 0); try { localStorage.setItem(ZGL_SEEN, String(Date.now())); } catch { /* */ }
  const P = Object.fromEntries(psy.map((d) => [d.id, d])), N = Object.fromEntries(nd.map((n) => [n.id, n])), T = Object.fromEntries(tr.map((x) => [x.id, x]));
  const nowy = (r) => ((r.ts || 0) > seen && z.tel[r.id] ? ' <span class="chip gold" style="min-height:22px;padding:0 8px;font-size:11.5px">nowe</span>' : '');
  const wiersz = (r, col, co, extra = '') => `<div class="zglr"><span><span class="zco">${co}</span><b>${esc(r.imie || '')}</b>${nowy(r)} ${telLink(z.tel[r.id])}<small>zgłoszone ${r.ts ? esc(fmtDate(r.ts)) : ''}</small></span><span class="zgla">${extra}<button class="btn sm ghost" data-act="zg-usun" data-col="${col}" data-id="${esc(r.id)}" aria-label="Usuń zgłoszenie">${icon('trash').s}</button></span></div>`;
  const sekcja = (tytul, rows, pusto) => `<div class="sec"><h2>${tytul}</h2></div><div class="pad">${rows.length ? `<div class="card zgl" style="padding:6px 14px">${rows.join('')}</div>` : `<p class="hint" style="margin:0 4px">${pusto}</p>`}</div>`;
  const nowsze = (a) => a.sort((x, y) => (y.ts || 0) - (x.ts || 0));
  const dek = nowsze(z.dek.filter((r) => P[r.pies_id])).map((r) => wiersz(r, 'deklaracje', `<a href="#/psy/${esc(r.pies_id)}">${esc(P[r.pies_id].imie)}</a>: ${esc(needLabel(r.potrzeba))}`));
  const pot = nowsze(z.of.filter((o) => o.typ === 'potrzeba' && N[o.ref] && o.stan !== 'odrzucona')).map((o) => wiersz(o, 'oferty', `${esc(opisPotrzeby(N[o.ref]))}${N[o.ref].status === 'zrealizowana' ? ' · już mamy' : ''}`));
  const tra = nowsze(z.of.filter((o) => o.typ === 'transport' && T[o.ref] && o.stan !== 'odrzucona')).map((o) => { const x = T[o.ref]; return wiersz(o, 'oferty', `<button class="zco zlink" data-act="tr-open" data-id="${esc(x.id)}">${esc(x.pies_imie || 'Transport')}: ${esc(x.skad)} → ${esc(x.dokad)}, ${esc(fmtShort(x.kiedy))}${o.stan === 'przyjeta' ? ' · jedzie' : ''}</button>`, x.status === 'szuka' && o.stan !== 'przyjeta' ? `<button class="btn sm" data-act="of-kierowca" data-id="${esc(o.id)}">Przypisz</button>` : ''); });
  const sb = sob.filter((x) => x.status !== 'odwolany').map((x) => { const L = nowsze(z.zg.filter((r) => r.key === x.key && r.status === 'tak')); return L.length ? `<h3 style="font-size:16px;margin:12px 4px 6px">${esc(fmtDayLong(x.start))}, ${esc(fmtTime(x.start))} · ${L.length} os.</h3><div class="card zgl" style="padding:6px 14px">${L.map((r) => wiersz(r, 'zgloszenia', 'Będzie na spacerach')).join('')}</div>` : ''; }).join('');
  return { tab: 'start', title: 'Zgłoszenia wolontariuszy', live: true,
    html: html`${pageBar('Zgłoszenia wolontariuszy')}<p class="hint" style="padding:0 20px;margin:4px 0 6px;color:var(--sage)">Kto zgłosił się do pomocy. Telefony widzi tylko administrator; serwer usuwa je po 30 dniach.</p>
      ${raw(sekcja('Pomoc dla psów', dek, 'Brak zgłoszeń.'))}${raw(sekcja('Potrzeby rzeczowe', pot, 'Brak zgłoszeń.'))}${raw(sekcja('Transport', tra, 'Brak zgłoszeń.'))}
      <div class="sec"><h2>Sobotnie spacery</h2></div><div class="pad">${raw(sb || '<p class="hint" style="margin:0 4px">Nikt jeszcze nie potwierdził.</p>')}</div><div style="height:24px"></div>` };
}

// ===== Start wolontariusza: komunikat, pies dnia, karta „Najbliżej” (bez kafelków – reszta jest na dolnym pasku) =====
export async function startWol() {
  const [dogs, walks, nd, tr, kom, zag, sob, z] = await Promise.all([list('psy'), list('spacery'), list('potrzeby'), list('transporty'), list('komunikaty'), list('zaginiecia'), soboty(1), zglDane()]);
  const act = dogs.filter((d) => !d.zniknal_ze_strony && !d.archiwum && d.status !== 'adoptowany' && !['adoptowany', 'zmarl'].includes(d.miejsce));
  const help = act.filter((d) => d.status === 'pilne' || dogNeeds(d, walks).length).length;
  const potrz = nd.filter((n) => n.status !== 'zrealizowana').length, trans = tr.filter((x) => x.status === 'szuka').length;
  const lost = zag.filter((x) => x.status !== 'znaleziony'), next = sob[0], dog = dogOfDay(dogs);
  kom.sort((a, b) => b.ts - a.ts); const kLast = kom[0];
  const hero = dog
    ? html`<section class="hero" aria-label="Pies dnia">${dogImg(dog.zdjecia[0], dog.imie, 'ph')}<div class="copy"><h2>Dziś możesz zmienić czyjś dzień</h2><div class="goldline"></div>
        <a class="dogtag" href="#/psy/${dog.id}">${icon('paw')}<span>Piesek dnia:</span> <b>${dog.imie}</b> ${raw(boksPill(dog, 'in'))} ${icon('chev')}</a></div></section>`
    : html`<section class="hero nodog"><span class="pawbig">${icon('paw')}</span><div class="copy"><h2>Dziś możesz zmienić czyjś dzień</h2><div class="goldline"></div></div></section>`;
  const mine = next && z.zg.find((r) => r.key === next.key && r.status === 'tak' && czyMoje(r.id));
  const wiersz = (href, t, txt, cls = '') => `<a class="dzw${cls}" href="${esc(href)}"><span class="dzt">${esc(t)}</span><span class="dzx">${esc(txt)}</span>${icon('chev').s}</a>`;
  const pomoc = [potrz && `${potrz} ${potrz === 1 ? 'potrzeba' : potrz < 5 ? 'potrzeby' : 'potrzeb'}`, trans && `${trans} ${trans === 1 ? 'transport' : trans < 5 ? 'transporty' : 'transportów'}`, help && `${help} ${help === 1 ? 'pies' : help < 5 ? 'psy' : 'psów'}`].filter(Boolean);
  const rows = [
    ...lost.map((x) => wiersz('#/zaginiecia/' + x.id, 'szukamy', 'Zaginął: ' + x.imie, ' pilne')),
    ...(next ? [wiersz('#/spacery', next.status === 'odwolany' ? 'odwołane' : fmtDayLong(next.start) + ', ' + fmtTime(next.start), next.status === 'odwolany' ? 'Sobotnie spacery odwołane' : mine ? 'Sobotnie spacery · będziesz ✓' : 'Sobotnie spacery pod bramą', next.status === 'odwolany' ? ' pilne' : '')] : []),
    ...(pomoc.length ? [wiersz('#/pomoc', 'możesz pomóc', pomoc.join(', '))] : [])
  ];
  return { tab: 'start', title: 'Start', live: true,
    html: html`${brandBar(kLast && kLast.ts > (+(localStorage.getItem('lapa.kseen') || 0)), false)}
    <section class="hello"><h1>${greeting()}</h1><p>Wolontariat Schroniska dla Psów w Nowodworze</p></section>
    ${kLast && Date.now() - kLast.ts < 7 * 864e5 ? html`<div class="pad" style="margin-top:14px"><div class="card" style="background:rgba(244,240,231,.1);color:var(--ivory);border:1px solid var(--line-l);box-shadow:none"><div class="card-head"><h3 style="color:var(--ivory);font-size:17px">${icon('bell')} Komunikat</h3><span class="hint" style="color:var(--sage)">${kLast.autor || ''} · ${fmtShort(kLast.ts)}</span></div><div style="white-space:pre-line">${kLast.tekst}</div></div></div>` : ''}
    ${hero}
    <div class="pad" style="margin-top:16px"><section class="card dzis" aria-label="Najbliżej"><h3>Najbliżej</h3>${rows.length ? raw(rows.join('')) : html`<p class="sub" style="margin:6px 0 2px">Na razie spokojnie. Zajrzyj na listę psów.</p>`}</section></div>
    <div style="height:16px"></div>`,
    mount(r) { hydratePhotos(r); } };
}
void html;
