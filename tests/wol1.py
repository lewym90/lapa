# 1.16: wolontariusz (podgląd + zgłoszenia „ja to ogarnę”) i administrator (lista zgłoszeń z telefonami).
# Wymaga: tests/restart_api.sh (czysta baza) i serwer statyczny na 8000.
from playwright.sync_api import sync_playwright
from wspolne import *

TEL = '600 111 222'


def zglos(P, imie=None, tel=None, ilosc=None):
    P.wait_for_selector('#zw')
    if ilosc is not None: P.fill('#zw_q', str(ilosc))
    if imie is not None: P.fill('#zw_i', imie)
    if tel is not None: P.fill('#zw_t', tel)
    P.click('#zw button[type=submit]'); P.wait_for_timeout(600)


with sync_playwright() as p:
    b = p.chromium.launch()
    ca, pa = newpage(b); login(pa, 'Ania')   # administrator
    now = pa.evaluate('Date.now()')
    save(pa, 'psy', {'id': 'd1', 'imie': 'Saba', 'plec': 'suka', 'wiek': '5 lat', 'status': 'do_adopcji', 'miejsce': 'schronisko', 'boks': '7', 'haslo': 'SABA - w cieniu strachu',
                     'opis': 'Spokojna sunia.', 'potrzeby': ['transport'], 'ocena': {'ludzie': 'ok', 'psy': 'nie'}, 'czip': '123456', 'zdjecia': ['https://example.com/a.jpg']})
    save(pa, 'zdrowie', {'id': 'h1', 'pies_id': 'd1', 'typ': 'kastracja', 'data': now, 'koszt': 300, 'notatka': 'tajne leczenie'})
    save(pa, 'obserwacje', {'id': 'o1', 'pies_id': 'd1', 'tekst': 'tajna obserwacja', 'ts': now, 'autor': 'Ania'})
    save(pa, 'potrzeby', {'id': 'n1', 'nazwa': 'Karma mokra', 'kategoria': 'Karma', 'potrzeba': 10, 'zapewniono': 1, 'jednostka': 'puszek', 'autor': 'Ania'})
    save(pa, 'transporty', {'id': 't1', 'pies_id': 'd1', 'pies_imie': 'Saba', 'skad': 'Schronisko', 'dokad': 'Weterynarz', 'kiedy': now + 86400e3, 'status': 'szuka', 'autor': 'Ania'})
    save(pa, 'zadania', {'id': 'x1', 'tytul': 'tajne zadanie', 'ts': now})
    sync(pa)

    # --- wolontariusz: Start, pasek, ustawienia ---
    cv, pv = newpage(b); login(pv, 'Wola', WOL); sync(pv, 1500)
    check('wolontariusz: rola', pv.evaluate("async()=>{const a=await import('/js/auth.js');return !a.state.admin && !a.state.coordinator}"))
    t = text(pv)
    check('Start: pies dnia', pv.locator('.hero .dogtag').count() == 1 and 'Saba' in pv.inner_text('.hero'))
    check('Start: 6 kafelków', pv.locator('.tiles a.tile').count() == 6, pv.locator('.tiles a.tile').count())
    check('Start: bez czatu', pv.locator('#app a[href="#/czat"]').count() == 0)
    check('pasek: Start, Psy, Pomoc, Potrzeby, Transport', [x.get_attribute('href') for x in pv.locator('nav.nav a.tab').all()] == ['#/start', '#/psy', '#/pomoc', '#/potrzeby', '#/transport'])
    check('pasek: bez „+”', pv.locator('nav.nav .plus').count() == 0)
    loc = pv.evaluate("async()=>{const s=await import('/js/store.js');return {z:(await s.list('zdrowie')).length,o:(await s.list('obserwacje')).length,t:(await s.list('zadania')).length,c:(await s.get('psy','d1')).czip||''}}")
    check('telefon wolontariusza nie ma danych tylko dla administratora', loc == {'z': 0, 'o': 0, 't': 0, 'c': ''}, loc)
    go(pv, '#/ustawienia', 700)
    check('ustawienia: bez kopii zapasowej i powiadomień', 'Kopia zapasowa' not in text(pv) and 'Strona schroniska' not in text(pv))
    pv.fill('#stli', '123'); pv.click('#stl button[type=submit]'); pv.wait_for_timeout(300)
    check('ustawienia: zły numer odrzucony', pv.evaluate("localStorage.getItem('lapa.tel')") in (None, ''))
    pv.fill('#stli', TEL); pv.click('#stl button[type=submit]'); pv.wait_for_timeout(300)
    check('ustawienia: telefon zapisany na telefonie', pv.evaluate("localStorage.getItem('lapa.tel')") == TEL)
    go(pv, '#/brama', 700)
    check('Brama niedostępna → Start', pv.evaluate('location.hash') == '#/start')
    r = pv.evaluate("async()=>{try{await (await import('/js/store.js')).save('psy',{id:'d1',imie:'X'});return 'zapisane'}catch(e){return e.name}}")
    check('aplikacja nie zapisze psa od wolontariusza', r == 'TylkoAdmin', r)

    # --- karta psa: podgląd ---
    go(pv, '#/psy/d1', 900); t = text(pv)
    check('karta: opis, boks, charakter', 'Spokojna sunia.' in t and 'Boks 7' in t and pv.locator('.ocr').count() == 2)
    check('karta: bez zdrowia, obserwacji, czipa', 'tajne leczenie' not in t and 'tajna obserwacja' not in t and '123456' not in t and 'Zdrowie' not in t)
    check('karta: historia spacerów jest', pv.locator('[data-act=dog-walks]').count() == 1)
    check('karta: bez edycji', pv.locator('#app [data-act=dog-edit], #app [data-act=dog-oznacz], #app button.boks.add').count() == 0)

    # --- zgłoszenia ---
    pv.locator('#app [data-act=decl]').first.click()
    pv.wait_for_selector('#zw'); check('okno: imię i telefon podpowiedziane', pv.input_value('#zw_i') == 'Wola' and pv.input_value('#zw_t') == TEL)
    zglos(pv)
    check('pomoc: chip z imieniem, zaznaczony', 'Wola' in pv.locator('#app [data-act=decl]').first.inner_text() and 'on' in pv.locator('#app [data-act=decl]').first.get_attribute('class'))
    go(pv, '#/potrzeby', 700); pv.click('[data-act=of-potrzeba]')
    zglos(pv, ilosc='')
    check('potrzeby: bez ilości nie wyśle', 'ile możesz' in pv.inner_text('#zw_e'))
    pv.fill('#zw_q', '3'); pv.fill('#zw_t', '12'); pv.click('#zw button[type=submit]'); pv.wait_for_timeout(300)
    check('potrzeby: bez pełnego telefonu nie wyśle', 'numer telefonu' in pv.inner_text('#zw_e'))
    pv.fill('#zw_t', TEL); pv.click('#zw button[type=submit]'); pv.wait_for_timeout(600)
    t = text(pv); check('potrzeby: „Zgłosili się: Wola (3)”', 'Zgłosili się: Wola (3)' in t and pv.locator('[data-act=of-cofnij]').count() == 1, t[:300])
    go(pv, '#/transport', 700); pv.click('[data-act=tr-open]'); pv.wait_for_selector('[data-act=of-transport]'); pv.click('[data-act=of-transport]'); zglos(pv)
    go(pv, '#/transport', 700); check('transport: „Mogą pojechać: Wola”', 'Mogą pojechać: Wola' in text(pv))
    go(pv, '#/sobotnie', 700); pv.locator('[data-act=sob-bede]').first.click(); zglos(pv)
    check('sobotnie: „Będą (1): Wola”', 'Będą (1): Wola' in text(pv))
    sync(pv, 1500)
    check('wszystko wysłane', pv.evaluate("async()=>(await import('/js/db.js')).outboxCount()") == 0)

    # --- drugi wolontariusz: tylko imiona, bez telefonów, nie wycofa cudzego ---
    cw, pw = newpage(b); login(pw, 'Zosia', WOL); sync(pw, 1500)
    for h in ['#/pomoc', '#/potrzeby', '#/transport', '#/sobotnie', '#/psy/d1']:
        go(pw, h, 700)
        check(f'Zosia {h}: widzi imię, bez telefonu', 'Wola' in text(pw) and pw.locator('a[href^="tel:"]').count() == 0 and '600' not in text(pw))
    check('Zosia: nie ma przycisku wycofania cudzego', pw.locator('[data-act=of-cofnij]').count() == 0)
    oid = pv.evaluate("async()=>(await (await import('/js/store.js')).list('oferty')).find(o=>o.typ==='potrzeba').id")
    st = pw.evaluate("""async(id)=>{const a=await import('/js/api.js');return (await a.api('/sync',{method:'POST',body:{changes:[{col:'oferty',id,data:{},updated_at:Date.now()+9,deleted:true,by:'Zosia'}]}})).results[0].status}""", oid)
    check('serwer: Zosia nie usunie zgłoszenia Woli', st == 'forbidden', st)
    st = pw.evaluate("""async()=>{const a=await import('/js/api.js');try{await a.api('/sync?since=0&private=1');return 'ok'}catch(e){return e.status}}""")
    check('serwer: wolontariusz nie pobierze telefonów', st == 403, st)

    # --- administrator: zgłoszenia z telefonami ---
    sync(pa, 1500); go(pa, '#/start', 900)
    check('Start administratora: nowe zgłoszenia (4)', 'Nowe zgłoszenia wolontariuszy: 4' in text(pa), text(pa)[:400])
    go(pa, '#/zgloszenia', 900); t = text(pa)
    check('lista: 4 telefony', pa.locator('a.kontakt[href="tel:600111222"]').count() == 4, pa.locator('a.kontakt').count())
    check('lista: wszystkie sekcje', all(x in t for x in ['Pomoc dla psów', 'Potrzeby rzeczowe', 'Transport', 'Sobotnie spacery', 'Karma mokra: 3 puszek']), t[:600])
    pa.click('[data-act=of-przyjmij]'); pa.wait_for_timeout(700)
    n1 = pa.evaluate("async()=>(await (await import('/js/store.js')).get('potrzeby','n1')).zapewniono")
    check('Przyjmij: doliczono 3 (1+3=4)', n1 == 4, n1)
    pa.click('[data-act=of-kierowca]'); pa.wait_for_timeout(700)
    t1 = pa.evaluate("async()=>(await (await import('/js/store.js')).get('transporty','t1'))")
    check('Przypisz: kierowca Wola', t1['kierowca'] == 'Wola' and t1['status'] == 'przypisany', t1)
    go(pa, '#/start', 700); check('po obejrzeniu: karta nowych zgłoszeń znika', 'Nowe zgłoszenia wolontariuszy' not in text(pa))
    go(pa, '#/pomoc', 700); check('Pomoc administratora: telefon przy zgłoszeniu', pa.locator('a.kontakt[href="tel:600111222"]').count() >= 2)
    go(pa, '#/transport', 700); pa.click('[data-act=tr-open]'); pa.wait_for_selector('#sheet-root .sheet')
    check('transport (administrator): telefon kierowcy', pa.locator('#sheet-root a.kontakt[href="tel:600111222"]').count() == 1); close_sheet(pa)

    # --- wolontariusz wycofuje się z soboty ---
    sync(pv, 1500); go(pv, '#/sobotnie', 700); pv.locator('[data-act=of-cofnij]').first.click(); pv.wait_for_selector('[data-yes]'); pv.click('[data-yes]'); pv.wait_for_timeout(500)
    check('sobotnie: wycofane', 'Nikt jeszcze nie potwierdził' in text(pv)); sync(pv, 1500)
    sync(pa, 1500); go(pa, '#/zgloszenia', 900)
    check('administrator: sobota bez zgłoszeń', pa.locator('a.kontakt[href="tel:600111222"]').count() == 3)
    go(pv, '#/potrzeby', 700); check('przyjęte zgłoszenie: znów „Mogę przywieźć”, brakuje 6', 'brakuje 6' in text(pv) and pv.locator('[data-act=of-potrzeba]').count() == 1)

    # --- usuwanie przez administratora ---
    go(pa, '#/zgloszenia', 900); pa.locator('[data-act=zg-usun]').first.click(); pa.wait_for_selector('[data-yes]'); pa.click('[data-yes]'); pa.wait_for_timeout(600)
    check('administrator usunął zgłoszenie', pa.locator('a.kontakt[href="tel:600111222"]').count() == 2)
    koniec('wol1')
