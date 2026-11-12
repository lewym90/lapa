// Czat wolontariuszy: wiadomości jako zwykłe wpisy (kolekcja `czat`), reakcje (`czat_re`), załączniki do psów, zaginięć, terminów i transportów.
import { html, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet, STATUS } from './ui.js';
import { list, save, remove, get } from './store.js';
import { state, getName } from './auth.js';
import { on } from './bus.js';
import * as db from './db.js';
import { uid, slug, fmtTime, fmtDayLong, fmtDate } from './util.js';
import { addPhotoFile, hydratePhotos } from './photos.js';
import { pickDog, dogThumb } from './screens-psy.js';
import { promptCard, pushRead, prefs } from './push.js';

const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* */ } }
};
const K_READ = 'lapa.czat.read', K_CLEAR = 'lapa.czat.clear', K_TOAST = 'lapa.czat.toast';
const num = (k) => +(ls.get(k) || 0);
export const EMOJI = { up: '👍', ok: '✅', heart: '❤️', pray: '🙏', laugh: '😂', eyes: '👀', rece: '🙋' };
const BASIC = ['up', 'ok', 'heart', 'pray', 'laugh', 'eyes'];
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const same = (a, b) => norm(a).trim() === norm(b).trim();
const inChat = () => location.hash.startsWith('#/czat');
const snip = (m, n = 90) => { const t = String(m.text || '').replace(/\s+/g, ' ').trim(); return (t || (m.foto ? 'Zdjęcie' : m.ref?.nazwa || 'Wiadomość')).slice(0, n); };

// ---------- stan widoku ----------
let draft = { text: '', re: null, ref: null, foto: null, pilne: false, prosba: false, edit: null };
let q = '', searchOpen = false, limit = 120, readAtOpen = 0, lastCount = 0, firstPaint = true;

// ---------- nieprzeczytane ----------
export async function unreadCount() {
  const me = getName(), read = num(K_READ), clr = num(K_CLEAR);
  return (await list('czat')).filter((m) => m.ts > read && m.ts > clr && !same(m.autor, me)).length;
}
let badgeT;
export function refreshBadge() {
  clearTimeout(badgeT);
  badgeT = setTimeout(async () => {
    if (!state.loggedIn) return;
    const n = await unreadCount();
    document.querySelectorAll('.cbadge').forEach((el) => { el.textContent = n > 99 ? '99+' : String(n); el.hidden = n === 0; el.setAttribute('aria-label', n + ' nowych'); });
    try { if ('setAppBadge' in navigator) { n > 0 ? navigator.setAppBadge(n).catch(() => {}) : navigator.clearAppBadge().catch(() => {}); } } catch { /* odznaka nieobsługiwana */ }
  }, 120);
}
function markRead(msgs) {
  const mx = msgs.reduce((a, m) => Math.max(a, m.ts || 0), 0);
  if (mx > num(K_READ)) ls.set(K_READ, String(mx));
  refreshBadge(); pushRead();
}

// ---------- uczestnicy (do @wzmianek) ----------
let ppl = { t: 0, a: [] };
async function people() {
  if (Date.now() - ppl.t < 30000) return ppl.a;
  const set = new Set();
  for (const c of ['czat', 'terminarz', 'spacery', 'obserwacje', 'zdrowie', 'zaginiecia', 'transporty', 'potrzeby']) {
    try { for (const r of await db.getAll(c)) { if (r.by && r.by !== 'strona') set.add(r.by.trim()); if (r.data?.autor) set.add(String(r.data.autor).trim()); } } catch { /* */ }
  }
  const me = getName(); ppl = { t: Date.now(), a: [...set].filter((n) => n.length > 1 && !same(n, me)).sort((a, b) => a.localeCompare(b, 'pl')) };
  return ppl.a;
}
const tok = (n) => n.replace(/\s+/g, '');
async function mentionsIn(text) {
  const nt = norm(text), out = [];
  for (const n of await people()) {
    const t = '@' + norm(tok(n)); let i = nt.indexOf(t);
    while (i >= 0) { const nx = nt[i + t.length]; if (!nx || !/[a-z0-9_-]/.test(nx)) { out.push(n); break; } i = nt.indexOf(t, i + 1); }
  }
  return out;
}

// ---------- wygląd wiadomości ----------
const fmtText = (t, me) => esc(t)
  .replace(/(^|[\s(])@([\p{L}\p{N}_-]{1,30})/gu, (m, p, n) => `${p}<span class="mn${slug(n) === slug(me) ? ' me' : ''}">@${n}</span>`)
  .replace(/https?:\/\/[^\s<]+/g, (u) => { const c = u.replace(/[.,;:!?)]+$/, ''); return `<a href="${c}" target="_blank" rel="noopener noreferrer">${c}</a>${u.slice(c.length)}`; })
  .replace(/\n/g, '<br>');
const dayKey = (t) => new Date(t).toDateString();
const dayLabel = (t) => { const d = new Date(t), n = new Date(), y = new Date(n.getTime() - 864e5); return d.toDateString() === n.toDateString() ? 'Dziś' : d.toDateString() === y.toDateString() ? 'Wczoraj' : fmtDayLong(t); };
const REFICON = { pies: 'paw', zag: 'alert', termin: 'calendar', transport: 'truck' };

function msgHtml(m, prev, ctx) {
  const { me, byId, re, readAt } = ctx, mine = same(m.autor, me);
  let o = '';
  if (!prev || dayKey(prev.ts) !== dayKey(m.ts)) o += `<div class="cday">${esc(dayLabel(m.ts))}</div>`;
  if (!ctx.divDone && !mine && m.ts > readAt && readAt > 0) { ctx.divDone = true; o += '<div class="cdiv" id="c-newdiv"><span>Nowe wiadomości</span></div>'; }
  const grp = prev && dayKey(prev.ts) === dayKey(m.ts) && same(prev.autor, m.autor) && m.ts - prev.ts < 5 * 60e3;
  const rx = re[m.id] || {}, pro = m.kind === 'prosba', rece = rx.rece || [];
  const q0 = m.re && byId[m.re];
  o += `<div class="cb${mine ? ' me' : ''}${grp ? ' grp' : ''}${pro ? ' pro' : ''}${m.zalatwione ? ' done' : ''}${m.pilne ? ' urgent' : ''}" role="button" tabindex="0" data-act="c-msg" data-id="${esc(m.id)}" id="cm-${esc(m.id)}">`;
  if (!mine && !grp) o += `<div class="cn">${esc(m.autor || '')}</div>`;
  if (pro) o += `<div class="cph">${icon('heart').s} Prośba o pomoc${m.zalatwione ? ' · załatwione' : ''}</div>`;
  if (m.pilne) o += '<div class="cpl">Pilne</div>';
  if (m.re) o += q0 ? `<button class="cq" data-act="c-quote" data-id="${esc(m.re)}"><b>${esc(q0.autor || '')}</b> ${esc(snip(q0, 70))}</button>` : '<div class="cq gone">Wiadomość usunięta</div>';
  if (m.text) o += `<div class="ct">${fmtText(m.text, me)}</div>`;
  if (m.foto) o += `<img class="cfoto" data-photo="${esc(m.foto)}" data-act="c-photo" data-id="${esc(m.foto)}" alt="Zdjęcie w czacie" loading="lazy">`;
  if (m.ref) o += `<button class="cref" data-act="c-ref" data-t="${esc(m.ref.typ)}" data-id="${esc(m.ref.id)}">${icon(REFICON[m.ref.typ] || 'pin').s}<span>${esc(m.ref.nazwa || '')}</span>${icon('chev').s}</button>`;
  if (pro) {
    const names = rece.join(', ');
    o += `<div class="cpro">${rece.length ? `Zgłosili się: <b>${esc(names)}</b>` : 'Nikt jeszcze się nie zgłosił.'}`;
    if (!m.zalatwione) o += `<div class="btnrow" style="margin-top:6px"><button class="btn sm gold" data-act="c-join" data-id="${esc(m.id)}">${rece.some((n) => same(n, me)) ? 'Wycofaj zgłoszenie' : 'Zgłaszam się'}</button>${mine ? `<button class="btn sm ghost" data-act="c-done" data-id="${esc(m.id)}">Załatwione</button>` : ''}</div>`;
    else if (mine) o += `<div class="btnrow" style="margin-top:6px"><button class="btn sm ghost" data-act="c-done" data-id="${esc(m.id)}">Cofnij „załatwione”</button></div>`;
    o += '</div>';
  }
  o += `<div class="cm">${m.pin ? icon('pin').s + ' ' : ''}${m.edytowano ? 'edytowano · ' : ''}${esc(fmtTime(m.ts))}</div>`;
  const chips = BASIC.filter((k) => (rx[k] || []).length);
  if (chips.length) o += `<div class="cre">${chips.map((k) => `<button class="${(rx[k] || []).some((n) => same(n, me)) ? 'on' : ''}" data-act="c-re" data-id="${esc(m.id)}" data-e="${k}" aria-label="${esc((rx[k] || []).join(', '))}">${EMOJI[k]} ${rx[k].length}</button>`).join('')}</div>`;
  return o + '</div>';
}

async function load() {
  const [msgs0, reacts] = await Promise.all([list('czat'), list('czat_re')]);
  const clr = num(K_CLEAR), all = msgs0.filter((m) => m.ts > clr).sort((a, b) => a.ts - b.ts || String(a.id).localeCompare(b.id));
  const byId = Object.fromEntries(all.map((m) => [m.id, m])), re = {};
  for (const r of reacts) { if (!byId[r.msg]) continue; ((re[r.msg] ||= {})[r.e] ||= []).push(r.imie); }
  return { all, byId, re };
}

async function paint(open = false) {
  const box = document.getElementById('c-msgs'); if (!box) return;
  const { all, byId, re } = await load(), me = getName();
  const nb = innerHeight + scrollY >= document.documentElement.scrollHeight - 180;
  const needle = norm(q).trim();
  let vis = needle ? all.filter((m) => norm([m.text, m.autor, m.ref?.nazwa].join(' ')).includes(needle)) : all;
  const more = vis.length > limit; if (more) vis = vis.slice(-limit);
  const ctx = { me, byId, re, readAt: open ? readAtOpen : readAtOpen, divDone: false };
  box.innerHTML = (more ? '<button class="btn sm ghost cmore" data-act="c-more">Pokaż starsze</button>' : '') + (vis.length ? vis.map((m, i) => msgHtml(m, vis[i - 1], ctx)).join('') : `<div class="empty" style="padding:30px 10px">${icon('chat').s}<h3>${needle ? 'Nic nie znaleziono' : 'Czat jest pusty'}</h3><p>${needle ? 'Spróbuj innego słowa.' : 'Napisz pierwszą wiadomość: np. czy ktoś może jutro zawieźć psa do weta.'}</p></div>`);
  hydratePhotos(box);
  const pins = all.filter((m) => m.pin).sort((a, b) => b.ts - a.ts), pb = document.getElementById('c-pin');
  if (pb) pb.innerHTML = pins.length ? `<button class="cpin" data-act="c-quote" data-id="${esc(pins[0].id)}">${icon('pin').s}<span><b>Przypięte${pins.length > 1 ? ' (' + pins.length + ')' : ''}:</b> ${esc(snip(pins[0], 80))}</span></button>` : '';
  const sc = document.getElementById('c-scount'); if (sc) sc.textContent = needle ? `Znaleziono: ${vis.length}` : '';
  const pill = document.getElementById('c-new');
  const grew = all.length > lastCount;
  if (open || firstPaint) {
    firstPaint = false;
    const dv = document.getElementById('c-newdiv');
    requestAnimationFrame(() => { if (dv) dv.scrollIntoView({ block: 'start' }); else scrollTo(0, document.documentElement.scrollHeight); });
  } else if (!needle && grew) {
    const last = all[all.length - 1];
    if (nb || same(last.autor, me)) { requestAnimationFrame(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })); if (pill) pill.hidden = true; }
    else if (pill) pill.hidden = false;
  }
  lastCount = all.length;
  if (document.visibilityState === 'visible') markRead(all);
}

// ---------- pole pisania ----------
function chipsHtml() {
  const c = [];
  if (draft.edit) c.push(['edit', 'Edytujesz wiadomość']);
  if (draft.re) c.push(['re', 'Odpowiedź: ' + snip(draft.re, 40)]);
  if (draft.ref) c.push(['ref', draft.ref.nazwa]);
  if (draft.foto) c.push(['foto', 'Zdjęcie']);
  if (draft.prosba) c.push(['prosba', 'Prośba o pomoc']);
  if (draft.pilne) c.push(['pilne', 'Pilne']);
  return c.map(([k, t]) => `<span class="cchip">${k === 'foto' ? `<img data-photo="${esc(draft.foto)}" alt="">` : ''}${esc(t)}<button data-act="c-rm" data-k="${k}" aria-label="Usuń">${icon('x').s}</button></span>`).join('');
}
function renderChips() { const e = document.getElementById('c-chips'); if (e) { e.innerHTML = chipsHtml(); hydratePhotos(e); } }
function growInput(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }
async function suggest(t) {
  const box = document.getElementById('c-sug'); if (!box) return;
  const m = /(^|\s)@([\p{L}\p{N}_-]*)$/u.exec(t.value.slice(0, t.selectionStart));
  if (!m) { box.innerHTML = ''; return; }
  const p = norm(m[2]), names = (await people()).filter((n) => norm(tok(n)).startsWith(p)).slice(0, 6);
  box.innerHTML = names.map((n) => `<button class="cchip pick" data-act="c-mention" data-n="${esc(tok(n))}">@${esc(n)}</button>`).join('');
}

async function send() {
  const t = document.getElementById('c-in'), text = (t?.value ?? draft.text).trim().slice(0, 1000), me = getName();
  if (!me) { toast('Najpierw wpisz imię w ustawieniach', true); return; }
  if (!text && !draft.ref && !draft.foto) return;
  if (draft.prosba && !text) { toast('Opisz, w czym potrzebujesz pomocy', true); return; }
  const wzm = text ? await mentionsIn(text) : [];
  if (draft.edit) {
    const m = await get('czat', draft.edit);
    if (m) await save('czat', { ...m, text, wzm, edytowano: Date.now() });
  } else {
    const m = { id: uid(), ts: Date.now(), autor: me, text, kind: draft.prosba ? 'prosba' : 'msg' };
    if (draft.pilne) m.pilne = true; if (wzm.length) m.wzm = wzm; if (draft.re) m.re = draft.re.id; if (draft.ref) m.ref = draft.ref; if (draft.foto) m.foto = draft.foto;
    await save('czat', m);
  }
  draft = { text: '', re: null, ref: null, foto: null, pilne: false, prosba: false, edit: null };
  if (t) { t.value = ''; growInput(t); } renderChips(); const sg = document.getElementById('c-sug'); if (sg) sg.innerHTML = '';
  await paint(); requestAnimationFrame(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
}

// ---------- ekran ----------
export async function czat() {
  readAtOpen = num(K_READ); lastCount = 0; firstPaint = true; q = ''; searchOpen = false; limit = 120;
  const card = await promptCard();
  return {
    tab: 'start', title: 'Czat', nav: false, live: false,
    html: html`${pageBar('Czat wolontariuszy', { right: html`<button class="iconbtn" data-act="c-search" aria-label="Szukaj w czacie">${icon('search')}</button><button class="iconbtn" data-act="c-info" aria-label="Jak działa czat">${icon('info')}</button>` })}
    <div class="chat">
      <div class="cnote">${icon('info')}<span>Czat widzą wszyscy wolontariusze. Wiadomości nie są szyfrowane, więc nie wpisuj haseł ani prywatnych danych. <button class="link" data-act="c-info">Jak to działa</button></span></div>
      ${card ? html`<div style="padding:0 12px 8px">${card}</div>` : ''}
      <div id="c-sbar" class="csbar" hidden><input class="input" id="c-q" type="search" placeholder="Szukaj w wiadomościach" aria-label="Szukaj w czacie" autocomplete="off"><small id="c-scount"></small></div>
      <div id="c-pin"></div>
      <div class="cmsgs" id="c-msgs" aria-live="polite"></div>
      <button class="cnewpill" id="c-new" data-act="c-down" hidden>${icon('chev')} Nowe wiadomości</button>
      <div class="composer"><div id="c-chips" class="cchips"></div>
        <div class="crow"><button class="iconbtn cplus" data-act="c-attach" aria-label="Dodaj pieska, termin, zdjęcie lub prośbę o pomoc">${icon('paperclip')}</button>
          <textarea id="c-in" rows="1" maxlength="1000" placeholder="Napisz wiadomość…" aria-label="Wiadomość"></textarea>
          <button class="csend" data-act="c-send" aria-label="Wyślij">${icon('send')}</button></div><div id="c-sug" class="csug"></div></div>
    </div>`,
    async mount(root) {
      const t = root.querySelector('#c-in'); t.value = draft.text; growInput(t); renderChips();
      t.addEventListener('input', () => { draft.text = t.value; growInput(t); suggest(t); });
      t.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover:hover) and (pointer:fine)').matches) { e.preventDefault(); send(); } });
      root.querySelector('#c-q').addEventListener('input', (e) => { q = e.target.value; paint(); });
      window.addEventListener('scroll', () => { const p = document.getElementById('c-new'); if (p && !p.hidden && innerHeight + scrollY >= document.documentElement.scrollHeight - 120) p.hidden = true; }, { passive: true });
      await paint(true);
    }
  };
}

// ---------- akcje ----------
actions['c-send'] = () => send();
actions['c-down'] = () => { scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }); const p = document.getElementById('c-new'); if (p) p.hidden = true; };
actions['c-more'] = () => { limit += 120; paint(); };
actions['c-search'] = () => { searchOpen = !searchOpen; const b = document.getElementById('c-sbar'); if (!b) return; b.hidden = !searchOpen; if (searchOpen) document.getElementById('c-q').focus(); else { q = ''; document.getElementById('c-q').value = ''; paint(); } };
actions['c-rm'] = (el) => {
  const k = el.dataset.k; if (k === 'edit') { draft.edit = null; draft.text = ''; const t = document.getElementById('c-in'); if (t) { t.value = ''; growInput(t); } }
  else if (k === 're') draft.re = null; else if (k === 'ref') draft.ref = null; else if (k === 'foto') draft.foto = null; else if (k === 'prosba') draft.prosba = false; else if (k === 'pilne') draft.pilne = false;
  renderChips();
};
actions['c-mention'] = (el) => {
  const t = document.getElementById('c-in'), pos = t.selectionStart, head = t.value.slice(0, pos).replace(/@([\p{L}\p{N}_-]*)$/u, '@' + el.dataset.n + ' ');
  t.value = head + t.value.slice(pos); draft.text = t.value; t.focus(); t.setSelectionRange(head.length, head.length); document.getElementById('c-sug').innerHTML = ''; growInput(t);
};
actions['c-quote'] = (el) => {
  const e = document.getElementById('cm-' + el.dataset.id); if (!e) { toast('Ta wiadomość jest poza widokiem (starsza lub usunięta)'); return; }
  e.scrollIntoView({ block: 'center', behavior: 'smooth' }); e.classList.add('flash'); setTimeout(() => e.classList.remove('flash'), 1600);
};
actions['c-photo'] = (el) => { openSheet(`<img class="cbig" data-photo="${esc(el.dataset.id)}" alt="Zdjęcie"><button class="btn ghost block" style="margin-top:12px" data-sheet-close>Zamknij</button>`, (s) => hydratePhotos(s)); };

const toggleRe = async (m, key) => {
  const me = getName(); if (!me) { toast('Najpierw wpisz imię w ustawieniach', true); return; }
  const id = `${m.id}-${slug(me).slice(0, 14) || 'u'}-${key}`;
  if (await get('czat_re', id)) await remove('czat_re', id); else await save('czat_re', { id, msg: m.id, imie: me, e: key });
  paint();
};
actions['c-re'] = async (el) => { const m = await get('czat', el.dataset.id); if (m) toggleRe(m, el.dataset.e); };
actions['c-join'] = async (el) => { const m = await get('czat', el.dataset.id); if (m) { await toggleRe(m, 'rece'); toast('Zapisane. Autor prośby zobaczy Twoje imię'); } };
actions['c-done'] = async (el) => { const m = await get('czat', el.dataset.id); if (m) { await save('czat', { ...m, zalatwione: !m.zalatwione }); paint(); } };

actions['c-msg'] = async (el) => {
  const m = await get('czat', el.dataset.id); if (!m) return;
  const me = getName(), mine = same(m.autor, me), can = mine || state.coordinator;
  openSheet(`<h2>Wiadomość</h2><p class="hint" style="margin:0 0 6px">${esc(m.autor || '')}, ${esc(fmtDate(m.ts))} ${esc(fmtTime(m.ts))}</p><p style="margin:0 0 10px;color:var(--graphite)">${esc(snip(m, 140))}</p>
    <div class="remoji">${BASIC.map((k) => `<button data-e="${k}" aria-label="Reakcja ${EMOJI[k]}">${EMOJI[k]}</button>`).join('')}</div>
    <div class="rows"><button class="row" data-a="re">${icon('reply').s}<span class="rt"><b>Odpowiedz</b></span></button>
    <button class="row" data-a="pin">${icon('pin').s}<span class="rt"><b>${m.pin ? 'Odepnij' : 'Przypnij u góry'}</b></span></button>
    ${m.text ? `<button class="row" data-a="copy">${icon('link').s}<span class="rt"><b>Kopiuj tekst</b></span></button>` : ''}
    ${mine && m.text ? `<button class="row" data-a="edit">${icon('pencil').s}<span class="rt"><b>Edytuj</b></span></button>` : ''}
    ${can ? `<button class="row" data-a="del" style="color:var(--terra-d)">${icon('x').s}<span class="rt"><b>Usuń wiadomość</b><small>Zniknie u wszystkich</small></span></button>` : ''}</div>`, (s) => {
    s.querySelectorAll('[data-e]').forEach((b) => { b.onclick = () => { closeSheet(); toggleRe(m, b.dataset.e); }; });
    s.querySelectorAll('[data-a]').forEach((b) => {
      b.onclick = async () => {
        const a = b.dataset.a; closeSheet();
        if (a === 're') { draft.re = { id: m.id, autor: m.autor, text: m.text, foto: m.foto, ref: m.ref }; renderChips(); document.getElementById('c-in')?.focus(); }
        else if (a === 'pin') { await save('czat', { ...m, pin: !m.pin }); paint(); }
        else if (a === 'copy') { try { await navigator.clipboard.writeText(m.text); toast('Skopiowano'); } catch { toast('Nie udało się skopiować', true); } }
        else if (a === 'edit') { draft.edit = m.id; draft.text = m.text; const t = document.getElementById('c-in'); if (t) { t.value = m.text; growInput(t); t.focus(); } renderChips(); }
        else if (a === 'del' && await confirmSheet('Usunąć wiadomość?', 'Zniknie u wszystkich wolontariuszy.', 'Usuń', true)) { await remove('czat', m.id); paint(); }
      };
    });
  });
};

// ---------- załączniki ----------
actions['c-attach'] = () => {
  openSheet(`<h2>Dodaj do wiadomości</h2><div class="rows">
    <button class="row" data-t="pies">${icon('paw').s}<span class="rt"><b>Pies</b><small>Wszyscy zobaczą jego kartę</small></span></button>
    <button class="row" data-t="zag">${icon('alert').s}<span class="rt"><b>Zaginięcie</b></span></button>
    <button class="row" data-t="termin">${icon('calendar').s}<span class="rt"><b>Termin z terminarza</b></span></button>
    <button class="row" data-t="transport">${icon('truck').s}<span class="rt"><b>Transport</b></span></button>
    <button class="row" data-t="foto">${icon('camera').s}<span class="rt"><b>Zdjęcie</b><small>Z aparatu lub galerii</small></span></button></div>
    <input type="file" accept="image/*" id="c-file" hidden>
    <label class="swrow"><span><b>Prośba o pomoc</b><br><small>Ktoś zgłosi się jednym dotknięciem</small></span><input type="checkbox" id="o_pro" ${draft.prosba ? 'checked' : ''}></label>
    <label class="swrow"><span><b>Pilne</b><br><small>Powiadomienie także w nocy</small></span><input type="checkbox" id="o_pil" ${draft.pilne ? 'checked' : ''}></label>
    <button class="btn block" style="margin-top:12px" data-sheet-close>Gotowe</button>`, (s) => {
    s.querySelector('#o_pro').onchange = (e) => { draft.prosba = e.target.checked; renderChips(); };
    s.querySelector('#o_pil').onchange = (e) => { draft.pilne = e.target.checked; renderChips(); };
    const file = s.querySelector('#c-file');
    file.onchange = async () => { const f = file.files[0]; if (!f) return; try { draft.foto = await addPhotoFile(f); closeSheet(); renderChips(); } catch { toast('Nie udało się wczytać zdjęcia', true); } };
    s.querySelectorAll('.row').forEach((b) => { b.onclick = () => { const t = b.dataset.t; if (t === 'foto') { file.click(); return; } closeSheet(); picker(t); }; });
  });
};
async function picker(t) {
  const set = (ref) => { draft.ref = ref; renderChips(); document.getElementById('c-in')?.focus(); };
  if (t === 'pies') { pickDog((d) => set({ typ: 'pies', id: d.id, nazwa: d.imie })); return; }
  let rows = [];
  if (t === 'zag') rows = (await list('zaginiecia')).filter((z) => z.status !== 'znaleziony').map((z) => ({ id: z.id, nazwa: 'Zaginął(a): ' + z.imie, sub: [z.gdzie, z.kiedy && fmtDate(z.kiedy)].filter(Boolean).join(' · ') }));
  if (t === 'termin') { const t0 = Date.now() - 864e5; rows = (await list('terminarz')).filter((e) => e.widocznosc !== 'ja' && e.start && e.start >= t0).sort((a, b) => a.start - b.start).slice(0, 40).map((e) => ({ id: e.id, nazwa: e.tytul, sub: fmtDate(e.start) + ' ' + fmtTime(e.start) })); }
  if (t === 'transport') rows = (await list('transporty')).filter((x) => !['zrealizowany', 'anulowany'].includes(x.status)).sort((a, b) => a.kiedy - b.kiedy).map((x) => ({ id: x.id, nazwa: 'Transport: ' + (x.pies_imie || 'pies'), sub: `${x.skad} → ${x.dokad}` }));
  const T = { zag: 'Wybierz zaginięcie', termin: 'Wybierz termin', transport: 'Wybierz transport' }[t], TYP = { zag: 'zag', termin: 'termin', transport: 'transport' }[t];
  openSheet(`<h2>${T}</h2>${rows.length ? `<div class="rows">${rows.map((r, i) => `<button class="row" data-i="${i}"><span class="rt"><b>${esc(r.nazwa)}</b><small>${esc(r.sub)}</small></span></button>`).join('')}</div>` : '<p class="hint">Nic do wyboru. Dodaj najpierw wpis w odpowiedniej części aplikacji.</p>'}`, (s) => {
    s.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => { const r = rows[+b.dataset.i]; closeSheet(); set({ typ: TYP, id: r.id, nazwa: r.nazwa }); }; });
  });
}

// ---------- podgląd karty (bez wychodzenia z czatu) ----------
actions['c-ref'] = async (el) => {
  const t = el.dataset.t, id = el.dataset.id, none = () => openSheet('<h2>Nie ma już tego wpisu</h2><p class="hint">Mógł zostać usunięty.</p><button class="btn ghost block" data-sheet-close>Zamknij</button>');
  if (t === 'pies') {
    const d = await get('psy', id); if (!d) return none();
    openSheet(`<div style="display:flex;gap:14px;align-items:center;margin-bottom:10px"><span class="avatar" style="width:84px;height:84px">${dogThumb(d).s}</span><div><h2 style="margin:0">${esc(d.imie)}</h2><div class="sub">${esc([d.plec, d.wiek, d.wielkosc, d.status && STATUS[d.status]].filter(Boolean).join(' · '))}</div></div></div>
      ${d.haslo ? `<p class="hint" style="margin:0 0 6px">${esc(d.haslo)}</p>` : ''}${d.opis ? `<p style="margin:0 0 12px;color:var(--graphite)">${esc(String(d.opis).slice(0, 260))}${d.opis.length > 260 ? '…' : ''}</p>` : ''}
      <button class="btn gold block" data-go="#/psy/${esc(id)}">Otwórz pełną kartę psa</button><button class="btn ghost block" style="margin-top:8px" data-sheet-close>Wróć do czatu</button>`, (s) => { hydratePhotos(s); goBtn(s); });
  } else if (t === 'zag') {
    const z = await get('zaginiecia', id); if (!z) return none();
    openSheet(`<h2>${esc(z.imie)}${z.status === 'znaleziony' ? ' (znaleziony)' : ''}</h2><p class="sub">Zaginął(a) ${esc(fmtDate(z.kiedy))}${z.gdzie ? ' · ' + esc(z.gdzie) : ''}</p>${z.ostatnio ? `<p class="hint">Ostatnio widziany: ${esc(z.ostatnio)}</p>` : ''}${z.opis ? `<p>${esc(z.opis)}</p>` : ''}
      <button class="btn gold block" data-act-open="zag-open" data-id="${esc(id)}">Otwórz zgłoszenie</button><button class="btn ghost block" style="margin-top:8px" data-sheet-close>Wróć do czatu</button>`, (s) => openBtn(s));
  } else if (t === 'termin') {
    const e = await get('terminarz', id); if (!e) return none();
    openSheet(`<h2>${esc(e.tytul)}</h2><p class="sub">${e.start ? esc(fmtDayLong(e.start) + ', ' + fmtTime(e.start)) : ''}${e.miejsce ? ' · ' + esc(e.miejsce) : ''}</p>${e.notatka ? `<p>${esc(e.notatka)}</p>` : ''}
      <button class="btn gold block" data-act-open="tm-open" data-id="${esc(id)}">Otwórz wpis i zgłoś się</button><button class="btn ghost block" style="margin-top:8px" data-sheet-close>Wróć do czatu</button>`, (s) => openBtn(s));
  } else if (t === 'transport') {
    const x = await get('transporty', id); if (!x) return none();
    openSheet(`<h2>Transport: ${esc(x.pies_imie || 'pies')}</h2><p class="sub">${esc(x.skad)} → ${esc(x.dokad)}${x.kiedy ? ' · ' + esc(fmtDate(x.kiedy) + ' ' + fmtTime(x.kiedy)) : ''}</p><p class="hint">Status: ${esc({ szuka: 'Poszukiwany kierowca', przypisany: 'Przypisany', zrealizowany: 'Zrealizowany', anulowany: 'Anulowany' }[x.status] || x.status || '')}${x.kierowca ? ' · kierowca: ' + esc(x.kierowca) : ''}</p>${x.uwagi ? `<p>${esc(x.uwagi)}</p>` : ''}
      <button class="btn gold block" data-go="#/transport">Przejdź do transportów</button><button class="btn ghost block" style="margin-top:8px" data-sheet-close>Wróć do czatu</button>`, (s) => goBtn(s));
  }
};
const goBtn = (s) => s.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { closeSheet(); location.hash = b.dataset.go; }; });
const openBtn = (s) => s.querySelectorAll('[data-act-open]').forEach((b) => { b.onclick = () => { closeSheet(); actions[b.dataset.actOpen]?.({ dataset: { id: b.dataset.id } }); }; });

// ---------- informacja o czacie ----------
actions['c-info'] = () => {
  openSheet(`<h2>Jak działa czat</h2>
    <div class="infotxt"><p><b>Kto widzi.</b> Każdy wolontariusz z aplikacją. Nie ma wiadomości prywatnych ani osobnych pokoi.</p>
    <p><b>Szybkość.</b> Przy otwartej aplikacji wiadomość dociera po kilku sekundach. Gdy aplikacja jest zamknięta, przyjdzie powiadomienie (jeśli są włączone w Ustawieniach). Mogą się spóźnić, gdy telefon oszczędza baterię lub ma tryb „Nie przeszkadzaj”. Przy sprawach pilnych zadzwoń lub użyj WhatsAppa.</p>
    <p><b>Powiadomienia.</b> Domyślnie obowiązuje cisza nocna 22:00–7:00. Wiadomość oznaczona jako „Pilne” oraz wzmianka <b>@Twoje imię</b> przyjdą także w nocy. Czat można wyciszyć w Ustawieniach.</p>
    <p><b>Przechowywanie.</b> Serwer trzyma wiadomości i zdjęcia około 30 dni, potem je kasuje. Kopie zapasowe serwera mogą je przechowywać do 60 dni. Na Twoim telefonie zostają, dopóki ich nie wyczyścisz.</p>
    <p><b>Szyfrowanie.</b> Wiadomości <b>nie są szyfrowane end-to-end</b>. Technicznie ma do nich dostęp każdy, kto administruje serwerem. Dlatego <b>zachowaj ostrożność</b>: nie wysyłaj haseł, numerów dokumentów, danych adopcyjnych ani zdjęć dokumentów.</p>
    <p><b>Swoje wiadomości</b> możesz edytować i usuwać (dotknij wiadomości). Usunięta znika u wszystkich, ale może jeszcze być w kopii zapasowej.</p></div>
    <div class="btnrow"><a class="btn ghost" href="#/ustawienia">Powiadomienia</a><button class="btn ghost" data-a="clear" style="color:var(--terra-d)">Wyczyść u mnie</button></div>
    <button class="btn block" style="margin-top:10px" data-sheet-close>Rozumiem</button>`, (s) => {
    s.querySelector('[data-a=clear]').onclick = async () => { if (await confirmSheet('Wyczyścić czat na tym telefonie?', 'Wiadomości znikną tylko z tego telefonu. Inni wolontariusze nadal je mają.', 'Wyczyść', true)) { ls.set(K_CLEAR, String(Date.now())); await paint(); toast('Wyczyszczono na tym telefonie'); } };
  });
};

// ---------- start: licznik, baner o nowej wiadomości, kliknięcie powiadomienia ----------
let banner = null;
function showBanner(m) {
  banner?.remove(); const b = document.createElement('button'); b.className = 'cbanner'; banner = b;
  b.innerHTML = `${icon('chat').s}<span><b>${esc(m.autor || '')}</b> ${esc(m.kind === 'prosba' ? 'prosi o pomoc: ' : '')}${esc(snip(m, 80))}</span>`;
  b.onclick = () => { b.remove(); location.hash = '#/czat'; };
  document.body.appendChild(b); setTimeout(() => { if (banner === b) { b.remove(); banner = null; } }, 6500);
}
let paintT;
export function initChat() {
  on('change', async () => {
    if (!state.loggedIn || !getName()) return;
    refreshBadge();
    if (inChat()) { clearTimeout(paintT); paintT = setTimeout(() => paint(), 80); return; }
    if (document.visibilityState !== 'visible') return;
    const me = getName(), lim = Math.max(num(K_READ), num(K_TOAST), num(K_CLEAR), Date.now() - 3 * 60e3);
    const n = (await list('czat')).filter((m) => m.ts > lim && !same(m.autor, me)).sort((a, b) => b.ts - a.ts)[0];
    if (!n) return;
    ls.set(K_TOAST, String(n.ts));
    if (prefs.mute() && !(n.wzm || []).some((x) => same(x, me))) return;
    showBanner(n);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { refreshBadge(); if (inChat()) paint(); } });
  addEventListener('hashchange', () => { setTimeout(refreshBadge, 300); });
  navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'go' && typeof e.data.url === 'string' && e.data.url.startsWith('#/')) location.hash = e.data.url; });
  refreshBadge();
}
