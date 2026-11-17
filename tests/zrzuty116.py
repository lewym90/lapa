# Zrzuty do akceptacji 1.16 (nie jest testem). Zdjęcia psów: tmpimg/ na serwerze statycznym.
from playwright.sync_api import sync_playwright
from wspolne import *
import sys
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/zr'
IMG = 'http://127.0.0.1:8000/tmpimg/'
D = 864e5


def shot(P, name, full=False):
    P.wait_for_timeout(500); P.evaluate("document.getElementById('toast').className=''"); P.wait_for_timeout(250); P.screenshot(path=f'{OUT}/{name}.png', full_page=full)


with sync_playwright() as p:
    b = p.chromium.launch()
    ca, pa = newpage(b, {'width': 390, 'height': 844}); login(pa, 'Ania')
    now = pa.evaluate('Date.now()')
    psy = [
        ('d1', 'Saba', 'suka', '5 lat', 'duża', '7', 'SABA - w cieniu strachu', ['spacer', 'zdjecia'], {'ludzie': 'ostroznie', 'dzieci': 'nie', 'psy': 'ok', 'smycz': 'neutral'}, 0),
        ('d2', 'Bruno', 'samiec', '3 lata', 'średni', '12', 'BRUNO - wesoły łobuziak', ['transport'], {'ludzie': 'ok', 'dzieci': 'ok', 'psy': 'ok'}, 1),
        ('d3', 'Fiona', 'suka', '8 lat', 'mała', 'B4', 'FIONA - kanapowa seniorka', ['dt'], {'ludzie': 'ok', 'koty': 'ok'}, 2),
        ('d4', 'Rex', 'samiec', '2 lata', 'duży', '3', 'REX - pełen energii', [], {'psy': 'nie', 'smycz': 'ostroznie'}, 3),
        ('d5', 'Kora', 'suka', '6 lat', 'średnia', '9', 'KORA - mądra i spokojna', ['spacer'], {}, 4),
    ]
    for i, (id_, im, pl, w, wl, bx, h, need, oc, ph) in enumerate(psy):
        save(pa, 'psy', {'id': id_, 'imie': im, 'plec': pl, 'wiek': w, 'wielkosc': wl, 'waga': f'{10 + 5 * i} kg', 'boks': bx, 'status': 'do_adopcji' if i != 1 else 'pilne', 'miejsce': 'schronisko', 'haslo': h,
                         'opis': f'{im} to wspaniały pies, który czeka na swój dom. Lubi spacery i drapanie za uchem.', 'potrzeby': need, 'ocena': oc, 'kanaly': {'www': now}, 'zdjecia': [IMG + f'p{ph}.jpg'], 'data_przyjecia': now - (100 + i) * D})
    save(pa, 'oznaczenia', {'id': 'd4', 'opis': 'dla aktywnych', 'wybrani': {'on': True, 'powody': ['silny'], 'inny': '', 'kto': 'Justyna, Marek'}})
    save(pa, 'oznaczenia', {'id': 'd1', 'opis': 'wycofany', 'wybrani': None})
    save(pa, 'potrzeby', {'id': 'n1', 'nazwa': 'Karma mokra dla psów', 'kategoria': 'Karma', 'potrzeba': 60, 'zapewniono': 22, 'jednostka': 'puszek', 'priorytet': 'pilne', 'autor': 'Ania'})
    save(pa, 'potrzeby', {'id': 'n2', 'nazwa': 'Koce i ręczniki', 'kategoria': 'Legowiska', 'potrzeba': 20, 'zapewniono': 5, 'jednostka': 'szt.', 'autor': 'Ania'})
    save(pa, 'transporty', {'id': 't1', 'pies_id': 'd2', 'pies_imie': 'Bruno', 'skad': 'Schronisko Nowodwór', 'dokad': 'Lecznica w Rykach', 'kiedy': now + 2 * D, 'status': 'szuka', 'autor': 'Ania', 'uwagi': 'Bruno jeździ spokojnie, potrzebny transporter.'})
    save(pa, 'spacery', {'id': 'w1', 'pies_id': 'd1', 'pies_imie': 'Saba', 'start': now - 3 * D, 'end': now - 3 * D + 3e6, 'czas_min': 50, 'dystans_km': 2.4, 'autor': 'Kasia', 'notatka': 'Spokojnie.'})
    save(pa, 'komunikaty', {'id': 'k1', 'tekst': 'W sobotę spacery od 10:00. Zapraszamy!', 'ts': now - 3600e3, 'autor': 'Ania'})
    sync(pa)

    cv, pv = newpage(b, {'width': 390, 'height': 844}); login(pv, 'Kasia', WOL); sync(pv, 1500)
    pv.evaluate("localStorage.setItem('lapa.tel','600 111 222')")
    go(pv, '#/start', 900); shot(pv, 'w01_start')
    pv.evaluate('scrollTo(0, 700)'); shot(pv, 'w02_start_kafelki')
    go(pv, '#/psy', 900); shot(pv, 'w03_psy')
    go(pv, '#/psy/d1', 900); shot(pv, 'w04_karta', True)
    pv.locator('#app [data-act=decl]').first.click(); pv.wait_for_selector('#zw'); shot(pv, 'w05_zglos_sie'); pv.click('#zw button[type=submit]'); pv.wait_for_timeout(600)
    go(pv, '#/pomoc', 900); shot(pv, 'w06_pomoc', True)
    go(pv, '#/potrzeby', 900); pv.click('[data-act=of-potrzeba]'); pv.wait_for_selector('#zw'); pv.fill('#zw_q', '12'); shot(pv, 'w07_moge_przywiezc'); pv.click('#zw button[type=submit]'); pv.wait_for_timeout(600)
    shot(pv, 'w08_potrzeby', True)
    go(pv, '#/transport', 900); pv.click('[data-act=tr-open]'); pv.wait_for_selector('#sheet-root .sheet'); shot(pv, 'w09_transport_okno')
    pv.click('[data-act=of-transport]'); pv.wait_for_selector('#zw'); pv.click('#zw button[type=submit]'); pv.wait_for_timeout(600)
    go(pv, '#/sobotnie', 900); pv.locator('[data-act=sob-bede]').first.click(); pv.wait_for_selector('#zw'); pv.click('#zw button[type=submit]'); pv.wait_for_timeout(600); shot(pv, 'w10_sobotnie')
    go(pv, '#/zaginiecia', 900)
    go(pv, '#/ustawienia', 900); shot(pv, 'w11_ustawienia', True)
    go(pv, '#/start', 700); pv.click('[data-act=menu]'); pv.wait_for_selector('.drawer'); shot(pv, 'w12_menu'); pv.evaluate("document.querySelector('.drawer')?.remove()")
    go(pv, '#/brama', 900); shot(pv, 'w13_brama_zablokowana')
    sync(pv, 1500)

    # druga wolontariuszka widzi tylko imię
    cz, pz = newpage(b, {'width': 390, 'height': 844}); login(pz, 'Zosia', WOL); sync(pz, 1500)
    go(pz, '#/potrzeby', 900); shot(pz, 'w14_inna_osoba_potrzeby')

    # administrator
    sync(pa, 1500); go(pa, '#/start', 900); shot(pa, 'a01_start', True)
    go(pa, '#/zgloszenia', 900); shot(pa, 'a02_zgloszenia', True)
    go(pa, '#/brama', 900); pa.click('[data-act=br-tab][data-t=wydaj]'); pa.wait_for_timeout(400); shot(pa, 'a03_brama')
    pa.locator('.bimie[data-id=d4]').click(); pa.wait_for_selector('#of2'); shot(pa, 'a04_brama_oznacz'); close_sheet(pa)
    go(pa, '#/psy', 900); shot(pa, 'a05_psy')
    go(pa, "#/psy/d4", 900); pa.evaluate("scrollTo(0, 430)"); shot(pa, 'a06_karta_wiersz')
    pa.evaluate("document.querySelector('[data-act=dog-oznacz]')?.scrollIntoView({block:'center'})"); shot(pa, 'a06b_karta_wiersz2')
    go(pv, '#/psy/d4', 900); pv.evaluate("scrollTo(0, 560)"); shot(pv, 'w15_karta_rex')
    go(pv, '#/psy', 900); shot(pv, 'w03_psy')
    go(pa, '#/transport', 900); pa.click('[data-act=tr-open]'); pa.wait_for_selector('#sheet-root .sheet'); shot(pa, 'a07_transport_okno'); close_sheet(pa)
    go(pa, '#/pomoc', 900); shot(pa, 'a08_pomoc', True)
    go(pa, '#/ustawienia', 900); shot(pa, 'a09_ustawienia')
    print('gotowe')
