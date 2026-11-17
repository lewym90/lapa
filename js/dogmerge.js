// Wspólna logika: z danych odczytanych ze strony schroniska powstaje rekord psa. Czyste funkcje, bez zależności od przeglądarki:
// używa ich aplikacja (przycisk Importuj/Odśwież) i serwer (automatyczne sprawdzanie strony).
const KAT = {
  ludzie: /człowiek|\bludzi|\bludzie|opiekun|obcych ludzi|obcy(?! pies|ch psów)|przytula|głask|pieszcz|kontakt z (?:człowiek|ludź)/,
  dzieci: /\bdzieci\b|dziećmi|dzieciom|z dzieckiem|dzieci[eę]/,
  psy: /psami|innych psów|obcych psów|inne psy|innymi psami|innych piesk|innymi pieskami|towarzystw\w+ (?:innych )?psów|suczk|samc|psiak|relacj\w+ z psami|kontakt\w* z psami/,
  koty: /\bkot/,
  smycz: /smycz|spacer/
};
const NEGATED_BAD = /\bnie jest agresywn\w*|\bnie bywa agresywn\w*|\bnie jest do (?:nich|niego|niej) agresywn\w*|\bnie ma agresji|bez agresji|\bnie jest (?:dla nich )?niebezpieczn\w*|\bnie atakuje|\bnie narzuca się|\bnie gryzie|\bnie warczy|\bnie szczeka|\bnie zaczepia|\bnie boi się|\bnie budzą w niej|\bnie ma problemu|bez problemu|\bnie sprawia problem\w*|\bnie ciągnie|\bnie jest problem\w*|\bnie stanowi problem\w*|\bnie wadzi/g;
const POS = /lubi|uwielbia|chętnie|dobrze|przyjazn\w*|towarzysk\w*|kontaktow\w*|zgodn\w*|akceptuje|wzorowo|pięknie|ładnie|łagodn\w*|przytula|potrafi|grzeczn\w*|ufn\w*|radosn\w*|wesoł\w*|szuka kontaktu|dogaduje się|pozytyw/;
const NEG = /agresywn\w*|\bnie toleruje|\bnie dogaduje się|\bnie nadaje się|\bnie akceptuje|\bnie lubi (?:towarzystwa|innych|obcych|dzieci|kotów|psów|ludzi|dotyku)|\bnie przepada za|atakuje|rzuca się na|\bnie polecamy|wykluczon\w*|bez dzieci|bez zwierząt/;
const CAU = /boi się|się boi|obawia się|lęk\w*|nieśmiał\w*|zdystansowan\w*|z dystansem|ostrożn\w*|wycofu\w*|wycofan\w*|selektywn\w*|dominuj\w*|odburkn\w*|ostrzegawczo|stopniowo|płochliw\w*|podejrzliw\w*|nieufn\w*|ciągnie na smyczy|ciągnie(?! na wolnym)|unika kontaktu|natarczyw\w*/;
const NEU = /neutraln\w*|obojętn\w*|ignoruje|\bnie interesuj\w*|\bnie zwraca uwagi|\bnie reaguje/;
export function ocenaZOpisu(opis) {
  const text = String(opis || '').replace(/\s+/g, ' ').trim(); if (text.length < 40) return undefined;
  const clauses = text.split(/(?<=[.!?])\s+/).flatMap((z) => z.split(/;|:|,| - | – |\) |\s(?:ale|jednak|natomiast|choć|chociaż)\s/)).map((x) => x.toLowerCase());
  const o = {}; const lek = [];
  for (const [k, re] of Object.entries(KAT)) {
    const ss = clauses.filter((x) => re.test(x)); if (!ss.length) continue;
    let pos = 0, neg = 0, cau = 0, neu = 0;
    for (const x of ss) {
      let y = x.replace(NEGATED_BAD, ' pozytyw ');
      if (k !== 'dzieci') y = y.replace(/(?:z|bez) dzieci\w*|dzieci\w* wykluczon\w*/g, ' ');
      const hasNeg = NEG.test(y); if (hasNeg) neg++; if (CAU.test(y)) cau++; if (NEU.test(y)) neu++; if (POS.test(y.replace(new RegExp(NEG.source, 'g'), ' '))) pos++;
    }
    o[k] = neg && !pos ? 'nie' : neg || cau ? 'ostroznie' : neu && !pos ? 'neutral' : pos ? 'ok' : neu ? 'neutral' : '';
    if (!o[k]) delete o[k];
  }
  for (const x of clauses) if (/lęk|boi się|się boi|obawia/.test(x) && !/nie boi się|nie ma problemu z lękiem|nie budzą/.test(x)) lek.push(x.replace(/\.$/, ''));
  const n = { ...o, lek: lek.slice(0, 2).join('. ').slice(0, 200), auto: true, autor: 'z opisu', ts: Date.now() };
  return Object.keys(o).length || n.lek ? n : undefined;
}
export const normPlec = (t = '') => (/suk|samic|dziewcz/i.test(t) ? 'suka' : /pies|samiec|piesek|chłop/i.test(t) ? 'samiec' : '');
export const czysc = (x = '') => String(x).replace(/&nbsp;|\u00a0/gi, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// Strona nie ma pola „miejsce”: jedynym sygnałem jest hasło (np. „ADINA - w domu tymczasowym 🏠”).
// Strona jest jedynym źródłem: miejsce, status, opis i dane zawsze są takie jak na stronie (ręcznie w aplikacji się ich nie zmienia).
export function miejsceZHasla(haslo) {
  return { miejsce: /domu tymczasow|dom tymczasow/i.test(haslo) ? 'dt' : /hotelik/i.test(haslo) ? 'hotelik' : 'schronisko' };
}
export function dogFromImport(imp, old = {}) {
  const f = imp.fields || {}; const haslo = czysc(imp.haslo || old.haslo || '');
  const statusWww = imp.status === 'adoptowany' ? 'adoptowany' : /procesie adopcji/i.test(haslo) ? 'w_trakcie' : (imp.status === 'w_trakcie' ? 'do_adopcji' : imp.status) || 'do_adopcji';
  const n = {
    ...old,
    id: old.id || (imp.id ? 'd' + imp.id : 'm' + Math.random().toString(36).slice(2, 10)),
    imie: imp.name || old.imie, plec: normPlec(f.plec) || old.plec || '', wiek: f.wiek || old.wiek || '', wielkosc: f.wielkosc || old.wielkosc || '',
    waga: f.waga || old.waga || '', wzrost: f.wzrost || old.wzrost || '', siersc: f.siersc || old.siersc || '',
    opis: imp.opis || (/Kilka słów o nas/.test(old.opis || '') ? '' : old.opis || ''), opis_www: imp.opis || old.opis_www || '', parser: 3, zdjecia: imp.zdjecia?.length ? imp.zdjecia : old.zdjecia || [],
    zrodlo_url: imp.url, zrodlo_id: imp.id, zaimportowano: Date.now(), dodany: old.dodany || Date.now(),
    haslo, status_www: statusWww, status: statusWww, ...miejsceZHasla(haslo),
    // „W schronisku od”: data publikacji ogłoszenia na stronie (administrator może ją zmienić w karcie psa – pole „od”).
    od_www: old.od_www || imp.opublikowano || null,
    ocena: ocenaZOpisu(imp.opis || old.opis || ''), film: imp.film || old.film || '', www_status: imp.status || old.www_status || 'do_adopcji'
  };
  // Pies jest na stronie (na liście do adopcji albo w „Adoptowanych”): nie jest ukryty.
  delete n.zniknal_ze_strony;
  // Kiedy aplikacja zobaczyła, że pies trafił do „Adoptowanych” (tylko gdy znaliśmy go wcześniej jako psa do adopcji).
  if (n.status === 'adoptowany') { if (old.id && old.status !== 'adoptowany' && !old.adoptowany_od) n.adoptowany_od = Date.now(); }
  else delete n.adoptowany_od;
  if (!n.ocena) delete n.ocena;
  return n;
}
