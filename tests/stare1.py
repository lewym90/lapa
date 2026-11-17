# 1.19: dane zapisane przez wersję produkcyjną 1.16.2 (stare pola i formaty) – każdy ekran i okno działa bez błędu,
# a stare wartości są pokazywane sensownie (potrzeba z liczbą i jednostką, dom tymczasowy z miejscowością, finanse z kategorią...).
from playwright.sync_api import sync_playwright
from wspolne import *

D = 864e5
TRASY = ['#/start', '#/psy', '#/byli', '#/psy/s1', '#/psy/s2', '#/psy/s3', '#/psy/s4', '#/brama', '#/wydarzenia', '#/terminarz', '#/spacery', '#/pomoc', '#/czat',
         '#/zaginiecia', '#/zaginiecia/z1', '#/dt', '#/dt/p1', '#/finanse', '#/zgloszenia', '#/ustawienia', '#/raport/w1', '#/raport/w2']
with sync_playwright() as p:
    b = p.chromium.launch()
    ca, pa = newpage(b); login(pa, 'Ania'); now = pa.evaluate('Date.now()')
    stare = [
        ('psy', {'id': 's1', 'imie': 'Rex', 'plec': 'samiec', 'status': 'dt', 'miejsce': 'dt', 'opiekun': 'Kasia', 'data_przyjecia': now - 400 * D, 'chip': '123', 'ocena': {'ludzie': 'ok', 'autor': 'Ania'},
                 'tagi': ['spokojny'], 'kanaly': {'fb': now - 10 * D, 'www': now - 300 * D}, 'nowy': True, 'karta_gotowa': True, 'zdr': {'czip': 'tak', 'szczep': 'nie', 'kastr': 'tak'}, 'zdr_uwagi': 'alergia', 'moje_zdjecia': [], 'zdjecia': [], 'zrodlo_id': '1'}),
        ('psy', {'id': 's2', 'imie': 'Mila', 'status': 'adoptowany', 'miejsce': 'adoptowany', 'data_adopcji': now - 5 * D, 'zdjecia': [], 'zrodlo_id': '2'}),
        ('psy', {'id': 's3', 'imie': 'Fafik', 'status': 'schronisko', 'miejsce': 'zaginiony', 'poprz_miejsce': 'schronisko', 'zaufanie': now - 3 * D, 'zdjecia': []}),
        ('psy', {'id': 's4', 'imie': 'Kora', 'status': 'w_trakcie', 'w_trakcie_od': now, 'archiwum': now, 'archiwum_los': 'zmarl', 'zdjecia': [], 'zrodlo_id': '4'}),
        ('zdrowie', {'id': 'h1', 'pies_id': 's1', 'typ': 'szczepienie', 'data': now - 100 * D, 'termin': now + 200 * D, 'koszt': 50.5, 'notatka': 'stary wpis', 'autor': 'Ania'}),
        ('obserwacje', {'id': 'o1', 'pies_id': 's1', 'typ': 'Zachowanie', 'tekst': 'Stara obserwacja', 'ts': now - D, 'autor': 'Ania'}),
        ('potrzeby', {'id': 'n1', 'nazwa': 'Karma mokra', 'kategoria': 'Karma mokra', 'potrzeba': 60, 'jednostka': 'puszek', 'zapewniono': 10, 'priorytet': 'pilne', 'status': 'otwarta', 'autor': 'Ania'}),
        ('oferty', {'id': 'of1', 'typ': 'potrzeba', 'ref': 'n1', 'ilosc': 5, 'stan': 'nowa', 'imie': 'Ola', 'ts': now}),
        ('transporty', {'id': 't1', 'pies_id': 's1', 'pies_imie': 'Rex', 'skad': 'A', 'dokad': 'B', 'kiedy': now + D, 'status': 'szuka', 'pilny': True}),
        ('zaginiecia', {'id': 'z1', 'pies_id': 's3', 'imie': 'Fafik', 'kiedy': now - 2 * D, 'gdzie': 'Ryki', 'ostatnio': 'las', 'opis': 'czarny', 'kontakt': '600', 'status': 'poszukiwany', 'akt': [{'ts': now, 'text': 'widziany', 'autor': 'Ania'}], 'autor': 'Ania'}),
        ('p_dt', {'id': 'p1', 'imie': 'Kasia', 'telefon': '600 100 200', 'miasto': 'Ryki', 'pojemnosc': 2, 'umie': ['duze', 'koty'], 'dostepny': True, 'notatka': 'stara notatka'}),
        ('p_finanse', {'id': 'f1', 'typ': 'wplata', 'kwota': 300, 'data': now, 'zrodlo': 'licytacja'}),
        ('p_finanse', {'id': 'f2', 'typ': 'wydatek', 'kwota': 80, 'data': now, 'kat': 'karma', 'pies_id': 's1'}),
        ('p_adopcje', {'id': 'a1', 'pies_id': 's4', 'imie': 'Jan', 'telefon': '600', 'etap': 'wizyta'}),
        ('spacery', {'id': 'w1', 'pies_id': 's1', 'pies_imie': 'Rex', 'start': now - 2 * D, 'end': now - 2 * D + 3e6, 'czas_min': 50, 'dystans_km': 2.1, 'os_czasu': [{'t': now - 2 * D, 'txt': 'Start'}], 'nastroj': 'spokojny', 'autor': 'Ania', 'notatka': 'stary spacer z GPS'}),
        ('spacery', {'id': 'w2', 'tryb': 'brama', 'pies_id': 's1', 'pies_imie': 'Rex', 'start': now - D, 'end': now - D + 1800e3, 'osoba': 'Kasia', 'autor': 'Ania'}),
        ('terminarz', {'id': 'e1', 'tytul': 'Stary wpis', 'start': now + 3600e3, 'widocznosc': 'wszyscy', 'owner': 'Ania', 'autor': 'Ania'}),
        ('szablony_karta', {'id': 'post', 'rodzaj': 'post', 'tekst': 'stary szablon'}),
    ]
    for c, o in stare: save(pa, c, o)
    pa.evaluate("try{localStorage.setItem('lapa.walk',JSON.stringify({dog:'s1',start:Date.now(),events:[]}))}catch(e){}")
    sync(pa)
    for h in TRASY:
        go(pa, h, 800); t = text(pa)
        check(f'administrator {h}: działa', 'Coś poszło nie tak' not in t and len(t.strip()) > 10, t[:120])
    go(pa, '#/pomoc', 800); check('stara potrzeba jako jeden tekst', 'Karma mokra 60 puszek' in text(pa))
    go(pa, '#/dt/p1', 800); check('stary dom tymczasowy: miejscowość jako adres', pa.locator('.kd', has_text='Adres').locator('text=Ryki').count() == 1)
    go(pa, '#/finanse', 800); t = text(pa); check('stare finanse: kategoria i źródło jako opis', 'Licytacja / bazarek' in t and 'Karma' in t)
    go(pa, '#/psy/s1', 900); t = text(pa)
    check('stara karta psa: dawne „tak” w kafelku i wpis zdrowia', pa.locator('.kafel[data-typ=kastracja]', has_text='tak').count() == 1 and 'stary wpis' in t)
    check('stara karta psa: data przyjęcia jako „W schronisku od”', pa.locator('.kd', has_text='W schronisku od').locator('text=lat').count() + pa.locator('.kd', has_text='W schronisku od').locator('text=rok').count() >= 1)
    go(pa, '#/byli', 800); t = text(pa); check('stare adoptowane i archiwum → Byli u nas', 'Mila' in t and 'Kora' in t)
    go(pa, '#/zaginiecia/z1', 800); check('stare zaginięcie: data i aktualizacja', 'widziany' in text(pa) and pa.locator('.kd', has_text='Kiedy').locator('b').inner_text().count('.') == 2)
    cv, pv = newpage(b); login(pv, 'Ola', WOL); sync(pv, 1500)
    for h in ['#/start', '#/psy', '#/byli', '#/psy/s1', '#/psy/s2', '#/pomoc', '#/spacery', '#/zaginiecia', '#/zaginiecia/z1', '#/raport/w1']:
        go(pv, h, 800); t = text(pv)
        check(f'wolontariusz {h}: działa', 'Coś poszło nie tak' not in t and len(t.strip()) > 10, t[:120])
    koniec('stare1')
