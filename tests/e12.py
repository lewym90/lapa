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
    pg.evaluate("""async()=>{const s=await import('/js/store.js');await s.save('moje_zadania',{id:'old1',tytul:'Zawieźć Alfa do weta',termin:Date.now()+86400e3});await s.save('wydarzenia',{id:'oldev',tytul:'Stary wspólny',start:Date.now()+2*86400e3,autor:'Michał'});await s.save('psy',{id:'d1',imie:'Alf',status:'do_adopcji',zdjecia:[]});}""")
    go(pg,'#/wydarzenia'); pg.wait_for_selector('[data-act=tm-tab]'); pg.wait_for_timeout(800)
    t=pg.inner_text('#app'); check('zakładka sobotnie spacery domyślnie', 'Zwykle sobota 9:00' in t)
    check('10 terminów (min. miesiąc)', pg.locator('[data-act=sb-edit]').count()>=10)
    pg.locator('[data-act=sb-edit]').first.click(); pg.wait_for_selector('#sd'); pg.select_option('#ss','odwolany'); pg.fill('#sp','mróz'); pg.click('#sf button[type=submit]'); pg.wait_for_timeout(700)
    t=pg.inner_text('#app'); check('odwołany z powodem', 'ODWOŁANY' in t and 'mróz' in t)
    pg.locator('[data-act=sb-edit]').nth(1).click(); pg.wait_for_selector('#sd'); d=pg.input_value('#sd'); import datetime as dt; nd=(dt.date.fromisoformat(d)-dt.timedelta(days=1)).isoformat(); pg.fill('#sd',nd); pg.click('#sf button[type=submit]'); pg.wait_for_timeout(700)
    check('przesunięty z soboty', 'przesunięty z' in pg.inner_text('#app'))
    pg.click('[data-act=sb-extra]'); pg.wait_for_selector('#sd'); pg.fill('#sd','2026-12-24'); pg.click('#sf button[type=submit]'); pg.wait_for_timeout(700)
    check('dodatkowy termin', 'dodatkowy termin' in pg.inner_text('#app'))
    pg.click('[data-t=ter]'); pg.wait_for_timeout(800); t=pg.inner_text('#app')
    check('migracja: zadanie i wydarzenie', 'Zawieźć Alfa' in t and 'Stary wspólny' in t)
    pg.click('[data-act=tm-new]'); pg.wait_for_selector('#tt'); pg.fill('#tt','Lek dla Alfa 8:00'); pg.fill('#td', dt.date.today().isoformat()); pg.fill('#th','08:00'); pg.select_option('#tw','ja'); pg.select_option('#tp','1d'); pg.fill('#tl','rano\nwieczór'); pg.fill('#tpy','Alf'); pg.click('#tf button[type=submit]'); pg.wait_for_timeout(800)
    t=pg.inner_text('#app'); check('wpis prywatny, codziennie', 'Lek dla Alfa 8:00' in t and 'Codziennie' in t and 'tylko ja' in t)
    n=pg.locator('.ev:has-text("Lek dla Alfa")').count(); check('powtarzanie: wiele dni', n>=30); print('wystąpień',n)
    pg.locator('[data-act=tm-open][data-id]').filter(has_text='Lek dla Alfa').first.click(); pg.wait_for_selector('#tme'); pg.click('#tmx'); pg.wait_for_selector('[data-yes]'); pg.click('[data-yes]'); pg.wait_for_timeout(800)
    check('usunięty', pg.locator('.ev:has-text("Lek dla Alfa")').count()==0)
    ctx2,p2=newpage(b,{'width':390,'height':900}); login(p2,'wolontariusz-haslo-1','Michał'); go(p2,'#/wydarzenia'); p2.wait_for_selector('[data-act=tm-tab]'); p2.click('[data-t=ter]'); p2.wait_for_timeout(2500); go(p2,'#/wydarzenia'); p2.click('[data-t=ter]'); p2.wait_for_timeout(800)
    t=p2.inner_text('#app'); check('Michał widzi wspólny, nie widzi prywatnych Ani', 'Stary wspólny' in t and 'Zawieźć Alfa' not in t)
    # Dziś komunikat
    pg.evaluate("async()=>{const s=await import('/js/store.js');await s.save('terminarz',{id:'dz1',tytul:'Adopcja o 17:00',start:new Date(new Date().toDateString()+' 17:00').getTime(),widocznosc:'wszyscy',owner:'Ania',autor:'Ania'});}")
    r=pg.evaluate("async()=>{const m=await import('/js/terminarz.js');const d=await m.dzisItems();return [d.items.length,m.dzisCount(d)]}"); check('dzisItems widzi dzisiejszy wpis', r[0]>=1)
    go(pg,'#/zadania'); pg.wait_for_timeout(700); check('Tylko ja filtr', 'Wpisy, które widzisz tylko Ty' in pg.inner_text('#app'))
    go(pg,'#/start'); pg.wait_for_timeout(900); check('Start: Dziś w terminarzu', 'Dziś w terminarzu' in pg.inner_text('#app'))
    go(pg,'#/zrobic'); pg.wait_for_timeout(700); check('Dziś i do zrobienia', 'Dziś w terminarzu' in pg.inner_text('#app'))
    pg.screenshot(path='t_zrobic.png')
    print('WYNIK:',ok,'OK',bad,'FAIL'); print(errs[:5])
