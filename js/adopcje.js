// Droga adopcji i domy tymczasowe: dane osobowe, tylko po odblokowaniu hasłem koordynatora (kolekcje p_*).
import { html, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet, plusBtn } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName } from './auth.js';
import { MS_DAY, fmtDate } from './util.js';
import { dogThumb } from './screens-psy.js';
import { hydratePhotos } from './photos.js';

export const ETAPY = [
  ['kontakt', 'Kontakt'], ['rozmowa', 'Rozmowa'], ['poznanie', 'Poznanie z psem'], ['wizyta', 'Wizyta przedadopcyjna'],
  ['umowa', 'Umowa i kastracja'], ['wydanie', 'Wydanie psa'], ['po', 'Wizyta poadopcyjna'], ['koniec', 'Zakończone'], ['rez', 'Rezygnacja']
];
const ETAP = Object.fromEntries(ETAPY);
const ORDER = ETAPY.map((e) => e[0]);
const AKTYWNE = ['kontakt', 'rozmowa', 'poznanie', 'wizyta', 'umowa', 'wydanie', 'po'];
const STARE = { Zainteresowanie: 'kontakt', Rozmowa: 'rozmowa', 'Spotkanie z psem': 'poznanie', 'Wizyta przedadopcyjna': 'wizyta', Adopcja: 'wydanie', Rezygnacja: 'rez' };
const etapOf = (a) => a.etap || STARE[a.status] || 'kontakt';
const SEL = (id, label, opts, val) => `<div class="field"><label for="${id}">${label}</label><select class="select" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
const d10 = (t) => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const tel = (t) => String(t || '').replace(/[^\d+]/g, '');
const lockPage = (title) => ({ tab: 'start', title, html: html`${pageBar(title)}<div class="pad"><div class="lockbox">${icon('lock')}<p style="margin:6px 0 10px"><b>Dane osobowe</b><br><span class="hint">Widzi je tylko koordynator.</span></p><button class="btn sm" data-act="unlock-sheet">Odblokuj hasłem koordynatora</button></div></div>` });

// Pies zmienia status razem z postępem adopcji.
async function syncDog(a, prevEtap) {
  const d = await get('psy', a.pies_id); if (!d) return;
  const e = etapOf(a), all = (await list('p_adopcje')).filter((x) => x.pies_id === a.pies_id && x.id !== a.id).concat([a]);
  let n = { ...d };
  if (e === 'wydanie' || e === 'po' || e === 'koniec') { n.status = 'adoptowany'; n.miejsce = 'adoptowany'; n.data_adopcji = n.data_adopcji || Date.now(); }
  else if (['poznanie', 'wizyta', 'umowa'].includes(e) && ['do_adopcji', 'pilne', 'schronisko'].includes(d.status)) n.status = 'w_trakcie';
  else if (e === 'rez' && d.status === 'w_trakcie' && !all.some((x) => AKTYWNE.includes(etapOf(x)) && ['poznanie', 'wizyta', 'umowa'].includes(etapOf(x)))) n.status = n.www_status && n.www_status !== 'w_trakcie' ? n.www_status : 'do_adopcji';
  if (JSON.stringify(n) !== JSON.stringify(d)) await save('psy', n);
}

// ===== formularz nowej osoby =====
actions['int-add'] = (el) => form({ pies_id: el.dataset.id });
async function form(a) {
  const dogs = (await list('psy')).sort((x, y) => (x.imie || '').localeCompare(y.imie || '', 'pl'));
  openSheet(`<h2>${a.id ? 'Edytuj osobę' : 'Osoba zainteresowana adopcją'}</h2><form id="af" novalidate>
    ${SEL('a_p', 'Pies', dogs.map((d) => [d.id, d.imie]), a.pies_id)}
    <div class="field"><label for="a_i">Imię i nazwisko</label><input class="input" id="a_i" maxlength="80" value="${esc(a.imie || '')}"></div>
    <div class="field"><label for="a_t">Telefon</label><input class="input" id="a_t" type="tel" maxlength="30" value="${esc(a.telefon || '')}"></div>
    <div class="field"><label for="a_m">Miejscowość (opcjonalnie, ważne przy transporcie)</label><input class="input" id="a_m" maxlength="60" value="${esc(a.miasto || '')}"></div>
    ${SEL('a_e', 'Etap', ETAPY, etapOf(a))}
    <div class="field"><label for="a_n">Notatka (warunki, dzieci, inne zwierzęta…)</label><textarea class="textarea" id="a_n" maxlength="800">${esc(a.notatka || '')}</textarea></div><div class="err" id="a_x"></div>
    <button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    s.querySelector('#af').addEventListener('submit', async (e) => {
      e.preventDefault(); const imie = s.querySelector('#a_i').value.trim(); if (!imie) { s.querySelector('#a_x').textContent = 'Wpisz imię.'; return; }
      const prev = etapOf(a), etap = s.querySelector('#a_e').value;
      const o = { ...a, pies_id: s.querySelector('#a_p').value, imie, telefon: s.querySelector('#a_t').value.trim(), miasto: s.querySelector('#a_m').value.trim(), etap, notatka: s.querySelector('#a_n').value.trim(), prowadzi: a.prowadzi || getName(), ts: a.ts || Date.now(), autor: a.autor || getName(), log: a.log || [] };
      if (!a.id || etap !== prev) { o.log = [...o.log, { ts: Date.now(), autor: getName(), text: a.id ? 'Etap: ' + ETAP[etap] : 'Dodano: ' + ETAP[etap] }]; if (!o.nastepny) autoNext(o); }
      await save('p_adopcje', o); await syncDog(o, prev); closeSheet(); toast('Zapisane');
    });
  });
}
function autoNext(o) {
  const e = etapOf(o), plus = { kontakt: [2, 'Oddzwonić i porozmawiać'], rozmowa: [7, 'Umówić poznanie z psem'], poznanie: [7, 'Umówić wizytę przedadopcyjną'], wizyta: [7, 'Przygotować umowę'], umowa: [7, 'Wydanie psa'], wydanie: [14, 'Wizyta poadopcyjna: jak się mają?'], po: [60, 'Kolejny kontakt: jak się mają?'] }[e];
  if (plus) { o.nastepny = Date.now() + plus[0] * MS_DAY; o.nastepny_opis = plus[1]; } else { o.nastepny = null; o.nastepny_opis = ''; }
}

// ===== szczegóły osoby =====
actions['adopcja-open'] = async (el) => {
  const a = await get('p_adopcje', el.dataset.id); if (!a) return; const d = await get('psy', a.pies_id), e = etapOf(a), i = ORDER.indexOf(e), nx = AKTYWNE.includes(e) ? ORDER[i + 1] : null;
  openSheet(`<h2>${esc(a.imie)}</h2><p class="sub" style="margin:0 0 8px">Pies: <b>${esc(d?.imie || '?')}</b> · ${esc(ETAP[e])}${a.miasto ? ' · ' + esc(a.miasto) : ''}</p>
    ${a.telefon ? `<div class="btnrow"><a class="btn" href="tel:${esc(tel(a.telefon))}">Zadzwoń</a><a class="btn ghost" href="sms:${esc(tel(a.telefon))}">SMS</a><a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/${esc(tel(a.telefon).replace(/^\+/, '').replace(/^(\d{9})$/, '48$1'))}">WhatsApp</a></div>` : ''}
    ${a.notatka ? `<div class="notebox" style="margin-top:10px">${esc(a.notatka)}</div>` : ''}
    <div class="field" style="margin-top:12px"><label for="n_d">Następny krok</label><input class="input" id="n_o" maxlength="100" placeholder="co zrobić" value="${esc(a.nastepny_opis || '')}"><input class="input" id="n_t" type="date" style="margin-top:6px" value="${a.nastepny ? d10(a.nastepny) : ''}"></div>
    <div class="field"><label for="n_p">Prowadzi</label><input class="input" id="n_p" maxlength="40" value="${esc(a.prowadzi || getName())}"></div>
    <button class="btn block" id="n_s">Zapisz krok</button>
    ${nx ? `<button class="btn ghost block" style="margin-top:8px" id="n_n">Przesuń dalej: ${esc(ETAP[nx])}</button>` : ''}
    <div class="field" style="margin-top:12px"><label for="n_l">Dodaj wpis do historii</label><input class="input" id="n_l" maxlength="300" placeholder="np. rozmowa telefoniczna, zdjęcia z domu"><button class="btn ghost block sm" style="margin-top:6px" id="n_la">Dodaj wpis</button></div>
    <div>${[...(a.log || [])].reverse().map((l) => `<div class="obs"><div class="oh"><b>${esc(l.autor || '')}</b><span>${esc(fmtDate(l.ts))}</span></div>${esc(l.text)}</div>`).join('')}</div>
    <div class="btnrow" style="margin-top:12px"><button class="btn ghost" id="n_e">Edytuj</button><button class="btn ghost" style="color:var(--terra-d)" id="n_x">Usuń</button></div>`, (s) => {
    s.querySelector('#n_s').onclick = async () => { const t = s.querySelector('#n_t').value; await save('p_adopcje', { ...a, nastepny_opis: s.querySelector('#n_o').value.trim(), nastepny: t ? new Date(t + 'T12:00').getTime() : null, prowadzi: s.querySelector('#n_p').value.trim() }); closeSheet(); toast('Zapisane'); };
    s.querySelector('#n_n')?.addEventListener('click', async () => { const o = { ...a, etap: nx, log: [...(a.log || []), { ts: Date.now(), autor: getName(), text: 'Etap: ' + ETAP[nx] }] }; autoNext(o); await save('p_adopcje', o); await syncDog(o, e); closeSheet(); toast('Etap: ' + ETAP[nx]); });
    s.querySelector('#n_la').onclick = async () => { const t = s.querySelector('#n_l').value.trim(); if (!t) return; await save('p_adopcje', { ...a, log: [...(a.log || []), { ts: Date.now(), autor: getName(), text: t }] }); closeSheet(); actions['adopcja-open'](el); };
    s.querySelector('#n_e').onclick = () => { closeSheet(); form(a); };
    s.querySelector('#n_x').onclick = async () => { if (await confirmSheet('Usunąć?', 'Osoba zniknie z listy.', 'Usuń', true)) { await remove('p_adopcje', a.id); toast('Usunięto'); } };
  });
};

// ===== lista przy karcie psa =====
export async function dogBlock(dogId) {
  const items = (await list('p_adopcje')).filter((z) => z.pies_id === dogId);
  return html`<div class="sec"><h2>Zainteresowani adopcją</h2></div>${items.length ? items.map((z) => html`<button class="row" data-act="adopcja-open" data-id="${z.id}"><span class="rt"><b>${z.imie}</b><small>${ETAP[etapOf(z)]}${z.nastepny ? ' · ' + (z.nastepny_opis || 'krok') + ' ' + fmtDate(z.nastepny) : ''}</small></span>${icon('chev')}</button>`) : html`<p class="hint">Nikt jeszcze nie zapisany.</p>`}
    <button class="btn ghost block sm" style="margin-top:10px" data-act="int-add" data-id="${dogId}">${icon('plus')} Dodaj osobę zainteresowaną</button>`;
}

// ===== ekran Adopcje =====
let fAd = 'aktywne';
export async function adopcje() {
  if (!state.coordinator) return lockPage('Adopcje');
  const [all, dogs] = await Promise.all([list('p_adopcje'), list('psy')]); const me = getName(), now = Date.now(), byId = Object.fromEntries(dogs.map((d) => [d.id, d]));
  let items = all.filter((a) => (fAd === 'aktywne' ? AKTYWNE.includes(etapOf(a)) : fAd === 'moje' ? a.prowadzi === me && AKTYWNE.includes(etapOf(a)) : ['koniec', 'rez'].includes(etapOf(a)) || fAd === 'wszystkie'));
  items.sort((a, b) => (a.nastepny || 9e15) - (b.nastepny || 9e15));
  const late = all.filter((a) => AKTYWNE.includes(etapOf(a)) && a.nastepny && a.nastepny < now).length;
  return {
    tab: 'start', title: 'Adopcje', live: true,
    html: html`${pageBar('Adopcje', { right: html`${plusBtn('ad-new', 'Dodaj')}` })}
    <div class="fchips">${[['aktywne', 'W toku'], ['moje', 'Moje'], ['zakonczone', 'Zakończone'], ['wszystkie', 'Wszystkie']].map(([k, l]) => html`<button class="chip dark ${fAd === k ? 'on' : ''}" data-act="ad-filter" data-k="${k}">${l}</button>`)}</div>
    <div class="pad stack">${late ? html`<p class="hint" style="color:var(--gold-l);margin:0">Zaległe kroki: ${late}</p>` : ''}
    ${items.length ? items.map((a) => { const d = byId[a.pies_id], over = a.nastepny && a.nastepny < now && AKTYWNE.includes(etapOf(a)); return html`<div class="card gap"><button class="gi" data-act="adopcja-open" data-id="${a.id}" style="text-align:left;background:none;border:0;padding:0"><span class="gp">${d ? dogThumb(d) : ''}</span><span class="rt"><b>${a.imie} · ${d?.imie || '?'}</b><small>${ETAP[etapOf(a)]}${a.prowadzi ? ' · ' + a.prowadzi : ''}</small><small style="${over ? 'color:var(--terra-d);font-weight:600' : ''}">${a.nastepny ? (over ? 'Zaległe: ' : '') + (a.nastepny_opis || 'Następny krok') + ' · ' + fmtDate(a.nastepny) : 'Brak ustalonego kroku'}</small></span></button></div>`; })
      : html`<div class="empty">${icon('heart')}<h3>Nikogo tu nie ma</h3><p>Dodaj osobę przyciskiem + albo z karty psa.</p></div>`}</div>`,
    mount(root) { hydratePhotos(root); }
  };
}
actions['ad-filter'] = (el) => { fAd = el.dataset.k; dispatchEvent(new HashChangeEvent('hashchange')); };
actions['ad-new'] = async () => { const dogs = await list('psy'); form({ pies_id: dogs[0]?.id }); };
export async function zalegle() { // do licznika na Starcie (tylko po odblokowaniu)
  if (!state.coordinator) return 0; const now = Date.now();
  return (await list('p_adopcje')).filter((a) => AKTYWNE.includes(etapOf(a)) && a.nastepny && a.nastepny < now).length;
}

// ===== Domy tymczasowe =====
const UMIE = [['szczeniaki', 'Szczenięta'], ['chore', 'Chore / po zabiegach'], ['behawioralne', 'Psy z problemami'], ['duze', 'Duże psy'], ['seniorzy', 'Seniorzy'], ['koty', 'Ma koty'], ['dzieci', 'Ma dzieci'], ['ogrod', 'Ogród']];
export async function dt() {
  if (!state.coordinator) return lockPage('Domy tymczasowe');
  const [people, dogs] = await Promise.all([list('p_dt'), list('psy')]);
  const living = (p) => dogs.filter((d) => d.miejsce === 'dt' && (d.opiekun || '').trim().toLowerCase() === p.imie.trim().toLowerCase());
  const rows = people.sort((a, b) => (a.imie || '').localeCompare(b.imie || '', 'pl'));
  return {
    tab: 'start', title: 'Domy tymczasowe', live: true,
    html: html`${pageBar('Domy tymczasowe', { right: html`${plusBtn('dt-add', 'Dodaj')}` })}
    <div class="pad stack"><p class="hint" style="color:var(--sage);margin:0">Pies jest przypisany do opiekuna, gdy w jego karcie wybierzesz miejsce „W domu tymczasowym” i wpiszesz to samo imię opiekuna.</p>
    ${rows.length ? rows.map((p) => { const l = living(p), free = Math.max(0, (+p.pojemnosc || 1) - l.length); return html`<div class="card"><button class="rowbtn" data-act="dt-open" data-id="${p.id}" style="width:100%;text-align:left;background:none;border:0;padding:0"><b>${p.imie}</b> <span class="chip ${free && p.dostepny !== false ? '' : 'outline'}">${p.dostepny === false ? 'Niedostępny' : free ? 'Wolne miejsca: ' + free : 'Komplet'}</span>
      <div class="hint">${[p.miasto, (p.umie || []).map((k) => (UMIE.find((x) => x[0] === k) || [])[1]).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div>
      ${l.length ? html`<div class="hint">Ma teraz: ${l.map((d) => d.imie).join(', ')}</div>` : ''}</button></div>`; })
      : html`<div class="empty">${icon('heart')}<h3>Brak opiekunów</h3><p>Dodaj osoby, które przyjmują psy do domu tymczasowego.</p></div>`}</div>`
  };
}
actions['dt-add'] = () => dtForm({});
actions['dt-open'] = async (el) => {
  const p = await get('p_dt', el.dataset.id); if (!p) return;
  openSheet(`<h2>${esc(p.imie)}</h2><p class="sub">${esc(p.miasto || '')} · pojemność: ${esc(String(p.pojemnosc || 1))}</p>${p.notatka ? `<div class="notebox">${esc(p.notatka)}</div>` : ''}
    ${p.telefon ? `<div class="btnrow" style="margin-top:10px"><a class="btn" href="tel:${esc(tel(p.telefon))}">Zadzwoń</a><a class="btn ghost" href="sms:${esc(tel(p.telefon))}">SMS</a></div>` : ''}
    <div class="btnrow" style="margin-top:10px"><button class="btn ghost" id="de">Edytuj</button><button class="btn ghost" style="color:var(--terra-d)" id="dx">Usuń</button></div>`, (s) => {
    s.querySelector('#de').onclick = () => { closeSheet(); dtForm(p); };
    s.querySelector('#dx').onclick = async () => { if (await confirmSheet('Usunąć?', 'Opiekun zniknie z listy.', 'Usuń', true)) { await remove('p_dt', p.id); toast('Usunięto'); } };
  });
};
function dtForm(p) {
  const cur = new Set(p.umie || []);
  openSheet(`<h2>${p.id ? 'Edytuj opiekuna' : 'Nowy opiekun domu tymczasowego'}</h2><form id="tf" novalidate>
    <div class="field"><label for="t_i">Imię i nazwisko</label><input class="input" id="t_i" maxlength="80" value="${esc(p.imie || '')}"></div>
    <div class="field"><label for="t_t">Telefon</label><input class="input" id="t_t" type="tel" maxlength="30" value="${esc(p.telefon || '')}"></div>
    <div class="field"><label for="t_m">Miejscowość</label><input class="input" id="t_m" maxlength="60" value="${esc(p.miasto || '')}"></div>
    <div class="field"><label for="t_c">Ile psów naraz</label><input class="input" id="t_c" type="number" min="1" max="10" value="${esc(String(p.pojemnosc || 1))}"></div>
    <div class="field"><label>Co potrafi</label><div class="chips" id="t_u">${UMIE.map(([k, l]) => `<button type="button" class="chip outline ${cur.has(k) ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div></div>
    <label class="check"><input type="checkbox" id="t_d" ${p.dostepny === false ? '' : 'checked'}> Teraz dostępny</label>
    <div class="field"><label for="t_n">Notatka</label><textarea class="textarea" id="t_n" maxlength="600">${esc(p.notatka || '')}</textarea></div><div class="err" id="t_x"></div>
    <button class="btn block" type="submit">Zapisz</button></form>`, (s) => {
    s.querySelector('#t_u').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) b.classList.toggle('on'); });
    s.querySelector('#tf').addEventListener('submit', async (e) => {
      e.preventDefault(); const imie = s.querySelector('#t_i').value.trim(); if (!imie) { s.querySelector('#t_x').textContent = 'Wpisz imię.'; return; }
      await save('p_dt', { ...p, imie, telefon: s.querySelector('#t_t').value.trim(), miasto: s.querySelector('#t_m').value.trim(), pojemnosc: Math.max(1, +s.querySelector('#t_c').value || 1), umie: [...s.querySelectorAll('#t_u .on')].map((b) => b.dataset.k), dostepny: s.querySelector('#t_d').checked, notatka: s.querySelector('#t_n').value.trim() });
      closeSheet(); toast('Zapisane');
    });
  });
}
