# 1.19.2: przepływy z audytu: potrzeba, transport, prywatny wpis na Starcie, zgłoszenia wolontariusza, „Już mamy”, dokument, panel boczny.
import sys; pass
from playwright.sync_api import sync_playwright
from wspolne import *
def g(P,c,i): return P.evaluate("async([c,i])=>(await (await import('/js/store.js')).get(c,i))",[c,i])
def L(P,c): return P.evaluate("async(c)=>(await (await import('/js/store.js')).list(c))",c)
with sync_playwright() as p:
    b=p.chromium.launch(); ca,pa=newpage(b); login(pa,'Ania')
    save(pa,'psy',{'id':'d1','imie':'Saba','plec':'suka','status':'do_adopcji','miejsce':'schronisko','zdjecia':[]})
    # potrzeba
    go(pa,'#/pomoc',700); pa.click('[data-act=a-need]'); pa.wait_for_selector('#nn'); pa.fill('#nn','Brit hipoalergiczny 5 kg'); pa.check('#npi'); pa.click('#nf3 button[type=submit]'); pa.wait_for_timeout(600)
    check('potrzeba dodana, pilna', 'Brit hipoalergiczny 5 kg' in text(pa) and pa.locator('.need', has_text='Brit').locator('text=Pilne').count()==1)
    # transport
    pa.click('[data-act=a-trans]'); pa.wait_for_selector('[data-pick=d1]'); pa.click('[data-pick=d1]'); pa.wait_for_selector('#tdk'); pa.fill('#tdk','Lublin'); pa.fill('#tk','2026-12-01T10:00'); pa.click('#tf2 button[type=submit]'); pa.wait_for_timeout(800)
    check('transport dodany, zostaje na Pomocy', pa.evaluate('location.hash')=='#/pomoc' and 'Lublin' in text(pa))
    pa.click('[data-act=tr-open]'); pa.wait_for_selector('#tb'); pa.click('#tb [data-s=przypisany]'); pa.wait_for_timeout(600)
    check('Jadę sam: przypisany', L(pa,'transporty')[0]['status']=='przypisany')
    # terminarz wpis tylko dla mnie na dziś
    go(pa,'#/terminarz',700); pa.click('[data-act=tm-new]'); pa.wait_for_selector('#tt'); pa.fill('#tt','Lek dla Saby')
    import datetime; dzis=datetime.date.today().isoformat(); pa.fill('#td',dzis); pa.fill('#th','23:30'); pa.select_option('#tw','ja')
    pa.click('#sheet-root button[type=submit]'); pa.wait_for_timeout(700)
    go(pa,'#/start',800); check('Start Dziś: prywatny wpis z terminarza', pa.locator('.dzw', has_text='Lek dla Saby').count()==1)
    # wolontariusz: przywiozę + będę
    sync(pa); cv,pv=newpage(b); login(pv,'Ola',WOL); sync(pv,1500)
    go(pv,'#/pomoc',700); pv.locator('.need', has_text='Brit').locator('[data-act=of-potrzeba]').click(); pv.wait_for_selector('#zw'); pv.fill('#zw_t','600 111 222'); pv.click('#zw button[type=submit]'); pv.wait_for_timeout(700)
    check('wolontariusz: Przywiozę', 'Przywiozą: Ola' in text(pv))
    go(pv,'#/spacery',700); pv.locator('[data-act=sob-bede]').first.click(); pv.wait_for_selector('#zw'); pv.click('#zw button[type=submit]'); pv.wait_for_timeout(700)
    go(pv,'#/start',800); check('Start wolontariusza: będziesz ✓', 'będziesz ✓' in text(pv))
    sync(pv,1500); sync(pa,1500); go(pa,'#/start',800)
    check('Start admina: nowe zgłoszenia', pa.locator('.dzw[href="#/zgloszenia"]').count()==1)
    go(pa,'#/pomoc',800); pa.click('.needh:has-text("Brit")'); pa.wait_for_selector('#nd'); pa.click('#nd'); pa.wait_for_timeout(700)
    check('Już mamy: potrzeba znika z Pomocy', 'Brit' not in text(pa))
    # dokument: dodaj i usuń
    from PIL import Image; Image.new('RGB', (300, 200), (200, 180, 150)).save('/tmp/dok-funk.jpg')
    go(pa,'#/psy/d1',900); pa.set_input_files('[data-kdok]',['/tmp/dok-funk.jpg']); pa.wait_for_timeout(2000)
    pa.click('.kdokp'); pa.wait_for_selector('#kd_x'); pa.click('#kd_x'); pa.wait_for_selector('[data-yes]'); pa.click('[data-yes]'); pa.wait_for_timeout(700)
    check('dokument usunięty', (g(pa,'psy','d1').get('dokumenty') or [])==[])
    # desktop: panel boczny bez powtórzeń
    cd,pd=newpage(b,{'width':1366,'height':860}); login(pd,'Ania'); go(pd,'#/start',700)
    hrefs=pd.locator('aside.side a.sl').evaluate_all('(e)=>e.map(x=>x.getAttribute("href"))')
    check('desktop: panel boczny bez powtórzeń', len(hrefs)==len(set(hrefs)) and '#/brama' in hrefs and '#/czat' in hrefs, hrefs)
    check('desktop: brak ikony czatu w nagłówku (jest w panelu)', not pd.locator('.topbar a[href="#/czat"]').first.is_visible())
    koniec('funk')
