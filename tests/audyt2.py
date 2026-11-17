# Gotowy tekst zaginięcia (do skopiowania) nie zdradza boksu ani oznaczeń administratora. Od 1.19 nie ma plakatu ani karty PDF.
from playwright.sync_api import sync_playwright
from wspolne import *
with sync_playwright() as p:
    b = p.chromium.launch(); ctx, pg = newpage(b); login(pg, 'Ania', 'administrator-haslo-3'); now = pg.evaluate('Date.now()')
    save(pg, 'psy', {'id': 'd1', 'imie': 'Saba', 'plec': 'suka', 'boks': '7', 'status': 'do_adopcji', 'miejsce': 'schronisko', 'opis': 'Opis.', 'zdjecia': []})
    save(pg, 'oznaczenia', {'id': 'd1', 'opis': 'wycofany', 'wybrani': {'on': True, 'powody': ['silny'], 'inny': '', 'kto': ''}})
    save(pg, 'zaginiecia', {'id': 'z1', 'pies_id': 'd1', 'imie': 'Saba', 'kiedy': now, 'gdzie': 'Nowodwór', 'status': 'poszukiwany', 'akt': [], 'autor': 'A'})
    go(pg, '#/zaginiecia/z1', 800); pg.click('[data-act=zag-tekst]'); pg.wait_for_selector('#z_pt')
    t = pg.input_value('#z_pt'); check('tekst bez boksu i oznaczeń', 'Boks' not in t and 'wycofany' not in t and 'wybrani' not in t and 'SZUKAMY SABA' in t, t[:200])
    pg.evaluate("location.hash='#/psy'"); pg.wait_for_timeout(600)
    check('przejście dalej zamyka okno', pg.locator('#sheet-root .sheet').count() == 0)
    koniec('audyt2')
