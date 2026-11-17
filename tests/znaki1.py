# 1.14/1.16: boks (wpisuje administrator, widzi każdy), oznaczenie „tylko dla wybranych” i krótki opis z listy
# (od 1.16 widzi je tylko administrator – wszędzie; wolontariusz nigdzie), Brama z imieniem i kontaktem,
# logowanie hasłem administratora (od razu i przez „Odblokuj”), administrator nie blokuje się po godzinie.
from playwright.sync_api import sync_playwright
from wspolne import *

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, pg = newpage(b); login(pg, 'Ania')   # administrator (pracownik schroniska)
    now = pg.evaluate('Date.now()')
    save(pg, 'psy', {'id': 'd1', 'imie': 'Saba', 'plec': 'suka', 'wiek': '5 lat', 'status': 'do_adopcji', 'miejsce': 'schronisko', 'haslo': 'SABA - w cieniu strachu', 'kanaly': {'www': now}, 'opis': 'Opis.', 'potrzeby': ['transport'], 'zdjecia': ['https://example.com/a.jpg']})
    save(pg, 'psy', {'id': 'd2', 'imie': 'Luna', 'plec': 'suka', 'status': 'dt', 'miejsce': 'dt', 'boks': '5', 'haslo': 'LUNA - w domu tymczasowym', 'kanaly': {'www': now}, 'zdjecia': []})
    sync(pg)

    # --- administrator: boks ---
    go(pg, '#/psy/d1', 900)
    check('pole Boks z ołówkiem (administrator)', pg.locator('[data-act=k-edit][data-f=boks]').count() == 1)
    pg.click('[data-act=k-edit][data-f=boks]'); pg.wait_for_selector('#kev'); pg.fill('#kev', ' 7a! '); pg.click('#kef button[type=submit]'); pg.wait_for_timeout(600)
    d = pg.evaluate("async()=>{const s=await import('/js/store.js');return s.get('psy','d1')}")
    check('boks z literą zapisany (bez spacji i znaków spoza liter i cyfr)', d.get('boks') == '7a', d.get('boks'))
    check('boks z literą na karcie', 'Boks 7a' in text(pg))
    for wpis, ma in [('A3', 'A3'), ('12 b', '12 b'), ('rząd 7/c', 'rząd 7/c'), ('7<b>', '7b'), ('123456789', '12345678')]:
        r = pg.evaluate("async(v)=>(await import('/js/znak.js')).czyscBoks(v)", wpis)
        check(f'boks „{wpis}”', r == ma, r)
    sync(pg)

    # --- wolontariusz: widzi boks, nie wpisze go, nie oznacza ---
    ctx3, pv = newpage(b); login(pv, 'Wola', WOL); sync(pv, 1200)
    go(pv, '#/psy/d1', 900); t = text(pv)
    check('wolontariusz: widzi boks', 'Boks 7a' in t)
    check('wolontariusz: bez przycisku boksu i oznaczania', pv.locator('button.boks.add').count() == 0 and 'Oznaczenie i opis psa' not in t)
    r = pv.evaluate("async()=>{try{const s=await import('/js/store.js');await s.save('oznaczenia',{id:'d1',opis:'specjalny'});return 'zapisane'}catch(e){return e.name}}")
    check('wolontariusz: aplikacja nie zapisze oznaczenia', r == 'TylkoAdmin', r)
    srv = pv.evaluate("""async()=>{const a=await import('/js/api.js');return (await a.api('/sync',{method:'POST',body:{changes:[{col:'oznaczenia',id:'d1',data:{opis:'specjalny'},updated_at:Date.now(),deleted:false,by:'x'}]}})).results[0].status}""")
    check('serwer odrzuca oznaczenie od wolontariusza', srv == 'forbidden', srv)

    # --- administrator: logowanie hasłem administratora na ekranie powitalnym ---
    ctx2, pa = newpage(b); login(pa, 'Admin', ADM)
    check('administrator po zalogowaniu', pa.evaluate("async()=>{const a=await import('/js/auth.js');return a.state.admin && a.state.coordinator}"))
    go(pa, '#/ustawienia'); check('ustawienia: tryb administratora', 'Wyłącz tryb administratora' in text(pa))
    go(pa, '#/start'); pa.click('[data-act=menu]'); pa.wait_for_selector('.drawer')
    check('menu: Administrator', 'Administrator' in pa.inner_text('.drawer'))
    close_sheet(pa); pa.evaluate("document.querySelector('.drawer')?.remove()")
    sync(pa)
    go(pa, '#/psy/d1', 900)
    pa.click('[data-act=dog-oznacz]'); pa.wait_for_selector('#of2')
    check('okno: informacja, że widzą tylko administratorzy', 'Widzą je tylko administratorzy' in pa.inner_text('.sheet'))
    check('opis z listy: 4 możliwości + bez opisu', pa.locator('[data-op]').count() == 5 and pa.locator('#oz_o input').count() == 0)
    pa.click('[data-op="dla aktywnych"]')
    pa.check('#oz_on'); pa.click('#of2 button[type=submit]'); pa.wait_for_timeout(300)
    check('bez powodu nie zapisze', 'Zaznacz powód' in pa.inner_text('#oz_e'))
    pa.click('[data-pw=wycofany]'); pa.click('[data-pw=silny]'); pa.fill('#oz_k', 'Justyna, Marek'); pa.click('#of2 button[type=submit]'); pa.wait_for_timeout(700)
    t = text(pa)
    check('karta (administrator): opis pod imieniem', 'dla aktywnych' in pa.inner_text('.dogsheet .opisl'))
    check('karta (administrator): oznaczenie tylko dla wybranych', 'Tylko dla wybranych: wycofany, silny' in t and 'mogą wychodzić: Justyna, Marek' in t)
    check('karta (administrator): czerwona ramka na zdjęciach', pa.locator('.dogtop.wyb').count() == 1)
    check('karta: bez podpisu kto oznaczył', 'Admin' not in pa.inner_text('.dogsheet'))
    sync(pa)

    # --- administrator widzi wszędzie, wolontariusz nigdzie ---
    sync(pg, 1200); sync(pv, 1200)
    go(pg, '#/psy', 900); pg.click('[data-act=dog-filter][data-k=aktywne]'); pg.wait_for_timeout(400)
    k = pg.locator('.dcard', has_text='Saba')
    check('administrator lista: obwódka', 'wyb' in k.get_attribute('class'))
    check('administrator lista: boks na zdjęciu', k.locator('.bx .boks').inner_text() == 'Boks 7a')
    check('administrator lista: pasek z powodem', k.locator('.wybl').inner_text() == 'Tylko wybrani: wycofany, silny')
    check('administrator lista: opis zamiast hasła', k.locator('.opisl').inner_text() == 'dla aktywnych' and 'w cieniu strachu' not in k.inner_text())
    l = pg.locator('.dcard', has_text='Luna')
    check('DT: bez boksu, hasło ze strony zostaje', l.locator('.boks').count() == 0 and 'w domu tymczasowym' in l.inner_text())
    go(pg, '#/psy/d1', 900); t = text(pg)
    check('administrator karta: opis i oznaczenie', 'dla aktywnych' in t and 'Tylko dla wybranych' in t)
    check('karta psa: „Ostatnia zmiana” nie zdradza, kto oznaczył', 'Admin' not in t)
    for h, nazwa in [('#/pomoc', 'Pomoc')]:
        go(pg, h, 900); row = pg.locator('.row, .card, .need', has_text='Saba').last
        tt = row.inner_text()
        check('administrator ' + nazwa + ': boks, opis, powód', 'Boks 7a' in tt and 'dla aktywnych' in tt and 'Tylko wybrani: wycofany, silny' in tt, tt)
        check('administrator ' + nazwa + ': obwódka zdjęcia', row.locator('.wyb').count() >= 1)
    # wolontariusz
    go(pv, '#/psy', 900); pv.click('[data-act=dog-filter][data-k=aktywne]'); pv.wait_for_timeout(400)
    k = pv.locator('.dcard', has_text='Saba')
    check('wolontariusz lista: bez obwódki i paska', 'wyb' not in k.get_attribute('class') and k.locator('.wybl').count() == 0)
    check('wolontariusz lista: hasło ze strony, bez opisu, z boksem', 'w cieniu strachu' in k.inner_text() and 'dla aktywnych' not in k.inner_text() and k.locator('.bx .boks').inner_text() == 'Boks 7a')
    check('wolontariusz: lokalnie brak oznaczeń', pv.evaluate("async()=>(await (await import('/js/db.js')).getAll('oznaczenia')).length") == 0)
    go(pv, '#/psy/d1', 900); t = text(pv)
    check('wolontariusz: karta bez opisu i ramki', 'dla aktywnych' not in t and 'Tylko dla wybranych' not in t and 'Oznaczenie i opis psa' not in t)
    for h in ['#/pomoc', '#/start', '#/transport']:
        go(pv, h, 900); check(f'wolontariusz {h}: bez oznaczeń', 'dla aktywnych' not in text(pv) and 'Tylko wybrani' not in text(pv) and pv.locator('#app .wyb').count() == 0)
    # pod spodem: nawet gdyby dane trafiły na telefon, funkcje nie pokażą ich wolontariuszowi
    r = pv.evaluate("async()=>{const z=await import('/js/znak.js');const d={imie:'X',boks:'1',miejsce:'schronisko',ozn:{opis:'specjalny',wybrani:{on:true,powody:['silny']}}};return z.linie(d)+z.wybCls(d)+z.opisLine(d)+z.wybPill(d)+z.imieZnaki(d)}")
    check('wolontariusz: znak.js nie pokazuje oznaczeń', 'specjalny' not in r and 'silny' not in r and 'wyb' not in r, r)

    # --- Brama (administrator): opis, powód, czerwona ramka, dotknięcie imienia = oznaczenie ---
    go(pg, '#/brama', 900); row = pg.locator('.row', has_text='Saba').first; tt = row.inner_text()
    check('Brama: boks, opis, powód', 'Boks 7a' in tt and 'dla aktywnych' in tt and 'Tylko wybrani: wycofany, silny' in tt, tt)
    check('Brama: czerwona ramka wiersza', 'wybr' in row.get_attribute('class'))
    pg.click('.bimie[data-id=d1]'); pg.wait_for_selector('#of2')
    check('Brama: dotknięcie imienia otwiera oznaczenie', pg.locator('[data-op="dla aktywnych"].on').count() == 1)
    close_sheet(pg)

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
    sync(pg, 1200); sync(pv, 1200)
    kw = pv.evaluate("async()=>(await (await import('/js/store.js')).list('spacery')).map(w=>[w.osoba||'',w.kontakt||''])")
    check('wolontariusz: spacery z Bramy bez kontaktu', len(kw) == 2 and all(k == '' for _, k in kw), kw)

    dsave = pg.evaluate("async()=>{const d=await import('/js/db.js');return (await d.getRec('psy','d1')).data}")
    check('oznaczenie nie trafia do danych psa', 'ozn' not in dsave, list(dsave.keys()))

    # --- administrator zostaje zalogowany (bez blokady po godzinie) ---
    pa.evaluate("localStorage.setItem('lapa.coordLast', String(Date.now()-5*3600e3))"); pa.reload(); pa.wait_for_timeout(1500)
    check('administrator po „godzinie” dalej administratorem', pa.evaluate("async()=>{const a=await import('/js/auth.js');return a.state.admin && a.state.coordinator}"))
    # zdjęcie oznaczenia
    go(pa, '#/psy/d1', 900); pa.click('[data-act=dog-oznacz]'); pa.wait_for_selector('#of2'); pa.click('[data-op=""]'); pa.uncheck('#oz_on'); pa.click('#of2 button[type=submit]'); pa.wait_for_timeout(500); sync(pa)
    sync(pg, 1200); go(pg, '#/start', 500); go(pg, '#/brama', 900); row = pg.locator('.row', has_text='Saba').first
    check('po zdjęciu: Brama bez ramki i opisu', 'wybr' not in (row.get_attribute('class') or '') and 'dla aktywnych' not in row.inner_text(), [row.get_attribute('class'), row.inner_text(), pa.evaluate("async()=>(await (await import('/js/db.js')).getRec('oznaczenia','d1'))"), pa.evaluate("async()=>{const a=await import('/js/api.js');return (await a.api('/sync?since=0')).changes.filter(c=>c.col==='oznaczenia')}"), pg.evaluate("async()=>(await (await import('/js/db.js')).getRec('oznaczenia','d1'))")])
    go(pg, '#/psy', 900); k = pg.locator('.dcard', has_text='Saba')
    check('po zdjęciu: lista bez obwódki i z hasłem ze strony', 'wyb' not in k.get_attribute('class') and 'w cieniu strachu' in k.inner_text(), k.inner_text())

    # --- odblokowanie hasłem administratora w sesji wolontariusza i wyłączenie ---
    go(pv, '#/ustawienia'); pv.click('[data-act=unlock-sheet]'); pv.wait_for_selector('#up'); pv.fill('#up', 'zle-haslo'); pv.click('#uf button[type=submit]'); pv.wait_for_timeout(700)
    check('złe hasło: komunikat', 'Nieprawidłowe hasło administratora' in pv.inner_text('#ue'))
    pv.fill('#up', ADM); pv.click('#uf button[type=submit]'); pv.wait_for_timeout(1500)
    check('odblokowanie hasłem administratora', pv.evaluate("async()=>{const a=await import('/js/auth.js');return a.state.admin}"))
    sync(pv, 1500)
    kw = pv.evaluate("async()=>(await (await import('/js/store.js')).list('spacery')).map(w=>w.kontakt||'')")
    check('po odblokowaniu: kontakty z Bramy pobrane', sorted(kw) == ['600 100 200', 'm.me/kasia.nowak'], kw)
    go(pv, '#/ustawienia'); pv.click('[data-act=set-lock]'); pv.wait_for_timeout(1500)
    check('wyłączenie trybu administratora', not pv.evaluate("async()=>{const a=await import('/js/auth.js');return a.state.admin || a.state.coordinator}"))
    check('po wyłączeniu: Start wolontariusza', pv.evaluate('location.hash') == '#/start' and pv.locator('.card.dzis', has_text='Najbliżej').count() == 1)
    sync(pv, 1500)
    kw = pv.evaluate("async()=>(await (await import('/js/store.js')).list('spacery')).map(w=>w.kontakt||'')")
    check('po wyłączeniu: kontakty usunięte z telefonu', kw == ['', ''], kw)

    koniec('znaki1')
