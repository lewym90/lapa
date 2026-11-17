# 1.16: telefon wolontariusza z danymi z poprzedniej wersji (pełne dane, prywatne, oczekujące zmiany psów)
# po aktualizacji ma zostać wyczyszczony i pobrać okrojoną wersję; telefon administratora pobiera wszystko od nowa.
from playwright.sync_api import sync_playwright
from wspolne import *

with sync_playwright() as p:
    b = p.chromium.launch()
    ca, pa = newpage(b); login(pa, 'Ania')
    now = pa.evaluate('Date.now()')
    save(pa, 'psy', {'id': 'd1', 'imie': 'Saba', 'status': 'do_adopcji', 'miejsce': 'schronisko', 'czip': '999', 'zdjecia': []})
    save(pa, 'zdrowie', {'id': 'h1', 'pies_id': 'd1', 'typ': 'leczenie', 'notatka': 'tajne', 'data': now})
    sync(pa)

    cv, pv = newpage(b); login(pv, 'Wola', WOL); sync(pv, 1500)
    # „stara wersja”: brak zapisanej roli, na telefonie dane spoza zakresu wolontariusza i zmiany czekające na wysłanie
    pv.evaluate("""async()=>{const d=await import('/js/db.js');const t=Date.now();
      await d.putRec({col:'zdrowie',id:'h1',data:{id:'h1',pies_id:'d1',notatka:'tajne'},updated_at:t,deleted:false,by:'x'});
      await d.putRec({col:'p_finanse',id:'f1',data:{id:'f1',kwota:100},updated_at:t,deleted:false,by:'x'});
      await d.putRec({col:'psy',id:'d1',data:{id:'d1',imie:'Saba',czip:'999'},updated_at:t,deleted:false,by:'x'});
      await d.addOutbox({col:'psy',id:'d1',data:{id:'d1',imie:'ZMIANA'},updated_at:t,deleted:false,by:'Wola'});
      await d.addOutbox({col:'deklaracje',id:'dX',data:{id:'dX',pies_id:'d1',potrzeba:'spacer',imie:'Wola'},updated_at:t,deleted:false,by:'Wola'});
      await d.metaSet('rola', undefined); await d.metaSet('cursor', 999999);}""")
    pv.reload(); pv.wait_for_timeout(2500); sync(pv, 2000)
    st = pv.evaluate("""async()=>{const d=await import('/js/db.js');const s=await import('/js/store.js');
      return {z:(await d.getAll('zdrowie')).length,f:(await d.getAll('p_finanse')).length,czip:((await s.get('psy','d1'))||{}).czip||'',imie:((await s.get('psy','d1'))||{}).imie||'',
              out:await d.outboxCount(),rola:await d.metaGet('rola'),dek:(await s.list('deklaracje')).map(x=>x.id)}}""")
    check('po aktualizacji: rola zapisana', st['rola'] == 'wolontariusz', st)
    check('po aktualizacji: bez zdrowia i finansów', st['z'] == 0 and st['f'] == 0, st)
    check('po aktualizacji: pies pobrany od nowa, bez czipu', st['imie'] == 'Saba' and st['czip'] == '', st)
    check('po aktualizacji: zmiana psa od wolontariusza odrzucona, zgłoszenie wysłane', st['out'] == 0 and 'dX' in st['dek'], st)
    sync(pa, 1500)
    check('serwer: pies bez zmiany wolontariusza', pa.evaluate("async()=>(await (await import('/js/store.js')).get('psy','d1')).imie") == 'Saba')

    # administrator po aktualizacji: brak roli w pamięci → pobiera wszystko od nowa
    pa.evaluate("async()=>{const d=await import('/js/db.js'); await d.metaSet('rola', undefined); await d.metaSet('cursor', 999999); await d.metaSet('cursor_private', 999999);}")
    pa.reload(); pa.wait_for_timeout(2500); sync(pa, 2000)
    st = pa.evaluate("async()=>{const s=await import('/js/store.js');return {z:(await s.list('zdrowie')).length,c:(await s.get('psy','d1')).czip, r:await (await import('/js/db.js')).metaGet('rola')}}")
    check('administrator po aktualizacji: pełne dane', st == {'z': 1, 'c': '999', 'r': 'admin'}, st)
    koniec('upgrade1')
