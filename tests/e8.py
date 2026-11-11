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
    b=p.chromium.launch(); ctx,pg=newpage(b,{'width':390,'height':844}); login(pg,'wolontariusz-haslo-1','Ania')
    pg.evaluate("""async()=>{const s=await import('/js/store.js');await s.save('psy',{id:'z1',imie:'Adina',plec:'suka',status:'do_adopcji',haslo:'ADINA - w domu tymczasowym',opis:'x',zdjecia:[]});}""")
    go(pg,'#/psy'); pg.wait_for_selector('.dcard'); check('lista: hasło', 'w domu tymczasowym' in pg.inner_text('#app'))
    go(pg,'#/psy/z1'); pg.wait_for_selector('.dogtop'); pg.click('[data-act=dog-ocena]'); pg.wait_for_selector('.sheetx')
    r=pg.evaluate("(()=>{const s=document.querySelector('.sheet').getBoundingClientRect();const x=document.querySelector('.sheetx').getBoundingClientRect();return [s.top,x.top,x.bottom]})()"); print(r)
    check('arkusz poniżej paska stanu', r[0]>=20)
    pg.click('.sheetx'); pg.wait_for_timeout(300); check('X zamyka', pg.locator('.sheet').count()==0)
    pg.screenshot(path='x.png')
    print('WYNIK:',ok,'OK',bad,'FAIL'); print(errs[:5])
