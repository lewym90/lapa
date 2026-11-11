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
    pg.evaluate("""async()=>{const s=await import('/js/store.js');await s.save('psy',{id:'m1',imie:'Nimus',plec:'samiec',status:'schronisko',zdjecia:[]});}""")
    pg.evaluate("location.hash='#/zaginiecia'"); pg.wait_for_selector('[data-act=zag-new]'); pg.click('[data-act=zag-new]'); pg.wait_for_selector('#zf')
    pg.select_option('#z_p','m1'); pg.fill('#z_g','Nowodwór'); pg.fill('#z_o','Lubartów'); pg.fill('#z_d','Łagodny, zielona obroża'); pg.click('#zf button[type=submit]'); pg.wait_for_selector('#z_pt'); pg.wait_for_timeout(400)
    t=pg.input_value('#z_pt'); check('post zaginięcia', 'SZUKAMY NIMUS' in t and 'zielona obroża' in t and '601 990 017' in t)
    pg.fill('#z_u','widziany w Wólce'); pg.click('#z_ua'); pg.wait_for_selector('#z_pt'); pg.wait_for_timeout(500)
    check('aktualizacja EDIT na górze', pg.input_value('#z_pt').startswith('EDIT:') and 'widziany w Wólce' in pg.input_value('#z_pt'))
    check('pies oznaczony jako zaginiony', pg.evaluate("import('/js/store.js').then(s=>s.get('psy','m1')).then(d=>d.miejsce)")=='zaginiony')
    pg.screenshot(path='z_sheet.png'); pg.keyboard.press('Escape')
    pg.evaluate("location.hash='#/start'"); pg.wait_for_timeout(700); check('start: alert poszukiwany', 'Poszukiwane psy' in pg.inner_text('#app'))
    pg.evaluate("location.hash='#/zaginiecia'"); pg.wait_for_selector('.gap'); pg.click('[data-act=zag-open]'); pg.wait_for_selector('#z_f'); pg.click('#z_f'); pg.wait_for_timeout(900)
    check('znaleziony: wraca do schroniska', pg.evaluate("import('/js/store.js').then(s=>s.get('psy','m1')).then(d=>d.miejsce)")=='schronisko')
    # finanse
    pg.evaluate("location.hash='#/finanse'"); pg.wait_for_selector('.lockbox'); pg.click('[data-act=unlock-sheet]'); pg.wait_for_selector('#up'); pg.fill('#up','koordynator-haslo-2'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
    pg.evaluate("location.hash='#/start'"); pg.evaluate("location.hash='#/finanse'"); pg.wait_for_selector('[data-act=fin-add]'); pg.click('[data-act=fin-add]'); pg.wait_for_selector('#ff')
    pg.select_option('#f_t','wplata'); pg.fill('#f_k','1250,50'); pg.select_option('#f_z','licytacja'); pg.click('#ff button[type=submit]'); pg.wait_for_timeout(700)
    pg.click('[data-act=fin-add]'); pg.wait_for_selector('#ff'); pg.fill('#f_k','300'); pg.select_option('#f_c','karma'); pg.select_option('#f_p','m1'); pg.click('#ff button[type=submit]'); pg.wait_for_timeout(700)
    pg.evaluate("""async()=>{const s=await import('/js/store.js');await s.save('zdrowie',{pies_id:'m1',typ:'kastracja',data:Date.now(),koszt:450,notatka:''});}"""); pg.evaluate("location.hash='#/start'"); pg.evaluate("location.hash='#/finanse'"); pg.wait_for_selector('.card'); pg.wait_for_timeout(700)
    t=pg.inner_text('#app').replace('\u00a0',' ').replace('\u202f',' '); check('finanse: wpłaty', '1250,50 zł' in t or '1 250,50 zł' in t)
    check('finanse: wydatki z leczeniem (750)', '750,00 zł' in t); check('finanse: saldo 500,50', '500,50 zł' in t); check('finanse: koszt na psa Nimus', 'Nimus' in t)
    pg.screenshot(path='f_fin.png',full_page=True)
    ctx2,pg2=newpage(b,{'width':390,'height':844}); login(pg2,'wolontariusz-haslo-1','Basia'); pg2.wait_for_timeout(2500)
    check('bez hasła brak finansów', pg2.evaluate("""async()=>{const s=await import('/js/store.js');return (await s.list('p_finanse')).length===0&&(await s.list('zaginiecia')).length===1}"""))
    print('WYNIK:',ok,'OK',bad,'FAIL'); print([e for e in errs if '401' not in e[1]][:5])
