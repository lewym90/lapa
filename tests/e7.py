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
    pg.evaluate("""async()=>{const s=await import('/js/store.js');for(const [i,n] of [['a','Adila'],['b','Burek'],['c','Cola']])await s.save('psy',{id:i,imie:n,plec:'samiec',status:'do_adopcji',zdjecia:[]});}""")
    go(pg,'#/brama'); pg.wait_for_selector('[data-act=br-out]')
    check('3 psy do wydania', pg.locator('[data-act=br-out]').count()==3)
    pg.locator('[data-act=br-out]').first.click(); pg.wait_for_timeout(500)
    pg.locator('[data-act=br-out]').first.click(); pg.wait_for_timeout(500)
    pg.click('[data-t=out]'); pg.wait_for_timeout(400)
    check('2 na spacerze', pg.locator('[data-act=br-back]').count()==2)
    pg.locator('[data-act=br-info]').first.click(); pg.wait_for_selector('#bo'); pg.fill('#bo','Marek 600100200'); pg.click('[data-tag=spokojny]'); pg.click('#bf button[type=submit]'); pg.wait_for_timeout(500)
    pg.locator('[data-act=br-back]').first.click(); pg.wait_for_timeout(500)
    check('1 na spacerze', pg.locator('[data-act=br-back]').count()==1)
    pg.click('[data-t=wrocily]'); pg.wait_for_timeout(400); t=pg.inner_text('#app')
    check('wrócił z osobą i tagiem', 'Marek' in t and 'spokojny' in t)
    pg.click('[data-t=wydaj]'); pg.wait_for_timeout(400)
    check('wydaj: ten co wrócił ma 1x', 'dziś był już 1x' in pg.inner_text('#app'))
    pg.screenshot(path='b_brama.png'); pg.click('[data-act=br-sum]'); pg.wait_for_selector('#bt'); check('post', 'Dziś' in pg.input_value('#bt') or 'DZIĘKUJEMY' in pg.input_value('#bt')); pg.keyboard.press('Escape')
    go(pg,'#/psy/a'); pg.wait_for_selector('.dogtop'); check('karta: historia spacerów', 'spacer' in pg.inner_text('#app'))
    go(pg,'#/start'); pg.wait_for_timeout(600); check('start: kafel Brama', 'Brama' in pg.inner_text('#app'))
    go(pg,'#/brama'); pg.click('[data-t=wydaj]'); pg.wait_for_selector('[data-act=br-out]'); pg.locator('[data-act=br-out]').first.click(); pg.wait_for_timeout(400); pg.click('[data-t=out]'); pg.wait_for_timeout(300)
    check('godzina HH:MM', pg.evaluate("/\\d{2}:\\d{2}/.test(document.querySelector('#bl').innerText) && !/\\d{4,}:/.test(document.querySelector('#bl').innerText)"))
    pg.locator('[data-act=br-info]').first.click(); pg.wait_for_selector('#bdel'); pg.click('#bdel'); pg.wait_for_selector('[data-yes]'); pg.click('[data-yes]'); pg.wait_for_timeout(500)
    check('usunięto wpis z Bramy', pg.locator('[data-act=br-back]').count()==1)
    pg.click('[data-t=wrocily]'); pg.wait_for_timeout(300)
    wid=pg.evaluate("import('/js/store.js').then(s=>s.list('spacery')).then(l=>l.find(w=>w.end).id)")
    go(pg,'#/raport/'+wid); pg.wait_for_selector('[data-act=rep-del]'); pg.click('[data-act=rep-del]'); pg.wait_for_selector('[data-yes]'); pg.click('[data-yes]'); pg.wait_for_timeout(600)
    check('usunięto spacer z raportu', pg.evaluate("import('/js/store.js').then(s=>s.get('spacery','"+wid+"'))")is None)
    print('WYNIK:',ok,'OK',bad,'FAIL'); print(errs[:5])
