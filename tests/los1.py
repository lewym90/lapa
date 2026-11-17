# 1.17: status psa (dostępny / w procesie adopcji / adoptowany / archiwum), zakładka Adopcje, filtr Adoptowane, Archiwum w Ustawieniach,
# pies w procesie adopcji: wolontariusz go nie widzi, administrator widzi go w Bramie (oznaczony) i może go wydać.
from playwright.sync_api import sync_playwright
from wspolne import *


def st(P, i):
    return P.evaluate("async(i)=>(await (await import('/js/store.js')).get('psy',i))", i)


with sync_playwright() as p:
    b = p.chromium.launch()
    ca, pa = newpage(b); login(pa, 'Ania'); errs = []; pa.on('pageerror', lambda e: errs.append(str(e)))
    now = pa.evaluate('Date.now()')
    base = {'miejsce': 'schronisko', 'zdjecia': ['https://example.com/a.jpg'], 'potrzeby': ['transport']}
    save(pa, 'psy', {**base, 'id': 'd1', 'imie': 'Azor', 'status': 'do_adopcji', 'auto_dodany': now})
    save(pa, 'psy', {**base, 'id': 'd2', 'imie': 'Bella', 'status': 'adoptowany', 'miejsce': 'adoptowany', 'zniknal_ze_strony': now})
    save(pa, 'psy', {**base, 'id': 'd3', 'imie': 'Cezar', 'status': 'w_trakcie', 'w_trakcie_od': now})
    save(pa, 'psy', {**base, 'id': 'd4', 'imie': 'Dina', 'status': 'do_adopcji', 'archiwum': now, 'archiwum_los': 'zmarl'})
    save(pa, 'psy', {**base, 'id': 'd5', 'imie': 'Ela', 'status': 'adoptowany', 'miejsce': 'adoptowany', 'adopcja_potw': now})
    sync(pa)
    # lista Psy: tylko dostępne
    go(pa, '#/psy', 800); t = text(pa)
    check('Psy: tylko dostępne (bez adopcji, adoptowanych, archiwum)', 'Azor' in t and not any(x in t for x in ['Bella', 'Cezar', 'Dina', 'Ela']), t[:300])
    check('Psy: bez filtrów „W procesie adopcji”, „Wszystkie”, „Archiwum”', pa.locator('[data-k=w_trakcie], [data-k=wszystkie], [data-k=archiwum]').count() == 0)
    pa.click('[data-act=dog-filter][data-k=adoptowany]'); pa.wait_for_timeout(500); t = text(pa)
    check('Adoptowane: Bella i Ela', 'Bella' in t and 'Ela' in t and 'Cezar' not in t and 'Dina' not in t)
    check('Adoptowane: „Co się stało?” tylko przy niepotwierdzonym', pa.locator('.dcard', has_text='Bella').locator('.kuzup').count() == 1 and pa.locator('.dcard', has_text='Ela').locator('.kuzup').count() == 0)
    go(pa, '#/zrobic', 800); check('Dziś i do zrobienia: bez „Adoptowany?” i „Dodany automatycznie”', 'Adoptowany?' not in text(pa) and 'Dodany automatycznie' not in text(pa))
    # Brama: pies w procesie adopcji jest, oznaczony, da się wydać
    go(pa, '#/brama', 800); pa.click('[data-act=br-tab][data-t=wydaj]'); pa.wait_for_timeout(300)
    row = pa.locator('.row', has_text='Cezar').first
    check('Brama: pies w procesie adopcji jest i ma oznaczenie', row.count() == 1 and 'W procesie adopcji' in row.inner_text())
    check('Brama: można go wydać', row.locator('[data-act=br-out]').count() == 1)
    check('Brama: bez adoptowanych i archiwum', 'Bella' not in text(pa) and 'Dina' not in text(pa))
    # karta psa: Zmień status → W procesie adopcji
    go(pa, '#/psy/d1', 900); pa.click('[data-act=dog-los]'); pa.wait_for_selector('[data-los]')
    check('okno statusu: 6 możliwości', pa.locator('[data-los]').count() == 6)
    pa.click('[data-los=w_trakcie]'); pa.wait_for_timeout(700)
    d = st(pa, 'd1'); check('Azor: w procesie adopcji', d['status'] == 'w_trakcie' and d.get('w_trakcie_od'))
    check('karta: informacja o adopcji', 'W procesie adopcji' in text(pa))
    go(pa, '#/psy', 800); pa.click('[data-act=dog-filter][data-k=aktywne]'); pa.wait_for_timeout(400)
    check('Azor zniknął z listy Psy', 'Azor' not in text(pa))
    # Adopcje
    go(pa, '#/adopcje', 900); t = text(pa)
    check('Adopcje: Azor i Cezar', 'Azor' in t and 'Cezar' in t and 'Bella' not in t)
    pa.click('[data-act=ad-osoba][data-id=d1]'); pa.wait_for_selector('#a_i'); pa.fill('#a_i', 'Jan Kowalski'); pa.fill('#a_t', '600 700 800'); pa.click('#af button[type=submit]'); pa.wait_for_timeout(700)
    check('Adopcje: dane osoby z telefonem', 'Jan Kowalski' in text(pa) and pa.locator('a.kontakt[href="tel:600700800"]').count() == 1)
    pa.click('[data-act=ad-adoptowany][data-id=d1]'); pa.wait_for_selector('[data-yes]'); pa.click('[data-yes]'); pa.wait_for_timeout(700)
    d = st(pa, 'd1'); check('Adoptowany: status i potwierdzenie', d['status'] == 'adoptowany' and d.get('adopcja_potw'))
    pa.click('[data-act=ad-wraca][data-id=d3]'); pa.wait_for_selector('[data-yes]'); pa.click('[data-yes]'); pa.wait_for_timeout(700)
    d = st(pa, 'd3'); check('Wraca do schroniska: dostępny', d['status'] == 'do_adopcji' and d['miejsce'] == 'schronisko')
    check('Adopcje: pusto', 'Nie ma psów w procesie adopcji' in text(pa))
    # zniknął ze strony → co się stało → Za Tęczowym Mostem → archiwum
    go(pa, '#/psy/d2', 900); check('karta: „Zniknęła ze strony… Co się naprawdę stało?”', 'Co się naprawdę stało' in text(pa))
    pa.click('[data-act=dog-los]'); pa.wait_for_selector('[data-los]'); pa.click('[data-los=zmarl]'); pa.wait_for_timeout(700)
    d = st(pa, 'd2'); check('Bella: archiwum (Za Tęczowym Mostem)', d.get('archiwum') and d.get('archiwum_los') == 'zmarl')
    go(pa, '#/ustawienia', 800); check('Ustawienia: link do Archiwum', pa.locator('a[href="#/archiwum"]').count() == 1)
    pa.click('a[href="#/archiwum"]'); pa.wait_for_timeout(800); t = text(pa)
    check('Archiwum: Bella i Dina', 'Bella' in t and 'Dina' in t and 'Za Tęczowym Mostem' in t)
    # edycja z archiwum: Dina → adoptowany → Adoptowane
    go(pa, '#/psy/d4', 900); pa.click('[data-act=dog-los]'); pa.wait_for_selector('[data-los]'); pa.click('[data-los=adoptowany]'); pa.wait_for_timeout(700)
    d = st(pa, 'd4'); check('Dina z archiwum → adoptowana', not d.get('archiwum') and d['status'] == 'adoptowany')
    go(pa, '#/adoptowane', 800); check('#/adoptowane: Dina jest', 'Dina' in text(pa) and pa.locator('[data-k=adoptowany].on').count() == 1)
    # dostępny pies → archiwum → znów dostępny
    go(pa, '#/psy/d3', 900); pa.click('[data-act=dog-los]'); pa.wait_for_selector('[data-los]'); pa.click('[data-los=wlasciciel]'); pa.wait_for_timeout(600)
    pa.click('[data-act=dog-los]'); pa.wait_for_selector('[data-los]'); pa.click('[data-los=dostepny]'); pa.wait_for_timeout(600)
    d = st(pa, 'd3'); check('archiwum → dostępny', not d.get('archiwum') and d['status'] == 'do_adopcji')
    # wolontariusz
    pa.evaluate("async()=>{const s=await import('/js/store.js');const d=await s.get('psy','d5');await s.save('psy',{...d,status:'w_trakcie',miejsce:'schronisko'})}")
    sync(pa, 1500)
    cv, pv = newpage(b); login(pv, 'Wola', WOL); sync(pv, 1500)
    go(pv, '#/psy', 800); t = text(pv)
    check('wolontariusz Psy: bez psa w procesie adopcji', 'Ela' not in t and 'Cezar' in t)
    pv.click('[data-act=dog-filter][data-k=adoptowany]'); pv.wait_for_timeout(400); t = text(pv)
    check('wolontariusz widzi Adoptowane, bez „Co się stało?”', 'Azor' in t and 'Dina' in t and pv.locator('.kuzup').count() == 0)
    go(pv, '#/psy/d5', 800); check('wolontariusz: karta psa w procesie adopcji = brak', 'Nie ma takiego psa' in text(pv))
    for h in ['#/start', '#/pomoc']:
        go(pv, h, 800); check(f'wolontariusz {h}: bez psa w procesie adopcji', 'Ela' not in text(pv))
    for h in ['#/adopcje', '#/archiwum']:
        go(pv, h, 700); check(f'wolontariusz {h} → Start', pv.evaluate('location.hash') == '#/start')
    check('bez błędów strony', not errs, errs)
    koniec('los1')
