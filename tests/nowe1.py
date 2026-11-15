# Nowe psy: karta przyjęcia krok po kroku i ten sam stan wszędzie (lista Psy, filtr, Nowe psy, Start, Dziś i do zrobienia, karta psa).
from playwright.sync_api import sync_playwright
from wspolne import *

with sync_playwright() as p:
    b = p.chromium.launch(); ctx, pg = newpage(b); login(pg, 'Ania')

    # 1. Nowy pies przez dolny „+”
    pg.click('nav.nav [data-act=add]'); pg.click('[data-act=a-newdog]'); pg.wait_for_selector('#n_i')
    pg.fill('#n_i', 'Burek'); pg.select_option('#n_p', 'samiec'); pg.fill('#n_w', 'ok. 2 lata, średni'); pg.click('#nf button[type=submit]')
    pg.wait_for_timeout(900)
    h = pg.evaluate('location.hash'); did = h.split('/')[-1]
    check('po dodaniu otwiera kroki', h.startswith('#/nowe/m'), h)
    t = text(pg); check('1 z 8 (przyjęcie gotowe)', '1 z 8 kroków' in t, t[:200])
    check('brakuje wymaganych', 'Do zakończenia brakuje: charakter, zdjęcia, opis i hasło, ogłoszenie' in t, t[:400])

    def stan_wszedzie(oczek, nazwa):
        go(pg, '#/psy'); pg.click('[data-act=dog-filter][data-k=aktywne]'); pg.wait_for_timeout(400)
        karta = pg.locator('.dcard', has_text='Burek')
        check(nazwa + ': lista Psy', ('Karta przyjęcia: ' + oczek) in karta.inner_text(), karta.inner_text())
        check(nazwa + ': plakietka Nowy', karta.locator('.st .chip', has_text='Nowy').count() == 1)
        pg.click('[data-act=dog-filter][data-k=nowe]'); pg.wait_for_timeout(400)
        check(nazwa + ': filtr Nowe psy', pg.locator('.dcard', has_text='Burek').count() == 1)
        go(pg, '#/nowe'); t = text(pg)
        check(nazwa + ': ekran Nowe psy', ('Burek\n' + oczek) in t, t[:300])
        go(pg, '#/zrobic'); t = text(pg)
        check(nazwa + ': Dziś i do zrobienia', ('Karta przyjęcia: ' + oczek) in t, t[:400])
        check(nazwa + ': bez osobnych przypomnień', 'Brak zdjęć' not in t and 'bez oceny' not in t and 'Gotowy do opublikowania' not in t)
        go(pg, '#/psy/' + did); t = text(pg)
        check(nazwa + ': karta psa', ('Karta przyjęcia: ' + oczek.split(' ')[0] + ' z 8 kroków') in t, t[:600])
        go(pg, '#/start'); t = text(pg)
        check(nazwa + ': Start', 'Nowe psy do uzupełnienia: 1' in t)

    stan_wszedzie('1 z 8', 'start')

    # 2. Charakter: „Pomiń na razie” liczy się jako zrobiony krok wymagany
    go(pg, '#/nowe/' + did); pg.click('[data-act=nw-skip]'); pg.wait_for_timeout(700)
    t = text(pg); check('pominięcie charakteru', '2 z 8 kroków' in t and 'Pominięte na razie' in t, t[:500])
    go(pg, '#/psy/' + did); t = text(pg)
    check('Droga psa: ocena pominięta', 'Ocena: na razie pominięta' in t)
    check('Droga psa: nie każe oceniać', 'Następny krok: ocena' not in t)

    # 3. Opis i hasło przez krok karty
    go(pg, '#/nowe/' + did); pg.click('[data-act=nw-step][data-k=opis]'); pg.wait_for_selector('#o_o')
    pg.fill('#o_h', 'czeka na Ciebie'); pg.fill('#o_o', 'Spokojny pies, lubi spacery i ludzi.'); pg.click('#f7 button[type=submit]'); pg.wait_for_timeout(700)
    t = text(pg); check('opis zapisany', '3 z 8 kroków' in t, t[:300])

    # 4. Zdjęcie (bez aparatu: adres zdjęcia jak przy imporcie)
    pg.evaluate("async(id)=>{const s=await import('/js/store.js');const d=await s.get('psy',id);await s.save('psy',{...d,zdjecia:['https://example.invalid/burek_l.jpg']})}", did); pg.wait_for_timeout(500)
    stan_wszedzie('4 z 8', 'przed ogłoszeniem')

    # 5. Ogłoszenie tylko na Instagramie: krok wymagany zaliczony, karta zamyka się sama
    go(pg, '#/nowe/' + did); pg.click('[data-act=nw-step][data-k=ogloszenie]'); pg.click('#g_k'); pg.wait_for_selector('#kf')
    pg.check('#kf [data-k=ig]'); pg.click('#kf button[type=submit]'); pg.wait_for_timeout(1800)
    d = pg.evaluate("async(id)=>{const s=await import('/js/store.js');return s.get('psy',id)}", did)
    check('karta zamknięta automatycznie', bool(d.get('karta_gotowa')), d)
    go(pg, '#/nowe'); check('zniknął z Nowe psy', 'Burek' not in text(pg))
    check('plakietka menu ukryta', pg.evaluate("[...document.querySelectorAll('.nbadge')].every(e=>e.hidden)"))
    go(pg, '#/psy'); pg.click('[data-act=dog-filter][data-k=aktywne]'); pg.wait_for_timeout(400)
    karta = pg.locator('.dcard', has_text='Burek')
    check('lista: bez „Karta przyjęcia” i bez Nowy', 'Karta przyjęcia' not in karta.inner_text() and karta.locator('.st .chip', has_text='Nowy').count() == 0, karta.inner_text())
    pg.click('[data-act=dog-filter][data-k=nowe]'); pg.wait_for_timeout(400)
    check('filtr Nowe psy pusty', pg.locator('.dcard', has_text='Burek').count() == 0)
    go(pg, '#/zrobic'); t = text(pg)
    check('Dziś: nic o Burku (ocena pominięta, ogłoszony na IG)', 'Burek' not in t, t[:400])
    go(pg, '#/psy/' + did); t = text(pg)
    check('karta psa: kompletna', 'Kompletna. Możesz poprawić każdy krok' in t)
    check('Droga psa: ogłoszony (Instagram)', '✓ Ogłoszony' in t)
    go(pg, '#/start'); check('Start: bez linii nowych psów', 'Nowe psy do uzupełnienia' not in text(pg))

    # 6. Powrót do uzupełniania i ręczne zakończenie
    go(pg, '#/nowe/' + did); pg.click('[data-act=nw-reopen]'); pg.wait_for_timeout(1500)
    go(pg, '#/nowe'); check('po „Wróć do uzupełniania” jest na liście', 'Burek' in text(pg))
    go(pg, '#/nowe/' + did); check('nie zamyka się sam', 'Zakończ uzupełnianie' in text(pg))
    pg.click('[data-act=nw-close]'); pg.wait_for_timeout(800)
    go(pg, '#/nowe'); check('zakończenie ręczne', 'Burek' not in text(pg))

    # 7. Pies, który jeszcze nie wychodzi (zaufanie): bez przypomnień, ale na liście Nowe psy
    go(pg, '#/start'); pg.click('nav.nav [data-act=add]'); pg.click('[data-act=a-newdog]'); pg.wait_for_selector('#n_i')
    pg.fill('#n_i', 'Mila'); pg.select_option('#n_p', 'suka'); pg.fill('#n_w', 'ok. 4 lata'); pg.click('#nf button[type=submit]'); pg.wait_for_timeout(900)
    mid = pg.evaluate('location.hash').split('/')[-1]
    pg.click('[data-act=nw-step][data-k=zaufanie]'); pg.click('#z_t'); pg.wait_for_timeout(800)
    go(pg, '#/nowe'); t = text(pg); check('Mila: zdobywamy zaufanie', 'zdobywamy zaufanie od 0 dni' in t, t[:300])
    go(pg, '#/zrobic'); check('Mila: bez przypomnień', 'Mila' not in text(pg))
    go(pg, '#/psy/' + mid); t = text(pg); check('Mila: karta bez ponaglania', 'Zdobywamy zaufanie od 0 dni' in t and 'Następny krok' not in t)

    # 8. Dwie osoby uzupełniają różne kroki: nikt nikomu nie nadpisuje
    ctx2, pg2 = newpage(b); login(pg2, 'Basia'); sync(pg); sync(pg2)
    go(pg2, '#/nowe/' + mid); pg2.click('[data-act=nw-step][data-k=wyglad]'); pg2.wait_for_selector('#w_k'); pg2.fill('#w_k', '18 kg'); pg2.click('#f5 button[type=submit]'); pg2.wait_for_timeout(500); sync(pg2)
    sync(pg); go(pg, '#/nowe/' + mid); pg.click('[data-act=nw-step][data-k=opis]'); pg.wait_for_selector('#o_o'); pg.fill('#o_o', 'Nieśmiała, ale łagodna.'); pg.click('#f7 button[type=submit]'); pg.wait_for_timeout(500); sync(pg)
    sync(pg2); d = pg2.evaluate("async(id)=>{const s=await import('/js/store.js');return s.get('psy',id)}", mid)
    check('wspólne uzupełnianie: obie zmiany są', d.get('waga') == '18 kg' and d.get('opis') == 'Nieśmiała, ale łagodna.', d)

    koniec('nowe1')
