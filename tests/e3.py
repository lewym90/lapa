import json, time, datetime, urllib.request
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8000/?api=http://127.0.0.1:18999'; API='http://127.0.0.1:18999'
errs=[]; ok=0; bad=0
def check(name, cond):
    global ok,bad
    if cond: ok+=1; print('OK   ',name)
    else: bad+=1; print('FAIL ',name)
def newpage(b, vp):
    ctx=b.new_context(viewport=vp, device_scale_factor=2 if vp['width']<600 else 1, locale='pl-PL', timezone_id='Europe/Warsaw'); pg=ctx.new_page()
    pg.on('console', lambda m: errs.append((m.type,m.text)) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append(('pageerror',str(e)))); return ctx,pg
def login(pg, pw, name):
    pg.goto(BASE); pg.wait_for_selector('#lf'); pg.fill('#pw',pw); pg.click('#lb'); pg.wait_for_selector('#nf'); pg.fill('#nm',name); pg.click('#nf button[type=submit]')
    pg.wait_for_selector('text=Wchodzę'); pg.click('text=Wchodzę'); pg.wait_for_selector('.hello')
def go(pg, h): pg.evaluate(f"location.hash='{h}'"); pg.wait_for_timeout(500)
def srv(path, tok):
    req=urllib.request.Request(API+path, headers={'authorization':'Bearer '+tok})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')

with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg=newpage(b,{'width':390,'height':844}); login(pg,'wolontariusz-haslo-1','Ania')
    # nowy pies przez menu +
    pg.click('.nav .plus'); pg.wait_for_selector('text=Nowy pies w schronisku'); pg.click('text=Nowy pies w schronisku')
    pg.fill('#n_i','Burek'); pg.select_option('#n_p','samiec'); pg.fill('#n_w','ok. 2 lata, średni'); pg.click('#nf button[type=submit]')
    pg.wait_for_selector('h1:has-text("Burek")'); pg.wait_for_timeout(500)
    check('nowy pies: karta', pg.locator('.steps').count()==1)
    check('nowy pies: etapy', 'Ocena' in pg.inner_text('.steps'))
    pg.screenshot(path='n_karta.png',full_page=True)
    # ocena -> opis
    pg.click('[data-act=dog-ocena]'); pg.wait_for_selector('#of'); pg.select_option('#o_ludzie','ok'); pg.select_option('#o_psy','ostroznie'); pg.select_option('#o_smycz','ok'); pg.fill('#o_lek','boi się hałasu'); pg.click('#of button[type=submit]'); pg.wait_for_timeout(700)
    check('ocena zapisana w opisie', 'Lubi kontakt z człowiekiem' in pg.inner_text('.desc') and 'boi się hałasu' in pg.inner_text('.desc'))
    # zdrowie z przeterminowanym terminem
    pg.click('[data-act=dog-zdrowie]'); pg.wait_for_selector('#zf'); pg.select_option('#z_t','szczepienie'); pg.fill('#z_d','2026-10-01'); pg.fill('#z_n','2026-11-05'); pg.fill('#z_k','80,50'); pg.click('#zf button[type=submit]'); pg.wait_for_timeout(900)
    check('zdrowie: wpis i koszt', '80,50' in pg.inner_text('.sheet'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # kanaly: tylko FB (z datą sprzed 3 dni)
    pg.evaluate("""async()=>{const s=await import('/js/store.js');const d=await s.get('psy',(location.hash.split('/')[2]));d.kanaly={fb:Date.now()-3*86400000};await s.save('psy',d);}""")
    # Do zrobienia
    pg.evaluate("location.hash='#/zrobic'"); pg.wait_for_selector('.gap'); pg.wait_for_timeout(500)
    t=pg.inner_text('#app')
    check('zaległość: zdrowie', 'termin minął' in t)
    check('zaległość: FB bez strony', 'nie ma na stronie' in t)
    check('zaległość: brak zdjęć', 'Brak zdjęć' in t)
    pg.screenshot(path='n_zrobic.png',full_page=True)
    pg.evaluate("location.hash='#/start'"); pg.wait_for_selector('.tile'); pg.wait_for_timeout(500)
    check('start: kafel Do zrobienia z licznikiem', 'Do zrobienia' in pg.inner_text('.tiles') and pg.locator('.tile .badge').count()>=1)
    pg.screenshot(path='n_start.png')
    # teksty
    pg.evaluate("location.hash='#/psy'"); pg.wait_for_selector('.dcard'); pg.click('.dcard'); pg.wait_for_selector('[data-act=dog-teksty]'); pg.click('[data-act=dog-teksty]'); pg.wait_for_selector('#t_t')
    pg.fill('#t_h','szuka swojego człowieka'); pg.wait_for_timeout(200)
    check('tekst: post zawiera imię i hasło', 'BUREK - szuka swojego człowieka' in pg.input_value('#t_t'))
    pg.select_option('#t_w','halas'); pg.wait_for_timeout(200)
    check('tekst: zróbmy hałas', 'ZRÓBMY HAŁAS wokół BUREK' in pg.input_value('#t_t'))
    check('tekst: link WhatsApp', 'wa.me' in pg.get_attribute('#t_wa','href'))
    pg.screenshot(path='n_teksty.png'); pg.keyboard.press('Escape')
    # wydarzenia bez zapisów
    pg.evaluate("location.hash='#/wydarzenia'"); pg.wait_for_selector('.ev.walk'); pg.wait_for_timeout(400)
    t=pg.inner_text('#app'); check('wydarzenia: brak zapisów', 'Zgłoś udział' not in t and 'zapisał' not in t and 'Otwarty dla wszystkich' in t)
    pg.click('[data-act=walk-post]'); pg.wait_for_selector('#wt'); check('post o spacerze', 'PSYpominamy' in pg.input_value('#wt')); pg.keyboard.press('Escape')
    pg.screenshot(path='n_wyd.png',full_page=True)
    # import łączy po imieniu
    pg.evaluate("""async()=>{const s=await import('/js/store.js');const P=await import('/js/screens-psy.js');
      const old=(await s.list('psy')).find(x=>x.imie==='Burek');
      const d=P.dogFromImport({id:'9999',name:'Burek',fields:{},status:'do_adopcji',opis:'',zdjecia:[],url:'https://www.schronisko-nowodwor.com.pl/psy-do-adopcji/burek/9999'},old);
      window.__m=d;}""")
    check('import: zachowuje id i kanał www', pg.evaluate("window.__m.id.startsWith('m') && !!window.__m.kanaly.www && !!window.__m.kanaly.fb && window.__m.nowy===true"))
    # druga osoba widzi zdrowie i psa
    ctx2,pg2=newpage(b,{'width':390,'height':844}); login(pg2,'wolontariusz-haslo-1','Basia'); pg2.wait_for_timeout(2500)
    check('sync: druga osoba widzi nowego psa i zdrowie', pg2.evaluate("""async()=>{const s=await import('/js/store.js');return (await s.list('psy')).some(x=>x.imie==='Burek')&&(await s.list('zdrowie')).length===1}"""))
    ctx3,pg3=newpage(b,{'width':1280,'height':800}); login(pg3,'wolontariusz-haslo-1','Cezary'); pg3.wait_for_timeout(2000); pg3.evaluate("location.hash='#/zrobic'"); pg3.wait_for_selector('.gap'); pg3.screenshot(path='n_desktop_zrobic.png')
    print('WYNIK:',ok,'OK',bad,'FAIL'); print([e for e in errs if '401' not in e[1]][:5])
