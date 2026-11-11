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
    r=pg.evaluate("""async()=>{const m=await import('/js/screens-psy.js');
      const mk=(h)=>m.dogFromImport({id:'1',name:'X',url:'u',status:'do_adopcji',haslo:h,fields:{},opis:'Lubi ludzi. Nie lubi towarzystwa innych psów.'},{});
      const a=mk('ADINA&nbsp;- w domu tymczasowym&nbsp;🏠'), h=mk('LAREDO - w domowym hoteliku dla psów🏠'), p=mk('X - w procesie adopcji :)'), n=mk('KIRIAN - będziesz ze mnie dumny');
      const back=m.dogFromImport({id:'1',name:'X',url:'u',status:'do_adopcji',haslo:'X - hasło',fields:{}},a);
      const man=m.dogFromImport({id:'1',name:'X',url:'u',status:'do_adopcji',haslo:'X - w domu tymczasowym',fields:{}},{miejsce:'schronisko'});
      return [a.miejsce,a.haslo,h.miejsce,p.status,p.miejsce||'-',n.miejsce||'-',back.miejsce,man.miejsce,a.ocena&&a.ocena.psy]}""")
    print(r)
    check('dt z hasła + czyszczenie', r[0]=='dt' and '&nbsp;' not in r[1]); check('hotelik', r[2]=='hotelik'); check('proces adopcji', r[3]=='w_trakcie' and r[4]=='-'); check('zwykłe hasło bez miejsca', r[5]=='-')
    check('powrót do schroniska', r[6]=='schronisko'); check('ręczne miejsce zostaje', r[7]=='schronisko'); check('ocena psy = nie', r[8]=='nie')
    pg.evaluate("""async()=>{const s=await import('/js/store.js');await s.save('psy',{id:'q1',imie:'Adina',status:'do_adopcji',miejsce:'dt',haslo:'ADINA - w domu tymczasowym',zdjecia:[]});await s.save('psy',{id:'q2',imie:'Burek',status:'do_adopcji',zdjecia:[]});}""")
    go(pg,'#/psy'); pg.wait_for_selector('.dcard'); pg.click('[data-k=dt]'); pg.wait_for_timeout(400)
    check('filtr DT', pg.locator('.dcard').count()==1 and 'Adina' in pg.inner_text('.dogs'))
    pg.click('[data-k=schronisko]'); pg.wait_for_timeout(400); check('filtr schronisko', pg.locator('.dcard').count()==1 and 'Burek' in pg.inner_text('.dogs'))
    go(pg,'#/pomoc'); pg.wait_for_timeout(500); check('brak karty o stronie', 'Otwórz stronę' not in pg.inner_text('#app'))
    print('WYNIK:',ok,'OK',bad,'FAIL'); print(errs[:5])
