// Run against an isolated local sales preview; never against a business site.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const origin=process.env.GROOMPRO_TEST_SALES_URL||'http://127.0.0.1:33460';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Use a local sales preview.');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'groompro-questionnaire-'));
const chrome=spawn(process.env.GROOMPRO_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking',
 '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
],{stdio:'ignore',windowsHide:true});
let socket;
async function main(){
 let port;
 for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{await pause(100);}}
 if(!port)throw Error('Test browser did not start.');
 const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let id=0;const pending=new Map(),apiRequests=[];
 socket.addEventListener('message',event=>{const value=JSON.parse(event.data);if(value.method==='Network.requestWillBeSent'&&new URL(value.params.request.url).pathname.startsWith('/api/'))apiRequests.push(value.params.request.url);const callback=pending.get(value.id);if(callback){pending.delete(value.id);value.error?callback.reject(Error(value.error.message)):callback.resolve(value.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id,timer=setTimeout(()=>{pending.delete(requestId);reject(Error(method+' timed out'));},120000);pending.set(requestId,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id:requestId,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+JSON.stringify(r.exceptionDetails.exception));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<180;i++){if(await evaluate(expression))return;await pause(500);}throw Error('Page condition timed out: '+expression);};
 const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await pause(100);};
 const button=async text=>{await evaluate(`Array.from(document.querySelectorAll('#your-groompro-tour button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`);await pause(100);};
 const hasTopic=topic=>evaluate(`!!document.querySelector('[data-tour-topic="${topic}"]')`);
 await send('Page.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:origin+'/#your-groompro-tour'});
 await wait(`!!document.querySelector('input[name="business"]')`);
 await button('Next');assert.match(await evaluate(`document.querySelector('#your-groompro-tour [role="alert"]').textContent`),/business type/);
 assert.equal(await evaluate(`document.activeElement.getAttribute('role')`),'alert');
 await click('input[name="business"][value="mobile"]');await click('input[name="team"][value="solo"]');await button('Next');
 await click('input[name="records"][value="paper"]');await click('input[name="bookings"][value="phone"]');await click('input[name="bookings"][value="checkout"]');
 await evaluate(`(()=>{const field=document.querySelector('input[name="software"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'Paper & Phone');field.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await button('Next');await click('input[name="services"][value="wash"]');await button('Next');
 for(const goal of ['messages','booking','checkout'])await click('input[name="goals"][value="'+goal+'"]');
 assert.equal(await evaluate(`document.querySelector('input[name="goals"][value="reports"]').disabled`),true);
 await button('Build My Tour & Lessons');
 assert.equal(await evaluate(`document.querySelector('[data-tour-topic]').dataset.tourTopic`),'messages');
 assert.equal(await hasTopic('team'),false);assert.equal(await hasTopic('inventory'),false);
 assert.match(await evaluate(`document.querySelector('.gp-tour-video-note').textContent`),/not been recorded/);
 assert.equal(await evaluate(`document.querySelectorAll('#your-groompro-tour video').length`),0);
 await button('Training Lessons');assert.equal(await evaluate(`document.querySelector('[data-tour-topic]').dataset.tourTopic`),'booking');
 await send('Page.reload');await wait(`!!document.querySelector('[data-tour-topic]')`);
 assert.match(await evaluate(`document.querySelector('.gp-tour-results-heading h3').textContent`),/Training Lessons/);
 assert.match(await evaluate(`document.querySelector('.gp-tour-results-heading').textContent`),/Paper & Phone/);
 await button('Edit Answers');await click('input[name="team"][value="small"]');await click('input[name="business"][value="salon"]');await button('Next');await button('Next');
 for(const service of ['retail','prepaid','vip'])await click('input[name="services"][value="'+service+'"]');
 await button('Next');await button('Build My Tour & Lessons');
 for(const topic of ['team','inventory','prepaid','vip'])assert.equal(await hasTopic(topic),true);
 const folder='test-results/sales-questionnaire';fs.mkdirSync(folder,{recursive:true});
 await evaluate(`document.querySelector('#your-groompro-tour').scrollIntoView()`);
 fs.writeFileSync(folder+'/results-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
 await evaluate(`document.querySelector('#your-groompro-tour').scrollIntoView()`);
 assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),true,'Questionnaire must fit a phone');
 fs.writeFileSync(folder+'/results-phone.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await button('Start Over');assert.equal(await evaluate(`document.querySelectorAll('#your-groompro-tour input:checked').length`),0);
 await send('Page.reload');await wait(`!!document.querySelector('input[name="business"]')`);
 assert.equal(await evaluate(`document.querySelectorAll('#your-groompro-tour input:checked').length`),0);
 await evaluate(`Storage.prototype.setItem=function(){throw Error('Storage unavailable')}`);
 await click('input[name="business"][value="salon"]');
 await wait(`document.querySelector('.gp-tour-privacy').textContent.includes('cannot save')`);
 await click('input[name="team"][value="solo"]');await button('Next');
 assert.equal(await evaluate(`!!document.querySelector('input[name="records"]')`),true);
 assert.deepEqual(apiRequests,[],'Questionnaire must not call business APIs or submit visitor answers');
 console.log('Passed: required answers, focus, goal limit, personalized sales/training, reload, editing, reset, unavailable storage, phone layout, no API requests.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();chrome.kill();});
