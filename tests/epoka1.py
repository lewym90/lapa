# 2.0: epoka bazy – telefon z danymi ze starej bazy czyści je i pobiera wszystko od nowa; świeża instalacja nic nie traci.
from playwright.sync_api import sync_playwright
from wspolne import *

with sync_playwright() as p:
    b = p.chromium.launch()
    ca, pa = newpage(b); login(pa, 'Ania')
    save(pa, 'psy', {'id': 'd1', 'imie': 'Azor', 'status': 'do_adopcji', 'zrodlo_id': '1'}); sync(pa)
    r = pa.evaluate("""async()=>{const db=await import('/js/db.js'); return [await db.metaGet('epoka'), !!(await db.getRec('psy','d1'))]}""")
    check('świeża instalacja: epoka zapisana, własne dane zostają', bool(r[0]) and r[1], r)
    r = pa.evaluate("""async()=>{const db=await import('/js/db.js'), st=await import('/js/store.js');
      await db.metaSet('epoka','stara-baza'); await db.putRec({col:'psy',id:'zstarej',data:{id:'zstarej',imie:'Ze starej'},updated_at:1,deleted:false});
      await db.addOutbox({col:'psy',id:'zstarej2',data:{id:'zstarej2',imie:'Niewysłany'},updated_at:Date.now(),deleted:false,by:'x'});
      return 1}""")
    pa.reload(); pa.wait_for_timeout(2500); sync(pa)
    r = pa.evaluate("""async()=>{const db=await import('/js/db.js'); return [await db.metaGet('epoka'), !!(await db.getRec('psy','zstarej')), !!(await db.getRec('psy','d1')), await db.outboxCount()]}""")
    check('stara epoka: dane ze starej bazy usunięte, dane serwera pobrane od nowa', r[0] != 'stara-baza' and not r[1] and r[2] and r[3] == 0, r)
    koniec('epoka1')
