# 1.18: strona schroniska jedynym źródłem psów. „Byli u nas” (psy, których nie ma już na stronie) dla obu ról,
# „w procesie adopcji” ze strony widać jako znaczek (lista, Brama), nie ma ręcznych statusów, adopcji, archiwum ani dodawania psa.
import json, urllib.request
from playwright.sync_api import sync_playwright
from wspolne import *


def api_psy(pw):
    tok = json.load(urllib.request.urlopen(urllib.request.Request(API + '/auth/login', data=json.dumps({'password': pw}).encode(), method='POST')))['token']
    r = json.load(urllib.request.urlopen(urllib.request.Request(API + '/sync?since=0', headers={'authorization': 'Bearer ' + tok})))
    return {c['id']: c['data'] for c in r['changes'] if c['col'] == 'psy' and not c['deleted']}


with sync_playwright() as p:
    b = p.chromium.launch()
    ca, pa = newpage(b); login(pa, 'Ania')
    now = pa.evaluate('Date.now()')
    base = {'miejsce': 'schronisko', 'zdjecia': ['https://example.com/a.jpg'], 'plec': 'samiec', 'wiek': '3 lata'}
    save(pa, 'psy', {**base, 'id': 'd1', 'imie': 'Azor', 'status': 'do_adopcji', 'boks': '4', 'zrodlo_id': '1', 'od_www': now - 400 * 864e5})
    save(pa, 'psy', {**base, 'id': 'd2', 'imie': 'Bella', 'status': 'do_adopcji', 'zrodlo_id': '2', 'od_www': 1600000000000, 'zniknal_ze_strony': now - 864e5, 'wazne': 'TAJNE-WAZNE', 'leki': 'TAJNE-LEKI', 'chip': '123456'})
    save(pa, 'psy', {**base, 'id': 'd3', 'imie': 'Cezar', 'status': 'w_trakcie', 'zrodlo_id': '3', 'boks': '9'})
    save(pa, 'psy', {**base, 'id': 'd4', 'imie': 'Dina', 'status': 'do_adopcji', 'archiwum': now, 'archiwum_los': 'zmarl'})
    save(pa, 'psy', {**base, 'id': 'd5', 'imie': 'Ela', 'status': 'do_adopcji', 'miejsce': 'dt', 'zrodlo_id': '5'})
    sync(pa)
    go(pa, '#/psy', 800); t = text(pa)
    check('Psy: Wszystkie = psy na stronie (także w procesie adopcji i w DT)', all(x in t for x in ['Azor', 'Cezar', 'Ela']) and not any(x in t for x in ['Bella', 'Dina']), t[:300])
    check('Psy: filtry Wszystkie, W schronisku, Ulubione, Byli u nas', [x.get_attribute('data-k') for x in pa.locator('[data-act=dog-filter]').all()] == ['aktywne', 'schronisko', 'ulubione', 'byli'])
    check('Psy: znaczek „W procesie adopcji”, bez „Do adopcji”', pa.locator('.dcard', has_text='Cezar').locator('text=W procesie adopcji').count() == 1 and 'Do adopcji' not in t)
    check('Psy: brak przycisku „Przyjmij nowego psa”', pa.locator('[data-act=a-newdog]').count() == 0 and 'Przyjmij' not in t)
    pa.click('[data-act=dog-filter][data-k=byli]'); pa.wait_for_timeout(500); t = text(pa)
    check('Byli u nas: Bella i Dina, z latami pobytu', 'Bella' in t and 'Dina' in t and 'Azor' not in t and 'u nas 2020–2026' in t, t[:300])
    go(pa, '#/adoptowane', 700); check('#/adoptowane → Byli u nas', pa.locator('[data-k=byli].on').count() == 1)
    go(pa, '#/archiwum', 700); check('#/archiwum → Byli u nas', pa.locator('[data-k=byli].on').count() == 1)
    # Brama: pies w procesie adopcji jest, z oznaczeniem; byli – nie
    go(pa, '#/brama', 800); pa.click('[data-act=br-tab][data-t=wydaj]'); pa.wait_for_timeout(400)
    row = pa.locator('.row', has_text='Cezar').first
    try: row.locator('small .adbadge').wait_for(timeout=4000)
    except Exception: pass
    check('Brama: pies w procesie adopcji z oznaczeniem', row.locator('small .adbadge').count() == 1)
    check('Brama: bez psów z „Byli u nas”', 'Bella' not in text(pa) and 'Dina' not in text(pa))
    # menu i „+”: bez dodawania psa, adopcji, social media, archiwum
    go(pa, '#/start', 700); pa.click('[data-act=menu]'); pa.wait_for_timeout(300); m = pa.inner_text('.drawer')
    check('Menu: bez Adopcji, Social media, Przyjmij, Do uzupełnienia', not any(x in m for x in ['Adopcje', 'Social media', 'Przyjmij', 'Do uzupełnienia']), m)
    pa.evaluate("document.querySelector('.drawer').remove()")
    pa.click('.nav [data-act=add]'); pa.wait_for_timeout(300); a = pa.inner_text('.sheet')
    check('„+”: bez psa ze strony, przyjęcia i zdjęć', not any(x in a for x in ['Przyjmij', 'Pies ze strony', 'Dodaj zdjęcie']) and 'Notatka o psie' in a, a)
    close_sheet(pa)
    for h in ['#/karta/nowy', '#/nowe', '#/adopcje', '#/social']:
        go(pa, h, 600); check(f'{h} nie istnieje (Start)', pa.locator('.hello').count() == 1)
    go(pa, '#/ustawienia', 700); check('Ustawienia: bez Archiwum psów, sprawdzanie co godzinę', 'Archiwum psów' not in text(pa))
    go(pa, '#/zrobic', 800); t = text(pa)
    check('Dziś i do zrobienia: bez dawnych przypomnień (zdjęcia, ogłoszenia, karta)', not any(x in t for x in ['Brak zdjęć', 'Na Facebooku', 'zróbmy hałas', 'Karta psa']), t[:300])
    # karta admina psa z byli u nas: znaczek, bez spaceru
    go(pa, '#/psy/d2', 900); t = text(pa)
    check('Admin: karta psa z Byli u nas ma znaczek i pełne dane', 'Byli u nas' in t and 'TAJNE-WAZNE' in t and 'Rozpocznij spacer' not in t)
    # serwer: wolontariusz nie dostaje pól administratora
    v = api_psy(WOL)
    check('Serwer: wolontariusz bez Ważne, leków, czipa', not any(k in v['d2'] for k in ['wazne', 'leki', 'chip', 'dokumenty', 'choroby', 'od']) and 'zniknal_ze_strony' in v['d2'])
    # wolontariusz
    cw, pw = newpage(b); login(pw, 'Ola', WOL); sync(pw)
    go(pw, '#/psy', 800); t = text(pw)
    check('Wolontariusz: widzi psa w procesie adopcji (jak na stronie)', 'Cezar' in t and 'Bella' not in t)
    pw.click('[data-act=dog-filter][data-k=byli]'); pw.wait_for_timeout(500); t = text(pw)
    check('Wolontariusz: Byli u nas', 'Bella' in t and 'Dina' in t)
    go(pw, '#/psy/d2', 900); t = text(pw)
    check('Wolontariusz: karta z Byli u nas – tylko dane ze strony', 'Byli u nas' in t and 'TAJNE' not in t and 'Historia spacerów' not in t and 'Czego potrzebuje' not in t, t[:400])
    go(pw, '#/byli', 700); check('Wolontariusz: #/byli działa', pw.locator('[data-k=byli].on').count() == 1)
    koniec('byli1')
