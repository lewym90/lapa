import { html, raw, icon, esc, openSheet, closeSheet, toast, actions, brandBar, pageBar, dogImg, safeUrl } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName } from './auth.js';
import { gaps, siteNew, siteNewLinks } from './teczka.js';
import { zalegle } from './adopcje.js';
import { aktywneLiczba } from './zaginiecia.js';
import { greeting, dogOfDay, dogNeeds, fmtShort, startOfDay, NEED_LABELS, fmtDate } from './util.js';

const seenK = 'lapa.kseen';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

export async function start() {
  const [dogs, walks, tasks, kom, zdr] = await Promise.all([list('psy'), list('spacery'), list('moje_zadania'), list('komunikaty'), list('zdrowie')]);
  siteNew().catch(() => {}); const siteN = (await siteNewLinks()).length; const todo = gaps(dogs, zdr), adLate = await zalegle(), lost = await aktywneLiczba();
  const dog = dogOfDay(dogs);
  const helpDogs = dogs.filter((d) => d.status === 'pilne' || dogNeeds(d, walks).length).sort((a, b) => (b.status === 'pilne') - (a.status === 'pilne'));
  kom.sort((a, b) => b.ts - a.ts);
  const kLast = kom[0], dot = !!kLast && kLast.ts > (+lsGet(seenK) || 0);
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.termin || 9e15) - (b.termin || 9e15));
  const doneToday = tasks.filter((t) => t.done && t.doneAt && startOfDay(t.doneAt) === startOfDay(Date.now()));
  const shown = [...open.slice(0, 3), ...doneToday.slice(0, 1)];
  const now = Date.now();

  const hero = dog
    ? html`<section class="hero" aria-label="Pies dnia">${dogImg(dog.zdjecia[0], dog.imie, 'ph')}
        <div class="copy"><h2>Dziś możesz zmienić czyjś dzień</h2><div class="goldline"></div>
        <a class="dogtag" href="#/psy/${dog.id}">${icon('paw')}<span>Dziś w ŁAPIE:</span> <b>${dog.imie}</b> ${icon('chev')}</a></div></section>`
    : html`<section class="hero nodog"><span class="pawbig">${icon('paw')}</span>
        <div class="copy"><h2>Dziś możesz zmienić czyjś dzień</h2><div class="goldline"></div>
        <a class="dogtag" href="#/psy" data-act="a-dog">${icon('plus')}<span>Dodaj pierwszego psa</span></a></div></section>`;

  return {
    tab: 'start', title: 'Start',
    html: html`${brandBar(dot)}
    <section class="hello"><h1>${greeting()}</h1><p>Wolontariat Schroniska dla Psów w Nowodworze</p></section>
    ${kLast && now - kLast.ts < 7 * 864e5 ? html`<div class="pad" style="margin-top:14px"><div class="card" style="background:rgba(244,240,231,.1);color:var(--ivory);border:1px solid var(--line-l);box-shadow:none"><div class="card-head"><h3 style="color:var(--ivory);font-size:17px">${icon('bell')} Komunikat</h3><span class="hint" style="color:var(--sage)">${kLast.autor || ''} · ${fmtShort(kLast.ts)}</span></div><div style="white-space:pre-line">${kLast.tekst}</div></div></div>` : ''}
    ${hero}
    <div class="tiles">
      <a class="tile green" href="#/zrobic">${todo.length + siteN ? html`<span class="badge">${todo.length + siteN}</span>` : ''}${icon('check', 't-ico')}<span class="t-lbl">Do zrobienia</span>${icon('arrow', 't-arr')}</a>
      <a class="tile terra" href="#/pomoc">${helpDogs.length ? html`<span class="badge">${helpDogs.length}</span>` : ''}${icon('medic', 't-ico')}<span class="t-lbl">Psy potrzebujące pomocy</span>${icon('arrow', 't-arr')}</a>
      <a class="tile sage" href="#/transport">${icon('truck', 't-ico')}<span class="t-lbl">Transport</span>${icon('arrow', 't-arr')}</a>
      <a class="tile green" href="#/brama" style="grid-column:1/-1;min-height:64px;flex-direction:row;align-items:center;gap:12px">${icon('walk', 't-ico')}<span class="t-lbl">Brama: wydaj / zwróć psa na spacer</span>${icon('arrow', 't-arr')}</a>
    </div>
    ${lost ? html`<div class="pad" style="margin-top:16px"><a class="card" href="#/zaginiecia" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--graphite);border-left:5px solid var(--terra)">${icon('alert')}<span><b>Poszukiwane psy: ${lost}</b><br><span class="hint">Zobacz kartę, post i plakat</span></span></a></div>` : ''}
    ${adLate ? html`<div class="pad" style="margin-top:16px"><a class="card" href="#/adopcje" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--graphite)">${icon('heart')}<span><b>Adopcje: zaległe kroki (${adLate})</b><br><span class="hint">Ktoś czeka na odpowiedź albo wizytę</span></span></a></div>` : ''}
    <div class="pad" style="margin-top:16px"><section class="card" aria-label="Moje zadania">
      <div class="card-head"><h3>${icon('check')} Moje zadania</h3><a class="link" href="#/zadania">Zobacz wszystkie ${icon('arrow')}</a></div>
      ${shown.length ? shown.map((t) => taskRow(t)) : html`<p class="sub" style="margin:8px 0 4px">Nic na dziś. Dodaj zadanie przyciskiem <b>+</b> albo zacznij od spaceru.</p>`}
    </section></div>
    ${helpDogs.length ? html`<div class="sec"><h2>Potrzebują Cię dziś</h2><a class="link" href="#/pomoc">Wszystkie</a></div>
      <div class="pad stack">${helpDogs.slice(0, 3).map((d) => html`<a class="row card" style="border:0" href="#/psy/${d.id}"><span class="avatar sm">${dogImg(d.zdjecia?.[0], d.imie)}</span>
        <span class="rt"><b>${d.imie}</b><small>${[d.status === 'pilne' ? 'Pilny przypadek' : '', ...dogNeeds(d, walks).slice(0, 2).map((k) => NEED_LABELS[k])].filter(Boolean).join(' · ')}</small></span>${icon('chev')}</a>`)}</div>` : ''}`
  };
}

function taskRow(t) {
  const late = t.termin && !t.done && t.termin < Date.now();
  return html`<div class="task ${t.done ? 'done' : ''}"><button class="chk" data-act="task-toggle" data-id="${t.id}" aria-label="${t.done ? 'Oznacz jako niewykonane' : 'Oznacz jako wykonane'}" aria-pressed="${!!t.done}">${icon('check')}</button>
    <span class="tt">${t.tytul}</span>${t.termin ? html`<span class="dchip ${late ? 'late' : ''}">${icon('calendar')}${fmtShort(t.termin)}</span>` : ''}</div>`;
}
actions['task-toggle'] = async (el) => {
  const t = await get('moje_zadania', el.dataset.id); if (!t) return;
  t.done = !t.done; t.doneAt = t.done ? Date.now() : null; await save('moje_zadania', t);
};

export async function tasks() {
  const all = await list('moje_zadania');
  const open = all.filter((t) => !t.done).sort((a, b) => (a.termin || 9e15) - (b.termin || 9e15));
  const done = all.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 15);
  return {
    tab: 'start', title: 'Moje zadania',
    html: html`${pageBar('Moje zadania', { right: html`<button class="iconbtn" data-act="a-task" aria-label="Dodaj zadanie">${icon('plus')}</button>` })}
    <div class="pad stack"><p class="hint" style="color:var(--sage);margin:0">Te zadania widzisz tylko Ty, na tym telefonie.</p>
    <section class="card">${open.length ? open.map((t) => html`${taskRow(t)}`) : html`<p class="sub" style="margin:4px 0">Brak otwartych zadań.</p>`}</section>
    ${done.length ? html`<h2 style="font-size:20px;color:var(--gold-l)">Ostatnio zrobione</h2><section class="card">${done.map((t) => html`${taskRow(t)}`)}</section>` : ''}</div>`
  };
}
actions['task-del'] = async (el) => { await remove('moje_zadania', el.dataset.id); closeSheet(); };

export function taskForm(preset = {}) {
  openSheet(html`<h2>Nowe zadanie</h2><p class="hint" style="margin:0 0 14px">Zobaczysz je tylko Ty.</p>
    <form id="tf" novalidate><div class="field"><label for="tt">Co trzeba zrobić?</label><input class="input" id="tt" maxlength="120" value="${preset.tytul || ''}" required></div>
    <div class="field"><label for="td">Termin (opcjonalnie)</label><input class="input" id="td" type="datetime-local"></div>
    <div class="err" id="te"></div><button class="btn block" type="submit">Zapisz zadanie</button></form>`.s, (s) => {
    s.querySelector('#tf').addEventListener('submit', async (e) => {
      e.preventDefault(); const v = s.querySelector('#tt').value.trim();
      if (!v) { s.querySelector('#te').textContent = 'Wpisz, co trzeba zrobić.'; return; }
      const d = s.querySelector('#td').value;
      await save('moje_zadania', { tytul: v, termin: d ? new Date(d).getTime() : null, done: false });
      closeSheet(); toast('Zadanie zapisane');
    });
    s.querySelector('#tt').focus();
  });
}
actions['a-task'] = () => taskForm();

export async function komunikatySheet() {
  const kom = (await list('komunikaty')).sort((a, b) => b.ts - a.ts).slice(0, 20);
  try { localStorage.setItem(seenK, String(Date.now())); } catch {}
  openSheet(html`<h2>Komunikaty</h2>
    ${kom.length ? kom.map((k) => html`<div class="obs"><div class="oh"><span>${k.autor || 'Koordynator'}</span><span>${fmtDate(k.ts)}</span></div><div style="white-space:pre-line">${k.tekst}</div></div>`) : html`<p class="hint" style="font-size:15px">Brak komunikatów. Gdy koordynator coś ogłosi, pojawi się tutaj i na ekranie Start.</p>`}
    ${state.coordinator ? html`<form id="kf" style="margin-top:16px"><div class="field"><label for="kt">Nowy komunikat dla wszystkich</label><textarea class="textarea" id="kt" maxlength="800"></textarea></div><button class="btn block" type="submit">Opublikuj</button></form>` : ''}`.s, (s) => {
    s.querySelector('#kf')?.addEventListener('submit', async (e) => {
      e.preventDefault(); const t = s.querySelector('#kt').value.trim(); if (!t) return;
      await save('komunikaty', { tekst: t, ts: Date.now(), autor: getName() }); closeSheet(); toast('Komunikat opublikowany');
    });
  });
}
