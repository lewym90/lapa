// „Napisz szkic za mnie”: hasło i opis psa ułożone z danych z karty (bez internetu, bez AI).
// To tylko szkic w stylu ogłoszeń schroniska – zawsze do przeczytania i poprawienia.

const g = (d, m, f) => (d.plec === 'suka' ? f : m); // forma męska / żeńska
const lista = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' i ' + a[a.length - 1]);
const duza = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// wielkość zapisana jako „mały/średni/duży” → forma do zdania
function wielkosc(d) {
  const w = String(d.wielkosc || '').trim().toLowerCase();
  if (/^ma[łl]/.test(w)) return g(d, 'mały', 'mała');
  if (/^[śs]redni/.test(w)) return g(d, 'średni', 'średnia');
  if (/^du[żz]/.test(w)) return g(d, 'duży', 'duża');
  return w;
}
function kim(d) {
  const k = d.wiek_kat;
  if (k === 'szczeniak') return g(d, 'szczeniak', 'szczeniaczka');
  if (k === 'mlody') return g(d, 'młody psiak', 'młoda sunia');
  if (k === 'senior') return g(d, 'senior', 'seniorka');
  return g(d, 'pies', 'sunia');
}
const OCENA_ZDANIA = {
  ludzie: { ok: (d) => `Uwielbia ludzi i ${g(d, 'chętnie przychodzi', 'chętnie przychodzi')} na pieszczoty.`, neutral: () => 'Do ludzi podchodzi spokojnie.', ostroznie: () => 'Do nowych osób potrzebuje trochę czasu, ale gdy zaufa – otwiera się.', nie: (d) => `Wobec obcych bywa ${g(d, 'nieufny', 'nieufna')}, potrzebuje cierpliwego opiekuna.` },
  dzieci: { ok: () => 'Lubi dzieci.', neutral: () => 'Spokojnie znosi obecność dzieci.', ostroznie: () => 'Najlepiej odnajdzie się w domu ze starszymi dziećmi.', nie: () => 'Nie polecamy do domu z małymi dziećmi.' },
  psy: { ok: () => 'Dogaduje się z innymi psami.', neutral: (d) => `Inne psy są ${g(d, 'mu', 'jej')} raczej obojętne.`, ostroznie: () => 'Inne psy akceptuje po spokojnym zapoznaniu.', nie: (d) => `Najlepiej ${g(d, 'czułby się jako jedynak', 'czułaby się jako jedynaczka')}.` },
  koty: { ok: () => 'Akceptuje koty.', neutral: () => 'Na koty reaguje spokojnie.', ostroznie: () => 'Do domu z kotem – tylko po próbie.', nie: () => 'Nie do domu z kotem.' },
  smycz: { ok: () => 'Ładnie chodzi na smyczy.', neutral: () => 'Na smyczy radzi sobie przyzwoicie.', ostroznie: () => 'Na smyczy jeszcze się uczy.', nie: () => 'Na smyczy mocno ciągnie – potrzebuje pracy i cierpliwości.' }
};
const ZDROWIE = [['czip', 'zaczipowany', 'zaczipowana'], ['szczep', 'zaszczepiony', 'zaszczepiona'], ['odrob', 'odrobaczony', 'odrobaczona'], ['kastr', 'wykastrowany', 'wysterylizowana']];

export function szkicHasla(d) {
  const imie = String(d.imie || '').trim().toUpperCase() || 'PIESEK';
  const t = (d.tagi || []).map((x) => String(x).toLowerCase());
  let h;
  if (d.wiek_kat === 'senior') h = g(d, 'spokojny senior szuka ciepłej kanapy', 'spokojna seniorka szuka ciepłej kanapy');
  else if (d.wiek_kat === 'szczeniak') h = g(d, 'radosny urwis szuka domu', 'radosna psotka szuka domu');
  else if (t.some((x) => /przytul/.test(x))) h = g(d, 'przytulas szuka swojego człowieka', 'przytulaska szuka swojego człowieka');
  else if (t.some((x) => /energi|aktywn|wesoł/.test(x))) h = g(d, 'wulkan energii szuka aktywnego domu', 'wulkan energii szuka aktywnego domu');
  else if (t.some((x) => /spokojn|łagodn/.test(x))) h = g(d, 'spokojny i łagodny, czeka na dom', 'spokojna i łagodna, czeka na dom');
  else if ((d.ocena || {}).ludzie === 'ostroznie' || (d.ocena || {}).ludzie === 'nie') h = g(d, 'potrzebuje czasu i cierpliwości', 'potrzebuje czasu i cierpliwości');
  else h = g(d, 'czeka na swój dom', 'czeka na swój dom');
  return `${imie} – ${h}`;
}

export function szkicOpisu(d) {
  const imie = String(d.imie || '').trim() || g(d, 'Ten piesek', 'Ta sunia');
  const akapity = [];
  // 1. kim jest i skąd się wziął
  const opisWygl = [wielkosc(d), kim(d)].filter(Boolean).join(' ');
  let p1 = `${imie} to ${opisWygl}`;
  if (d.wiek) p1 += ` w wieku ${String(d.wiek).trim().replace(/^ok\.?\s*/i, 'ok. ')}`;
  if (d.waga) p1 += ` (waży ${String(d.waga).trim()})`;
  p1 += '.';
  const sk = (d.pochodzenie || {}), gdzie = String(sk.gdzie || '').trim();
  if (sk.typ === 'znaleziony') p1 += ` Do schroniska ${g(d, 'trafił', 'trafiła')} jako ${g(d, 'znaleziony', 'znaleziona')}${gdzie ? ' (' + gdzie + ')' : ''}.`;
  else if (sk.typ === 'oddany') p1 += ` ${g(d, 'Trafił', 'Trafiła')} do nas, bo dotychczasowy właściciel nie mógł się ${g(d, 'nim', 'nią')} dłużej opiekować.`;
  else if (sk.typ === 'interwencja') p1 += ` Do schroniska ${g(d, 'trafił', 'trafiła')} po interwencji${gdzie ? ' (' + gdzie + ')' : ''}.`;
  else if (gdzie) p1 += ` ${duza(gdzie.replace(/\.$/, ''))}.`;
  akapity.push(p1);
  // 2. charakter
  const t = (d.tagi || []).map((x) => String(x).trim()).filter(Boolean);
  const oc = d.ocena || {};
  const zdania = ['ludzie', 'dzieci', 'psy', 'koty', 'smycz'].map((k) => OCENA_ZDANIA[k][oc[k]]?.(d)).filter(Boolean);
  if (t.length || zdania.length) akapity.push([t.length ? `${duza(g(d, 'jest', 'jest'))} ${lista(t)}.` : '', ...zdania].filter(Boolean).join(' '));
  // 3. zdrowie
  const z = d.zdr || {}, tak = ZDROWIE.filter(([k]) => z[k] === 'tak').map(([, m, f]) => g(d, m, f));
  if (tak.length) akapity.push(`${imie} jest ${lista(tak)}.`);
  if (String(d.zdr_uwagi || '').trim()) akapity.push(String(d.zdr_uwagi).trim().replace(/([^.!?])$/, '$1.'));
  // 4. zaproszenie
  akapity.push(`${g(d, 'Szuka', 'Szuka')} domu, w którym ktoś da ${g(d, 'mu', 'jej')} miłość i bezpieczeństwo. Jeśli chcesz ${g(d, 'go', 'ją')} poznać, skontaktuj się ze schroniskiem. Prosimy, udostępnij – może właśnie ktoś z Twoich znajomych ${g(d, 'na niego', 'na nią')} czeka!`);
  return akapity.join('\n\n');
}
