# 1.16.2: usuwanie psa (pomyłka) z karty przyjęcia i z „Edytuj”, razem z powiązanymi wpisami; znika u wszystkich.
from playwright.sync_api import sync_playwright
from wspolne import *

with sync_playwright() as p:
    b = p.chromium.launch()
    ca, pa = newpage(b); login(pa, 'Ania')
    now = pa.evaluate('Date.now()')
    save(pa, 'psy', {'id': 'm1', 'imie': 'Aaa', 'status': 'schronisko', 'miejsce': 'schronisko', 'nowy': True, 'karta_otwarta': True, 'dodany': now, 'zdjecia': []})
    save(pa, 'psy', {'id': 'd2', 'imie': 'Saba', 'status': 'do_adopcji', 'miejsce': 'schronisko', 'zdjecia': []})
    save(pa, 'spacery', {'id': 'w1', 'pies_id': 'm1', 'pies_imie': 'Aaa', 'start': now - 3600e3, 'end': now - 1800e3, 'czas_min': 30})
    save(pa, 'spacery', {'id': 'w2', 'pies_id': 'd2', 'pies_imie': 'Saba', 'start': now - 3600e3, 'end': now - 1800e3, 'czas_min': 30})
    save(pa, 'obserwacje', {'id': 'o1', 'pies_id': 'm1', 'tekst': 'x', 'ts': now})
    save(pa, 'oznaczenia', {'id': 'm1', 'opis': 'specjalny'})
    sync(pa)
    cv, pv = newpage(b); login(pv, 'Wola', WOL); sync(pv, 1500)
    check('wolontariusz widzi Aaa przed usunięciem', pv.evaluate("async()=>!!(await (await import('/js/store.js')).get('psy','m1'))"))

    go(pa, '#/nowe/m1', 900)
    check('karta przyjęcia: przycisk usunięcia', pa.locator('[data-act=dog-usun]').count() == 1)
    check('karta przyjęcia: podpowiedź o zmianie imienia', 'Imię możesz zmienić' in text(pa))
    pa.click('[data-act=dog-usun]'); pa.wait_for_selector('[data-yes]')
    t = pa.inner_text('#sheet-root')
    check('okno: co zniknie', 'Aaa' in t and '1 spacer' in t and '1 notatka' in t, t)
    pa.click('[data-no]') if pa.locator('[data-no]').count() else close_sheet(pa); pa.wait_for_timeout(300)
    check('anuluj: pies zostaje', pa.evaluate("async()=>!!(await (await import('/js/store.js')).get('psy','m1'))"))
    pa.click('[data-act=dog-usun]'); pa.wait_for_selector('[data-yes]'); pa.click('[data-yes]'); pa.wait_for_timeout(800)
    st = pa.evaluate("""async()=>{const s=await import('/js/store.js');return {p:!!(await s.get('psy','m1')),w1:!!(await s.get('spacery','w1')),w2:!!(await s.get('spacery','w2')),o:!!(await s.get('obserwacje','o1')),z:!!(await s.get('oznaczenia','m1')),s:!!(await s.get('psy','d2'))}}""")
    check('usunięto psa i jego wpisy, inne zostały', st == {'p': False, 'w1': False, 'w2': True, 'o': False, 'z': False, 's': True}, st)
    check('po usunięciu: lista Psy', pa.evaluate('location.hash') == '#/psy' and 'Aaa' not in text(pa))
    sync(pa, 1500); sync(pv, 1500)
    check('wolontariusz: Aaa zniknął', not pv.evaluate("async()=>!!(await (await import('/js/store.js')).get('psy','m1'))"))
    go(pa, '#/brama', 700); check('Brama bez Aaa', 'Aaa' not in text(pa))

    # z karty psa: Edytuj → Usuń psa z aplikacji
    go(pa, '#/psy/d2', 900); pa.click('[data-act=dog-edit]'); pa.wait_for_selector('#dd'); pa.click('#dd'); pa.wait_for_selector('[data-yes]')
    check('Edytuj → Usuń: okno potwierdzenia', 'Saba' in pa.inner_text('#sheet-root')); pa.click('[data-yes]'); pa.wait_for_timeout(700)
    check('Saba usunięta', not pa.evaluate("async()=>!!(await (await import('/js/store.js')).get('psy','d2'))"))
    # wolontariusz nie usuwa
    r = pv.evaluate("async()=>{try{await (await import('/js/store.js')).remove('psy','d2');return 'ok'}catch(e){return e.name}}")
    check('wolontariusz nie usunie psa', r == 'TylkoAdmin', r)
    koniec('usun1')
