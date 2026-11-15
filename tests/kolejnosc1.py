# 1.15: kolejność „Alfabetycznie | Boks” (Brama: „Wydaj”; „Godzina | Boks” w „Poza” i „Wróciły”), wybór psa do spaceru, lista Psy.
# Według boksów: 2, 7, 7a, 12, A3 (liczby jak liczby), pod nimi psy bez boksu alfabetycznie. Wybór pamięta telefon, osobno dla ekranu.
from playwright.sync_api import sync_playwright
from wspolne import *

BOKSY = [('Rex', '12'), ('Bari', '7a'), ('Dina', 'A3'), ('Kora', '7'), ('Fado', '2'), ('Zuza', ''), ('Ala', ''), ('Luna', '5')]  # Luna w DT: bez boksu
ALFA = ['Ala', 'Bari', 'Dina', 'Fado', 'Kora', 'Rex', 'Zuza']
WG_BOKSU = ['Fado', 'Kora', 'Bari', 'Rex', 'Dina', 'Ala', 'Zuza']

with sync_playwright() as p:
    b = p.chromium.launch(); ctx, pg = newpage(b); login(pg, 'Ania'); now = pg.evaluate('Date.now()')
    for i, (imie, bx) in enumerate(BOKSY):
        save(pg, 'psy', {'id': f'k{i}', 'imie': imie, 'plec': 'samiec', 'boks': bx, 'status': 'dt' if imie == 'Luna' else 'do_adopcji', 'miejsce': 'dt' if imie == 'Luna' else 'schronisko', 'kanaly': {'www': now}, 'zdjecia': []})
    imiona = lambda sel: [x.split('\n')[0].split(' ')[0].strip() for x in pg.locator(sel).all_inner_texts()]

    go(pg, '#/brama', 800)
    check('Brama: domyślnie alfabetycznie', imiona('#bl .row b') == ALFA, imiona('#bl .row b'))
    check('Brama „Wydaj”: przycisk Alfabetycznie | Boks', pg.locator('.kolej [data-t=domyslnie]').inner_text() == 'Alfabetycznie' and pg.locator('.kolej [data-t=boks]').count() == 1)
    pg.click('.kolej [data-t=boks]'); pg.wait_for_timeout(500)
    check('Brama: według boksów, bez boksu alfabetycznie na końcu', imiona('#bl .row b') == WG_BOKSU, imiona('#bl .row b'))
    # wydaj trzy psy w kolejności godzin: Rex, Fado, Ala
    for imie in ['Rex', 'Fado', 'Ala']:
        pg.locator('#bl .row', has_text=imie).locator('[data-act=br-out]').click(); pg.wait_for_selector('#wo'); pg.click('#wo button[type=submit]'); pg.wait_for_timeout(350)
    pg.click('[data-act=br-tab][data-t=out]'); pg.wait_for_timeout(400)
    check('„Poza”: przycisk Godzina | Boks', pg.locator('.kolej [data-t=domyslnie]').inner_text() == 'Godzina')
    check('„Poza” według boksów', imiona('#bl .row b') == ['Fado', 'Rex', 'Ala'], imiona('#bl .row b'))
    pg.click('.kolej [data-t=domyslnie]'); pg.wait_for_timeout(400)
    check('„Poza” według godziny (jak dotąd)', imiona('#bl .row b') == ['Rex', 'Fado', 'Ala'], imiona('#bl .row b'))
    for imie in ['Ala', 'Rex', 'Fado']:  # zwrot w tej kolejności
        pg.locator('#bl .row', has_text=imie).locator('[data-act=br-back]').click(); pg.wait_for_timeout(350)
    pg.click('[data-act=br-tab][data-t=wrocily]'); pg.wait_for_timeout(400)
    check('„Wróciły” według godziny: ostatni zwrot na górze', imiona('#bl .row b') == ['Fado', 'Rex', 'Ala'], imiona('#bl .row b'))
    pg.click('.kolej [data-t=boks]'); pg.wait_for_timeout(400)
    check('„Wróciły” według boksów', imiona('#bl .row b') == ['Fado', 'Rex', 'Ala'], imiona('#bl .row b'))
    pg.click('[data-act=br-tab][data-t=wydaj]'); pg.wait_for_timeout(400)
    # najpierw psy, które dziś jeszcze nie wyszły, potem te, które już były; w obu grupach według boksów
    check('Brama „Wydaj” po spacerach: grupy jak dotąd, w każdej boksy', imiona('#bl .row b') == ['Kora', 'Bari', 'Dina', 'Zuza', 'Fado', 'Rex', 'Ala'], imiona('#bl .row b'))

    # wybór psa do spaceru (osobny wybór; Luna w DT jest na liście, bez boksu → alfabetycznie)
    go(pg, '#/spacer', 800)
    check('Spacer: domyślnie alfabetycznie', imiona('#wl .row b') == ['Ala', 'Bari', 'Dina', 'Fado', 'Kora', 'Luna', 'Rex', 'Zuza'], imiona('#wl .row b'))
    pg.click('.kolej [data-t=boks]'); pg.wait_for_timeout(500)
    check('Spacer: według boksów', imiona('#wl .row b') == ['Fado', 'Kora', 'Bari', 'Rex', 'Dina', 'Ala', 'Luna', 'Zuza'], imiona('#wl .row b'))
    pg.fill('#wq', 'a'); pg.wait_for_timeout(200)
    check('Spacer: szukanie zachowuje kolejność', imiona('#wl .row b') == ['Fado', 'Kora', 'Bari', 'Dina', 'Ala', 'Luna', 'Zuza'], imiona('#wl .row b'))

    # lista Psy (osobny wybór)
    go(pg, '#/psy', 800); pg.click('[data-act=dog-filter][data-k=aktywne]'); pg.wait_for_timeout(400)
    h3 = lambda: [x.split(' ')[0].strip() for x in pg.locator('#grid .dcard h3').all_inner_texts()]
    check('Psy: domyślnie alfabetycznie', h3() == ['Ala', 'Bari', 'Dina', 'Fado', 'Kora', 'Luna', 'Rex', 'Zuza'], h3())
    pg.click('.kolej [data-t=boks]'); pg.wait_for_timeout(500)
    check('Psy: według boksów', h3() == ['Fado', 'Kora', 'Bari', 'Rex', 'Dina', 'Ala', 'Luna', 'Zuza'], h3())
    pg.fill('#fq', 'r'); pg.wait_for_timeout(300)
    check('Psy: szukanie zachowuje kolejność', h3() == ['Kora', 'Bari', 'Rex'], h3())
    pg.fill('#fq', ''); pg.wait_for_timeout(200)
    check('nic nie wychodzi poza ekran', pg.evaluate('document.documentElement.scrollWidth - innerWidth') <= 1)

    # zapamiętanie po ponownym otwarciu
    pg.reload(); pg.wait_for_timeout(1200); go(pg, '#/psy', 800)
    check('Psy: wybór zapamiętany', pg.locator('.kolej [data-t=boks]').get_attribute('aria-pressed') == 'true')
    go(pg, '#/brama', 600); pg.click('[data-act=br-tab][data-t=wydaj]'); pg.wait_for_timeout(300)
    check('Brama: wybór zapamiętany', pg.locator('.kolej [data-t=boks]').get_attribute('aria-pressed') == 'true')
    koniec('kolejnosc1')
