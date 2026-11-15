# Okno „Teksty do postów” na karcie psa: szablony do edycji (wspólne dla wszystkich).
# 1) Domyślne szablony dają co do znaku te same teksty co poprzednia wersja (funkcje STARE poniżej, skopiowane z 1.12.0).
# 2) Edycja szablonu, synchronizacja do drugiej osoby, przywrócenie domyślnego.
from playwright.sync_api import sync_playwright
from wspolne import *

STARE = r"""
const KONTAKT = 'Kontakt w sprawie adopcji: Justyna 691 742 265, Dorota 607 119 526, stowarzyszenie.nowodwor@wp.pl';
const SITE = 'https://www.schronisko-nowodwor.com.pl';
const days = (t) => Math.max(0, Math.floor((Date.now() - t) / 864e5));
const STARE = {
  album: { l: 'Nazwa albumu', f: (d, h) => `${d.imie.toUpperCase()} - ${h || 'wpisz hasło'}` },
  post: { l: 'Post adopcyjny', f: (d, h) => `${d.imie.toUpperCase()} - ${h || 'wpisz hasło'}\n\n${[d.wiek, d.wielkosc, d.waga && 'waga ' + d.waga].filter(Boolean).join(', ')}\n\n${d.opis || ''}\n\nPrzed adopcją obowiązuje wizyta przedadopcyjna i umowa. Pies jest po kastracji/sterylizacji lub przed zabiegiem na koszt schroniska.\n${KONTAKT}\n${d.zrodlo_url || SITE}` },
  halas: { l: 'Zróbmy hałas', f: (d, h) => { const dn = d.data_przyjecia ? days(d.data_przyjecia) : 0; return `ZRÓBMY HAŁAS wokół ${d.imie.toUpperCase()}!\n${dn > 30 ? `${d.imie} jest w schronisku od ${dn} dni i nikt o ${d.plec === 'suka' ? 'nią' : 'niego'} nie zapytał.` : `${d.imie} czeka na swój dom.`} ${h || ''}\n\n${d.opis ? d.opis.slice(0, 300) : ''}\n\nUdostępnij, to może być jego/jej szansa.\n${KONTAKT}`; } },
  dt: { l: 'Apel o dom tymczasowy', f: (d, h) => `PILNIE SZUKAMY DOMU TYMCZASOWEGO dla ${d.imie.toUpperCase()}\n${h || ''}\n\n${d.opis ? d.opis.slice(0, 300) : ''}\n\nDom tymczasowy to czas, w którym pies odpoczywa od schroniska, a my szukamy mu domu na stałe. Koszty leczenia i karmę pokrywa stowarzyszenie.\n${KONTAKT}` },
  sms: { l: 'SMS / WhatsApp (krótko)', f: (d) => `${d.imie}${d.wiek ? ', ' + d.wiek : ''}${d.wielkosc ? ', ' + d.wielkosc : ''}. Szuka domu. Zdjęcia i opis: ${d.zrodlo_url || SITE}` }
};
"""

with sync_playwright() as p:
    b = p.chromium.launch(); ctx, pg = newpage(b); login(pg, 'Ania')

    # 1. Porównanie z poprzednią wersją na wielu wariantach psów i haseł
    wynik_por = pg.evaluate("""async (stare) => {
      const t = await import('/js/teczka.js'); const STARE = new Function(stare + '; return STARE;')();
      const now = Date.now(), D = 864e5, dogs = [];
      for (const plec of ['suka', 'samiec', ''])
        for (const dp of [null, now - 5 * D, now - 31 * D, now - 400 * D])
          for (const opis of ['', 'Krótki opis.', 'Długi '.repeat(80) + 'koniec', 'Z klamrami {imie} i {haslo}'])
            for (const ex of [{}, { wiek: '2 lata' }, { wielkosc: 'średni', waga: '12 kg' }, { wiek: 'ok. 5 lat', wielkosc: 'duży', waga: '30', zrodlo_url: 'https://www.schronisko-nowodwor.com.pl/psy-do-adopcji/x/1' }])
              dogs.push({ imie: 'Łajka Ósma', plec, data_przyjecia: dp, opis, ...ex });
      let n = 0, zle = [];
      for (const d of dogs) for (const h of ['', 'będziesz ze mnie dumny', '{IMIE}']) for (const r of Object.keys(STARE)) {
        n++; const a = STARE[r].f(d, h), b = t.tekstKarta(r, d, h, {});
        if (a !== b) zle.push({ r, h, d, a, b });
      }
      return { n, zle: zle.slice(0, 3), ile: zle.length, rodzaje: Object.keys(t.TEKSTY).join(','), stareR: Object.keys(STARE).join(',') };
    }""", STARE)
    check('te same rodzaje tekstów', wynik_por['rodzaje'] == wynik_por['stareR'], wynik_por)
    check(f"domyślne szablony = poprzednie teksty ({wynik_por['n']} porównań)", wynik_por['ile'] == 0, wynik_por['zle'])

    # 2. Okno na karcie psa
    save(pg, 'psy', {'id': 'p1', 'imie': 'Rufi', 'plec': 'samiec', 'wiek': '3 lata', 'wielkosc': 'średni', 'opis': 'Wesoły pies.', 'status': 'schronisko', 'miejsce': 'schronisko'})
    go(pg, '#/psy/p1'); pg.click('[data-act=dog-teksty]'); pg.wait_for_selector('#t_t')
    v = pg.input_value('#t_t'); check('post domyślny', v.startswith('RUFI - wpisz hasło\n\n3 lata, średni\n\nWesoły pies.'), v[:80])
    pg.fill('#t_h', 'mój najlepszy'); pg.wait_for_timeout(100)
    check('hasło od razu w tekście', pg.input_value('#t_t').startswith('RUFI - mój najlepszy'))
    pg.select_option('#t_w', 'sms'); pg.wait_for_timeout(100)
    check('SMS', pg.input_value('#t_t') == 'Rufi, 3 lata, średni. Szuka domu. Zdjęcia i opis: https://www.schronisko-nowodwor.com.pl')
    check('bez informacji o zmianie przy domyślnym', pg.inner_text('#t_i').strip() == '')

    # 3. Edycja szablonu SMS
    pg.click('#t_e'); pg.wait_for_selector('#ks_t')
    check('okno szablonu: treść domyślna', pg.input_value('#ks_t') == '{imie}{dane_krotko}. Szuka domu. Zdjęcia i opis: {link}')
    pg.fill('#ks_t', '{IMIE} ({wiek}) czeka na {go}! {link}'); pg.wait_for_timeout(100)
    check('podgląd', pg.inner_text('#ks_p') == 'RUFI (3 lata) czeka na go! https://www.schronisko-nowodwor.com.pl', pg.inner_text('#ks_p'))
    pg.fill('#ks_t', 'Hej {imie}, ')
    pg.click('details summary'); pg.click('[data-ins="{opis}"]'); pg.wait_for_timeout(100)
    check('wstaw zmienną', pg.input_value('#ks_t') == 'Hej {imie}, {opis}', pg.input_value('#ks_t'))
    pg.fill('#ks_t', '{imie} szuka domu. {nieznane} {link}'); pg.click('#ks_s'); pg.wait_for_selector('#t_t'); pg.wait_for_timeout(300)
    check('po zapisie wraca do tekstów z tym samym rodzajem', pg.input_value('#t_w') == 'sms' and pg.input_value('#t_h') == 'mój najlepszy')
    check('tekst z nowego szablonu (nieznane słowo zostaje)', pg.input_value('#t_t') == 'Rufi szuka domu. {nieznane} https://www.schronisko-nowodwor.com.pl', pg.input_value('#t_t'))
    check('informacja kto zmienił', 'Szablon zmieniony przez Ania' in pg.inner_text('#t_i'))
    pg.select_option('#t_w', 'post'); pg.wait_for_timeout(100)
    check('inne rodzaje bez zmian', pg.input_value('#t_t').startswith('RUFI - mój najlepszy\n\n3 lata, średni'))
    # pusty szablon nie przejdzie
    pg.click('#t_e'); pg.wait_for_selector('#ks_t'); pg.fill('#ks_t', '   '); pg.click('#ks_s'); pg.wait_for_timeout(200)
    check('pusty szablon odrzucony', 'nie może być pusty' in pg.inner_text('#ks_e'))
    pg.click('#ks_b'); pg.wait_for_selector('#t_t')

    # 4. Druga osoba widzi zmieniony szablon
    sync(pg)
    ctx2, pg2 = newpage(b); login(pg2, 'Basia'); sync(pg2)
    go(pg2, '#/psy/p1'); pg2.click('[data-act=dog-teksty]'); pg2.wait_for_selector('#t_t'); pg2.select_option('#t_w', 'sms'); pg2.wait_for_timeout(200)
    check('synchronizacja szablonu', pg2.input_value('#t_t').startswith('Rufi szuka domu.'), pg2.input_value('#t_t'))
    check('u drugiej osoby: kto zmienił', 'przez Ania' in pg2.inner_text('#t_i'))

    # 5. Przywróć domyślny (z potwierdzeniem); Anuluj wraca do okna szablonu
    pg2.click('#t_e'); pg2.wait_for_selector('#ks_t'); pg2.click('#ks_r'); pg2.wait_for_selector('[data-no]'); pg2.click('[data-no]'); pg2.wait_for_selector('#ks_t')
    check('Anuluj wraca do szablonu', pg2.input_value('#ks_t').startswith('{imie} szuka domu.'))
    pg2.click('#ks_r'); pg2.wait_for_selector('[data-yes]'); pg2.click('[data-yes]'); pg2.wait_for_selector('#t_t'); pg2.wait_for_timeout(200)
    check('przywrócony domyślny', pg2.input_value('#t_t') == 'Rufi, 3 lata, średni. Szuka domu. Zdjęcia i opis: https://www.schronisko-nowodwor.com.pl', pg2.input_value('#t_t'))
    sync(pg2); sync(pg)
    go(pg, '#/psy/p1'); pg.click('[data-act=dog-teksty]'); pg.wait_for_selector('#t_t'); pg.select_option('#t_w', 'sms'); pg.wait_for_timeout(200)
    check('domyślny wrócił u wszystkich', pg.input_value('#t_t').startswith('Rufi, 3 lata, średni.'), pg.input_value('#t_t'))
    # zapis szablonu identycznego z domyślnym nie tworzy zmiany
    pg.click('#t_e'); pg.wait_for_selector('#ks_t'); pg.click('#ks_s'); pg.wait_for_selector('#t_t'); pg.wait_for_timeout(200)
    n = pg.evaluate("async()=>{const s=await import('/js/store.js');return (await s.list('szablony_karta')).length}")
    check('domyślny = brak zapisu', n == 0, n)

    # 6. Zmiana szablonu przez kogoś innego, gdy okno jest otwarte: tekst odświeża się sam
    go(pg2, '#/psy/p1'); pg2.click('[data-act=dog-teksty]'); pg2.wait_for_selector('#t_t'); pg2.select_option('#t_w', 'album'); pg2.wait_for_timeout(100)
    save(pg, 'szablony_karta', {'id': 'album', 'rodzaj': 'album', 'tekst': 'ALBUM: {IMIE}', 'autor': 'Ania', 'ts': 1}); sync(pg)
    sync(pg2, 1500)
    check('odświeżenie na żywo', pg2.input_value('#t_t') == 'ALBUM: RUFI', pg2.input_value('#t_t'))

    # 7. Przypomnienie „zróbmy hałas” nadal otwiera to okno
    save(pg, 'psy', {'id': 'p2', 'imie': 'Stary', 'plec': 'samiec', 'data_przyjecia': pg.evaluate('Date.now()') - 200 * 864e5, 'status': 'schronisko', 'miejsce': 'schronisko', 'zdjecia': ['https://example.invalid/s_l.jpg']})
    go(pg, '#/zrobic'); pg.locator('.card', has_text='Stary').locator('[data-act=dog-teksty]').click(); pg.wait_for_selector('#t_t')
    check('z „Dziś i do zrobienia”', 'Teksty: Stary' in text(pg, '.sheet'))

    koniec('teksty1')
