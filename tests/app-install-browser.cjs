// Isolated local browser only. All business API requests are fulfilled in memory.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const origin=process.env.GROOMPRO_TEST_INSTALL_URL||'http://127.0.0.1:33461';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Use a local preview.');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'groompro-install-'));
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
 let id=0;const pending=new Map(),apiRequests=[];
 socket.addEventListener('message',event=>{const value=JSON.parse(event.data);if(value.method==='Network.requestWillBeSent'&&new URL(value.params.request.url).pathname.startsWith('/api/'))apiRequests.push(value.params.request.url);const callback=pending.get(value.id);if(callback){pending.delete(value.id);value.error?callback.reject(Error(value.error.message)):callback.resolve(value.result)}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id,timer=setTimeout(()=>{pending.delete(requestId);reject(Error(method+' timed out'))},120000);pending.set(requestId,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id:requestId,method,params}))});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+JSON.stringify(r.exceptionDetails.exception));return r.result.value};
 const wait=async expression=>{for(let i=0;i<180;i++){if(await evaluate(expression))return;await pause(500)}throw Error('Page condition timed out: '+expression)};
 const installButton=`[...document.querySelectorAll('button')].find(b=>b.textContent==='Install GroomPro')`;
 const clickInstall=async()=>{
  await evaluate(`(()=>{const button=${installButton};if(!button.getClientRects().length)document.querySelector('.gp-calendar-overflow')?.click()})()`);
  await wait(`${installButton}.getClientRects().length>0`);
  await evaluate(`${installButton}.click()`);
 };
 await send('Page.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:950,deviceScaleFactor:1,mobile:false});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__releaseSetup=null;
  const originalFetch=window.fetch;
  window.fetch=async function(input,options){
   const pathname=new URL(typeof input==='string'?input:input.url,location.href).pathname;
   if(!pathname.startsWith('/api/'))return originalFetch.call(this,input,options);
   if(pathname==='/api/setup/context')return new Promise(resolve=>{window.__releaseSetup=()=>resolve(Response.json({tenant:{id:'installation-fixture',name:'Installation Test'},setupRequired:false}))});
   if(pathname==='/api/employee/session')return Response.json({employee:null});
   if(pathname==='/api/features')return Response.json({features:[]});
   return Response.json({employees:[],assets:[],schedules:[],tickets:[],blocks:[],items:[],notices:[],settings:{},preferences:{},services:[],products:[],packages:[]});
  };
 `});
 await send('Page.navigate',{url:origin});
 await wait('!!window.__groomproInstall && !!window.__releaseSetup');
 assert.equal(await evaluate(`!!(${installButton})`),false,'Calendar has not mounted yet');
 assert.deepEqual(await evaluate(`[...document.querySelectorAll('link[rel="manifest"]')].map(link=>({href:link.getAttribute('href'),credentials:link.crossOrigin}))`),[{href:'/manifest.webmanifest',credentials:'use-credentials'}]);
 const manifest=await send('Page.getAppManifest');assert.equal(manifest.errors.length,0);assert.equal(JSON.parse(manifest.data).start_url,'/');
 assert.deepEqual((await send('Page.getInstallabilityErrors')).installabilityErrors,[]);
 assert.equal(await evaluate(`(()=>{window.__promptCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.__promptCalls++};event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event);return event.defaultPrevented})()`),true);
 await evaluate('window.__releaseSetup()');await wait(`!!(${installButton})`);
 await clickInstall();await wait('window.__promptCalls===1');
 await clickInstall();await wait('!!document.querySelector("#gp-install-title")?.closest("dialog").open');
 assert.equal(await evaluate('window.__promptCalls'),1,'Dismissed prompt cannot be reused');
 // Help must remain visible even when the narrow Calendar toolbar is closed.
 await evaluate(`document.querySelector('.gp-calendar-overflow')?.click()`);
 assert.equal(await evaluate(`document.querySelector('#gp-install-title').getBoundingClientRect().width>0`),true);
 const folder='test-results/app-install';fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(folder+'/pc-instructions.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate(`document.querySelector('[aria-label="Dismiss install instructions"]').click()`);
 await evaluate(`(()=>{const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{throw Error('Browser unavailable')};event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event)})()`);
 await clickInstall();await wait('document.querySelector("#gp-install-title").closest("dialog").open');
 await evaluate(`document.querySelector('[aria-label="Dismiss install instructions"]').click()`);
 await evaluate(`(()=>{const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.__promptCalls++};event.userChoice=new Promise(resolve=>window.__resolveChoice=resolve);window.dispatchEvent(event)})()`);
 await clickInstall();await wait(`${installButton}.disabled`);
 await evaluate(`window.__resolveChoice({outcome:'accepted'});window.dispatchEvent(new Event('appinstalled'))`);
 await wait(`!(${installButton})`);
 assert.equal(await evaluate('window.__groomproInstall.prompt'),null);
 assert.equal(await evaluate('window.__groomproInstall.installed'),true);
 assert.equal(apiRequests.length,0,'No business API calls reach the server');
 console.log('PASS: credentialed manifest and Chrome installability, early capture, cancellation, fresh prompt, failure help, pending choice, installed state. No business API requests.');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{socket?.close();chrome.kill()});
