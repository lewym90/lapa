# Nakładki pełnoekranowe: karta psa do druku i plakat zaginięcia (Zamknij, Esc), plakat bez boksu i oznaczeń.
from playwright.sync_api import sync_playwright
from wspolne import *
with sync_playwright() as p:
    b = p.chromium.launch(); ctx, pg = newpage(b); login(pg, 'Ania', 'administrator-haslo-3'); now = pg.evaluate('Date.now()')
    save(pg, 'psy', {'id': 'd1', 'imie': 'Saba', 'plec': 'suka', 'boks': '7', 'status': 'do_adopcji', 'miejsce': 'schronisko', 'opis': 'Opis.', 'zdjecia': []})
    save(pg, 'oznaczenia', {'id': 'd1', 'opis': 'wycofany', 'wybrani': {'on': True, 'powody': ['silny'], 'inny': '', 'kto': ''}})
    save(pg, 'zaginiecia', {'id': 'z1', 'pies_id': 'd1', 'imie': 'Saba', 'kiedy': now, 'gdzie': 'Nowodwór', 'status': 'poszukiwany', 'akt': [], 'autor': 'A'})
    for sposob in ['zamknij', 'esc']:
        go(pg, '#/psy/d1', 800); pg.click('[data-act=dog-print]'); pg.wait_for_selector('.ppv', timeout=8000)
        if sposob == 'zamknij':
            t = pg.inner_text('.ppv-page')
            check('karta PDF bez boksu i oznaczeń', 'Boks' not in t and 'wycofany' not in t and 'wybrani' not in t, t[:200])
            pg.click('[data-ppv=x]')
        else: pg.keyboard.press('Escape')
        pg.wait_for_timeout(300); check('karta do druku zamyka się: ' + sposob, pg.locator('.ppv').count() == 0)
    go(pg, '#/zaginiecia', 800); pg.click('[data-act=zag-open]'); pg.wait_for_selector('#z_pl'); pg.click('#z_pl'); pg.wait_for_selector('.ppv', timeout=8000)
    pg.wait_for_timeout(500); pg.click('.ppv [data-ppv=x], .ppv button:has-text("Zamknij")'); pg.wait_for_timeout(300)
    check('plakat zamyka się', pg.locator('.ppv').count() == 0)
    go(pg, '#/psy/d1', 800); pg.click('[data-act=dog-print]'); pg.wait_for_selector('.ppv', timeout=8000)
    pg.evaluate("location.hash='#/psy'"); pg.wait_for_timeout(600)
    check('przejście dalej (gest wstecz) zamyka podgląd', pg.locator('.ppv').count() == 0)
    koniec('audyt2')
