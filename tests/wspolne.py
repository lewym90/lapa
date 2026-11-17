# Wspólne funkcje testów Playwright (nowe1.py, droga1.py, spojnosc1.py, teksty1.py, social1.py).
# Wymaga: serwer API na 18999 (tests/restart_api.sh, czysta baza) i statyczny na 8000 (python3 -m http.server 8000 w katalogu repo).
import json, urllib.request
BASE = 'http://127.0.0.1:8000/?api=http://127.0.0.1:18999'
API = 'http://127.0.0.1:18999'
WOL = 'wolontariusz-haslo-1'
ADM = 'administrator-haslo-3'
errs = []
wynik = {'ok': 0, 'bad': 0}


def check(name, cond, info=''):
    if cond:
        wynik['ok'] += 1; print('OK   ', name)
    else:
        wynik['bad'] += 1; print('FAIL ', name, info)


def newpage(b, vp={'width': 390, 'height': 900}):
    ctx = b.new_context(viewport=vp, device_scale_factor=2 if vp['width'] < 600 else 1, locale='pl-PL', timezone_id='Europe/Warsaw')
    # bez okna o powiadomieniach (osobny test pushui.py)
    ctx.add_init_script("try{localStorage.setItem('lapa.push.asked','1')}catch(e){}")
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append((m.type, m.text)) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append(('pageerror', str(e))))
    return ctx, pg


def login(pg, name, pw=ADM):
    pg.goto(BASE); pg.wait_for_selector('#lf'); pg.fill('#pw', pw); pg.click('#lb'); pg.wait_for_selector('#nf'); pg.fill('#nm', name); pg.click('#nf button[type=submit]')
    pg.wait_for_selector('text=Wchodzę'); pg.click('text=Wchodzę'); pg.wait_for_selector('.hello')
    pg.evaluate("async()=>{const d=await import('/js/db.js');const n=new Date();await d.metaSet('poranny',n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0'))}")
    close_sheet(pg)


def close_sheet(pg):
    pg.evaluate("async()=>{(await import('/js/ui.js')).closeSheet()}"); pg.wait_for_timeout(150)


def go(pg, h, wait=600):
    close_sheet(pg); pg.evaluate(f"location.hash='{h}'"); pg.wait_for_timeout(wait)


def js(pg, code):
    return pg.evaluate(code)


def save(pg, col, obj):
    pg.evaluate("async([c,o])=>{const s=await import('/js/store.js');await s.save(c,o)}", [col, obj])


def sync(pg, wait=900):
    pg.evaluate("async()=>{const s=await import('/js/sync.js');await s.run()}"); pg.wait_for_timeout(wait)


def text(pg, sel='#app'):
    return pg.inner_text(sel)


def koniec(nazwa):
    zle = [e for e in errs if 'ERR_' not in e[1] and 'net::' not in e[1]]
    check(nazwa + ': brak błędów w konsoli', not zle, zle[:5])
    print('WYNIK:', wynik['ok'], 'OK', wynik['bad'], 'FAIL')
    return wynik['bad'] == 0
