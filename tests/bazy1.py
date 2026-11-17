# 1.19: Zaginięcia, Domy tymczasowe i hoteliki, Finanse jako bazy danych (lista → karta z polami i ołówkiem).
from playwright.sync_api import sync_playwright
from wspolne import *


def g(P, col, i):
    return P.evaluate("async([c,i])=>(await (await import('/js/store.js')).get(c,i))", [col, i])


def pole(P, act, f, val):
    P.click(f'[data-act={act}][data-f={f}]'); P.wait_for_selector('#sheet-root .sheet .input, #sheet-root .sheet .textarea')
    P.fill('#sheet-root .sheet .input, #sheet-root .sheet .textarea', val); P.click('#sheet-root button[type=submit]'); P.wait_for_timeout(600)


with sync_playwright() as p:
    b = p.chromium.launch()
    ca, pa = newpage(b); login(pa, 'Ania')
    save(pa, 'psy', {'id': 'm1', 'imie': 'Nimus', 'plec': 'samiec', 'status': 'do_adopcji', 'miejsce': 'schronisko', 'zdjecia': []})
    save(pa, 'psy', {'id': 'm2', 'imie': 'Luna', 'plec': 'suka', 'status': 'do_adopcji', 'miejsce': 'dt', 'zdjecia': []})
    # ===== zaginięcia =====
    go(pa, '#/zaginiecia', 700); pa.click('[data-act=zag-new]'); pa.wait_for_selector('#zf')
    pa.select_option('#z_p', 'm1'); check('zaginięcie: wybór psa wpisuje imię', pa.input_value('#z_i') == 'Nimus')
    pa.click('#zf button[type=submit]'); pa.wait_for_timeout(800)
    zid = pa.evaluate("location.hash.split('/')[2]")
    check('zaginięcie: od razu karta', pa.evaluate('location.hash').startswith('#/zaginiecia/') and 'Szukamy' in text(pa))
    pole(pa, 'zag-edit', 'gdzie', 'Nowodwór'); pole(pa, 'zag-edit', 'opis', 'Łagodny, zielona obroża'); pole(pa, 'zag-edit', 'kiedy', '12.11.2026')
    z = g(pa, 'zaginiecia', zid)
    check('zaginięcie: pola zapisane', z['gdzie'] == 'Nowodwór' and z['opis'].startswith('Łagodny') and z['kiedy_txt'] == '12.11.2026', z)
    pa.click('[data-act=zag-edit][data-f=kiedy]'); pa.wait_for_selector('#zev'); pa.fill('#zev', 'wczoraj'); pa.click('#zef button[type=submit]'); pa.wait_for_timeout(300)
    check('zaginięcie: zła data → komunikat', 'Nie rozumiem' in pa.inner_text('#zee')); close_sheet(pa)
    pa.click('[data-act=zag-akt]'); pa.wait_for_selector('#zav'); pa.fill('#zav', 'widziany w Wólce'); pa.click('#zaf button[type=submit]'); pa.wait_for_timeout(600)
    check('zaginięcie: aktualizacja z datą i autorem', 'widziany w Wólce' in text(pa) and 'Ania' in pa.inner_text('.knotki'))
    pa.click('[data-act=zag-tekst]'); pa.wait_for_selector('#z_pt'); t = pa.input_value('#z_pt')
    check('gotowy tekst', t.startswith('EDIT:') and 'SZUKAMY NIMUS' in t and 'zielona obroża' in t and '12.11.2026' in t and '601 990 017' in t, t)
    check('bez plakatu', pa.locator('#z_pl').count() == 0); close_sheet(pa)
    check('zaginięcie nie zmienia miejsca psa', g(pa, 'psy', 'm1')['miejsce'] == 'schronisko')
    go(pa, '#/start', 700); check('Start: wiersz „Zaginął: Nimus”', pa.locator('.dzw', has_text='Zaginął: Nimus').count() == 1)
    pa.click('.dzw:has-text("Zaginął: Nimus")'); pa.wait_for_timeout(700); check('wiersz prowadzi do karty', pa.evaluate('location.hash') == '#/zaginiecia/' + zid)
    pa.click('[data-act=zag-znal]'); pa.wait_for_timeout(600)
    check('znaleziony', g(pa, 'zaginiecia', zid)['status'] == 'znaleziony' and 'Znaleziony' in text(pa))
    go(pa, '#/zaginiecia', 700); check('lista: w „Odnalezione”', 'Odnalezione' in text(pa) and 'Nimus' in text(pa))
    # ===== domy tymczasowe i hoteliki =====
    go(pa, '#/dt', 700); pa.click('[data-act=dt-add]'); pa.wait_for_selector('#t_i'); pa.fill('#t_i', 'Ania'); pa.click('#t_r [data-k=hotelik]'); pa.click('#tf button[type=submit]'); pa.wait_for_timeout(800)
    did = pa.evaluate("location.hash.split('/')[2]")
    check('DT: od razu karta, rodzaj hotelik', g(pa, 'p_dt', did)['rodzaj'] == 'hotelik' and pa.locator('[data-act=dt-rodzaj].on[data-k=hotelik]').count() == 1)
    pole(pa, 'dt-edit', 'telefon', '600 100 200'); pole(pa, 'dt-edit', 'adres', 'Ryki'); pole(pa, 'dt-edit', 'notatka', 'Bierze małe psy, bez kotów')
    pd = g(pa, 'p_dt', did); check('DT: dowolne pola', pd['telefon'] == '600 100 200' and pd['adres'] == 'Ryki' and 'małe psy' in pd['notatka'], pd)
    check('DT: Zadzwoń', pa.locator('a[href="tel:600100200"]').count() == 1)
    pa.click('[data-act=dt-rodzaj][data-k=dt]'); pa.wait_for_timeout(500); check('DT: zmiana rodzaju', g(pa, 'p_dt', did)['rodzaj'] == 'dt')
    pa.click('[data-act=dt-pies]'); pa.wait_for_selector('[data-pick=m2]'); pa.click('[data-pick=m2]'); pa.wait_for_timeout(700)
    check('DT: pies dodany', g(pa, 'p_dt', did)['psy'] == ['m2'] and 'Luna' in text(pa))
    go(pa, '#/psy/m2', 900); check('karta psa: u kogo jest', pa.locator(f'a.kd[href="#/dt/{did}"]', has_text='Ania').count() == 1)
    go(pa, '#/dt', 700); check('DT lista: „Teraz: Luna”', 'Teraz: Luna' in text(pa))
    save(pa, 'p_dt', {'id': 'pp2', 'imie': 'Basia', 'psy': []}); go(pa, '#/dt/pp2', 700)
    pa.click('[data-act=dt-pies]'); pa.wait_for_selector('[data-pick=m2]'); pa.click('[data-pick=m2]'); pa.wait_for_timeout(800)
    check('DT: pies tylko w jednym miejscu', g(pa, 'p_dt', 'pp2')['psy'] == ['m2'] and g(pa, 'p_dt', did)['psy'] == [])
    pa.click('[data-act=dt-pies-x]'); pa.wait_for_timeout(600); check('DT: pies usunięty z osoby', g(pa, 'p_dt', 'pp2')['psy'] == [])
    pa.click('[data-act=dt-usun]'); pa.wait_for_selector('[data-yes]'); pa.click('[data-yes]'); pa.wait_for_timeout(700)
    check('DT: wpis usunięty', g(pa, 'p_dt', 'pp2') is None and pa.evaluate('location.hash') == '#/dt')
    # ===== finanse =====
    go(pa, '#/finanse', 700); pa.click('[data-act=fin-add]'); pa.wait_for_selector('#ff')
    pa.click('#f_t [data-k=wplata]'); pa.fill('#f_k', '1 250,50'); pa.fill('#f_o', 'Licytacja'); pa.click('#ff button[type=submit]'); pa.wait_for_timeout(700)
    pa.click('[data-act=fin-add]'); pa.wait_for_selector('#ff'); pa.fill('#f_k', '300'); pa.fill('#f_o', 'Karma'); pa.select_option('#f_p', 'm1'); pa.fill('#f_d', '2026'); pa.click('#ff button[type=submit]'); pa.wait_for_timeout(700)
    pa.click('[data-act=fin-add]'); pa.wait_for_selector('#ff'); pa.fill('#f_k', ''); pa.click('#ff button[type=submit]'); pa.wait_for_timeout(300)
    check('finanse: bez kwoty nie zapisze', 'kwotę' in pa.inner_text('#f_x')); close_sheet(pa)
    save(pa, 'zdrowie', {'pies_id': 'm1', 'typ': 'kastracja', 'data': pa.evaluate('Date.now()'), 'koszt': 450})
    go(pa, '#/start', 300); go(pa, '#/finanse', 800); pa.wait_for_selector('.kwpis'); t = text(pa).replace(' ', ' ').replace(' ', ' ')
    check('finanse: wpłaty, wydatki z leczeniem, saldo', ('1 250,50 zł' in t or '1250,50 zł' in t) and '750,00 zł' in t and '500,50 zł' in t and 'leczenie z kart psów 450,00 zł' in t, t[t.find('Wpłaty'):][:300])
    check('finanse: wpis z psem i samym rokiem', pa.locator('.kwpis', has_text='Karma').locator('text=Nimus').count() == 1 and '2026' in pa.inner_text('.kwpis:has-text("Karma")'))
    check('finanse: jeden przycisk dodawania (w nagłówku)', pa.locator('[data-act=fin-add]').count() == 1)
    pa.click('.kwpis:has-text("Licytacja")'); pa.wait_for_selector('#f_del'); check('finanse: edycja wczytuje dane', pa.input_value('#f_o') == 'Licytacja' and pa.locator('#f_t .on[data-k=wplata]').count() == 1)
    pa.click('#f_del'); pa.wait_for_selector('[data-yes]'); pa.click('[data-yes]'); pa.wait_for_timeout(600)
    check('finanse: wpis usunięty', 'Licytacja' not in text(pa))
    with pa.expect_download() as dl: pa.click('[data-act=fin-csv]')
    csv = open(dl.value.path(), encoding='utf-8-sig').read()
    check('finanse: CSV z leczeniem', 'Karma' in csv and 'Leczenie: Kastracja' in csv and 'Nimus' in csv, csv[:300])
    # wolontariusz
    cv, pv = newpage(b); login(pv, 'Basia', WOL); sync(pa); sync(pv, 1500)
    check('wolontariusz: bez finansów i domów tymczasowych', pv.evaluate("async()=>{const s=await import('/js/store.js');return (await s.list('p_finanse')).length===0&&(await s.list('p_dt')).length===0&&(await s.list('zaginiecia')).length===1}"))
    for h in ['#/dt', '#/finanse']:
        go(pv, h, 600); check(f'wolontariusz: {h} → Start', pv.evaluate('location.hash') == '#/start')
    koniec('bazy1')
