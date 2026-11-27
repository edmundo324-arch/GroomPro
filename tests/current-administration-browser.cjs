// Isolated local browser. Business APIs are mocked and blocked at the network boundary.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const origin=process.env.GROOMPRO_TEST_ADMIN_URL||'http://127.0.0.1:33463';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Use an isolated local preview.');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'groompro-current-admin-'));
const chrome=spawn(process.env.GROOMPRO_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
let socket;
async function main(){
 let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break}catch{await pause(100)}}
 if(!port)throw Error('Test browser did not start.');
 const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 let id=0;const pending=new Map(),escaped=[],errors=[];
 const send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id,timer=setTimeout(()=>{pending.delete(requestId);reject(Error(method+' timed out'))},120000);pending.set(requestId,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id:requestId,method,params}))});
 socket.addEventListener('message',event=>{const value=JSON.parse(event.data);if(value.method==='Runtime.exceptionThrown')errors.push(value.params.exceptionDetails);if(value.method==='Fetch.requestPaused'){escaped.push(value.params.request.url);void send('Fetch.fulfillRequest',{requestId:value.params.requestId,responseCode:500,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from('{"error":"Unmocked API request"}').toString('base64')})}const callback=pending.get(value.id);if(callback){pending.delete(value.id);value.error?callback.reject(Error(value.error.message)):callback.resolve(value.result)}});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+JSON.stringify(r.exceptionDetails.exception));return r.result.value};
 const wait=async expression=>{for(let i=0;i<320;i++){if(await evaluate(expression))return;await pause(250)}throw Error('Page condition timed out: '+expression+'; state: '+JSON.stringify(await evaluate(`({url:location.href,boot:window.__boot,business:sessionStorage.getItem('fixtureBusiness'),role:sessionStorage.getItem('fixtureRole'),actions:sessionStorage.getItem('fixtureActions'),text:document.body.innerText.slice(0,1800),calls:window.__calls.slice(-8)})`)))};
 const visible="el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'";
 const adminHeading=`[...document.querySelectorAll('h1')].find(el=>el.textContent==='Master Administration'&&(${visible})(el))`;
 const modulePresent=name=>`[...document.querySelectorAll('.gp-header-menu > button,.gp-header-overflow > button')].some(el=>el.textContent.trim()===${JSON.stringify(name)})`;
 const navigate=async name=>evaluate(`(()=>{const button=[...document.querySelectorAll('.gp-header-menu > button')].find(b=>b.textContent.trim()===${JSON.stringify(name)});if(button)button.click();else{document.querySelector('[aria-label="More modules"]').click();[...document.querySelectorAll('.gp-header-overflow > button')].find(b=>b.textContent.trim()===${JSON.stringify(name)}).click()}})()`);
 const click=async label=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(label)}&&(${visible})(el));if(!b)throw Error('Missing '+${JSON.stringify(label)});b.click()})()`);
 const screenshot=async name=>{const folder='test-results/current-administration';fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(folder+'/'+name+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'))};
 const switchRole=async role=>{
  await evaluate(`window.__nextRole=${JSON.stringify(role)};document.querySelector('.gp-header-employee').click()`);
  await wait(`!!document.querySelector('[aria-label="Employee PIN"]')`);
  await evaluate(`(()=>{const input=document.querySelector('[aria-label="Employee PIN"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'123123');input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await pause(50);await evaluate(`document.querySelector('[aria-label="Employee PIN"]').closest('form').requestSubmit()`);
  await wait(`!document.querySelector('[aria-label="Employee PIN"]')&&sessionStorage.getItem('fixtureRole')===${JSON.stringify(role)}`);
 };
 await send('Page.enable');await send('Network.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*',requestStage:'Request'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  if(!sessionStorage.getItem('fixtureRole'))sessionStorage.setItem('fixtureRole','PLATFORM_OWNER');
  if(!sessionStorage.getItem('fixtureBusiness'))sessionStorage.setItem('fixtureBusiness','home');
  window.__boot=Number(sessionStorage.getItem('fixtureBoot')||0)+1;sessionStorage.setItem('fixtureBoot',String(window.__boot));
  window.__calls=[];window.__nextRole='PLATFORM_OWNER';window.__expire=false;
  const businesses=[{id:'home',name:'GroomPro'},{id:'pilot_test',name:'Happy Paws Test'}];
  const business=()=>businesses.find(b=>b.id===sessionStorage.getItem('fixtureBusiness'));
  const employee=()=>sessionStorage.getItem('fixtureRole')==='SIGNED_OUT'?null:{id:business().id==='home'?'fixture-operator':'pilot_operator_fixture',firstName:'Pat',lastName:'Tester',role:sessionStorage.getItem('fixtureRole'),active:true};
  const platform=()=>['PLATFORM_OWNER','DEVELOPER'].includes(employee()?.role);
  const originalFetch=window.fetch;
  window.fetch=async function(input,options){
   const url=new URL(typeof input==='string'?input:input.url,location.href),p=url.pathname,method=options?.method||'GET';
   if(!p.startsWith('/api/'))return originalFetch.call(this,input,options);
   window.__calls.push({path:p,method});
   if(p==='/api/setup/context')return Response.json({tenant:business(),setupRequired:false});
   if(p==='/api/ui-context')return Response.json({tenantId:business().id,locationId:'fixture-location'});
   if(p==='/api/platform-brand')return Response.json({name:'GroomPro Suite'});
   if(p==='/api/device-authorization')return Response.json({approved:true,platformAccess:true});
   if(p==='/api/employee/session'){
    if(method==='POST')sessionStorage.setItem('fixtureRole',window.__nextRole);
    if(method==='DELETE')sessionStorage.setItem('fixtureRole','SIGNED_OUT');
    return Response.json({employee:employee()});
   }
   if(p==='/api/employee/activity'){
    if(window.__expire){sessionStorage.setItem('fixtureRole','SIGNED_OUT');return Response.json({error:'Session ended.'},{status:401})}
    return Response.json({ok:true});
   }
   if(p==='/api/subscriptions')return Response.json({plans:[],features:[],planFeatures:[],subscription:null,platformAdmin:platform()});
   if(p==='/api/platform-access'){
    if(!platform())return Response.json({error:'GroomPro developer access is required.'},{status:403});
    if(method==='PATCH'){
     const b=JSON.parse(options.body),actions=JSON.parse(sessionStorage.getItem('fixtureActions')||'[]');actions.push(b);sessionStorage.setItem('fixtureActions',JSON.stringify(actions));
     if(b.action==='OPEN_BUSINESS')sessionStorage.setItem('fixtureBusiness',b.tenantId);
     if(b.action==='RETURN_HOME')sessionStorage.setItem('fixtureBusiness','home');
     return Response.json({tenant:business()});
    }
    return Response.json({tenants:businesses,currentTenantId:business().id,canReturnHome:business().id!=='home',canManageOwners:employee().role==='PLATFORM_OWNER',employees:[],businessOwnerId:'sample-owner',businessOwnerEmail:'owner@example.invalid',access:{suspended:false}});
   }
   if(p==='/api/starter-packages')return Response.json({platformAdmin:platform(),tenants:platform()?businesses:[],packages:[]});
   if(p==='/api/features')return Response.json({features:[{code:'CALENDAR',name:'Calendar',enabled:true},{code:'REPORTS',name:'Reports',enabled:true}]});
   if(p==='/api/operating-hours')return Response.json({timezone:'America/Chicago',hours:[]});
   if(p==='/api/workflow-settings')return Response.json({settings:{},businessSettings:{}});
   return Response.json({employees:[],assets:[],schedules:[],tickets:[],blocks:[],items:[],notices:[],settings:{},preferences:{},services:[],products:[],packages:[],plans:[],breeds:[],offers:[],customers:[],memberships:[],tasks:[],permissions:[]});
  };
 `});
 await send('Page.navigate',{url:origin});await wait(modulePresent('Master Administration'));
 assert.equal(await evaluate(modulePresent('Day')),true,'Calendar remains in the current blue menu');
 assert.equal(await evaluate(modulePresent('Customers')),true);assert.equal(await evaluate(modulePresent('Services')),true);
 await navigate('Master Administration');await wait(`!!(${adminHeading})`);
 await wait(`!!document.querySelector('.gp-platform-access')`);
 await click('Features & Permissions');await wait(`[...document.querySelectorAll('h2')].some(el=>el.textContent==='Features'&&(${visible})(el))`);
 await click('Businesses & Plans');
 await wait(`!!document.querySelector('.gp-platform-access')`);
 await evaluate(`document.querySelector('.gp-platform-access').open=true`);
 await wait(`!!document.querySelector('.gp-platform-access option[value="pilot_test"]')`);
 await screenshot('current-site-administration');
 const boot=await evaluate('window.__boot');
 await evaluate(`(()=>{const select=document.querySelector('.gp-platform-access [aria-label="Open a business"] select');select.value='pilot_test';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
 await wait(`[...document.querySelectorAll('.gp-platform-access button')].some(el=>/^Open business$/i.test(el.textContent.trim())&&(${visible})(el))`);
 await evaluate(`[...document.querySelectorAll('.gp-platform-access button')].find(el=>/^Open business$/i.test(el.textContent.trim())&&(${visible})(el)).click()`);
 await wait(`window.__boot>${boot}&&document.querySelector('.gp-topbar')?.getAttribute('data-business-name')==='Happy Paws Test'`);
 assert.equal(await evaluate('location.pathname'),'/');assert.equal(await evaluate(modulePresent('Day')),true);
 assert.deepEqual(await evaluate(`JSON.parse(sessionStorage.getItem('fixtureActions'))[0]`),{action:'OPEN_BUSINESS',tenantId:'pilot_test'});
 await screenshot('selected-business-workspace');
 await navigate('Master Administration');await wait(`!!(${adminHeading})`);
 await switchRole('DEVELOPER');await wait(modulePresent('Master Administration'));
 await navigate('Master Administration');await wait(`!!(${adminHeading})`);await click('Features & Permissions');
 await wait(`[...document.querySelectorAll('h2')].some(el=>el.textContent==='Features'&&(${visible})(el))`);
 for(const role of ['FRONT','MANAGER','ADMIN']){
  await switchRole(role);await wait(`!(${modulePresent('Master Administration')})&&!(${adminHeading})`);
  const before=await evaluate(`window.__calls.filter(c=>c.path==='/api/subscriptions'||c.path==='/api/platform-access').length`);
  await evaluate(`window.dispatchEvent(new CustomEvent('groompro:visual-navigate',{detail:{module:'Master Administration'}}))`);await pause(200);
  assert.equal(await evaluate(`!!(${adminHeading})`),false,'Unauthorized direct navigation stays blocked');
  assert.equal(await evaluate(`window.__calls.filter(c=>c.path==='/api/subscriptions'||c.path==='/api/platform-access').length`),before);
  assert.equal(await evaluate(modulePresent('Day')),true);
 }
 await switchRole('PLATFORM_OWNER');await wait(modulePresent('Master Administration'));await navigate('Master Administration');await wait(`!!(${adminHeading})`);
 await evaluate('window.__expire=true');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:20,y:100,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:20,y:100,button:'left',clickCount:1});
 await wait(`sessionStorage.getItem('fixtureRole')==='SIGNED_OUT'&&!(${modulePresent('Master Administration')})&&!(${adminHeading})`);
 assert.equal(await evaluate(modulePresent('Day')),true);
 assert.deepEqual(escaped,[],'No business API reaches the server');assert.deepEqual(errors,[],'No browser runtime errors');
 console.log('PASS: current-site Owner/Developer administration, both tabs, normal Calendar/menu retained, current-root business switch, regular-role denial, expiry removes admin. All business APIs mocked.');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{socket?.close();chrome.kill()});
