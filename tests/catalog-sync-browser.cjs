// Isolated local browser only: all business APIs are fulfilled in memory.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const origin=process.env.GROOMPRO_TEST_CATALOG_URL||'http://127.0.0.1:33462';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Use an isolated local preview.');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'groompro-catalog-sync-'));
const chrome=spawn(process.env.GROOMPRO_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking',
 '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
],{stdio:'ignore',windowsHide:true});
let socket;
async function main(){
 let port;
 for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break}catch{await pause(100)}}
 if(!port)throw Error('Test browser did not start.');
 const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 let id=0;const pending=new Map(),networkApiRequests=[],pageErrors=[];
 const send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id,timer=setTimeout(()=>{pending.delete(requestId);reject(Error(method+' timed out'))},120000);pending.set(requestId,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id:requestId,method,params}))});
 socket.addEventListener('message',event=>{
  const value=JSON.parse(event.data);
  if(value.method==='Runtime.exceptionThrown')pageErrors.push(value.params.exceptionDetails);
  if(value.method==='Fetch.requestPaused'){
   // Backstop for XHR or other clients: never allow a business request through.
   networkApiRequests.push(value.params.request.url);
   void send('Fetch.fulfillRequest',{requestId:value.params.requestId,responseCode:500,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({error:'Unmocked API request in browser fixture'})).toString('base64')});
  }
  const callback=pending.get(value.id);if(callback){pending.delete(value.id);value.error?callback.reject(Error(value.error.message)):callback.resolve(value.result)}
 });
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+JSON.stringify(r.exceptionDetails.exception));return r.result.value};
 const wait=async expression=>{for(let i=0;i<180;i++){if(await evaluate(expression))return;await pause(500)}throw Error('Page condition timed out: '+expression)};
 const visible=`el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'`;
 const editor=`[...document.querySelectorAll('.gp-editor-window')].find(${visible})`;
 const result=`[...document.querySelectorAll('[aria-label="Catalog Update Results"]')].find(${visible})`;
 const navigate=async name=>{
  await evaluate(`(()=>{const buttons=[...document.querySelectorAll('.gp-header-menu > button')];const button=buttons.find(b=>b.textContent.trim()===${JSON.stringify(name)});if(button)button.click();else{document.querySelector('[aria-label="More modules"]').click();[...document.querySelectorAll('.gp-header-overflow > button')].find(b=>b.textContent.trim()===${JSON.stringify(name)}).click()}})()`);
 };
 const open=async name=>{const selector=`[...document.querySelectorAll('button[aria-label=${JSON.stringify('Edit '+name)}]')].find(${visible})`;await wait(`!!(${selector})`);await evaluate(`${selector}.click()`);await wait(`!!(${editor})`)};
 const scope=async value=>{await evaluate(`(${editor}).querySelector('input[type="radio"][value="${value}"]').click()`);await wait(`(${editor}).querySelector('input[value="${value}"]').checked`)};
 const saved=async()=>{const count=await evaluate('window.__catalogSaves.length');await evaluate(`(${editor}).querySelector('form').requestSubmit()`);await wait(`window.__catalogSaves.length===${count+1}&&!(${editor})`);return evaluate(`window.__catalogSaves[${count}]`)};
 const screenshot=async name=>{const folder='test-results/catalog-sync';fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(folder+'/'+name+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'))};
 const revealFieldset=async legend=>{await evaluate(`(()=>{const fieldset=[...(${editor}).querySelectorAll('fieldset')].find(el=>el.querySelector(':scope > legend')?.textContent===${JSON.stringify(legend)});fieldset.scrollIntoView({block:'center'})})()`);await pause(150)};
 await send('Page.enable');await send('Network.enable');await send('Runtime.enable');
 await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*',requestStage:'Request'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__catalogSaves=[];window.__catalogEvents=[];window.__ticketEvents=[];window.__offlineNext=false;
  window.__posAmount=5000;window.__posReads={detail:0,checkout:0};
  window.addEventListener('groompro:catalog-synced',event=>window.__catalogEvents.push(event.detail));
  window.addEventListener('groompro:data-changed',event=>{if(event.detail?.url==='/api/tickets')window.__ticketEvents.push(event.detail)});
  const catalog={
   services:[{id:'bath',name:'Bath',description:'A gentle bath and coat rinse.',durationMin:30,priceCents:5000,active:true,workflowRole:'BATH',category:'Full Wash',_catalogVersion:'service-v1'}],
   products:[],
   packages:[{id:'wash',name:'Full Wash',description:'Bath and finish.',priceCents:7000,active:true,items:[{serviceId:'bath',quantity:1,role:'BATH'}],_catalogVersion:'package-v1'}],
   plans:[{id:'vip',name:'VIP Wash',description:'Monthly bath visits.',priceCents:4000,active:true,billingDay:1,billingDaySecond:15,items:[{serviceId:'bath',quantity:2,role:'BATH'}],_catalogVersion:'vip-v1'}]
  };
  const originalFetch=window.fetch;
  window.fetch=async function(input,options){
   const url=new URL(typeof input==='string'?input:input.url,location.href),pathname=url.pathname;
   if(!pathname.startsWith('/api/'))return originalFetch.call(this,input,options);
   if(pathname==='/api/setup/context')return Response.json({tenant:{id:'catalog-fixture',name:'Catalog Test'},setupRequired:false});
   if(pathname==='/api/employee/session')return Response.json({employee:null});
   if(pathname==='/api/features')return Response.json({features:[]});
   if(pathname==='/api/operating-hours')return Response.json({timezone:'America/Chicago',hours:[]});
   if(pathname==='/api/workflow-settings')return Response.json({settings:{posLayout:{taxRatePct:0}}});
   if(pathname==='/api/grooming-notes')return Response.json({customer:{notes:''},pets:[],records:[],defaults:{}});
   if(pathname==='/api/tickets/pos-fixture'){
    window.__posReads.detail++;
    const pet={id:'fixture-pet',name:'Gizmo',breed:'Poodle',weightLbs:15,active:true};
    return Response.json({ticket:{id:'pos-fixture',orderNumber:404,status:'OPEN',timingMode:'SEQUENTIAL',scheduledStart:'2026-12-01T15:00:00.000Z',durationMin:30,createdAt:'2026-11-26T15:00:00.000Z',locationId:'fixture-location',location:{id:'fixture-location',timezone:'America/Chicago'},customer:{id:'fixture-customer',firstName:'Maria',lastName:'Fixture',email:null,phones:[],pets:[pet]},pets:[{pet}],assignments:[],scheduleHistory:[],notes:'',lines:[{id:'fixture-line',petId:pet.id,pet,lineType:'SERVICE',serviceId:'bath',role:'BATH',description:'Bath Visit',quantity:1,unitPriceCents:window.__posAmount,totalCents:window.__posAmount,discountCents:0,durationMin:30}]},account:{balanceCents:0,creditCents:0,loyaltyPoints:0},rewards:[],paymentMethods:[]});
   }
   if(pathname==='/api/tickets/checkout'&&url.searchParams.get('ticketId')==='pos-fixture'){
    window.__posReads.checkout++;
    return Response.json({subtotalCents:window.__posAmount,tipCents:0,salesTaxCents:0,totalCents:window.__posAmount,paidCents:0,dueCents:window.__posAmount,account:{balanceCents:0,creditCents:0,loyaltyPoints:0}});
   }
   if(pathname==='/api/catalog'){
    if(options?.method==='PATCH'){
     const body=JSON.parse(options.body);window.__catalogSaves.push(body);
     if(window.__offlineNext){window.__offlineNext=false;return Response.json({offlinePending:true})}
     const list=catalog[body.kind],index=list.findIndex(item=>item.id===body.id);
     list[index]={...list[index],...body,_catalogVersion:'next-'+window.__catalogSaves.length};
     const sync={updated:0,unchanged:0,review:[],ticketIds:[]};
     if(body.applyTo&&body.applyTo!=='NONE')Object.assign(sync,{updated:2,unchanged:1,ticketIds:['ticket-1','ticket-2'],review:[{ticketId:'ticket-3',orderNumber:303,reason:'Staff-adjusted price was kept.'}]});
     if(body.kind==='plans')Object.assign(sync,{vipBenefitsUpdated:body.updateVipBenefits?3:0,vipPricesUpdated:body.updateVipPrice?3:0,vipScheduledChargesUpdated:body.updateVipPrice?2:0,vipChargesForReview:body.updateVipPrice?1:0});
     return Response.json({item:list[index],sync});
    }
    return Response.json(catalog);
   }
   if(pathname==='/api/online-booking-classes')return Response.json({classIds:[],classes:[],configured:true,availableOnline:false,revision:'fixture'});
   return Response.json({employees:[],assets:[],schedules:[],tickets:[],blocks:[],items:[],notices:[],settings:{},preferences:{},services:[],products:[],packages:[],plans:[],breeds:[],SERVICE:[],offers:[],customers:[],memberships:[]});
  };
 `});
 await send('Page.navigate',{url:origin});
 await wait(`!!document.querySelector('.gp-header-menu > button')`);
 if(process.env.GROOMPRO_TEST_POS_ONLY!=='1'){
 await navigate('Services');await open('Bath');
 assert.equal(await evaluate(`(${editor}).querySelector('input[value="NONE"]').checked`),true,'New bookings is the safe default');
 assert.deepEqual(await evaluate(`[...(${editor}).querySelectorAll('input[type="radio"]')].map(el=>el.value)`),['ALL','FUTURE','NONE']);
 assert.match(await evaluate(`(${editor}).innerText`),/Today and Future Appointments/);
 assert.match(await evaluate(`(${editor}).innerText`),/Future Appointments Only — Exclude Today/);
 await revealFieldset('Where Should These Changes Apply?');await screenshot('service-choices');
 let body=await saved();assert.equal(body.applyTo,'NONE');assert.equal(body.catalogVersion,'service-v1');
 assert.equal(await evaluate('window.__catalogEvents.length'),0);assert.equal(await evaluate('window.__ticketEvents.length'),0);
 await open('Bath');await scope('ALL');body=await saved();assert.equal(body.applyTo,'ALL');
 await wait(`!!(${result})`);
 await evaluate(`(${result}).querySelector('summary').click()`);
 assert.match(await evaluate(`(${result}).innerText`),/Staff-adjusted price was kept/);
 assert.match(await evaluate(`(${result}).innerText`),/Some details were kept/);
 assert.equal(await evaluate(`(${result}).querySelector('button').textContent`),'Open Ticket #303');
 assert.deepEqual(await evaluate('window.__catalogEvents.at(-1).ticketIds'),['ticket-1','ticket-2']);
 await screenshot('appointment-results');
 await open('Bath');assert.equal(await evaluate(`(${editor}).querySelector('input[value="NONE"]').checked`),true,'Choice resets for each edit');await scope('FUTURE');body=await saved();assert.equal(body.applyTo,'FUTURE');
 await navigate('Packages');await open('Full Wash');
 assert.equal(await evaluate(`(${editor}).querySelector('input[value="NONE"]').checked`),true);await scope('FUTURE');body=await saved();assert.equal(body.kind,'packages');assert.equal(body.applyTo,'FUTURE');assert.equal(body.catalogVersion,'package-v1');
 await open('Full Wash');await scope('ALL');body=await saved();assert.equal(body.applyTo,'ALL');
 // Offline acknowledgement must not pretend that saved appointments were updated.
 await open('Full Wash');await scope('ALL');const beforeEvents=await evaluate('[window.__catalogEvents.length,window.__ticketEvents.length]');await evaluate('window.__offlineNext=true');await saved();
 assert.match(await evaluate('document.body.innerText'),/Existing appointments have not been updated yet/);
 assert.deepEqual(await evaluate('[window.__catalogEvents.length,window.__ticketEvents.length]'),beforeEvents);
 await navigate('VIP Memberships');
 for(const [benefits,price] of [[true,false],[false,true],[true,true],[false,false]]){
  await open('VIP Wash');
  const vipBoxes=`[...(${editor}).querySelectorAll('fieldset')].find(el=>el.querySelector(':scope > legend')?.textContent==='Apply Changes to Current VIP Members').querySelectorAll('input[type="checkbox"]')`;
  assert.deepEqual(await evaluate(`[...(${vipBoxes})].map(el=>el.checked)`),[false,false],'VIP decisions reset independently');
  assert.equal(await evaluate(`(${editor}).querySelectorAll('input[type="radio"]').length`),0,'VIP does not imply appointment propagation');
  if(benefits)await evaluate(`(${vipBoxes})[0].click()`);
  if(price)await evaluate(`(${vipBoxes})[1].click()`);
  if(benefits&&price){await revealFieldset('Apply Changes to Current VIP Members');await screenshot('vip-independent-choices')}
  body=await saved();assert.equal(body.updateVipBenefits,benefits);assert.equal(body.updateVipPrice,price);assert.equal(body.applyTo,undefined);assert.ok(body.catalogVersion);
  await wait(`!!(${result})`);
  const summary=await evaluate(`(${result}).innerText`);
  if(benefits)assert.match(summary,/Included services updated for 3 memberships/i);
  if(price){assert.match(summary,/Future price updated for 3 memberships/i);assert.match(summary,/2 upcoming charges updated/i);assert.match(summary,/1 scheduled charge kept for individual review/)}
  if(benefits&&price)await screenshot('vip-update-results');
 }
 }
 // An already-open POS ticket must refresh after its saved prices change.
 await evaluate(`window.dispatchEvent(new CustomEvent('groompro:open-ticket',{detail:{ticketId:'pos-fixture'}}))`);
 const pos=`document.querySelector('[aria-label="POS Ticket"]')`;
 const payment=`[...(${pos}).querySelectorAll('label')].find(el=>el.textContent==='Amount ($)').querySelector('input')`;
 await wait(`!!(${pos})&&!!(${pos}).querySelector('[data-field="price"]')&&(${payment}).value==='50.00'`);
 assert.equal(await evaluate(`(${pos}).querySelector('[data-field="price"]').textContent`),'$50.00');
 assert.match(await evaluate(`(${pos}).querySelector('.gp-ticket-money-summary').innerText`),/Due\s*\$50\.00/);
 await evaluate(`window.__posAmount=6000;window.dispatchEvent(new CustomEvent('groompro:catalog-synced',{detail:{ticketIds:['pos-fixture']}}))`);
 await wait(`(${payment}).value==='60.00'&&(${pos}).querySelector('[data-field="price"]').textContent==='$60.00'`);
 assert.match(await evaluate(`(${pos}).querySelector('.gp-ticket-money-summary').innerText`),/Due\s*\$60\.00/);
 await screenshot('pos-updated-automatic-payment');
 // A staff-entered payment amount is independent of the revised amount due.
 await evaluate(`(${payment}).focus();(${payment}).select()`);
 await send('Input.insertText',{text:'20.00'});
 await evaluate(`(${payment}).blur()`);
 await wait(`(${payment}).value==='20.00'`);
 await evaluate(`window.__posAmount=7000;window.dispatchEvent(new CustomEvent('groompro:catalog-synced',{detail:{ticketIds:['pos-fixture']}}))`);
 await wait(`(${pos}).querySelector('[data-field="price"]').textContent==='$70.00'`);
 assert.match(await evaluate(`(${pos}).querySelector('.gp-ticket-money-summary').innerText`),/Due\s*\$70\.00/);
 assert.equal(await evaluate(`(${payment}).value`),'20.00','Keep the manually chosen payment amount');
 await screenshot('pos-retained-manual-payment');
 const beforeUnrelated=await evaluate('window.__posReads');
 await evaluate(`window.__posAmount=8000;window.dispatchEvent(new CustomEvent('groompro:catalog-synced',{detail:{ticketIds:['another-ticket']}}))`);
 await pause(600);
 assert.deepEqual(await evaluate('window.__posReads'),beforeUnrelated,'Unrelated ticket updates do not reload this POS');
 assert.equal(await evaluate(`(${pos}).querySelector('[data-field="price"]').textContent`),'$70.00');
 assert.deepEqual(networkApiRequests,[],'No business request can reach the server');
 assert.deepEqual(pageErrors,[],'No browser runtime errors');
 console.log(process.env.GROOMPRO_TEST_POS_ONLY==='1'?'PASS: open POS automatic payment $50→$60, manual $20 retained at $70 due, line/total refresh, unrelated-ticket isolation. All business APIs mocked.':'PASS: actual Services/Packages/VIP editors, NONE default/reset, ALL/FUTURE scopes, independent VIP flags, review results, refresh events, offline pending, open POS automatic/manual payment refresh and unrelated-ticket isolation, screenshots. All business APIs mocked.');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{socket?.close();chrome.kill()});
