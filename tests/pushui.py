exec(open('e13.py').read().split("with sync_playwright()")[0])
STUB = """
window.__perm=localStorage.getItem('stubperm')||'default'; window.__reqs=0; window.__calls=[];
Object.defineProperty(Notification,'permission',{get:()=>window.__perm,configurable:true});
Notification.requestPermission=async()=>{window.__reqs++;window.__perm='granted';localStorage.setItem('stubperm','granted');return 'granted'};
const mk=(ep)=>({endpoint:ep||'https://fcm.googleapis.com/fcm/send/T'+Math.random().toString(36).slice(2),options:{applicationServerKey:null},toJSON(){return{endpoint:this.endpoint,keys:{p256dh:'BPpFakeKeyFakeKeyFakeKeyFakeKeyFakeKeyFakeKeyFakeKeyFakeKeyFakeKeyFakeKeyFakeKeyFakeKeyFake',auth:'fakeAuthSecret12'}}},unsubscribe:async()=>{window.__sub=null;localStorage.removeItem('stubsub');return true}});
window.__sub=localStorage.getItem('stubsub')?mk(localStorage.getItem('stubsub')):null;
Object.defineProperty(navigator.serviceWorker,'ready',{get:()=>Promise.resolve({pushManager:{getSubscription:async()=>window.__sub||null,subscribe:async()=>{window.__sub=mk();localStorage.setItem('stubsub',window.__sub.endpoint);return window.__sub}}})});
"""
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg=newpage(b,{'width':390,'height':844}); ctx.add_init_script(STUB)
    login(pg,'wolontariusz-haslo-1','Ania')
    # pierwsze okno po zalogowaniu
    pg.wait_for_selector('text=Powiadomienia z czatu', timeout=9000); check('jednorazowe okno z prośbą o włączenie', pg.locator('[data-act=np-on-sheet]').count()==1)
    pg.click('[data-act=np-later-sheet]'); pg.wait_for_timeout(300)
    # karta zachęty na czacie po „Nie teraz”? (ukryta na 7 dni) -> ustawienia zawsze dają włączenie
    go(pg,'#/ustawienia'); pg.wait_for_selector('text=Powiadomienia'); t=pg.inner_text('#app')
    check('Ustawienia: stan Wyłączone i przycisk Włącz', 'Wyłączone' in t and pg.locator('.card [data-act=np-on]').count()==1)
    pg.click('.card [data-act=np-on]'); pg.wait_for_timeout(1500); t=pg.inner_text('#app')
    check('po kliknięciu: zgoda wywołana raz', pg.evaluate('window.__reqs')==1)
    check('Ustawienia: Włączone na tym telefonie + testowe/wyłącz', 'Włączone na tym telefonie' in t and pg.locator('[data-act=np-test]').count()==1 and pg.locator('[data-act=np-off]').count()==1)
    tok=pg.evaluate("localStorage.getItem('lapa.token')"); 
    import urllib.request
    # serwer zapamiętał subskrypcję (porównanie liczby po stronie bazy przez /push/prefs na endpoint z telefonu)
    ep=pg.evaluate('window.__sub.endpoint'); req=urllib.request.Request(API+'/push/prefs',data=json.dumps({'endpoint':ep,'name':'Ania'}).encode(),headers={'authorization':'Bearer '+tok,'content-type':'application/json'})
    check('serwer zna to urządzenie', urllib.request.urlopen(req).status==200)
    # przełączniki
    pg.locator('input[data-act=np-quiet]').click(); pg.wait_for_timeout(300); check('cisza nocna wyłączona i zostaje wyłączona', pg.evaluate("localStorage.getItem('lapa.push.quiet')")=='0' and not pg.locator('input[data-act=np-quiet]').is_checked())
    pg.locator('input[data-act=np-mute]').click(); pg.wait_for_timeout(300); check('wyciszenie włączone', pg.evaluate("localStorage.getItem('lapa.push.mute')")=='1' and pg.locator('input[data-act=np-mute]').is_checked())
    pg.click('[data-act=np-test]'); pg.wait_for_timeout(1500)
    # wyłączenie i ponowne włączenie (ktoś kliknął za szybko)
    pg.click('[data-act=np-off]'); pg.wait_for_timeout(800); check('po wyłączeniu znów jest przycisk Włącz', pg.locator('.card [data-act=np-on]').count()==1 and 'Wyłączone' in pg.inner_text('#app'))
    pg.click('.card [data-act=np-on]'); pg.wait_for_timeout(1200); check('ponowne włączenie działa', 'Włączone na tym telefonie' in pg.inner_text('#app'))
    # po restarcie aplikacji zapis odnawiany sam
    pg.reload(); pg.wait_for_selector('.topbar', timeout=8000); pg.wait_for_timeout(3000)
    go(pg,'#/ustawienia'); pg.wait_for_timeout(500); check('po ponownym uruchomieniu nadal włączone', 'Włączone na tym telefonie' in pg.inner_text('#app'))
    # karta zachęty na czacie dla osoby bez włączonych powiadomień
    ctx2,p2=newpage(b,{'width':390,'height':844}); ctx2.add_init_script(STUB+"try{localStorage.setItem('lapa.push.asked','1')}catch(e){}"); login(p2,'wolontariusz-haslo-1','Basia')
    go(p2,'#/czat'); p2.wait_for_selector('#c-in'); check('karta „Włącz powiadomienia” na czacie', p2.locator('.pushcard [data-act=np-on]').count()==1)
    p2.click('.pushcard [data-act=np-on]'); p2.wait_for_timeout(1500); go(p2,'#/czat'); p2.wait_for_selector('#c-in'); check('po włączeniu karta znika', p2.locator('.pushcard').count()==0)
    print('BŁĘDY KONSOLI:',[e for e in errs if 'status of 500' not in e[1]])
    b.close()
print(f'WYNIK: {ok} OK {bad} FAIL')
