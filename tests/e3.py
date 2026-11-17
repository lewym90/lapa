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
    ctx,pg=newpage(b,{'width':390,'height':844}); login(pg,'administrator-haslo-3','Ania')
    # 1.18: pies ze strony, wpis zdrowia z minionym terminem → „Dziś i do zrobienia” i licznik na Starcie
    pg.evaluate("""async()=>{const s=await import('/js/store.js');await s.save('psy',{id:'d7',imie:'Burek',plec:'samiec',status:'do_adopcji',miejsce:'schronisko',zdjecia:[],zrodlo_id:'7'});}""")
    go(pg,'#/psy/d7'); pg.wait_for_selector('.kafel[data-typ=szczepienie]'); pg.click('.kafel[data-typ=szczepienie]'); pg.wait_for_selector('#kz_d')
    pg.fill('#kz_d','01.10.2026'); pg.fill('#kz_x','05.11.2026'); pg.fill('#kz_k','80,50'); pg.click('#kzf button[type=submit]'); pg.wait_for_timeout(700)
    check('zdrowie: wpis i koszt', '80,50 zł' in pg.inner_text('#app'))
    pg.evaluate("location.hash='#/start'"); pg.wait_for_selector('.card.dzis'); pg.wait_for_timeout(500)
    t=pg.inner_text('.card.dzis')
    check('Start „Dziś”: zaległy zabieg', 'termin minął' in t and 'Burek' in t and pg.locator('.dzw.pilne', has_text='Burek').count()==1)
    # wydarzenia bez zapisów
    pg.evaluate("location.hash='#/spacery'"); pg.wait_for_selector('.ev.walk'); pg.wait_for_timeout(400)
    t=pg.inner_text('#app'); check('wydarzenia: brak zapisów', 'Zgłoś udział' not in t and 'zapisał' not in t and 'Sobotnie spacery' in t)
    check('sobotnie: bez przycisku „Post”', pg.locator('[data-act=walk-post]').count()==0)
    pg.screenshot(path='n_wyd.png',full_page=True)
    # druga osoba widzi zdrowie i psa
    ctx2,pg2=newpage(b,{'width':390,'height':844}); login(pg2,'administrator-haslo-3','Basia'); pg2.wait_for_timeout(2500)
    check('sync: druga osoba widzi nowego psa i zdrowie', pg2.evaluate("""async()=>{const s=await import('/js/store.js');return (await s.list('psy')).some(x=>x.imie==='Burek')&&(await s.list('zdrowie')).length===1}"""))
    ctx3,pg3=newpage(b,{'width':1280,'height':800}); login(pg3,'administrator-haslo-3','Cezary'); pg3.wait_for_timeout(2000); pg3.evaluate("location.hash='#/start'"); pg3.wait_for_selector('.card.dzis')
    print('WYNIK:',ok,'OK',bad,'FAIL'); print([e for e in errs if '401' not in e[1]][:5])
