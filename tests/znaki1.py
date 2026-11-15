# 1.14: boks, oznaczenie „tylko dla wybranych”, krótki opis z listy (tylko administrator), Brama z imieniem i kontaktem,
# logowanie hasłem administratora (od razu i przez „Odblokuj”), administrator nie blokuje się po godzinie.
from playwright.sync_api import sync_playwright
from wspolne import *

ADM = 'administrator-haslo-3'
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, pg = newpage(b); login(pg, 'Ania')   # zwykły wolontariusz
    now = pg.evaluate('Date.now()')
    save(pg, 'psy', {'id': 'd1', 'imie': 'Saba', 'plec': 'suka', 'wiek': '5 lat', 'status': 'do_adopcji', 'miejsce': 'schronisko', 'haslo': 'SABA - w cieniu strachu', 'kanaly': {'www': now}, 'opis': 'Opis.', 'potrzeby': ['transport'], 'zdjecia': ['https://example.invalid/s_l.jpg']})
    save(pg, 'psy', {'id': 'd2', 'imie': 'Luna', 'plec': 'suka', 'status': 'dt', 'miejsce': 'dt', 'boks': '5', 'haslo': 'LUNA - w domu tymczasowym', 'kanaly': {'www': now}, 'zdjecia': []})
    sync(pg)

    # --- wolontariusz: boks wpisuje każdy, oznaczania nie widzi ---
    go(pg, '#/psy/d1', 900); t = text(pg)
    check('wolontariusz: brak przycisku oznaczania', 'Oznaczenie i opis psa' not in t)
    check('przycisk + Boks', pg.locator('button.boks.add').count() == 1)
    pg.click('button.boks.add'); pg.wait_for_selector('#mb'); pg.fill('#mb', ' 7a! '); pg.click('#mf button[type=submit]'); pg.wait_for_timeout(600)
    d = pg.evaluate("async()=>{const s=await import('/js/store.js');return s.get('psy','d1')}")
    check('boks z literą zapisany (bez spacji i znaków spoza liter i cyfr)', d.get('boks') == '7a', d.get('boks'))
    check('boks z literą na karcie', 'Boks 7a' in text(pg))
    for wpis, ma in [('A3', 'A3'), ('12 b', '12 b'), ('rząd 7/c', 'rząd 7/c'), ('7<b>', '7b'), ('123456789', '12345678')]:
        r = pg.evaluate("async(v)=>(await import('/js/znak.js')).czyscBoks(v)", wpis)
        check(f'boks „{wpis}”', r == ma, r)
    r = pg.evaluate("async()=>{const s=await import('/js/store.js');await s.save('oznaczenia',{id:'d1',opis:'specjalny'});const y=await import('/js/sync.js');await y.run();return (await import('/js/db.js')).outboxCount()}")
    pg.wait_for_timeout(500)
    srvz = pg.evaluate("async()=>{const a=await import('/js/api.js');return (await a.api('/sync?since=0&private=0')).changes.filter(c=>c.col==='oznaczenia').length}")
    check('serwer odrzuca oznaczenie od wolontariusza', srvz == 0 and r == 0, (srvz, r))
    pg.evaluate("async()=>{const s=await import('/js/store.js');await s.remove('oznaczenia','d1')}")  # sprzątanie lokalnej próby
    sync(pg)

    # --- administrator: logowanie hasłem administratora na ekranie powitalnym ---
    ctx2, pa = newpage(b); login(pa, 'Admin', ADM)
    check('administrator po zalogowaniu', pa.evaluate("async()=>{const a=await import('/js/auth.js');return a.state.admin && a.state.coordinator}"))
    go(pa, '#/ustawienia'); check('ustawienia: tryb administratora', 'Wyłącz tryb administratora' in text(pa))
    go(pa, '#/start'); pa.click('[data-act=menu]'); pa.wait_for_selector('.drawer')
    check('menu: Administrator', 'Administrator · wszystkie uprawnienia' in pa.inner_text('.drawer'))
    close_sheet(pa); pa.evaluate("document.querySelector('.drawer')?.remove()")
    sync(pa)
    go(pa, '#/psy/d1', 900)
    pa.click('[data-act=dog-oznacz]'); pa.wait_for_selector('#of2')
    check('opis z listy: 4 możliwości + bez opisu', pa.locator('[data-op]').count() == 5 and pa.locator('#oz_o input').count() == 0)
    pa.click('[data-op="dla aktywnych"]')
    pa.check('#oz_on'); pa.click('#of2 button[type=submit]'); pa.wait_for_timeout(300)
    check('bez powodu nie zapisze', 'Zaznacz powód' in pa.inner_text('#oz_e'))
    pa.click('[data-pw=wycofany]'); pa.click('[data-pw=silny]'); pa.fill('#oz_k', 'Justyna, Marek'); pa.click('#of2 button[type=submit]'); pa.wait_for_timeout(700)
    t = text(pa)
    check('karta: opis pod imieniem', 'dla aktywnych' in t)
    check('karta: ramka tylko dla wybranych', 'Tylko dla wybranych wolontariuszy' in t and 'Powód: wycofany, silny' in t and 'Mogą wychodzić: Justyna, Marek' in t)
    check('karta: czerwona ramka na zdjęciach', pa.locator('.dogtop.wyb').count() == 1)
    check('karta: bez podpisu kto oznaczył', 'Admin' not in pa.inner_text('.dogsheet'))
    sync(pa)

    # --- wolontariusz widzi to wszędzie ---
    sync(pg, 1200)
    go(pg, '#/psy', 900); pg.click('[data-act=dog-filter][data-k=aktywne]'); pg.wait_for_timeout(400)
    k = pg.locator('.dcard', has_text='Saba')
    check('lista: obwódka', 'wyb' in k.get_attribute('class'))
    check('lista: boks na zdjęciu', k.locator('.bx .boks').inner_text() == 'Boks 7a')
    check('lista: pasek z powodem', k.locator('.wybl').inner_text() == 'Tylko wybrani: wycofany, silny')
    check('lista: opis zamiast hasła', k.locator('.opisl').inner_text() == 'dla aktywnych' and 'w cieniu strachu' not in k.inner_text())
    l = pg.locator('.dcard', has_text='Luna')
    check('DT: bez boksu, hasło ze strony zostaje', l.locator('.boks').count() == 0 and 'w domu tymczasowym' in l.inner_text())
    go(pg, '#/psy/d1', 900); t = text(pg)
    check('wolontariusz: karta z opisem i ramką', 'dla aktywnych' in t and 'Tylko dla wybranych wolontariuszy' in t and 'Oznaczenie i opis psa' not in t)
    check('karta psa: „Ostatnia zmiana” nie zdradza administratora', 'Admin' not in t)
    for h, nazwa in [('#/brama', 'Brama'), ('#/spacer', 'wybór psa do spaceru'), ('#/pomoc', 'Pomoc'), ('#/start', 'Start: Potrzebują Cię dziś')]:
        go(pg, h, 900); row = pg.locator('.row, .card, .need', has_text='Saba').last
        tt = row.inner_text()
        check(nazwa + ': boks, opis, powód', 'Boks 7a' in tt and 'dla aktywnych' in tt and 'Tylko wybrani: wycofany, silny' in tt, tt)
        check(nazwa + ': obwódka zdjęcia', row.locator('.wyb').count() >= 1)

    # --- Brama: okno wydania, imię i kontakt, bez godziny na przycisku ---
    go(pg, '#/brama', 900); pg.click('[data-act=br-out][data-id=d1]'); pg.wait_for_selector('#wo')
    sh = text(pg, '.sheet')
    check('okno: powód i kto może', 'Tylko wybrani: wycofany, silny' in sh and 'Mogą wychodzić: Justyna, Marek' in sh)
    check('okno: przycisk „Wydaj” bez godziny', pg.inner_text('#wo button[type=submit]').strip() == 'Wydaj')
    check('pies nie wydany przed drugim dotknięciem', pg.evaluate("async()=>{const s=await import('/js/store.js');return (await s.list('spacery')).length}") == 0)
    pg.fill('#wo_o', 'Kasia'); pg.fill('#wo_k', '600 100 200'); pg.click('#wo button[type=submit]'); pg.wait_for_timeout(600)
    w = pg.evaluate("async()=>{const s=await import('/js/store.js');return (await s.list('spacery'))[0]}")
    check('spacer zapisany przy drugim dotknięciu', w and w['osoba'] == 'Kasia' and w['kontakt'] == '600 100 200' and abs(w['start'] - pg.evaluate('Date.now()')) < 5000, w)
    pg.click('[data-act=br-tab][data-t=out]'); pg.wait_for_timeout(500)
    check('Poza: telefon do kliknięcia', pg.locator('a.kontakt[href="tel:600100200"]').count() == 1)
    pg.click('[data-act=br-back]'); pg.wait_for_timeout(500)
    go(pg, '#/brama', 700); pg.click('[data-act=br-tab][data-t=wydaj]'); pg.wait_for_timeout(300); pg.click('[data-act=br-out][data-id=d1]'); pg.wait_for_selector('#wo')
    check('podpowiedź dzisiejszych osób', pg.locator('[data-lu]').count() == 1)
    pg.click('[data-lu]'); check('jedno dotknięcie wpisuje imię i kontakt', pg.input_value('#wo_o') == 'Kasia' and pg.input_value('#wo_k') == '600 100 200')
    pg.fill('#wo_k', 'm.me/kasia.nowak'); pg.click('#wo button[type=submit]'); pg.wait_for_timeout(500)
    pg.click('[data-act=br-tab][data-t=out]'); pg.wait_for_timeout(400)
    check('Poza: link do Messengera', pg.locator('a.kontakt[href="https://m.me/kasia.nowak"]').count() == 1)

    # --- teksty na zewnątrz bez boksu i oznaczeń ---
    go(pg, '#/psy/d1', 700); pg.click('[data-act=dog-teksty]'); pg.wait_for_selector('#t_t')
    tx = pg.input_value('#t_t'); check('teksty postów bez boksu i opisu', 'Boks' not in tx and 'dla aktywnych' not in tx and 'wybrani' not in tx)
    go(pg, '#/social/adopcja/d1', 900)
    alltx = ' '.join(pg.locator('textarea[data-o]').evaluate_all('(e)=>e.map(x=>x.value)'))
    check('Social media bez boksu i opisu', 'Boks' not in alltx and 'dla aktywnych' not in alltx and 'wybrani' not in alltx)
    dsave = pg.evaluate("async()=>{const d=await import('/js/db.js');return (await d.getRec('psy','d1')).data}")
    check('oznaczenie nie trafia do danych psa', 'ozn' not in dsave, list(dsave.keys()))

    # --- administrator zostaje zalogowany (bez blokady po godzinie) ---
    pa.evaluate("localStorage.setItem('lapa.coordLast', String(Date.now()-5*3600e3))"); pa.reload(); pa.wait_for_timeout(1500)
    check('administrator po „godzinie” dalej administratorem', pa.evaluate("async()=>{const a=await import('/js/auth.js');return a.state.admin && a.state.coordinator}"))
    # zdjęcie oznaczenia
    go(pa, '#/psy/d1', 900); pa.click('[data-act=dog-oznacz]'); pa.wait_for_selector('#of2'); pa.click('[data-op=""]'); pa.uncheck('#oz_on'); pa.click('#of2 button[type=submit]'); pa.wait_for_timeout(500); sync(pa)
    sync(pg, 1200); go(pg, '#/psy', 900)
    k = pg.locator('.dcard', has_text='Saba')
    check('po zdjęciu: bez obwódki i z hasłem ze strony', 'wyb' not in k.get_attribute('class') and 'w cieniu strachu' in k.inner_text(), k.inner_text())

    # --- odblokowanie hasłem administratora w zwykłej sesji i wyłączenie ---
    go(pg, '#/ustawienia'); pg.click('[data-act=unlock-sheet]'); pg.wait_for_selector('#up'); pg.fill('#up', ADM); pg.click('#uf button[type=submit]'); pg.wait_for_timeout(800)
    check('odblokowanie hasłem administratora', pg.evaluate("async()=>{const a=await import('/js/auth.js');return a.state.admin}"))
    go(pg, '#/ustawienia'); pg.click('[data-act=set-lock]'); pg.wait_for_timeout(500)
    check('wyłączenie trybu administratora', not pg.evaluate("async()=>{const a=await import('/js/auth.js');return a.state.admin || a.state.coordinator}"))

    # --- nowa obserwacja: widać wybrany rodzaj ---
    go(pg, '#/psy/d1', 700); pg.click('[data-act=dog-obs-add]'); pg.wait_for_selector('#ot')
    bg = pg.locator('#ot .chip.on').evaluate('(e)=>getComputedStyle(e).backgroundColor')
    check('obserwacja: zaznaczony rodzaj jest widoczny', bg not in ('rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'), bg)

    koniec('znaki1')
