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
    b=p.chromium.launch(); ctx,pg=newpage(b,{'width':390,'height':900}); login(pg,'wolontariusz-haslo-1','Ania')
    pg.evaluate("""async()=>{const s=await import('/js/store.js');const d=await import('/js/db.js');await s.save('terminarz',{id:'dz1',tytul:'Adopcja o 17:00',start:new Date(new Date().toDateString()+' 17:00').getTime(),widocznosc:'wszyscy',owner:'Ania',autor:'Ania'});await s.save('terminarz',{id:'dz2',tytul:'Lek Alf',start:Date.now()-2*864e5,widocznosc:'ja',owner:'Ania',autor:'Ania',zadanie:true});await d.metaSet('poranny',null);}""")
    pg.reload(); pg.wait_for_timeout(500)
    try:
        pg.wait_for_selector('.sheet h2', timeout=9000); t=pg.inner_text('.sheet'); print(t[:300]); check('poranny komunikat', 'Adopcja o 17:00' in t and 'Zaległe (1)' in t)
    except Exception as e: check('poranny komunikat', False)
    pg.click('.sheet [data-sheet-close].btn'); pg.wait_for_timeout(300); pg.reload(); pg.wait_for_timeout(5000); check('tylko raz dziennie', pg.locator('.sheet').count()==0)
    go(pg,'#/wydarzenia'); pg.wait_for_timeout(900); pg.screenshot(path='t_sob.png'); pg.click('[data-t=ter]'); pg.wait_for_timeout(700); pg.screenshot(path='t_ter.png')
    pg.click('[data-act=tm-new]'); pg.wait_for_selector('#tt'); pg.screenshot(path='t_form.png')
    print('WYNIK:',ok,'OK',bad,'FAIL'); print(errs[:5])
