# 1.18: karta psa administratora – kompendium: Ważne (pomarańczowe), Dane (strona tylko do odczytu, „W schronisku od” z datą ze strony
# i ołówkiem, sam rok wystarczy), Wydawanie na spacer, Zdrowie (kafelki, leki, choroby, wpisy z datą „tyle, ile pamiętasz”, koszt),
# Dokumenty (zdjęcia), Dla wolontariuszy, Notatki. Bez statusów, kanałów, tekstów do postów, drogi psa i usuwania.
from playwright.sync_api import sync_playwright
from wspolne import *


def dog(P, i='d1'):
    return P.evaluate("async(i)=>(await (await import('/js/store.js')).get('psy',i))", i)


def edit(P, f, val):
    P.click(f'[data-act=k-edit][data-f={f}]'); P.wait_for_selector('#kev'); P.fill('#kev', val); P.click('#kef button[type=submit]'); P.wait_for_timeout(500)


with sync_playwright() as p:
    b = p.chromium.launch()
    ca, pa = newpage(b); login(pa, 'Ania')
    now = pa.evaluate('Date.now()')
    save(pa, 'psy', {'id': 'd1', 'imie': 'Wilma', 'plec': 'suka', 'wiek': 'ok. 6 lat', 'waga': '18 kg', 'wielkosc': 'średnia', 'status': 'do_adopcji', 'miejsce': 'schronisko', 'boks': '12', 'zdjecia': [], 'zrodlo_id': '1', 'zrodlo_url': 'https://example.com/psy/1', 'od_www': pa.evaluate('new Date(2021,10,18,12).getTime()'), 'haslo': 'WILMA - spokojna dama', 'opis': 'Spokojna suczka.', 'zdr': {'kastr': 'tak'}})
    go(pa, '#/psy/d1', 1000); t = text(pa)
    for s_ in ['Dane', 'Wydawanie na spacer', 'Zdrowie', 'Dokumenty', 'Dla wolontariuszy', 'Notatki']:
        check('sekcja ' + s_, s_ in t)
    check('Wydawanie na spacer: „Każdy” i pusty opis', pa.locator('.kd', has_text='Kto może wyprowadzać').locator('text=Każdy').count() == 1 and pa.locator('.kd', has_text='Krótki opis').count() == 1)
    check('dane ze strony', all(x in t for x in ['Suka', 'ok. 6 lat', '18 kg', 'średnia']))
    check('W schronisku od: data ze strony i liczba lat', '18.11.2021' in t and ('4 lata' in t or '5 lat' in t), t[:600])
    check('bez dawnych elementów', not any(x in t for x in ['Zmień status', 'Gdzie jest ogłoszony', 'Teksty do postów', 'Zaufanie i spacery', 'Karta psa:', 'Usuń psa', 'Ocena zachowania', 'Edytuj', 'PDF', 'Zdjęcia / sesja']), t)
    check('dane ze strony bez ołówka (tylko odczyt)', pa.locator('.kd:not(.ed)', has_text='Wiek').count() == 1)
    check('Ważne: puste = tylko „Dodaj ważną informację”', pa.locator('.kwazne').count() == 0 and pa.locator('.kdodaj', has_text='Dodaj ważną informację').count() == 1)
    pa.click('.kdodaj[data-f=wazne]'); pa.wait_for_selector('#kev'); pa.fill('#kev', 'Bierze leki 2× dziennie'); pa.click('#kef button[type=submit]'); pa.wait_for_timeout(600)
    bg = pa.evaluate("getComputedStyle(document.querySelector('.kwazne')).backgroundColor")
    check('Ważne: pomarańczowe pole na górze', pa.locator('.kwazne', has_text='Bierze leki').count() == 1 and bg == 'rgb(251, 227, 200)', bg)
    edit(pa, 'wazne', ''); check('Ważne: puste usuwa', pa.locator('.kwazne').count() == 0 and 'wazne' not in dog(pa))
    # W schronisku od
    edit(pa, 'od', '2019'); check('od: sam rok się zapisuje', dog(pa).get('od') == '2019' and '2019' in text(pa) and '7 lat' in text(pa))
    edit(pa, 'od', 'marzec 2018'); check('od: miesiąc słownie', dog(pa).get('od') == '03.2018')
    pa.click('[data-act=k-edit][data-f=od]'); pa.wait_for_selector('#kev'); pa.fill('#kev', '45.13.2019'); pa.click('#kef button[type=submit]'); pa.wait_for_timeout(300)
    check('od: zła data → komunikat, bez zapisu', 'Nie rozumiem tej daty' in pa.inner_text('.sheet') and dog(pa).get('od') == '03.2018'); close_sheet(pa)
    edit(pa, 'od', ''); check('od: puste → wraca data ze strony', 'od' not in dog(pa) and '18.11.2021' in text(pa))
    edit(pa, 'boks', '7a!'); check('boks', dog(pa).get('boks') == '7a')
    edit(pa, 'chip', '616093900123456'); check('czip', dog(pa).get('chip') == '616093900123456' and '616093900123456' in text(pa))
    edit(pa, 'leki', 'Vetmedin 5 mg rano i wieczorem'); edit(pa, 'choroby', 'Alergia na kurczaka')
    t = text(pa); check('stałe leki i choroby', 'Vetmedin 5 mg' in t and 'Alergia na kurczaka' in t)
    # zdrowie: kafelki
    check('kafelek kastracji z dawnej karty: „tak”', pa.locator('.kafel[data-typ=kastracja]', has_text='tak').count() == 1)
    pa.click('.kafel[data-typ=szczepienie]'); pa.wait_for_selector('#kz_d')
    check('kafelek otwiera wpis z wybranym rodzajem', pa.eval_on_selector('#kz_t', 'e=>e.value') == 'szczepienie')
    pa.fill('#kz_d', '03.2024'); pa.fill('#kz_n', 'Wścieklizna'); pa.fill('#kz_k', '80,50'); pa.fill('#kz_x', '03.2030'); pa.click('#kzf button[type=submit]'); pa.wait_for_timeout(700)
    check('kafelek pokazuje datę', pa.locator('.kafel.jest[data-typ=szczepienie]', has_text='03.2024').count() == 1)
    check('wpis na liście z kosztem', pa.locator('.kwpis', has_text='Wścieklizna').count() == 1 and '80,50 zł' in text(pa))
    pa.click('.kdodaj[data-act=k-zdr]'); pa.wait_for_selector('#kz_d'); pa.fill('#kz_d', 'wczoraj'); pa.click('#kzf button[type=submit]'); pa.wait_for_timeout(300)
    check('zła data wpisu → komunikat', 'Wpisz, kiedy to było' in pa.inner_text('.sheet'))
    pa.select_option('#kz_t', 'kastracja'); pa.fill('#kz_d', '2020'); pa.click('#kzf button[type=submit]'); pa.wait_for_timeout(700)
    check('sam rok w zdrowiu', pa.locator('.kafel.jest[data-typ=kastracja]', has_text='2020').count() == 1)
    check('koszt razem', 'razem 80,50 zł' in text(pa))
    pa.click('.kwpis:has-text("Wścieklizna")'); pa.wait_for_selector('#kz_d')
    check('edycja wpisu: dane wczytane', pa.eval_on_selector('#kz_d', 'e=>e.value') == '03.2024' and pa.eval_on_selector('#kz_k', 'e=>e.value') == '80,5')
    pa.fill('#kz_n', 'Wścieklizna, Biocan'); pa.click('#kzf button[type=submit]'); pa.wait_for_timeout(700)
    check('edycja wpisu zapisana (bez duplikatu)', pa.locator('.kwpis').count() == 2 and 'Biocan' in text(pa))
    pa.click('.kwpis:has-text("Kastracja")'); pa.wait_for_selector('#kz_del'); pa.click('#kz_del'); pa.wait_for_selector('.sheet [data-yes]'); pa.click('.sheet [data-yes]'); pa.wait_for_timeout(700)
    check('usunięcie wpisu (kafelek wraca do „tak” z dawnej karty)', pa.locator('.kwpis').count() == 1 and pa.locator('.kafel[data-typ=kastracja]', has_text='tak').count() == 1)
    # dokumenty
    pa.set_input_files('[data-kdok]', ['/tmp/sc/dok.jpg']); pa.wait_for_timeout(2500)
    check('dokument dodany', len(dog(pa).get('dokumenty') or []) == 1 and pa.locator('.kdokp').count() == 1)
    pa.click('.kdokp'); pa.wait_for_selector('#kd_x'); check('dokument otwiera się w dużym widoku', pa.locator('.sheet img.kdokbig').count() == 1); close_sheet(pa)
    # notatka
    pa.click('.kdodaj[data-act=dog-obs-add]'); pa.wait_for_selector('#otx'); pa.fill('#otx', 'Pierwszy raz podeszła do ręki.'); pa.click('#of button[type=submit]'); pa.wait_for_timeout(700)
    check('notatka na karcie z autorem', pa.locator('.knotki .obs', has_text='Pierwszy raz').count() == 1 and 'Ania' in pa.inner_text('.knotki'))
    # potrzeby
    pa.click('.kd[data-act=dog-needs]'); pa.wait_for_selector('#nc'); pa.click('#nc [data-k=transport]'); pa.click('#ns'); pa.wait_for_timeout(600)
    check('czego potrzebuje', 'Transport' in text(pa))
    pa.click('.kd[data-act=dog-needs]'); pa.wait_for_selector('#nc'); check('Inne: pole tekstu ukryte, dopóki nie zaznaczysz', pa.locator('#ni_f').is_hidden())
    pa.click('#nc [data-k=inne]'); check('Inne: pole tekstu się pokazuje', pa.locator('#ni_f').is_visible())
    pa.click('#ns'); pa.wait_for_timeout(200); check('Inne: bez tekstu nie zapisze', 'Wpisz, czego' in pa.inner_text('#ne'))
    pa.fill('#ni', 'ciepły kocyk'); pa.click('#ns'); pa.wait_for_timeout(600)
    check('Inne: zapisane jako dowolny tekst', 'inne:ciepły kocyk' in dog(pa)['potrzeby'] and 'ciepły kocyk' in text(pa))
    pa.click('.kd[data-act=dog-needs]'); pa.wait_for_selector('#nc'); check('Inne: przy edycji tekst wraca', pa.input_value('#ni') == 'ciepły kocyk' and pa.locator('#ni_f').is_visible()); close_sheet(pa)
    go(pa, '#/pomoc', 800); check('Pomoc: potrzeba „Inne” jako chip z tekstem', pa.locator('[data-act=decl][data-need="inne:ciepły kocyk"]', has_text='ciepły kocyk').count() == 1)
    go(pa, '#/psy/d1', 900)
    # komputer
    cd, pd = newpage(b, {'width': 1366, 'height': 900}); login(pd, 'Ania'); save(pd, 'psy', dog(pa)); go(pd, '#/psy/d1', 1000)
    w = pd.evaluate("document.querySelector('.komp').getBoundingClientRect().width")
    check('komputer: karta czytelnej szerokości', w <= 780, w)
    pa.screenshot(path='/tmp/zr/komp1.png', full_page=True)
    koniec('komp1')
