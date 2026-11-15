# Zakładka Social media (1.10.x): rodzaje, teksty z danych psa, końcówki wg płci, poprawka na potrzeby chwili,
# edycja szablonu wspólna dla wszystkich, przywracanie domyślnego, wybór psa z karty przyjęcia, kanał YouTube w karcie psa.
from playwright.sync_api import sync_playwright
from wspolne import *

with sync_playwright() as p:
    b = p.chromium.launch(); ctx, pg = newpage(b); login(pg, 'Ania')
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin='http://127.0.0.1:8000')
    save(pg, 'psy', {'id': 's1', 'imie': 'Luna', 'plec': 'suka', 'wiek': '3 lata', 'waga': '14', 'wzrost': '45', 'opis': 'Kochana sunia.', 'status': 'schronisko', 'miejsce': 'schronisko'})

    go(pg, '#/social'); t = text(pg)
    for nazwa in ['Pies do adopcji', 'Zróbmy hałas', 'Dom tymczasowy', 'Zbiórka / leczenie', 'Pies adoptowany', 'Zaproszenie na spacery', 'Odwołanie spacerów', 'Relacja po spacerach', 'Maxi Zoo', 'Podziękowanie', 'Zaginięcie psa']:
        check('rodzaj: ' + nazwa, nazwa in t)

    # Pies do adopcji z psem wybranym w adresie (tak otwiera go krok „Ogłoszenie” karty przyjęcia)
    go(pg, '#/social/adopcja/s1', 900)
    plat = pg.locator('textarea[data-o]').count(); check('8 tekstów na platformy', plat == 8, plat)
    fb = pg.input_value('textarea[data-o=fb]')
    check('FB: tytuł i dane', fb.startswith('LUNA - \n') or fb.startswith('LUNA -'), fb[:60])
    check('FB: dane psa', 'wiek: 3 lata; wysokość w kłębie: 45 cm; waga: 14 kg' in fb, fb)
    check('FB: blok kontaktu', 'Justyna: 691 742 265' in fb)
    check('TikTok: końcówki suczki', 'kochającego ją domu' in pg.input_value('textarea[data-o=tiktok]') and 'Gotowa jest' in pg.input_value('textarea[data-o=tiktok]'))
    check('YouTube tytuł', pg.input_value('textarea[data-o=yt_t]') == 'LUNA - jest gotowa do pokochania i adoptowania / czytaj opis ! #dog #pies #shorts #shortvideo')
    pg.fill('#f_haslo', 'najlepsza przyjaciółka'); pg.wait_for_timeout(200)
    check('hasło w tytule strony', pg.input_value('textarea[data-o=www_t]') == 'LUNA - najlepsza przyjaciółka')

    # poprawka na potrzeby chwili: nie zmienia szablonu, formularz jej nie nadpisuje, „Wróć do wygenerowanego”
    pg.fill('textarea[data-o=ig]', 'Mój własny tekst 🐾'); pg.wait_for_timeout(100)
    pg.fill('#f_cecha', 'Spokojna.'); pg.wait_for_timeout(200)
    check('poprawka zostaje po zmianie formularza', pg.input_value('textarea[data-o=ig]') == 'Mój własny tekst 🐾')
    check('FB odświeżony z formularza', 'Spokojna.' in pg.input_value('textarea[data-o=fb]'))
    pg.click('[data-act=soc-copy][data-p=ig]'); pg.wait_for_timeout(300)
    check('Kopiuj bierze poprawiony tekst', pg.evaluate('navigator.clipboard.readText()') == 'Mój własny tekst 🐾')
    pg.click('[data-act=soc-reset][data-p=ig]'); pg.wait_for_timeout(200)
    check('Wróć do wygenerowanego', pg.input_value('textarea[data-o=ig]').startswith('LUNA - najlepsza przyjaciółka'))
    n = pg.evaluate("async()=>{const s=await import('/js/store.js');return (await s.list('szablony_social')).length}")
    check('poprawka nie zapisuje szablonu', n == 0)

    # edycja szablonu (TikTok), synchronizacja, przywrócenie
    pg.click('[data-act=soc-edit][data-p=tiktok]'); pg.wait_for_selector('#ts_t')
    pg.fill('#ts_t', '{IMIE} szuka domu! {krs}'); pg.wait_for_timeout(100)
    check('podgląd szablonu', pg.inner_text('#ts_p').startswith('LUNA szuka domu! PRZEKAŻ 1.5%'))
    pg.click('#ts_s'); pg.wait_for_timeout(500)
    check('szablon zapisany', pg.input_value('textarea[data-o=tiktok]').startswith('LUNA szuka domu!'))
    check('podpis zmiany', 'Szablon zmieniony przez Ania' in text(pg))
    sync(pg)
    ctx2, pg2 = newpage(b); login(pg2, 'Basia'); sync(pg2)
    go(pg2, '#/social/adopcja/s1', 900)
    check('druga osoba widzi szablon', pg2.input_value('textarea[data-o=tiktok]').startswith('LUNA szuka domu!'))
    pg2.click('[data-act=soc-edit][data-p=tiktok]'); pg2.wait_for_selector('#ts_r'); pg2.click('#ts_r'); pg2.click('[data-yes]'); pg2.wait_for_timeout(600)
    sync(pg2); sync(pg, 1500)
    go(pg, '#/social/adopcja/s1', 900)
    check('przywrócony u wszystkich', pg.input_value('textarea[data-o=tiktok]').startswith('LUNA liczy na pomoc'), pg.input_value('textarea[data-o=tiktok]')[:60])

    # rodzaj bez psa
    go(pg, '#/social/odwolanie', 700); pg.fill('#f_data', '2 maja'); pg.fill('#f_nastepna', '9 maja'); pg.wait_for_timeout(200)
    check('odwołanie spacerów', pg.input_value('textarea[data-o=fb]').startswith('Informujemy, że sobota 2 maja - NIE MA SPACERÓW'), pg.input_value('textarea[data-o=fb]'))

    # karta psa: kanał YouTube w „Gdzie jest ogłoszony”
    go(pg, '#/psy/s1'); pg.click('[data-act=dog-kanaly]'); pg.wait_for_selector('#kf')
    check('kanał YouTube', pg.locator('#kf [data-k=yt]').count() == 1)
    pg.check('#kf [data-k=yt]'); pg.click('#kf button[type=submit]'); pg.wait_for_timeout(500)
    check('YouTube = ogłoszony na Drodze psa', '✓ Ogłoszony' in text(pg))

    # nazwa spaceru (1.10.3)
    go(pg, '#/start'); pg.click('nav.nav [data-act=add]'); check('„Spacer z wolontariuszem” w „+”', 'Spacer z wolontariuszem' in text(pg, '.sheet'))

    koniec('social1')
