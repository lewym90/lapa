# Pełny przegląd: każdy ekran (telefon i komputer, wolontariusz i administrator) i główne okna.
# Sprawdza: ekran się otwiera bez błędu, nic nie wychodzi poza szerokość ekranu, z każdego ekranu da się wyjść
# (dolny pasek, panel boczny albo przycisk Wstecz, który działa), każde okno zamyka się krzyżykiem, Esc i dotknięciem tła.
from playwright.sync_api import sync_playwright
from wspolne import *

ADM = 'administrator-haslo-3'
D = 864e5
TRASY = ['#/start', '#/psy', '#/psy/d1', '#/psy/d2', '#/psy/m1', '#/brama', '#/spacer', '#/raport/w3', '#/czat', '#/wydarzenia', '#/pomoc', '#/transport',
         '#/zadania', '#/terminarz', '#/sobotnie', '#/zrobic', '#/nowe', '#/nowe/m1', '#/adopcje', '#/dt', '#/zaginiecia', '#/finanse', '#/social',
         '#/social/adopcja', '#/social/adopcja/d1', '#/social/halas', '#/social/dt', '#/social/pomoc', '#/social/adoptowany', '#/social/spacery',
         '#/social/odwolanie', '#/social/relacja', '#/social/maxizoo', '#/social/podziekowanie', '#/ustawienia', '#/dziekujemy', '#/psy/nie-ma-takiego']


def seed(pg):
    # spacery z Bramy z „przed chwilą”, żeby test działał też tuż po północy (Brama pokazuje tylko dzisiejsze)
    now = pg.evaluate('Date.now()')
    psy = [
        {'id': 'd1', 'imie': 'Saba', 'plec': 'suka', 'wiek': '5 lat', 'wielkosc': 'duża', 'boks': '7', 'status': 'do_adopcji', 'miejsce': 'schronisko', 'haslo': 'SABA - w cieniu strachu', 'data_przyjecia': now - 300 * D, 'kanaly': {'www': now}, 'opis': 'Potrzebuje czasu. ' * 20, 'zdjecia': ['https://example.invalid/s_l.jpg'], 'potrzeby': ['transport'], 'zrodlo_url': 'https://www.schronisko-nowodwor.com.pl/psy-do-adopcji/saba/1'},
        {'id': 'd2', 'imie': 'Bardzo Długie Imię Psa Testowego', 'plec': 'samiec', 'wiek': 'ok. 10 lat', 'wielkosc': 'bardzo duży', 'boks': '1234', 'status': 'pilne', 'miejsce': 'schronisko', 'haslo': 'X - ' + 'bardzo długie hasło ' * 5, 'kanaly': {}, 'zdjecia': []},
        {'id': 'd3', 'imie': 'Luna', 'plec': 'suka', 'status': 'dt', 'miejsce': 'dt', 'opiekun': 'Kasia', 'kanaly': {'www': now}, 'zdjecia': []},
        {'id': 'm1', 'imie': 'Nowy', 'plec': 'samiec', 'wiek': '1 rok', 'nowy': True, 'status': 'schronisko', 'miejsce': 'schronisko', 'data_przyjecia': now, 'dodany': now, 'zdjecia': []},
    ]
    for d in psy: save(pg, 'psy', d)
    save(pg, 'spacery', {'id': 'w1', 'tryb': 'brama', 'pies_id': 'd1', 'pies_imie': 'Saba', 'start': now - 60000, 'end': None, 'autor': 'A', 'osoba': 'Kasia', 'kontakt': '600 100 200'})
    save(pg, 'spacery', {'id': 'w2', 'tryb': 'brama', 'pies_id': 'd2', 'pies_imie': 'Bardzo Długie Imię Psa Testowego', 'start': now - 120000, 'end': now - 60000, 'autor': 'A', 'osoba': 'Bardzo Długie Imię Osoby', 'kontakt': 'https://m.me/bardzo.dlugi.profil.messengera.osoby'})
    save(pg, 'spacery', {'id': 'w3', 'pies_id': 'd1', 'pies_imie': 'Saba', 'start': now - 5 * D, 'end': now - 5 * D + 3e6, 'czas_min': 50, 'dystans_km': 2.5, 'autor': 'A', 'notatka': 'Spokojnie.'})
    save(pg, 'zaginiecia', {'id': 'z1', 'pies_id': 'd1', 'imie': 'Saba', 'kiedy': now, 'gdzie': 'Nowodwór', 'status': 'poszukiwany', 'akt': [], 'autor': 'A'})
    save(pg, 'transporty', {'id': 't1', 'pies_id': 'd1', 'pies_imie': 'Saba', 'skad': 'Schronisko', 'dokad': 'Weterynarz', 'kiedy': now + 3600e3, 'status': 'szuka', 'autor': 'A'})
    save(pg, 'terminarz', {'id': 'e1', 'tytul': 'Wizyta', 'start': now + 7200e3, 'widocznosc': 'wszyscy', 'owner': 'A', 'autor': 'A', 'pies_id': 'd1', 'pies_imie': 'Saba'})
    save(pg, 'czat', {'id': 'c1', 'ts': now, 'autor': 'Basia', 'text': 'Kto weźmie Sabę?', 'kind': 'msg', 'ref': {'typ': 'pies', 'id': 'd1', 'nazwa': 'Saba'}})
    save(pg, 'potrzeby', {'id': 'n1', 'nazwa': 'Karma', 'kategoria': 'Karma mokra', 'potrzeba': 10, 'zapewniono': 1, 'autor': 'A'})


def sprawdz_ekran(pg, h, kto, szer):
    go(pg, h, 800)
    t = text(pg)
    tag = f'{kto} {szer}px {h}'
    check(tag + ': otwiera się', 'Coś poszło nie tak' not in t and len(t.strip()) > 10, t[:120])
    ov = pg.evaluate('document.documentElement.scrollWidth - innerWidth')
    check(tag + ': nic nie wychodzi poza ekran', ov <= 1, ov)
    nav = pg.locator('nav.nav').count() and pg.locator('nav.nav').is_visible()
    side = pg.locator('aside.side').count() and pg.locator('aside.side').is_visible()
    back = pg.locator('#app [data-act=back]:visible, #app .topbar a.iconbtn[href]:visible, #app a.btn[href="#/start"]:visible, #app a.btn[href="#/psy"]:visible, #app a.btn[href="#/nowe"]:visible, #app a.btn[href="#/social"]:visible')
    check(tag + ': da się wyjść', bool(nav or side or back.count()))
    if not nav and not side and back.count():
        pg.evaluate("location.hash='#/start'"); pg.wait_for_timeout(300); go(pg, h, 700)
        back.first.click(); pg.wait_for_timeout(600)
        check(tag + ': Wstecz działa', pg.evaluate('location.hash') != h)


def okno(pg, nazwa, otworz):
    """Otwiera okno, sprawdza szerokość i zamykanie: krzyżyk, Esc, tło."""
    for sposob in ['x', 'esc', 'tlo']:
        otworz(); pg.wait_for_selector('#sheet-root .sheet', timeout=5000); pg.wait_for_timeout(250)
        if sposob == 'x':
            ov = pg.evaluate("(()=>{const s=document.querySelector('#sheet-root .sheet');return s.scrollWidth-s.clientWidth})()")
            check(nazwa + ': okno mieści się w szerokości', ov <= 1, ov)
            pg.click('#sheet-root .sheetx')
        elif sposob == 'esc':
            pg.keyboard.press('Escape')
        else:
            pg.mouse.click(5, 5)
        pg.wait_for_timeout(300)
        check(f'{nazwa}: zamyka się ({sposob})', pg.locator('#sheet-root .sheet').count() == 0)


with sync_playwright() as p:
    b = p.chromium.launch()
    for kto, haslo in [('wolontariusz', WOL), ('administrator', ADM)]:
        for vp in [{'width': 390, 'height': 844}, {'width': 1280, 'height': 860}]:
            ctx, pg = newpage(b, vp); login(pg, kto[:4].capitalize(), haslo)
            if kto == 'wolontariusz' and vp['width'] == 390: seed(pg); sync(pg)
            else: sync(pg, 1500)
            if kto == 'administrator' and vp['width'] == 390:
                save(pg, 'oznaczenia', {'id': 'd1', 'opis': 'wycofany', 'wybrani': {'on': True, 'powody': ['wycofany', 'silny', 'trudny'], 'inny': 'gryzie smycz i ucieka', 'kto': 'Justyna, Marek, Dorota, Ania, Kasia'}})
                save(pg, 'oznaczenia', {'id': 'd2', 'opis': 'dla aktywnych', 'wybrani': {'on': True, 'powody': ['silny'], 'inny': '', 'kto': ''}})
                sync(pg)
            for h in TRASY:
                sprawdz_ekran(pg, h, kto, vp['width'])
            if vp['width'] == 390:
                # okna na karcie psa
                go(pg, '#/psy/d1', 800)
                for act in ['dog-miejsce', 'dog-ocena', 'dog-zdrowie', 'dog-kanaly', 'dog-teksty', 'dog-walks', 'dog-obs', 'dog-needs', 'dog-photo', 'dog-obs-add', 'dog-edit'] + (['dog-oznacz'] if kto == 'administrator' else []):
                    okno(pg, f'{kto} karta psa {act}', lambda a=act: pg.locator(f'#app [data-act={a}]').first.click())
                # „+” i okna z niego
                go(pg, '#/start', 700)
                okno(pg, f'{kto} menu +', lambda: pg.click('nav.nav [data-act=add]'))
                for act in ['a-newdog', 'a-obs', 'a-photo', 'a-task', 'a-event', 'a-trans', 'a-need', 'a-dog']:
                    def otworz(a=act):
                        pg.click('nav.nav [data-act=add]'); pg.wait_for_selector('#sheet-root .sheet'); pg.click(f'#sheet-root [data-act={a}]'); pg.wait_for_timeout(400)
                    okno(pg, f'{kto} + {act}', otworz)
                # Brama: okno wydania i edycji
                go(pg, '#/brama', 700); pg.click('[data-act=br-tab][data-t=wydaj]'); pg.wait_for_timeout(300)
                okno(pg, f'{kto} Brama: wydaj', lambda: pg.locator('[data-act=br-out]').first.click())
                pg.click('[data-act=br-tab][data-t=out]'); pg.wait_for_timeout(300)
                okno(pg, f'{kto} Brama: dane osoby', lambda: pg.locator('[data-act=br-info]').first.click())
                pg.click('[data-act=br-tab][data-t=wydaj]'); pg.wait_for_timeout(200)
                # menu (trzy kreski) zamyka się i prowadzi do każdego punktu
                go(pg, '#/start', 700); pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer')
                n = pg.locator('.drawer nav a').count(); pg.click('.drawer .scrim'); pg.wait_for_timeout(200)
                check(f'{kto}: menu zamyka się dotknięciem tła', pg.locator('.drawer').count() == 0)
                for i in range(n):
                    go(pg, '#/start', 400); pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer'); href = pg.locator('.drawer nav a').nth(i).get_attribute('href')
                    pg.locator('.drawer nav a').nth(i).click(); pg.wait_for_timeout(500)
                    check(f'{kto}: menu → {href}', pg.evaluate('location.hash') == href and pg.locator('.drawer').count() == 0 and 'Coś poszło nie tak' not in text(pg))
                # dolny pasek
                go(pg, '#/start', 500)
                for tab in ['start', 'psy', 'wydarzenia', 'pomoc']:
                    pg.click(f'nav.nav a[href="#/{tab}"]'); pg.wait_for_timeout(400)
                    check(f'{kto}: dolny pasek → {tab}', pg.evaluate('location.hash') == '#/' + tab)
            ctx.close()
    koniec('audyt')
