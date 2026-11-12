// Zakładka „Social media”: gotowe teksty do skopiowania na Facebooka, Instagram, TikToka, YouTube i stronę schroniska.
// Zasady: bez AI, bez publikowania, bez logowania do żadnego serwisu. Teksty powstają z szablonów (wzorowanych na ich dotychczasowych
// postach) i danych psa. Każdy szablon można zmienić; zmiana zapisuje się wspólnie dla wszystkich wolontariuszy (kolekcja szablony_social).
import { html, icon, esc, openSheet, closeSheet, toast, actions, pageBar, confirmSheet } from './ui.js';
import { list, save, remove, get } from './store.js';
import { getName } from './auth.js';
import { on } from './bus.js';
import { fmtDate } from './util.js';
import { dogThumb } from './screens-psy.js';
import { hydratePhotos } from './photos.js';

const COL = 'szablony_social';
const KONTAKT = 'Kontakt w sprawie adopcji\nJustyna: 691 742 265\nDorota: 607 119 526\ne-mail: stowarzyszenie.nowodwor@wp.pl';
const KRS = 'PRZEKAŻ 1.5% NOWODWORSKIM OGONKOM KRS 0000861820';
const YT_STOPKA = 'KONTAKT W SPRAWIE ADOPCJI: \n- e-mail: stowarzyszenie.nowodwor@wp.pl\n- nr. tel. w sprawie adopcji: \n----- 691 742 265 - Justyna\n----- 607 119 526 - Dorota\n \n--- PRZEKAŻ 1.5% NOWODWORSKIM OGONKOM\nKRS 0000861820\n\nMEDIA SPOŁECZNOŚCIOWE:\n- facebook: https://www.facebook.com/SchroniskoNowodwor\n- tiktok: https://www.tiktok.com/@schronisko.nowodwor.wolo\n- instagram: https://www.instagram.com/schronisko.nowodwor.wolo/reels/\n\nWłaścicielem praw autorskich prezentowanych treści na tym kanale oraz innych kontach w mediach społecznościowych powiązanych ze stowarzyszeniem jest "Stowarzyszenie Wolontariat Schroniska dla psów w Nowodworze." Wszelkie próby wykorzystywania naszych materiałów bez naszej wiedzy i zgody będą zgłaszane.';

const PLAT = { fb: 'Facebook', ig: 'Instagram', tiktok: 'TikTok', yt_t: 'YouTube: tytuł', yt_o: 'YouTube: opis', www_t: 'Strona: tytuł', www_d: 'Strona: dane psa', www_o: 'Strona: opis' };
const TT = '#piesek #dogtok #schronisko #niekupujadoptuj #pies';
const dzis = () => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); };
const plural = (n, a, b, c) => (n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
const jedn = (v, u) => { const t = String(v || '').trim(); return !t ? '' : /^[\d.,]+$/.test(t) ? t + ' ' + u : t; };
const hasloOf = (d) => { const h = String(d.haslo || '').replace(/^.*?\s[-–—]\s/, '').trim(); return h || (d.miejsce === 'dt' ? 'w domu tymczasowym' : d.miejsce === 'hotelik' ? 'w domowym hoteliku dla psów' : ''); };
const czasOf = (d) => {
  if (!d.data_przyjecia) return ''; const dn = Math.floor((Date.now() - d.data_przyjecia) / 864e5); if (dn < 14) return '';
  const m = Math.floor(dn / 30); return m >= 1 ? m + ' ' + plural(m, 'miesiąc', 'miesiące', 'miesięcy') : Math.floor(dn / 7) + ' tygodni';
};
const daneLinia = (d) => [d.wiek && 'wiek: ' + String(d.wiek).replace(/^wiek:\s*/i, ''), jedn(d.wzrost, 'cm') && 'wysokość w kłębie: ' + jedn(d.wzrost, 'cm'), jedn(d.waga, 'kg') && 'waga: ' + jedn(d.waga, 'kg'), d.chip && 'chip: ' + d.chip].filter(Boolean).join('; ');

// ----- pola formularza (wspólne i dla poszczególnych rodzajów) -----
const F_PLEC = { id: 'plec', l: 'Płeć (decyduje o końcówkach w tekście)', t: 'select', opts: [['samiec', 'Pies (samiec)'], ['suka', 'Suczka']] };
const F_HASLO = { id: 'haslo', l: 'Hasło (po myślniku w tytule)', ph: 'np. będziesz ze mnie dumny', t: 'text', def: hasloOf };
const F_CECHA = { id: 'cecha', l: 'Zdanie o charakterze (opcjonalnie)', ph: 'np. Spokojny, pięknie chodzi na smyczy.', t: 'area' };

// ----- rodzaje postów i domyślne szablony -----
const OGOLNY_ADOPCJA = '{IMIE} - {haslo}\n{dane} {opis} {cecha}\n\n{kontakt}';
export const TYPY = [
  { k: 'adopcja', l: 'Pies do adopcji', o: 'Tytuł, opis i dane na wszystkie platformy', ic: 'paw', dog: true, pola: [F_PLEC, F_HASLO, F_CECHA],
    plat: ['fb', 'ig', 'tiktok', 'yt_t', 'yt_o', 'www_t', 'www_d', 'www_o'],
    t: { fb: OGOLNY_ADOPCJA, ig: OGOLNY_ADOPCJA,
      tiktok: '{IMIE} liczy na pomoc w znalezieniu prawdziwie kochającego {go} domu i rodziny. {cecha} {Gotowy} jest do pokochania i adoptowania.\n--- ' + KRS + ' ' + TT,
      yt_t: '{IMIE} - jest {gotowy} do pokochania i adoptowania / czytaj opis ! #dog #pies #shorts #shortvideo',
      yt_o: 'Przedstawiony na filmiku piesek jest do pokochania i adoptowania.\n\n{yt_stopka}',
      www_t: '{IMIE} - {haslo}',
      www_d: 'Płeć: {plec_s}\nWiek: {wiek}\nWielkość: {wielkosc}\nWaga: {waga}\nWysokość w kłębie: {wzrost}\nSierść: {siersc}',
      www_o: '{opis} {cecha}\n\n' + KONTAKT } },
  { k: 'halas', l: 'Zróbmy hałas', o: 'Dla psa, o którego nikt nie pyta', ic: 'bell', dog: true, pola: [F_PLEC, { id: 'czas', l: 'Jak długo w schronisku', ph: 'np. 10 miesięcy', t: 'text', def: czasOf }, F_CECHA], plat: ['fb'],
    t: { fb: 'ZRÓBMY HAŁAS wokół {IMIE}. Czy wiecie, że {ten} {cudowny} {pies} jest w schronisku{odkiedy} i nigdy nikt o {niego} nie zapytał, nie chciał {go} adoptować ?\n{cecha}\nPomóżcie znaleźć dom - komentujcie post, udostępniajcie, zróbmy {mu} zasięg @obserwujący' } },
  { k: 'dt', l: 'Dom tymczasowy', o: 'Apel o dom tymczasowy', ic: 'pin', dog: true, pola: [F_PLEC, F_CECHA], plat: ['fb', 'ig', 'tiktok'],
    t: { fb: 'POMOCY PSYjaciele\n{IMIE} szuka domu tymczasowego (Lublin i okolice).\n{dane}\n{cecha}\n\nNie chcemy, żeby {wracal} do schroniska. Jeśli możesz dać {mu} schronienie (nawet na tydzień lub dwa), my zapewnimy wszystko, co potrzeba. Szukamy tylko człowieka i miejsca.\n\nPisz do nas lub dzwoń: Justyna 691 742 265, Dorota 607 119 526\n@obserwujący prosimy o udostępnienia',
      ig: 'POMOCY PSYjaciele\n{IMIE} szuka domu tymczasowego (Lublin i okolice).\n{dane}\n{cecha}\n\nNie chcemy, żeby {wracal} do schroniska. Jeśli możesz dać {mu} schronienie (nawet na tydzień lub dwa), my zapewnimy wszystko, co potrzeba. Szukamy tylko człowieka i miejsca.\n\n{kontakt}',
      tiktok: '{IMIE} potrzebuje domu tymczasowego. {cecha} Nie chcemy, żeby {wracal} do schroniska. Jeśli możesz dać {mu} schronienie, napisz do nas.\n--- ' + KRS + ' #pies #dog #schronisko #adoptme #zwierzęta' } },
  { k: 'pomoc', l: 'Zbiórka / leczenie', o: 'Prośba o wpłaty na leczenie psa', ic: 'medic', dog: true, pola: [F_PLEC, { id: 'potrzeba', l: 'Co się stało, czego potrzeba', ph: 'np. Operacja łapki, rehabilitacja, koszt…', t: 'area' }, { id: 'link', l: 'Link do zrzutki', ph: 'https://zrzutka.pl/…', t: 'text' }], plat: ['fb', 'tiktok', 'yt_t', 'yt_o'],
    t: { fb: '@obserwujący POMOCY - {IMIE} potrzebuje wsparcia\n{potrzeba}\n\nProsimy o wpłaty, choćby symbolicznego „piątaka”. Każda wpłata ma znaczenie.\n{link}\n\nUDOSTĘPNIAJCIE zrzutkę, PSYjaciele',
      tiktok: 'WIĘCEJ INFORMACJI NA NASZYM PROFILU FACEBOOKU {IMIE} pilnie potrzebuje Waszej pomocy, aby móc się leczyć i jak najszybciej wrócić do zdrowia. Gdy tylko wyzdrowieje, rozpoczniemy poszukiwania dla {niego} ciepłego, kochającego domu i odpowiedzialnej rodziny.\n--- ' + KRS + ' #pies #dog #schronisko #adoptme #zwierzęta',
      yt_t: '{IMIE} - pomóż {mu} w leczeniu i powrocie do zdrowia / czytaj opis ! #dog #pies #shorts #shortvideo',
      yt_o: 'Piesek pokazany na nagraniu pilnie potrzebuje Waszej pomocy, aby móc się leczyć i jak najszybciej wrócić do zdrowia. Gdy tylko wyzdrowieje, rozpoczniemy poszukiwania dla {niego} ciepłego, kochającego domu i odpowiedzialnej rodziny.\n\nWIĘCEJ INFORMACJI NA NASZYM PROFILU FACEBOOK - jak można pomóc.\n\n{yt_stopka}' } },
  { k: 'adoptowany', l: 'Pies adoptowany', o: 'Dopisek, tytuł na YouTube i stronie', ic: 'heart', dog: true, adopted: true, pola: [F_PLEC], plat: ['fb', 'yt_t', 'www_t'],
    t: { fb: 'EDIT: MAMY DOM {IMIE}',
      yt_t: '{IMIE} - pies został {adoptowany}',
      www_t: '{IMIE} - {adoptowany} ♥' } },
  { k: 'spacery', l: 'Zaproszenie na spacery', o: 'Post z piątku przed sobotą', ic: 'walk', dog: false, pola: [{ id: 'kontekst', l: 'Wstęp (pogoda, pora roku)', ph: 'np. Wiosna w powietrzu. Pieski już to czują i bardzo na Was czekają.', t: 'area' }, { id: 'godz', l: 'Godzina w sobotę', ph: '9.00', t: 'text', def: () => '9.00' }, { id: 'dopisek', l: 'Dopisek (opcjonalnie)', ph: 'np. ze względu na upał spacery będą krótsze', t: 'area' }], plat: ['fb'],
    t: { fb: '{kontekst}\nSobota godz.{godz}\n{dopisek}' } },
  { k: 'odwolanie', l: 'Odwołanie spacerów', o: 'Brak spacerów w sobotę', ic: 'x', dog: false, pola: [{ id: 'data', l: 'Która sobota', ph: 'np. 2 maja', t: 'text' }, { id: 'powod', l: 'Powód (opcjonalnie)', ph: 'np. dzień świąteczny', t: 'text' }, { id: 'nastepna', l: 'Kiedy kolejne spacery', ph: 'np. 9 maja', t: 'text' }], plat: ['fb'],
    t: { fb: 'Informujemy, że sobota {data} - NIE MA SPACERÓW w schronisku{powod_n}. Pieski zapraszają wszystkich {NASTEPNA}' } },
  { k: 'relacja', l: 'Relacja po spacerach', o: 'Podziękowanie z soboty', ic: 'camera', dog: false, pola: [{ id: 'frek', l: 'Jak było z frekwencją', t: 'select', opts: [['tlum', 'Tłum ludzi'], ['dobrze', 'Normalnie'], ['malo', 'Mało osób']] }, { id: 'jak', l: 'Twoje słowa o dniu (opcjonalnie)', ph: 'np. Było słonecznie, 3 psy pojechały do nowych domów.', t: 'area' }, { id: 'kolejny', l: 'Zaproszenie na kolejny raz', t: 'text', def: () => 'za tydzień' }], plat: ['fb'],
    t: { fb: '{start}\n{jak}\n\nDziękujemy i do zobaczenia {kolejny}' } },
  { k: 'maxizoo', l: 'Maxi Zoo', o: 'Dyżur piesków w sklepie', ic: 'box', dog: false, pola: [{ id: 'data', l: 'Data', t: 'text', def: dzis }, { id: 'godz', l: 'Godziny', t: 'text', def: () => '10 do 19' }, { id: 'lok', l: 'Gdzie', t: 'text', def: () => 'Galerii Olimp w Lublinie' }, { id: 'psy', l: 'Psy na dyżurze (imiona po przecinku)', ph: 'np. Lissel, Avatar, Shein', t: 'text' }], plat: ['fb', 'tiktok', 'yt_t', 'yt_o'],
    t: { fb: 'Kochani PSYjaciele\nZapraszamy Was do Maxi Zoo Polska w {lok}. Nasze bezdomniaki czekają tu na Was od godz.{godz}. {dyzur}\nPieski proszą o Waszą uwagę, głaski i prezenty, które możecie nabyć właśnie w Maxi Zoo. ZAPRASZAMY',
      tiktok: 'Po raz kolejny nasze bezdomniaki odwiedziły Maxi Zoo! Dziękujemy za wszystko! #adoptdontshop #niekupujadoptuj #psyzeschroniska #dogtok #dc #dlaciebie #fyp #foryou #shelterdog #adoptme #dogsoftiktok #maxizoo',
      yt_t: 'MAXI ZOO {data} / czytaj opis ! #pies #shortvideo #shorts #dog',
      yt_o: 'Nasi PSYjaciele ponownie odwiedzili @MaxiZooPolska i kolejny raz nas nie zawiedliście. Dziękujemy, że zawsze, nawet w trudnych czasach jesteście dla naszych psich sierotek. Pieski polecają się do pokochania i adoptowania\n\n{yt_stopka}' } },
  { k: 'podziekowanie', l: 'Podziękowanie', o: 'Dla szkoły, grupy, darczyńców', ic: 'gift', dog: false, pola: [{ id: 'komu', l: 'Komu dziękujemy', ph: 'np. uczniom Szkoły Podstawowej w Dębicy', t: 'text' }, { id: 'za', l: 'Za co', ph: 'np. za świetną zbiórkę darów', t: 'text' }, { id: 'co', l: 'Co przywieźli (opcjonalnie)', ph: 'np. Żwacze, karma Brit i Dolina Noteci, to skarby dla naszych bezdomniaków.', t: 'area' }], plat: ['fb'],
    t: { fb: 'Dziękujemy {komu} {za} dla naszych podopiecznych. {co}\n\nPsy, których dotknęła bezdomność, zasługują na wszystko, co najlepsze. Dziękujemy' } }
];
const TYP = Object.fromEntries(TYPY.map((t) => [t.k, t]));
const OPIS_ZAG = 'Zaginięcie psa ma osobny ekran z aktualizacjami i plakatem';

// ----- podstawianie zmiennych -----
const START = { tlum: 'Dziś było cudownie. Mnóstwo ludzi pod schroniskiem i na każdego pieska czekał człowiek, który zabrał go na spacer.', dobrze: 'Dziękujemy każdemu, kto poświęcił sobotni poranek, aby dać chwile radości bezdomnym psiakom.', malo: 'Dziś wolontariuszy było mniej, ale dzięki tym, którzy przyjechali, pieski wyszły na spacer. Przyjeżdżajcie co sobotę, bo bez Was nie mogą opuścić kojców.' };
export function zmienne(typ, S, dog) {
  const suka = (S.vals.plec || dog?.plec || 'samiec') === 'suka', g = (m, f) => (suka ? f : m), V = S.vals, d = dog || {};
  const psy = String(V.psy || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => x.toUpperCase()).join(', ');
  const v = {
    imie: d.imie || '', haslo: V.haslo || '', wiek: d.wiek || '', wielkosc: d.wielkosc || '', waga: jedn(d.waga, 'kg'), wzrost: jedn(d.wzrost, 'cm'), siersc: d.siersc || '', chip: d.chip || '',
    dane: dog ? daneLinia(d) : '', opis: String(d.opis || '').trim(), plec_s: dog ? g('Piesek', 'Suczka') : '',
    gotowy: g('gotowy', 'gotowa'), go: g('go', 'ją'), jego: g('jego', 'jej'), mu: g('mu', 'jej'), niego: g('niego', 'nią'), on: g('on', 'ona'), adoptowany: g('adoptowany', 'adoptowana'),
    piesek: g('piesek', 'suczka'), pies: g('pies', 'suka'), wracal: g('wracał', 'wracała'), ten: g('ten', 'ta'), cudowny: g('cudowny', 'cudowna'),
    kontakt: KONTAKT, krs: KRS, yt_stopka: YT_STOPKA,
    odkiedy: V.czas ? ' od ' + V.czas : '', powod_n: V.powod ? ' (' + V.powod + ')' : '', start: START[V.frek || 'dobrze'], dyzur: psy ? 'Dziś dyżurują: ' + psy + '.' : ''
  };
  for (const p of typ.pola) if (v[p.id] === undefined) v[p.id] = p.t === 'select' ? V[p.id] || '' : (V[p.id] || '').trim();
  return v;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function wypelnij(tpl, v) {
  const look = (n) => {
    if (v[n] !== undefined) return v[n];
    if (n.length > 1 && n === n.toUpperCase() && v[n.toLowerCase()] !== undefined) return String(v[n.toLowerCase()]).toUpperCase();
    const l = n.charAt(0).toLowerCase() + n.slice(1);
    if (n !== l && v[l] !== undefined) return cap(String(v[l]));
    return undefined;
  };
  const out = [];
  for (const line of String(tpl).split('\n')) {
    let n = 0, empty = 0;
    let r = line.replace(/\{([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż_0-9]+)\}/g, (m, name) => { const x = look(name); if (x === undefined) return m; n++; if (!String(x).trim()) empty++; return String(x); });
    if (n && empty === n && !/\{[^}]+\}/.test(r) && line.replace(/\{[^}]+\}/g, '').replace(/[\s:.,;-]/g, '').length <= 24) continue;
    if (empty) r = r.replace(/ {2,}/g, ' ').replace(/ +$/, '');
    out.push(r);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ----- stan ekranu -----
const S = { typ: null, dogId: null, vals: {} };
let OV = {}, cur = null; // OV: nadpisane szablony (klucz typ__plat); cur: aktualnie wyświetlane teksty
const ovKey = (t, p) => t + '__' + p;
async function loadOV() { OV = {}; for (const r of await list(COL)) if (r && r.typ && r.plat) OV[ovKey(r.typ, r.plat)] = r; }
const tplFor = (t, p) => (OV[ovKey(t.k, p)]?.tekst) ?? t.t[p];

// ----- ekran 1: wybór rodzaju -----
export async function social(typKey) {
  if (typKey) return composer(typKey);
  return {
    tab: 'start', title: 'Social media', live: false,
    html: html`${pageBar('Social media')}<div class="pad">
      <p class="hint" style="margin:0 0 12px;color:var(--sage)">Wybierz rodzaj posta. Dostaniesz gotowe teksty na każdą platformę, do skopiowania. Zdjęcia i filmy dodajesz sam w aplikacji Facebooka, Instagrama, TikToka czy YouTube. Nic nie jest publikowane automatycznie.</p>
      <div class="card" style="padding:4px 16px"><div class="rows">${TYPY.map((t) => html`<a class="row" href="#/social/${t.k}">${icon(t.ic)}<span class="rt"><b>${t.l}</b><small>${t.o}</small></span>${icon('chev')}</a>`)}
        <a class="row" href="#/zaginiecia">${icon('alert')}<span class="rt"><b>Zaginięcie psa</b><small>${OPIS_ZAG}</small></span>${icon('chev')}</a></div></div>
      <p class="hint" style="margin:14px 0 0;color:var(--sage)">Szablony możesz zmienić po swojemu: w każdym rodzaju przy tekście jest przycisk „Edytuj szablon”. Zmiana obowiązuje wszystkich wolontariuszy, a „Przywróć domyślny” cofa ją.</p></div>` };
}

// ----- ekran 2: formularz i teksty -----
function composer(typKey) {
  const t = TYP[typKey];
  if (!t) return { tab: 'start', title: 'Social media', html: html`${pageBar('Social media')}<div class="empty"><h3>Nie ma takiego rodzaju posta</h3><a class="btn gold" href="#/social">Wróć do listy</a></div>` };
  if (S.typ !== typKey) { const keep = S.typ && TYP[S.typ].dog && t.dog && !!TYP[S.typ].adopted === !!t.adopted; S.typ = typKey; if (!keep) S.dogId = null; S.vals = {}; }
  return {
    tab: 'start', title: t.l + ' · Social media', live: false,
    html: html`<header class="topbar"><a class="iconbtn" href="#/social" aria-label="Wstecz do listy rodzajów">${icon('back')}</a><h1 style="font-size:22px;font-weight:500;text-align:center;flex:1;padding:0 6px">${t.l}</h1><span style="min-width:44px"></span></header><div class="pad stack" id="soc"></div>`,
    mount(root) { const box = root.querySelector('#soc'); cur = { t, box, texts: {}, edits: {}, dog: null }; box.addEventListener('input', onField); box.addEventListener('change', onField); init(); }
  };
}
async function init() {
  const { t, box } = cur; await loadOV(); cur.edits = {};
  cur.dog = t.dog && S.dogId ? await get('psy', S.dogId) : null; if (t.dog && S.dogId && !cur.dog) S.dogId = null;
  for (const p of t.pola) if (p.def && S.vals[p.id] === undefined && (!p.id.match(/haslo|czas/) || cur.dog)) S.vals[p.id] = p.def(cur.dog || {});
  if (t.dog && cur.dog && S.vals.plec === undefined) S.vals.plec = cur.dog.plec === 'suka' ? 'suka' : 'samiec';
  box.innerHTML = formHtml() + '<div id="socout" class="stack"></div>';
  hydratePhotos(box); paintOut();
}
function onField(e) {
  const o = e.target.dataset?.o; // ręczna poprawka tekstu na potrzeby chwili (nie zmienia szablonu)
  if (o) { if (e.type !== 'input') return; cur.edits[o] = e.target.value; cur.texts[o] = e.target.value; grow(e.target); const h = cur.box.querySelector(`[data-edited="${o}"]`); if (h) h.hidden = false; return; }
  const id = e.target.dataset?.f; if (!id || S.vals[id] === e.target.value) return; // „change” po „input” nic nie zmienia: bez tego odświeżenie kart gubiło pierwsze dotknięcie Kopiuj
  S.vals[id] = e.target.value; paintOut();
}
function fieldHtml(p) {
  const val = S.vals[p.id] ?? '';
  if (p.t === 'select') return `<div class="field"><label for="f_${p.id}">${esc(p.l)}</label><select class="select" id="f_${p.id}" data-f="${p.id}" data-nodraft>${p.opts.map(([k, l]) => `<option value="${k}" ${k === (val || p.opts[0][0]) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  if (p.t === 'area') return `<div class="field"><label for="f_${p.id}">${esc(p.l)}</label><textarea class="textarea" id="f_${p.id}" data-f="${p.id}" data-nodraft style="min-height:84px" maxlength="600" placeholder="${esc(p.ph || '')}">${esc(val)}</textarea></div>`;
  return `<div class="field"><label for="f_${p.id}">${esc(p.l)}</label><input class="input" id="f_${p.id}" data-f="${p.id}" data-nodraft maxlength="200" autocomplete="off" placeholder="${esc(p.ph || '')}" value="${esc(val)}"></div>`;
}
function formHtml() {
  const { t, dog } = cur;
  const dogBox = !t.dog ? '' : dog
    ? `<div class="card gap"><span class="avatar sm">${dogThumb(dog).s}</span><span class="rt"><b>${esc(dog.imie)}</b><small>${esc([dog.wiek, dog.wielkosc].filter(Boolean).join(' · ') || 'Brak danych w karcie')}</small></span><button type="button" class="btn sm ghost" data-act="soc-dog">Zmień psa</button></div>`
    : `<button type="button" class="btn block" data-act="soc-dog">${t.adopted ? 'Wybierz adoptowanego psa' : 'Wybierz psa z bazy'}</button>`;
  const fields = !t.dog || dog ? t.pola.map(fieldHtml).join('') : '';
  const warn = t.dog && dog && !dog.plec ? '<p class="hint" style="margin:-6px 0 12px">W karcie psa nie ma płci. Wybierz ją powyżej, żeby końcówki w tekście były poprawne.</p>' : '';
  return `${dogBox}${fields ? `<div class="card">${fields}${warn}</div>` : ''}`;
}

// ----- teksty gotowe do skopiowania -----
function paintOut() {
  const { t, dog } = cur, out = cur.box.querySelector('#socout'); if (!out) return;
  if (t.dog && !dog) { out.innerHTML = '<div class="empty">' + icon('paw').s + '<h3>Wybierz psa</h3><p>Teksty pojawią się tu od razu po wyborze.</p></div>'; cur.texts = {}; return; }
  const v = zmienne(t, S, dog); cur.texts = {};
  out.innerHTML = t.plat.map((p) => {
    const edited = cur.edits[p] !== undefined, txt = edited ? cur.edits[p] : wypelnij(tplFor(t, p), v); cur.texts[p] = txt; const ov = OV[ovKey(t.k, p)];
    return `<div class="card socard"><div class="card-head"><h3>${esc(PLAT[p])}</h3></div><textarea class="textarea socout" data-o="${p}" data-nodraft spellcheck="true" aria-label="Tekst na ${esc(PLAT[p])}, możesz go poprawić przed skopiowaniem">${esc(txt)}</textarea>
      <p class="hint" data-edited="${p}" style="margin:6px 0 0"${edited ? '' : ' hidden'}>Poprawiłeś(-aś) ten tekst. Zmiany w formularzu go nie nadpiszą. <button type="button" class="link" data-act="soc-reset" data-p="${p}">Wróć do wygenerowanego</button></p>
      <div class="btnrow" style="margin-top:10px"><button type="button" class="btn sm" data-act="soc-copy" data-p="${p}">Kopiuj</button><button type="button" class="btn sm ghost" data-act="soc-edit" data-p="${p}">Edytuj szablon</button></div>
      ${ov ? `<p class="hint" style="margin:8px 0 0">Szablon zmieniony${ov.autor ? ' przez ' + esc(ov.autor) : ''}${ov.ts ? ', ' + esc(fmtDate(ov.ts)) : ''}</p>` : ''}</div>`;
  }).join('') + (dog ? '<button type="button" class="btn ghost block" data-act="dog-kanaly" data-id="' + esc(dog.id) + '">Zaznacz w karcie psa, gdzie opublikowano</button>' : '');
  out.querySelectorAll('textarea[data-o]').forEach(grow);
}
const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 60) + 'px'; };
actions['soc-reset'] = (el) => { delete cur.edits[el.dataset.p]; paintOut(); toast('Przywrócono wygenerowany tekst'); };
// Kopiowanie: najpierw schowek przeglądarki (z limitem czasu, bo bywa, że nigdy nie odpowiada), potem stary sposób, na końcu zaznaczenie tekstu
async function kopiuj(txt, pole) {
  try { await Promise.race([navigator.clipboard.writeText(txt), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 1500))]); return true; } catch { /* próbujemy dalej */ }
  try {
    const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length); const ok = document.execCommand('copy'); ta.remove(); if (ok) return true;
  } catch { /* ignoruj */ }
  if (pole) { pole.focus(); pole.select(); }
  return false;
}
actions['soc-copy'] = async (el) => {
  const txt = cur?.texts?.[el.dataset.p]; if (!txt) { toast('Brak tekstu do skopiowania', true); return; }
  if (await kopiuj(txt, cur.box.querySelector(`[data-o="${el.dataset.p}"]`))) toast('Skopiowano'); else toast('Tekst zaznaczony. Przytrzymaj i wybierz Kopiuj', true);
};

// ----- wybór psa -----
actions['soc-dog'] = async () => {
  const t = cur.t, all = (await list('psy')).filter((d) => d.imie);
  const isAd = (d) => d.status === 'adoptowany' || d.miejsce === 'adoptowany';
  const dogs = all.filter((d) => (t.adopted ? isAd(d) : !isAd(d))).sort((a, b) => a.imie.localeCompare(b.imie, 'pl'));
  const paint = (q, root) => {
    const f = dogs.filter((d) => d.imie.toLowerCase().includes(q.trim().toLowerCase()));
    root.innerHTML = f.length ? f.map((d) => `<button type="button" class="row" data-pick="${esc(d.id)}"><span class="avatar sm">${dogThumb(d).s}</span><span class="rt"><b>${esc(d.imie)}</b><small>${esc([d.wiek, d.wielkosc].filter(Boolean).join(' · '))}</small></span>${icon('chev').s}</button>`).join('') : '<p class="hint">Nie ma takiego psa.</p>';
    hydratePhotos(root);
  };
  openSheet(`<h2>Wybierz psa</h2><div class="field"><input class="input" id="sq" data-nodraft type="search" placeholder="Szukaj po imieniu" autocomplete="off"></div><div id="sl" class="rows"></div>`, (s) => {
    const l = s.querySelector('#sl'); paint('', l);
    s.querySelector('#sq').addEventListener('input', (e) => paint(e.target.value, l));
    l.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]'); if (!b) return;
      S.dogId = b.dataset.pick; S.vals = {}; closeSheet(); init();
    });
  });
};

// ----- edycja szablonu -----
const CHIPS = [['imie', 'Imię'], ['IMIE', 'IMIĘ'], ['haslo', 'Hasło'], ['dane', 'Dane psa'], ['opis', 'Opis'], ['wiek', 'Wiek'], ['wielkosc', 'Wielkość'], ['waga', 'Waga'], ['wzrost', 'Wysokość'], ['siersc', 'Sierść'], ['gotowy', 'gotowy/gotowa'], ['go', 'go/ją'], ['mu', 'mu/jej'], ['niego', 'niego/nią'], ['wracal', 'wracał/wracała'], ['adoptowany', 'adoptowany/adoptowana'], ['kontakt', 'Blok kontaktu'], ['krs', '1,5% i KRS'], ['yt_stopka', 'Stopka YouTube']];
actions['soc-edit'] = async (el) => {
  const t = cur.t, p = el.dataset.p, ov = OV[ovKey(t.k, p)], def = t.t[p];
  const own = t.pola.filter((f) => !CHIPS.some(([k]) => k === f.id)).map((f) => [f.id, f.l.replace(/\s*\(.*\)$/, '')]);
  const chips = (t.dog ? CHIPS : CHIPS.filter(([k]) => ['kontakt', 'krs'].includes(k))).concat(own);
  const v = () => zmienne(t, S, cur.dog);
  openSheet(`<h2>Szablon: ${esc(t.l)} · ${esc(PLAT[p])}</h2>
    <p class="hint" style="margin:0 0 10px">Zmiana obowiązuje wszystkich wolontariuszy. Słowa w nawiasach klamrowych, np. {imie}, same zamieniają się na dane psa lub to, co wpisałeś(-aś) w formularzu.</p>
    <div class="field"><label for="ts_t">Treść szablonu</label><textarea class="textarea" id="ts_t" data-nodraft style="min-height:180px">${esc(ov ? ov.tekst : def)}</textarea></div>
    <details style="margin:0 0 12px"><summary style="cursor:pointer;font-weight:600;padding:8px 0">Wstaw zmienną</summary><div class="chips" style="margin-top:8px">${chips.map(([k, l]) => `<button type="button" class="chip outline" data-ins="{${esc(k)}}">${esc(l)}</button>`).join('')}</div></details>
    <div class="field"><span class="lbl">Tak to będzie wyglądać</span><div class="socout" id="ts_p"></div></div>
    <div class="err" id="ts_e" role="alert"></div>
    <div class="btnrow"><button type="button" class="btn" id="ts_s">Zapisz szablon</button><button type="button" class="btn ghost" id="ts_r">Przywróć domyślny</button></div>`, (s) => {
    const ta = s.querySelector('#ts_t'), pv = s.querySelector('#ts_p'), er = s.querySelector('#ts_e');
    const prev = () => { pv.textContent = wypelnij(ta.value, v()) || ' '; er.textContent = ''; };
    ta.addEventListener('input', prev); prev();
    s.querySelectorAll('[data-ins]').forEach((b) => b.addEventListener('click', () => {
      const a = ta.selectionStart ?? ta.value.length, z = ta.selectionEnd ?? a;
      ta.value = ta.value.slice(0, a) + b.dataset.ins + ta.value.slice(z); const pos = a + b.dataset.ins.length; ta.focus(); try { ta.setSelectionRange(pos, pos); } catch { /* ignoruj */ } prev();
    }));
    s.querySelector('#ts_s').onclick = async () => {
      const txt = ta.value.replace(/\s+$/, ''); if (!txt.trim()) { er.textContent = 'Szablon nie może być pusty. Użyj „Przywróć domyślny”, żeby wrócić do początkowego.'; return; }
      if (txt === def) { if (ov) await remove(COL, ovKey(t.k, p)); }
      else await save(COL, { id: ovKey(t.k, p), typ: t.k, plat: p, tekst: txt, autor: getName(), ts: Date.now() });
      await loadOV(); delete cur.edits[p]; closeSheet(); toast('Szablon zapisany'); paintOut();
    };
    s.querySelector('#ts_r').onclick = async () => {
      if (!ov) { ta.value = def; prev(); toast('To już jest szablon domyślny'); return; }
      if (await confirmSheet('Przywrócić domyślny szablon?', 'Twoja zmiana zniknie u wszystkich wolontariuszy.', 'Przywróć', true)) { await remove(COL, ovKey(t.k, p)); await loadOV(); delete cur.edits[p]; toast('Przywrócono domyślny'); paintOut(); }
    };
  });
};

// Zmiana szablonu przez kogoś innego (synchronizacja): odśwież teksty, jeśli nic się teraz nie edytuje
on('change', ({ col } = {}) => {
  if ((col !== COL && col !== '*') || !cur || !cur.box.isConnected || document.querySelector('#sheet-root .sheet')) return;
  loadOV().then(() => paintOut());
});
