import http from 'node:http'; import { spawn, execSync } from 'node:child_process'; import fs from 'node:fs';
const R=new URL('..', import.meta.url).pathname.replace(/\/$/, ''), D='/tmp/srv'; fs.rmSync(D,{recursive:true,force:true}); fs.mkdirSync(D);
fs.copyFileSync(R+'/server/lapa-server.mjs',D+'/lapa-server.mjs'); fs.copyFileSync(R+'/js/dogmerge.js',D+'/dogmerge.mjs');
const hash=(p)=>execSync('node '+R+'/server/hash-password.mjs',{input:p}).toString().trim();
const dogs={}; const mk=(i,o={})=>({id:i,slug:'pies'+i,name:'Burek'+i,plec:i%2?'Samiec':'Suka',wiek:'2 lata',haslo:'BUREK'+i+' - szuka domu',opis:`Burek${i} jest bardzo przyjazny, lubi ludzi i dobrze dogaduje się z innymi psami. Chodzi na smyczy. Nie jest agresywny.`,...o});
for(let i=1;i<=25;i++) dogs[i]=mk(i);
dogs[4]=mk(4,{data:'<p>czwartek, 18 listopada 2021</p>'});
const page=(d)=>`<html><body><h2 class="TzArticleTitle">${d.name}</h2><ul><li class="tz_extrafield-item"><div class="tz_extrafield-label">Płeć</div><div class="tz_extrafield-value">${d.plec}</div></li><li class="tz_extrafield-item"><div class="tz_extrafield-label">Wiek</div><div class="tz_extrafield-value">${d.wiek}</div></li><li class="tz_extrafield-item"><div class="tz_extrafield-label">Status</div><div class="tz_extrafield-value">Do adopcji</div></li></ul><div class="intro">${d.haslo}</div><div class="col-md-8 text"><p>${d.opis}</p></div><a data-fancybox href="/img/${d.id}_l.jpg">x</a>${d.data||''}</body></html>`;
let lim=999; const adopt={}; let adoptPada=false, pobrane=0, adopt10;
const site=http.createServer((q,r)=>{const u=new URL(q.url,'http://x'); let m;
 if(u.pathname==='/adoptowane'){ if(adoptPada){r.statusCode=500;return r.end('x');} const st=+(u.searchParams.get('start')||0); const ids=Object.keys(adopt).slice(st,st+9); r.end('<html>'+ids.map(i=>`<a href="/adoptowane/${adopt[i].slug}/${i}">p</a>`).join('')+'</html>');}
 else if((m=/^\/adoptowane\/([^/]+)\/(\d+)$/.exec(u.pathname))&&adopt[m[2]]) {pobrane++; r.end(page(adopt[m[2]]).replace('Do adopcji','Adoptowany'));}
 else if(u.pathname==='/psy-do-adopcji'){const st=+(u.searchParams.get('start')||0); const ids=Object.keys(dogs).slice(0,lim).slice(st,st+9); r.end('<html>'+ids.map(i=>`<a href="/psy-do-adopcji/${dogs[i].slug}/${i}">p</a>`).join('')+'</html>');}
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
// 1.20: zakładka „Adoptowane” → „Byli u nas”; psa nie ma nigdzie na stronie → znika z aplikacji (wraca, gdy znów się pojawi)
const rok=new Date().getFullYear();
adopt[100]=mk(100,{data:`<p>poniedziałek, 3 marca ${rok-1}</p>`}); adopt[101]=mk(101,{data:'<p>środa, 6 marca 2019</p>'});
await edit(10,(x)=>({...x,wazne:'notatka admina'}));
adopt[10]=dogs[10]; delete dogs[10];
s=await run(); d=await dog(10);
ck('13: pies przeniesiony na stronie do „Adoptowane” → Byli u nas, notatka zostaje '+JSON.stringify({st:d.status,a:!!d.adoptowany_od,z:d.zniknal_ze_strony,n:s.adoptowanych,u:s.uwaga}),d.status==='adoptowany'&&d.adoptowany_od&&!d.zniknal_ze_strony&&d.wazne==='notatka admina');
d=await dog(100); ck('13b: nieznany adoptowany z ostatnich 3 lat → dodany',d&&d.status==='adoptowany'&&!d.adoptowany_od&&s.adoptowanych===2&&s.nowych===0);
ck('13c: adoptowany ponad 3 lata temu → nie dodany',!(await dog(101)));
let ile=pobrane; s=await run(); ck('14: znane adoptowane nie są pobierane co godzinę '+JSON.stringify({p:pobrane-ile,n:s.adoptowanych}),s.adoptowanych===0&&pobrane-ile===0);
const z2=dogs[2]; delete dogs[2]; s=await run(); d=await dog(2);
ck('15: psa nie ma nigdzie na stronie → znika z aplikacji '+JSON.stringify({z:!!d.zniknal_ze_strony,n:s.zniknelo}),!!d.zniknal_ze_strony&&d.status==='do_adopcji'&&s.zniknelo===1&&s.zniknelo_nazwy[0]==='Burek2');
s=await run(); ck('15b: drugie sprawdzenie bez zmian',s.zniknelo===0);
await edit(2,(x)=>({...x,wazne:'pamiętamy'}));
dogs[2]=z2; s=await run(); d=await dog(2); ck('16: pojawił się znowu → wraca z notatkami '+JSON.stringify({w:s.wrocilo}),!d.zniknal_ze_strony&&d.wazne==='pamiętamy'&&s.wrocilo===1);
delete adopt[100]; s=await run(); d=await dog(100); ck('17: zniknął z „Adoptowanych” → znika z aplikacji',!!d.zniknal_ze_strony);
adopt[100]=mk(100,{data:`<p>poniedziałek, 3 marca ${rok-1}</p>`}); s=await run(); d=await dog(100); ck('17b: wrócił do „Adoptowanych” → znów w Byli u nas',!d.zniknal_ze_strony&&d.status==='adoptowany');
adopt10=dogs[10]=adopt[10]; delete adopt[10]; s=await run(); d=await dog(10); ck('18: wrócił z adopcji na listę do adopcji',d.status==='do_adopcji'&&!d.adoptowany_od&&!d.zniknal_ze_strony);
adoptPada=true; const z3=dogs[3]; delete dogs[3]; s=await run(); d=await dog(3);
ck('19: „Adoptowane” nie działa → nic nie chowamy, jest uwaga '+JSON.stringify({ok:s.ok,u:s.uwaga.slice(0,50)}),s.ok&&!d.zniknal_ze_strony&&s.uwaga.includes('Adoptowane'));
adoptPada=false; dogs[3]=z3;
const ep=(await (await fetch(B+'/health')).json()).epoka, ep2=(await (await fetch(B+'/sync?since=999999999',{headers:H})).json()).epoka; ck('20: epoka bazy w /health i /sync',ep&&ep.length>8&&ep===ep2);
// uszkodzony układ strony (brak pól)
const orig=page; 
srv.kill(); site.close(); console.log(fails?'BŁĘDY: '+fails:'WSZYSTKO OK'); process.exit(fails?1:0);
