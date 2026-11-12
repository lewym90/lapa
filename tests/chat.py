exec(open('e13.py').read().split("with sync_playwright()")[0])
from PIL import Image
import io
Image.new('RGB',(320,240),(200,120,60)).save('/tmp/foto.jpg','JPEG')
def prep(ctx): ctx.add_init_script("try{localStorage.setItem('lapa.push.asked','1')}catch(e){}")
def say(pg, text, mode='send'):
    pg.fill('#c-in', text); pg.click('[data-act=c-send]'); pg.wait_for_timeout(300)
def msgs(pg): return pg.inner_text('#c-msgs')
with sync_playwright() as p:
    b=p.chromium.launch()
    ca,A=newpage(b,{'width':390,'height':844}); prep(ca); login(A,'wolontariusz-haslo-1','Ania')
    cb,B=newpage(b,{'width':390,'height':844}); prep(cb); login(B,'wolontariusz-haslo-1','Basia')
    A.evaluate("""async()=>{const s=await import('/js/store.js');await s.save('psy',{id:'dk1',imie:'Ares',plec:'samiec',wiek:'3 lata',status:'zwykly',miejsce:'schronisko',opis:'Łagodny pies, lubi spacery.'});}""")
    go(A,'#/czat'); A.wait_for_selector('#c-in')
    t=A.inner_text('.cnote'); check('informacja o braku szyfrowania', 'nie są szyfrowane' in t and 'Jak to działa' in t)
    check('pusty czat', 'Czat jest pusty' in msgs(A))
    # 1. wiadomość Ani -> Basia widzi licznik i baner, bez odświeżania
    go(B,'#/start'); B.wait_for_timeout(800)
    say(A,'Kto jutro zawiezie Ares do weta o 18?')
    check('wysłana widoczna u autora', 'zawiezie Ares' in msgs(A))
    t0=time.time()
    B.wait_for_selector('.cbanner', timeout=6000); dt=time.time()-t0
    check(f'baner u Basi w {dt:.1f}s (natychmiast)', dt<4 and 'Ania' in B.inner_text('.cbanner'))
    B.wait_for_timeout(400); bd=B.locator('.topbar .cbadge'); check('licznik na ikonie czatu = 1', bd.count()>0 and bd.first.inner_text()=='1' and bd.first.is_visible())
    B.click('.cbanner'); B.wait_for_selector('#c-in'); B.wait_for_timeout(600)
    check('Basia widzi wiadomość Ani z podpisem', 'Ania' in msgs(B) and 'zawiezie Ares' in msgs(B))
    go(B,'#/start'); B.wait_for_timeout(500); check('licznik zniknął po przeczytaniu', not B.locator('.topbar .cbadge').first.is_visible())
    go(B,'#/czat'); B.wait_for_selector('#c-in')
    # 2. reakcja
    B.click('.cb >> nth=0'); B.wait_for_selector('.remoji'); B.click('.remoji [data-e=up]'); B.wait_for_timeout(1500)
    A.wait_for_timeout(2500); check('Ania widzi reakcję 👍 1', '👍 1' in msgs(A))
    # 3. odpowiedź
    B.click('.cb >> nth=0'); B.click('[data-a=re]'); B.wait_for_selector('.cchip'); say(B,'Mogę ja, ale dopiero po 19')
    A.wait_for_timeout(2500); check('Ania widzi cytat w odpowiedzi', 'Mogę ja' in msgs(A) and A.locator('.cq').count()==1 and 'Kto jutro' in A.inner_text('.cq'))
    # 4. prośba o pomoc
    A.click('[data-act=c-attach]'); A.wait_for_selector('#o_pro'); A.check('#o_pro'); A.click('#o_pil'); A.click('.sheet [data-sheet-close]'); A.wait_for_timeout(300)
    check('chipy prośby i pilne', 'Prośba o pomoc' in A.inner_text('#c-chips') and 'Pilne' in A.inner_text('#c-chips'))
    say(A,'Potrzebny kierowca w sobotę rano')
    B.wait_for_timeout(2500); B.wait_for_selector('.cpro'); check('prośba u Basi z przyciskiem', 'Nikt jeszcze' in B.inner_text('.cpro') and B.locator('[data-act=c-join]').count()==1)
    B.click('[data-act=c-join]'); B.wait_for_timeout(1200); A.wait_for_timeout(2500)
    check('Ania widzi, kto się zgłosił', 'Zgłosili się: Basia' in A.inner_text('.cpro'))
    A.click('[data-act=c-done]'); A.wait_for_timeout(800); check('oznaczone jako załatwione', 'załatwione' in msgs(A))
    # 5. załącznik: pies
    A.click('[data-act=c-attach]'); A.click('.row[data-t=pies]'); A.wait_for_selector('[data-pick]'); A.click('[data-pick=dk1]'); A.wait_for_timeout(300)
    check('chip psa', 'Ares' in A.inner_text('#c-chips')); say(A,'Ten pies jedzie do weta')
    B.wait_for_timeout(2500); check('Basia widzi załącznik z psem', B.locator('.cref', has_text='Ares').count()>=1)
    B.click('.cref'); B.wait_for_selector('[data-go]'); check('podgląd karty psa w czacie', 'Ares' in B.inner_text('.sheet') and 'Łagodny pies' in B.inner_text('.sheet'))
    B.click('[data-go]'); B.wait_for_timeout(600); check('przejście do pełnej karty', B.evaluate('location.hash')=='#/psy/dk1')
    go(B,'#/czat'); B.wait_for_selector('#c-in')
    # 6. wzmianka
    B.fill('#c-in','Dzięki @An'); B.dispatch_event('#c-in','input'); B.wait_for_selector('#c-sug .pick', timeout=4000); B.click('#c-sug .pick'); check('wzmianka wstawiona', B.input_value('#c-in').startswith('Dzięki @Ania '))
    B.click('[data-act=c-send]'); A.wait_for_timeout(2500); check('wzmianka podświetlona u Ani', A.locator('.mn.me').count()==1)
    # 7. zdjęcie
    A.click('[data-act=c-attach]'); A.wait_for_selector('#c-file',state='attached'); A.set_input_files('#c-file','/tmp/foto.jpg'); A.wait_for_timeout(900); check('chip zdjęcia', 'Zdjęcie' in A.inner_text('#c-chips'))
    A.click('[data-act=c-send]'); A.wait_for_timeout(1500); check('zdjęcie widoczne u autora', A.locator('.cfoto').count()==1 and (A.get_attribute('.cfoto','src') or '').startswith('blob:'))
    B.wait_for_timeout(4000); check('zdjęcie widoczne u Basi', B.locator('.cfoto').count()==1 and (B.get_attribute('.cfoto','src') or '').startswith('blob:'))
    # 8. edycja i usunięcie
    A.click('.cb.me >> nth=0'); A.wait_for_selector('[data-a=edit]'); A.click('[data-a=edit]'); A.wait_for_timeout(200); check('tryb edycji', A.input_value('#c-in').startswith('Kto jutro'))
    A.fill('#c-in','Kto jutro zawiezie Ares do weta o 17?'); A.click('[data-act=c-send]'); B.wait_for_timeout(2800)
    check('edycja widoczna u Basi z adnotacją', 'o 17?' in msgs(B) and 'edytowano' in msgs(B))
    B.click('.cb:not(.me) >> nth=0'); B.wait_for_timeout(300); check('Basia nie ma „Edytuj” cudzej wiadomości', B.locator('[data-a=edit]').count()==0 and B.locator('[data-a=del]').count()==0); B.keyboard.press('Escape'); B.evaluate("document.querySelector('#sheet-root .scrim')?.click()")
    A.click('.cb.me >> nth=0'); A.click('[data-a=del]'); A.click('[data-yes]'); B.wait_for_timeout(3000); check('usunięta znika u wszystkich', 'o 17?' not in msgs(B) and 'o 17?' not in msgs(A))
    # 9. przypięcie i szukanie
    A.click('.cb >> nth=1'); A.click('[data-a=pin]'); A.wait_for_timeout(800); check('baner przypiętej', 'Przypięte' in A.inner_text('#c-pin'))
    A.screenshot(path='chat_a.png'); B.screenshot(path='chat_b.png')
    A.click('[data-act=c-search]'); A.fill('#c-q','kierowca'); A.wait_for_timeout(400); check('wyszukiwanie', 'Znaleziono: 1' in A.inner_text('#c-scount') and A.locator('.cb').count()==1)
    A.fill('#c-q',''); A.click('[data-act=c-search]')
    # 10. informacja
    A.click('.topbar [data-act=c-info]'); A.wait_for_selector('.infotxt'); t=A.inner_text('.infotxt'); check('opis: szyfrowanie, przechowywanie, ostrożność', 'nie są szyfrowane' in t and '30 dni' in t and 'zachowaj ostrożność' in t); A.click('.sheet [data-sheet-close]')
    # 11. wyczyść u siebie
    A.click('.topbar [data-act=c-info]'); A.click('[data-a=clear]'); A.click('[data-yes]'); A.wait_for_timeout(600); check('wyczyszczone tylko u Ani', 'Czat jest pusty' in msgs(A) and 'Mogę ja' in B.evaluate("document.querySelector('#c-msgs').innerText") )
    print('BŁĘDY KONSOLI:',[e for e in errs if 'status of 500' not in e[1]])
    b.close()
print(f'WYNIK: {ok} OK {bad} FAIL')
