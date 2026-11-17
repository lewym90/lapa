// Wolontariusz (od 1.16): podgląd Psy, Pomoc, Potrzeby, Transport, Sobotnie spacery, Zaginięcia
// oraz zgłoszenia „ja to ogarnę” (imię + telefon). Telefon widzi tylko administrator, znika po 30 dniach (serwer: p_tel).
// Wspólne kawałki (lista zgłoszeń, przyciski) są używane też na ekranach administratora.
import { html, raw, esc, icon, openSheet, closeSheet, toast, actions, brandBar, pageBar, dogImg, confirmSheet } from './ui.js';
import { list, listRecs, save, remove, get } from './store.js';
import { ktoText } from './kto.js';
import { state, getName, getTel, setTel } from './auth.js';
import { uid, dogOfDay, dogNeeds, NEED_LABELS, greeting, fmtDayLong, fmtTime, fmtDate, fmtShort, dayKey } from './util.js';
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
export function zglosSie({ tytul, opis = '', ilosc = null, przycisk = 'Zgłaszam się' }, zapisz) {
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
      await zapisz({ imie, tel, ilosc: q }); closeSheet(); toast('Dziękujemy! Administrator się z Tobą skontaktuje');
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
    return `<button class="chip outline ${mine ? 'on' : ''}" data-act="decl" data-dog="${esc(d.id)}" data-need="${esc(k)}" ${mine ? `data-mine="${esc(mine.id)}"` : ''} aria-pressed="${!!mine}">${esc(NEED_LABELS[k] || k)}${z.length ? ' · ' + esc(imiona(z)) : ''}</button>`;
  }).join('');
}
actions.decl = async (el) => {
  if (el.dataset.mine) return actions['of-cofnij']({ dataset: { col: 'deklaracje', id: el.dataset.mine } });
  const d = await get('psy', el.dataset.dog); if (!d) return; const k = el.dataset.need;
  zglosSie({ tytul: `${d.imie}: ${NEED_LABELS[k] || k}`, opis: `<p class="hint" style="margin:0 0 12px">Zgłoś, że możesz się tym zająć. Administrator schroniska skontaktuje się z Tobą i ustali szczegóły.</p>` },
    ({ imie, tel }) => nowe('deklaracje', { pies_id: d.id, potrzeba: k }, imie, tel));
};
export async function pomocPsyHtml() {
  const [dogs, walks, z] = await Promise.all([list('psy'), list('spacery'), zglDane()]);
  const help = dogs.map((d) => ({ d, needs: dogNeeds(d, walks) })).filter((x) => x.needs.length || x.d.status === 'pilne').sort((a, b) => (b.d.status === 'pilne') - (a.d.status === 'pilne'));
  if (!help.length) return `<div class="empty" style="padding:24px 10px">${icon('heart').s}<h3>Nikt nie czeka na pomoc</h3><p>Gdy pies będzie potrzebował spaceru, zdjęć albo domu tymczasowego, pojawi się tutaj.</p></div>`;
  return help.map(({ d, needs }) => `<div class="need"><a href="#/psy/${esc(d.id)}" style="display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit"><span class="avatar sm${wybCls(d)}">${dogImg(d.zdjecia?.[0], d.imie).s}</span><span style="flex:1"><b style="font-family:var(--serif);font-size:19px">${esc(d.imie)}</b> ${boksPill(d, 'in')}${d.status === 'pilne' ? ' <span class="chip terra" style="min-height:24px;padding:1px 9px;font-size:12px">Pilne</span>' : ''}${linie(d) ? `<span style="display:block">${linie(d)}</span>` : ''}</span>${icon('chev').s}</a>
    <div class="chips" style="margin-top:10px">${chipyPotrzeb(d, needs, z.dek)}</div>
    ${needs.length && !state.admin ? `<p class="hint" style="margin:8px 0 0">Dotknij potrzeby, żeby zgłosić, że się tym zajmiesz. Inni zobaczą Twoje imię.</p>` : ''}
    ${state.admin ? zglAdminList(z.dek.filter((x) => x.pies_id === d.id), z.tel, 'deklaracje', (x) => `<span class="chip" style="min-height:26px;font-size:12px">${esc(NEED_LABELS[x.potrzeba] || x.potrzeba)}</span>`) : ''}</div>`).join('');
}
export async function pomocWol() {
  return { tab: 'pomoc', title: 'Pomoc dla psów', live: true,
    html: html`${pageBar('Pomoc dla psów', { back: false })}<div class="pad stack">${raw(await pomocPsyHtml())}</div>`, mount(r) { hydratePhotos(r); } };
}

// ===== potrzeby rzeczowe =====
export async function potrzebyHtml() {
  const [ndr, z] = await Promise.all([listRecs('potrzeby'), zglDane()]); const nd = ndr.map((r) => r.data), nrec = Object.fromEntries(ndr.map((r) => [r.id, r]));
  const open = nd.filter((n) => n.status !== 'zrealizowana').sort((a, b) => (b.priorytet === 'pilne') - (a.priorytet === 'pilne'));
  if (!open.length) return `<div class="empty" style="padding:24px 10px">${icon('box').s}<h3>Brak zgłoszonych potrzeb</h3><p>${state.admin ? 'Dodaj np. „Karma mokra: 60 puszek”. Wolontariusze zobaczą, ile brakuje.' : 'Gdy schronisko będzie czegoś potrzebować, pojawi się to tutaj.'}</p></div>`;
  return open.map((n) => {
    const have = n.zapewniono || 0, pct = Math.min(100, Math.round((have / (n.potrzeba || 1)) * 100)), miss = Math.max(0, (n.potrzeba || 0) - have);
    const of = z.of.filter((o) => o.typ === 'potrzeba' && o.ref === n.id && o.stan !== 'odrzucona'), nowe = of.filter((o) => o.stan !== 'przyjeta'), mine = nowe.find((o) => czyMoje(o.id));
    return `<div class="need"><div style="display:flex;justify-content:space-between;gap:10px"><div><b style="font-size:17px">${esc(n.nazwa)}</b>${n.priorytet === 'pilne' ? ' <span class="chip terra" style="min-height:24px;padding:1px 9px;font-size:12px">Pilne</span>' : ''}<div class="sub">${esc(n.kategoria || '')}</div>${state.admin ? `<div class="sub kto">${esc(ktoText(nrec[n.id], n.autor))}</div>` : ''}</div>${state.admin ? `<button class="iconbtn" data-act="need-edit" data-id="${esc(n.id)}" aria-label="Edytuj potrzebę" style="color:var(--graphite)">${icon('pencil').s}</button>` : ''}</div>
      <div class="bar ${pct < 35 ? 'low' : ''}"><i style="width:${pct}%"></i></div><div class="sub">Potrzeba ${esc(String(n.potrzeba))} ${esc(n.jednostka || '')}, zapewniono ${have}, <b>brakuje ${miss}</b></div>
      ${nowe.length ? `<div class="sub" style="margin-top:6px"><b>Zgłosili się:</b> ${esc(nowe.map((o) => o.imie + (o.ilosc ? ' (' + o.ilosc + ')' : '')).join(', '))}</div>` : ''}
      ${state.admin ? zglAdminList(of, z.tel, 'oferty', (o) => (o.stan === 'przyjeta' ? '' : `<button class="btn sm" data-act="of-przyjmij" data-id="${esc(o.id)}">Przyjmij</button>`)) : ''}
      <div class="btnrow" style="margin-top:10px">${state.admin ? `<button class="btn sm ghost" data-act="need-give" data-id="${esc(n.id)}">${icon('plus').s} Dolicz dostawę</button>` : mine ? `<button class="btn sm ghost" data-act="of-cofnij" data-col="oferty" data-id="${esc(mine.id)}">Twoje zgłoszenie: ${esc(String(mine.ilosc || ''))} · Wycofaj</button>` : `<button class="btn sm gold" data-act="of-potrzeba" data-id="${esc(n.id)}">${icon('gift').s} Mogę przywieźć</button>`}</div></div>`;
  }).join('');
}
actions['of-potrzeba'] = async (el) => {
  const n = await get('potrzeby', el.dataset.id); if (!n) return; const brak = Math.max(0, (n.potrzeba || 0) - (n.zapewniono || 0));
  zglosSie({ tytul: n.nazwa, opis: `<p class="hint" style="margin:0 0 12px">Brakuje ${brak} ${esc(n.jednostka || '')}. Wpisz, ile możesz przywieźć. Administrator potwierdzi i doliczy po odbiorze.</p>`, ilosc: { jedn: n.jednostka || '', brak }, przycisk: 'Zgłaszam' },
    ({ imie, tel, ilosc }) => nowe('oferty', { typ: 'potrzeba', ref: n.id, ilosc, stan: 'nowa' }, imie, tel));
};
// administrator: przyjęcie oferty rzeczowej = doliczenie do „zapewniono”
actions['of-przyjmij'] = async (el) => {
  const o = await get('oferty', el.dataset.id); if (!o) return; const n = await get('potrzeby', o.ref);
  if (n) { n.zapewniono = (n.zapewniono || 0) + (o.ilosc || 0); if (n.zapewniono >= n.potrzeba) n.status = 'zrealizowana'; await save('potrzeby', n); }
  await save('oferty', { ...o, stan: 'przyjeta', przyjeto: Date.now() }); toast(n ? `Doliczono ${o.ilosc || 0} do „${n.nazwa}”` : 'Przyjęte');
};
export async function potrzebyWol() {
  return { tab: 'potrzeby', title: 'Potrzeby rzeczowe', live: true,
    html: html`${pageBar('Potrzeby rzeczowe', { back: !!state.admin, right: state.admin ? html`<button class="plusbtn" data-act="a-need" aria-label="Dodaj potrzebę">${icon('plus')}</button>` : '' })}<div class="pad stack">${raw(await potrzebyHtml())}</div>` };
}

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
  const o = await get('oferty', el.dataset.id); if (!o) return; const x = await get('transporty', o.ref); if (!x) return;
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
  return { tab: 'start', title: 'Sobotnie spacery', live: true,
    html: html`${pageBar('Sobotnie spacery')}<p class="hint" style="padding:0 20px;margin:4px 0 10px;color:var(--sage)">Zwykle w sobotę pod bramą schroniska. Daj znać, że będziesz – administrator zobaczy Twoje imię i telefon, inni tylko imię.</p><div class="evlist">${raw(rows)}</div>` };
}
actions['sob-bede'] = (el) => {
  const key = el.dataset.key, t = +el.dataset.t;
  zglosSie({ tytul: `Spacery: ${fmtDayLong(t)}`, opis: `<p class="hint" style="margin:0 0 12px">Godz. ${esc(fmtTime(t))} pod bramą schroniska.</p>`, przycisk: 'Będę' },
    ({ imie, tel }) => nowe('zgloszenia', { key, status: 'tak' }, imie, tel));
};

// ===== administrator: wszystkie zgłoszenia wolontariuszy (z telefonami) =====
export const ZGL_SEEN = 'lapa.zgl.seen';
export async function noweZgloszenia() {
  if (!state.admin) return 0; const seen = +(localStorage.getItem(ZGL_SEEN) || 0);
  return (await list('p_tel')).filter((t) => (t.ts || 0) > seen).length;
}
export async function zgloszeniaAdmin() {
  const [z, psy, nd, tr, sob] = await Promise.all([zglDane(), list('psy'), list('potrzeby'), list('transporty'), soboty(10)]);
  const seen = +(localStorage.getItem(ZGL_SEEN) || 0); try { localStorage.setItem(ZGL_SEEN, String(Date.now())); } catch { /* */ }
  const P = Object.fromEntries(psy.map((d) => [d.id, d])), N = Object.fromEntries(nd.map((n) => [n.id, n])), T = Object.fromEntries(tr.map((x) => [x.id, x]));
  const nowy = (r) => ((r.ts || 0) > seen && z.tel[r.id] ? ' <span class="chip gold" style="min-height:22px;padding:0 8px;font-size:11.5px">nowe</span>' : '');
  const wiersz = (r, col, co, extra = '') => `<div class="zglr"><span><span class="zco">${co}</span><b>${esc(r.imie || '')}</b>${nowy(r)} ${telLink(z.tel[r.id])}<small>zgłoszone ${r.ts ? esc(fmtDate(r.ts)) : ''}</small></span><span class="zgla">${extra}<button class="iconbtn sm" data-act="zg-usun" data-col="${col}" data-id="${esc(r.id)}" aria-label="Usuń zgłoszenie">${icon('trash').s}</button></span></div>`;
  const sekcja = (tytul, rows, pusto) => `<div class="sec"><h2>${tytul}</h2></div><div class="pad">${rows.length ? `<div class="card zgl" style="padding:6px 14px">${rows.join('')}</div>` : `<p class="hint" style="margin:0 4px">${pusto}</p>`}</div>`;
  const nowsze = (a) => a.sort((x, y) => (y.ts || 0) - (x.ts || 0));
  const dek = nowsze(z.dek.filter((r) => P[r.pies_id])).map((r) => wiersz(r, 'deklaracje', `<a href="#/psy/${esc(r.pies_id)}">${esc(P[r.pies_id].imie)}</a>: ${esc(NEED_LABELS[r.potrzeba] || r.potrzeba)}`));
  const pot = nowsze(z.of.filter((o) => o.typ === 'potrzeba' && N[o.ref] && o.stan !== 'odrzucona')).map((o) => wiersz(o, 'oferty', `${esc(N[o.ref].nazwa)}: ${esc(String(o.ilosc || ''))} ${esc(N[o.ref].jednostka || '')}${o.stan === 'przyjeta' ? ' · przyjęte' : ''}`, o.stan === 'przyjeta' || N[o.ref].status === 'zrealizowana' ? '' : `<button class="btn sm" data-act="of-przyjmij" data-id="${esc(o.id)}">Przyjmij</button>`));
  const tra = nowsze(z.of.filter((o) => o.typ === 'transport' && T[o.ref] && o.stan !== 'odrzucona')).map((o) => { const x = T[o.ref]; return wiersz(o, 'oferty', `<button class="zco zlink" data-act="tr-open" data-id="${esc(x.id)}">${esc(x.pies_imie || 'Transport')}: ${esc(x.skad)} → ${esc(x.dokad)}, ${esc(fmtShort(x.kiedy))}${o.stan === 'przyjeta' ? ' · jedzie' : ''}</button>`, x.status === 'szuka' && o.stan !== 'przyjeta' ? `<button class="btn sm" data-act="of-kierowca" data-id="${esc(o.id)}">Przypisz</button>` : ''); });
  const sb = sob.filter((x) => x.status !== 'odwolany').map((x) => { const L = nowsze(z.zg.filter((r) => r.key === x.key && r.status === 'tak')); return L.length ? `<h3 style="font-size:16px;margin:12px 4px 6px">${esc(fmtDayLong(x.start))}, ${esc(fmtTime(x.start))} · ${L.length} os.</h3><div class="card zgl" style="padding:6px 14px">${L.map((r) => wiersz(r, 'zgloszenia', 'Będzie na spacerach')).join('')}</div>` : ''; }).join('');
  return { tab: 'start', title: 'Zgłoszenia wolontariuszy', live: true,
    html: html`${pageBar('Zgłoszenia wolontariuszy')}<p class="hint" style="padding:0 20px;margin:4px 0 6px;color:var(--sage)">Kto zgłosił się do pomocy. Telefony widzi tylko administrator; serwer usuwa je po 30 dniach.</p>
      ${raw(sekcja('Pomoc dla psów', dek, 'Brak zgłoszeń.'))}${raw(sekcja('Potrzeby rzeczowe', pot, 'Brak zgłoszeń.'))}${raw(sekcja('Transport', tra, 'Brak zgłoszeń.'))}
      <div class="sec"><h2>Sobotnie spacery</h2></div><div class="pad">${raw(sb || '<p class="hint" style="margin:0 4px">Nikt jeszcze nie potwierdził.</p>')}</div><div style="height:24px"></div>` };
}

// ===== Start wolontariusza: pies dnia + kafelki =====
export async function startWol() {
  const [dogs, walks, nd, tr, kom, zag, sob] = await Promise.all([list('psy'), list('spacery'), list('potrzeby'), list('transporty'), list('komunikaty'), list('zaginiecia'), soboty(1)]);
  const act = dogs.filter((d) => d.status !== 'adoptowany' && d.miejsce !== 'adoptowany' && d.miejsce !== 'zmarl');
  const help = act.filter((d) => d.status === 'pilne' || dogNeeds(d, walks).length).length;
  const potrz = nd.filter((n) => n.status !== 'zrealizowana').length, trans = tr.filter((x) => x.status === 'szuka').length;
  const lost = zag.filter((z) => z.status !== 'znaleziony').length, next = sob[0], dog = dogOfDay(dogs);
  kom.sort((a, b) => b.ts - a.ts); const kLast = kom[0];
  const tile = (href, cls, ic, lbl, n, sub = '') => `<a class="tile ${cls}" href="${href}">${n ? `<span class="badge">${n}</span>` : ''}${icon(ic, 't-ico').s}<span class="t-lbl">${lbl}${sub ? `<small style="display:block;font-family:var(--sans);font-size:12.5px;font-weight:500;opacity:.85;margin-top:2px">${sub}</small>` : ''}</span>${icon('arrow', 't-arr').s}</a>`;
  const hero = dog
    ? html`<section class="hero" aria-label="Pies dnia">${dogImg(dog.zdjecia[0], dog.imie, 'ph')}<div class="copy"><h2>Dziś możesz zmienić czyjś dzień</h2><div class="goldline"></div>
        <a class="dogtag" href="#/psy/${dog.id}">${icon('paw')}<span>Piesek dnia:</span> <b>${dog.imie}</b> ${raw(boksPill(dog, 'in'))} ${icon('chev')}</a></div></section>`
    : html`<section class="hero nodog"><span class="pawbig">${icon('paw')}</span><div class="copy"><h2>Dziś możesz zmienić czyjś dzień</h2><div class="goldline"></div></div></section>`;
  const sobTxt = next ? (next.status === 'odwolany' ? 'ODWOŁANE: ' : '') + fmtDayLong(next.start) + ', ' + fmtTime(next.start) : '';
  return { tab: 'start', title: 'Start',
    html: html`${brandBar(kLast && kLast.ts > (+(localStorage.getItem('lapa.kseen') || 0)), false)}
    <section class="hello"><h1>${greeting()}</h1><p>Wolontariat Schroniska dla Psów w Nowodworze</p></section>
    ${kLast && Date.now() - kLast.ts < 7 * 864e5 ? html`<div class="pad" style="margin-top:14px"><div class="card" style="background:rgba(244,240,231,.1);color:var(--ivory);border:1px solid var(--line-l);box-shadow:none"><div class="card-head"><h3 style="color:var(--ivory);font-size:17px">${icon('bell')} Komunikat</h3><span class="hint" style="color:var(--sage)">${fmtDate(kLast.ts)}</span></div><p style="margin:6px 0 0">${kLast.tekst}</p></div></div>` : ''}
    ${hero}
    <div class="tiles">${raw(tile('#/psy', 'green', 'paw', 'Psy', 0, act.length + ' w schronisku i DT') + tile('#/pomoc', 'terra', 'medic', 'Pomoc dla psów', help) + tile('#/potrzeby', 'sage', 'box', 'Potrzeby rzeczowe', potrz) + tile('#/transport', 'green', 'truck', 'Transport', trans, trans ? 'szuka kierowcy' : '') + tile('#/sobotnie', 'sage', 'calendar', 'Sobotnie spacery', 0, esc(sobTxt)) + tile('#/zaginiecia', lost ? 'terra' : 'green', 'alert', 'Zaginione psy', lost))}</div>`,
    mount(r) { hydratePhotos(r); } };
}
void html;
