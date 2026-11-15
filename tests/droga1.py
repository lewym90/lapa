# Droga psa (karta psa) i przypomnienia: te same zasady co karta przyjęcia. Psy ze strony i już ogłoszone: bez zmian.
from playwright.sync_api import sync_playwright
from wspolne import *

DAY = 864e5
with sync_playwright() as p:
    b = p.chromium.launch(); ctx, pg = newpage(b); login(pg, 'Ania')
    now = pg.evaluate('Date.now()')

    def droga(d, walks=[]):
        return pg.evaluate("async([d,w])=>{const t=await import('/js/teczka.js');const r=t.droga(d,w);return {steps:r.steps,trust:r.trust,next:r.next}}", [d, walks])

    def st(r, label):
        return dict((l, s) for l, s in r['steps']).get(label)

    # Pies ze strony schroniska (nie „nowy”): przyjęty, ogłoszony na stronie
    site = {'id': 'd1', 'imie': 'Saba', 'plec': 'suka', 'status': 'do_adopcji', 'kanaly': {'www': now - 30 * DAY, 'fb': now - 30 * DAY}, 'ocena': {'ludzie': 'ok'}, 'opis': 'Opis', 'zdjecia': ['x']}
    r = droga(site)
    check('strona: Przyjęty', st(r, 'Przyjęty') == 'ok')
    check('strona: Ogłoszony', st(r, 'Ogłoszony') == 'ok')
    check('strona: brak następnego kroku', r['next'] is None, r['next'])

    # Instagram też liczy się jako ogłoszenie
    ig = {**site, 'id': 'd2', 'kanaly': {'ig': now}}
    check('Instagram = Ogłoszony', st(droga(ig), 'Ogłoszony') == 'ok')
    check('Instagram: bez kroku „ogłoszenie”', droga(ig)['next'] is None)
    nic = {**site, 'id': 'd3', 'kanaly': {}}
    r = droga(nic); check('bez kanałów: krok ogłoszenie (to samo okno co karta przyjęcia)', r['next'] and r['next']['act'] == 'nw-step' and r['next']['k'] == 'ogloszenie', r['next'])

    # Nowy pies bez płci: przyjęcie niekompletne (tak samo jak w karcie przyjęcia)
    nowy = {'id': 'm1', 'imie': 'Fafik', 'nowy': True, 'plec': '', 'wiek': '2 lata', 'data_przyjecia': now, 'status': 'schronisko', 'miejsce': 'schronisko'}
    r = droga(nowy)
    check('nowy bez płci: Przyjęty niezaliczony', st(r, 'Przyjęty') == '')
    check('nowy bez płci: następny krok przyjęcie', r['next']['k'] == 'przyjecie', r['next'])
    k = pg.evaluate("async(d)=>{const t=await import('/js/teczka.js');return t.kroki(d)[0].done}", nowy)
    check('karta przyjęcia zgodna (krok 1 niezaliczony)', k is False)
    nowy2 = {**nowy, 'plec': 'samiec'}
    r = droga(nowy2); check('nowy z płcią: następny krok pierwszy spacer', 'pierwszy spacer' in r['next']['txt'], r['next'])
    w = [{'pies_id': 'm1', 'start': now, 'end': now + 1}]
    r = droga(nowy2, w); check('po spacerze: ocena', r['next']['act'] == 'dog-ocena', r['next'])
    r = droga({**nowy2, 'pominiete': {'ocena': now}}, w)
    check('ocena pominięta: etykieta', any(l == 'Ocena: na razie pominięta' for l, s in r['steps']))
    check('ocena pominięta: następny krok to zdjęcia', r['next']['act'] == 'dog-photo', r['next'])
    r = droga({**nowy2, 'ocena': {'ludzie': 'ok'}, 'zdjecia': ['x']}, w)
    check('brak opisu: okno opisu z karty przyjęcia', r['next']['k'] == 'opis', r['next'])
    r = droga({**nowy2, 'zaufanie': now}); check('zaufanie: bez kroku i z etapem „teraz”', r['next'] is None and st(r, 'Zaufanie i spacery') == 'now')
    r = droga({**site, 'status': 'w_trakcie'}); check('w procesie adopcji', st(r, 'Adopcja') == 'now')
    r = droga({**site, 'status': 'adoptowany', 'miejsce': 'adoptowany'}); check('adoptowany', st(r, 'Adopcja') == 'ok' and r['next'] is None)

    # Przypomnienia dla psów spoza karty przyjęcia: bez zmian
    gaps = lambda dogs, walks=[]: pg.evaluate("async([d,w])=>{const t=await import('/js/teczka.js');return t.gaps(d,[],w).map(x=>x.d.id+':'+x.kind)}", [dogs, walks])
    g = gaps([{**site, 'id': 'g1', 'kanaly': {'fb': now - 5 * DAY}}, {**site, 'id': 'g2', 'zdjecia': []}, {**site, 'id': 'g3', 'data_przyjecia': now - 200 * DAY, 'miejsce': 'schronisko'}])
    check('stare: FB bez strony', 'g1:www' in g, g)
    check('stare: brak zdjęć', 'g2:foto' in g, g)
    check('stare: zróbmy hałas', 'g3:halas' in g, g)
    # Nowy pies po zamknięciu karty: bez osobnych przypomnień „dla nowych”
    zamk = {**nowy2, 'id': 'g4', 'karta_gotowa': now, 'pominiete': {'ocena': now}, 'zdjecia': ['x'], 'opis': 'o', 'kanaly': {'ig': now}}
    g = gaps([zamk]); check('zamknięta karta: nic', g == [], g)
    g = gaps([{**nowy2, 'id': 'g5'}]); check('karta w toku: jedno przypomnienie', g == ['g5:karta'], g)

    # Karta psa: przycisk „Otwórz” przy następnym kroku otwiera okno z karty przyjęcia
    save(pg, 'psy', {**nowy2, 'id': 'm9', 'imie': 'Kropka', 'ocena': {'ludzie': 'ok'}, 'zdjecia': ['https://example.invalid/k_l.jpg']})
    save(pg, 'spacery', {'id': 'w9', 'pies_id': 'm9', 'start': now, 'end': now + 60000, 'tryb': 'brama'})
    go(pg, '#/psy/m9'); t = text(pg)
    check('karta: następny krok opis', 'Następny krok: opis i hasło do ogłoszenia' in t, t[:800])
    pg.click('.teraz [data-act=nw-step]'); pg.wait_for_selector('#o_o', timeout=4000)
    check('otwiera okno „Opis i hasło”', 'Opis i hasło: Kropka' in text(pg, '.sheet'))

    koniec('droga1')
