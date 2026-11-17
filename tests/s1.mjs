import http from 'node:http'; import { spawn, execSync } from 'node:child_process'; import fs from 'node:fs';
const R=new URL('..', import.meta.url).pathname.replace(/\/$/, ''), D='/tmp/srv'; fs.rmSync(D,{recursive:true,force:true}); fs.mkdirSync(D);
fs.copyFileSync(R+'/server/lapa-server.mjs',D+'/lapa-server.mjs'); fs.copyFileSync(R+'/js/dogmerge.js',D+'/dogmerge.mjs');
const hash=(p)=>execSync('node '+R+'/server/hash-password.mjs',{input:p}).toString().trim();
const dogs={}; const mk=(i,o={})=>({id:i,slug:'pies'+i,name:'Burek'+i,plec:i%2?'Samiec':'Suka',wiek:'2 lata',haslo:'BUREK'+i+' - szuka domu',opis:`Burek${i} jest bardzo przyjazny, lubi ludzi i dobrze dogaduje się z innymi psami. Chodzi na smyczy. Nie jest agresywny.`,...o});
for(let i=1;i<=25;i++) dogs[i]=mk(i);
dogs[4]=mk(4,{data:'<p>czwartek, 18 listopada 2021</p>'});
const page=(d)=>`<html><body><h2 class="TzArticleTitle">${d.name}</h2><ul><li class="tz_extrafield-item"><div class="tz_extrafield-label">Płeć</div><div class="tz_extrafield-value">${d.plec}</div></li><li class="tz_extrafield-item"><div class="tz_extrafield-label">Wiek</div><div class="tz_extrafield-value">${d.wiek}</div></li><li class="tz_extrafield-item"><div class="tz_extrafield-label">Status</div><div class="tz_extrafield-value">Do adopcji</div></li></ul><div class="intro">${d.haslo}</div><div class="col-md-8 text"><p>${d.opis}</p></div><a data-fancybox href="/img/${d.id}_l.jpg">x</a>${d.data||''}</body></html>`;
let lim=999;
const site=http.createServer((q,r)=>{const u=new URL(q.url,'http://x'); let m;
 if(u.pathname==='/psy-do-adopcji'){const st=+(u.searchParams.get('start')||0); const ids=Object.keys(dogs).slice(0,lim).slice(st,st+9); r.end('<html>'+ids.map(i=>`<a href="/psy-do-adopcji/${dogs[i].slug}/${i}">p</a>`).join('')+'</html>');}
 else if(u.pathname==='/do-adopcji-pilne'){r.end('<html></html>');}
 else if((m=/^\/psy-do-adopcji\/([^/]+)\/(\d+)$/.exec(u.pathname))&&dogs[m[2]]) r.end(page(dogs[m[2]]));
 else {r.statusCode=404;r.end('no');}}).listen(18500);
const env={...process.env,LAPA_TEST_SITE:'http://127.0.0.1:18500',LAPA_TEST_FAST:'1',DB_FILE:D+'/data/lapa.db',PORT:'18998',PASS_VOLUNTEER_HASH:hash('wolontariusz-haslo-1'),PASS_ADMIN_HASH:hash('administrator-haslo-3'),SITE_SYNC_HOURS:'99'};
const srv=spawn('node',['--disable-warning=ExperimentalWarning',D+'/lapa-server.mjs'],{env,stdio:['ignore','inherit','inherit']});
const B='http://127.0.0.1:18998'; const sl=(ms)=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<30;i++){try{await fetch(B+'/health');break}catch{await sl(200)}}
const tok=(await (await fetch(B+'/auth/login',{method:'POST',body:JSON.stringify({password:'administrator-haslo-3'})})).json()).token;
const H={authorization:'Bearer '+tok}; let fails=0; const ck=(n,c)=>{console.log(c?'OK  ':'FAIL',n); if(!c)fails++;};
const health=async()=>(await (await fetch(B+'/health')).json()).site;
const run=async()=>{await fetch(B+'/site/sync',{method:'POST',headers:H}); await sl(300); for(let i=0;i<100;i++){const s=await health(); if(!s.running&&s.t) {await sl(200); const s2=await health(); if(!s2.running) return s2;} await sl(200);} };
const all=async()=>{const r=await (await fetch(B+'/sync?since=0',{headers:H})).json(); return r.changes.filter(c=>c.col==='psy'&&!c.deleted).map(c=>c.data)};
const dog=async(i)=>(await all()).find(d=>d.id==='d'+i);
let s=await run(); ck('1: 25 nowych '+JSON.stringify({n:s.nowych,z:s.zmienionych,ok:s.ok,b:s.blad}),s.ok&&s.nowych===25);
ck('1c: „w schronisku od” z daty publikacji', new Date((await dog(4)).od_www).toISOString().slice(0,10)==='2021-11-18');
let d=await dog(3); ck('1b: pola psa',d&&d.imie==='Burek3'&&d.plec==='samiec'&&d.wiek==='2 lata'&&d.zdjecia.length===1&&d.status==='do_adopcji'&&d.opis.includes('przyjazny')&&d.auto_dodany&&d.ocena?.ludzie==='ok');
s=await run(); ck('2: bez zmian => 0/0 '+JSON.stringify({n:s.nowych,z:s.zmienionych}),s.ok&&s.nowych===0&&s.zmienionych===0);
dogs[3].opis='Zupełnie nowy opis psa Burek3, który jest bardzo łagodny i lubi spacery z wolontariuszami.'; dogs[26]=mk(26); 
s=await run(); ck('3: 1 nowy 1 zmieniony '+JSON.stringify({n:s.nowych,z:s.zmienionych,names:s.nazwy}),s.ok&&s.nowych===1&&s.zmienionych===1&&s.nazwy[0]==='Burek26');
d=await dog(3); ck('3b: opis zmieniony',d.opis.startsWith('Zupełnie nowy'));
// ręczna zmiana statusu i opisu w aplikacji
const edit=async(i,f)=>{const x=await dog(i); const n=f({...x}); await fetch(B+'/sync',{method:'POST',headers:H,body:JSON.stringify({changes:[{col:'psy',id:'d'+i,data:n,updated_at:Date.now()+1000,deleted:false,by:'Michał'}]})});};
await edit(5,(x)=>({...x,status:'adoptowany',opis:'Nasz ręczny opis.'}));
dogs[5].opis=dogs[5].opis; s=await run(); d=await dog(5); ck('4: strona jest jedynym źródłem: ręczny status i opis wracają do tych ze strony',d.status==='do_adopcji'&&d.opis.startsWith('Burek5 jest')&&s.zmienionych===1);
dogs[5].haslo='BUREK5 - w procesie adopcji :)'; s=await run(); d=await dog(5); ck('4b: zmiana na stronie nadpisuje status',d.status==='w_trakcie');
dogs[7].haslo='BUREK7 - w domu tymczasowym 🏠'; s=await run(); d=await dog(7); ck('5: miejsce z hasła',d.miejsce==='dt');
// usunięty pies nie wraca
await fetch(B+'/sync',{method:'POST',headers:H,body:JSON.stringify({changes:[{col:'psy',id:'d9',data:{},updated_at:Date.now()+2000,deleted:true,by:'x'}]})});
dogs[9].opis='Zmieniony opis dziewiątego psa, który został usunięty w aplikacji przez wolontariusza.'; s=await run(); ck('6: usunięty nie wraca '+s.pominietych,!(await dog(9)));
// zabezpieczenie: strona zwraca 5 psów
lim=5; const before=JSON.stringify((await all()).map(x=>x.id).sort()); dogs[1].opis='NIE POWINNO SIĘ ZAPISAĆ, bo strona wygląda na zepsutą i nic nie zapisujemy.'; s=await run();
ck('7: zepsuta lista => błąd, bez zmian '+s.blad.slice(0,60),s.ok===false&&!(await dog(1)).opis.includes('NIE POWINNO'));
lim=999; s=await run(); ck('8: po naprawie znów działa',s.ok&&(await dog(1)).opis.includes('NIE POWINNO'));
// 1.18: pies znika ze strony → „Byli u nas” (znacznik zniknal_ze_strony, status bez zmian); wraca → sam wraca (także z dawnego archiwum)
await edit(6,(x)=>({...x,poza_strona:Date.now()-86400e3})); // znacznik z poprzedniej wersji
await edit(8,(x)=>({...x,archiwum:Date.now(),archiwum_los:'zmarl'}));
const z2=dogs[2], z6=dogs[6], z8=dogs[8]; delete dogs[2]; delete dogs[6]; delete dogs[8];
s=await run(); d=await dog(2); ck('9: zniknął → byli u nas '+JSON.stringify({st:d.status,m:d.miejsce,z:!!d.zniknal_ze_strony,n:s.zniknelo}),!!d.zniknal_ze_strony&&d.status==='do_adopcji'&&d.miejsce==='schronisko'&&s.zniknelo===3&&s.zniknelo_nazwy.includes('Burek2'));
d=await dog(6); ck('9b: stary znacznik usunięty, byli u nas',!!d.zniknal_ze_strony&&!d.poza_strona);
d=await dog(8); ck('9c: dawne archiwum też w byli u nas',!!d.zniknal_ze_strony);
s=await run(); ck('9d: drugie sprawdzenie bez zmian',s.zniknelo===0);
dogs[2]=z2; dogs[8]=z8; s=await run(); d=await dog(2); ck('10: wrócił na stronę → znów w schronisku '+JSON.stringify({st:d.status,m:d.miejsce,w:s.wrocilo}),d.status==='do_adopcji'&&d.miejsce==='schronisko'&&!d.zniknal_ze_strony&&s.wrocilo===2);
d=await dog(8); ck('10b: dawne archiwum wraca razem ze stroną',!d.archiwum&&!d.zniknal_ze_strony);
dogs[6]=z6; s=await run(); d=await dog(6); ck('11: kolejny powrót',!d.zniknal_ze_strony&&d.status==='do_adopcji');
await edit(7,(x)=>({...x,status:'adoptowany',miejsce:'adoptowany'})); s=await run(); d=await dog(7); ck('12: ręcznie „adoptowany”, ale nadal na stronie → jak na stronie '+JSON.stringify({st:d.status,m:d.miejsce}),d.status==='do_adopcji'&&d.miejsce==='dt');
// uszkodzony układ strony (brak pól)
const orig=page; 
srv.kill(); site.close(); console.log(fails?'BŁĘDY: '+fails:'WSZYSTKO OK'); process.exit(fails?1:0);
