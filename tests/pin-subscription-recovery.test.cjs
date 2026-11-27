const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
function load(file,deps){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(key=>key in deps?deps[key]:require(key),exports);return exports;}
const responseObject=load('src/lib/response-object.ts',{});
function hooks(){let index=0,states=[],effects=[];return {api:{useState:initial=>{const i=index++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]},useRef:initial=>{const i=index++;return states[i]||(states[i]={current:initial})},useEffect:(callback,deps)=>{const i=index++,before=states[i];if(!before||deps.some((v,n)=>v!==before[n])){states[i]=deps;effects.push(callback)}}},render:fn=>{index=0;return fn()},effects:()=>{const list=effects;effects=[];list.forEach(fn=>fn())}};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('PIN sign-in distinguishes an empty hosting response, retries, and accepts only a completed sign-in',async()=>{
 const h=hooks(),events=[],signed=[];let replies=[new Response('',{status:502}),Response.json({employee:{id:'employee',role:'GROOMER'}})];const oldFetch=global.fetch,oldWindow=global.window;
 global.fetch=async()=>replies.shift();global.window={dispatchEvent:event=>events.push(event.type)};
 try{const {usePinSignIn}=load('src/components/use-pin-sign-in.ts',{react:h.api,'../lib/response-object':responseObject});let current;const render=()=>current=h.render(()=>usePinSignIn(true,result=>signed.push(result)));render();h.effects();current.setPin('654321');render();await current.submit();render();assert.match(current.error,/did not return a completed sign-in response/);assert.equal(signed.length,0);assert.equal(current.pin,'654321');await current.submit();render();assert.equal(signed[0].employee.id,'employee');assert.deepEqual(events,['groompro:identity-changed']);assert.equal(current.error,'');assert.equal(current.pin,'');}
 finally{global.fetch=oldFetch;global.window=oldWindow;}
});
test('PIN sign-in preserves device verification and does not report a workspace callback failure as an invalid PIN',async()=>{
 const h=hooks();let required=0,throwCallback=false,response={deviceVerificationRequired:true};const oldFetch=global.fetch,oldWindow=global.window;global.fetch=async()=>Response.json(response,{status:response.deviceVerificationRequired?401:200});global.window={dispatchEvent(){}};
 try{const {usePinSignIn}=load('src/components/use-pin-sign-in.ts',{react:h.api,'../lib/response-object':responseObject});let current;const render=()=>current=h.render(()=>usePinSignIn(true,()=>{if(throwCallback)throw Error('Workspace unavailable')},{onDeviceRequired:()=>required++}));render();h.effects();current.setPin('654321');render();await current.submit();render();assert.equal(required,1);assert.equal(current.pin,'');response={employee:{id:'employee'}};throwCallback=true;current.setPin('654321');render();await current.submit();render();assert.match(current.error,/PIN was accepted/);}
 finally{global.fetch=oldFetch;global.window=oldWindow;}
});
test('failed employee switching rolls back ending the previous session',async()=>{
 let saved=[{id:'previous',tenantId:'business',deviceId:'device',endedAt:null}],fail=true;
 const db={$transaction:async run=>{const draft=structuredClone(saved);const tx={employeeSession:{updateMany:async({where,data})=>{for(const row of draft)if(row.tenantId===where.tenantId&&row.deviceId===where.deviceId&&row.endedAt===null)Object.assign(row,data)},create:async({data})=>{if(fail)throw Error('Create unavailable');const row={id:'new',...data};draft.push(row);return row}}};const result=await run(tx);saved=draft;return result}};
 const {startEmployeeSession}=load('src/lib/employee-session.ts',{'./action-context':{},'./request-authorization':{},'next/headers':{},'./workflow-settings':{},'./db':{db}});
 await assert.rejects(startEmployeeSession('business','employee','device'),/Create unavailable/);assert.equal(saved[0].endedAt,null);assert.equal(saved.length,1);fail=false;assert.equal((await startEmployeeSession('business','employee','device')).id,'new');assert.ok(saved[0].endedAt);assert.equal(saved[1].userId,'employee');
});
const walk=(node,predicate)=>{if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...([node.props?.children].flat(Infinity)).flatMap(child=>walk(child,predicate))]};
test('business plans recover from empty responses without hiding independent business controls or replacing saved plans',async()=>{
 const h=hooks(),PlatformAccessSettings=()=>null;let reply=new Response('',{status:200});const data={plans:[{id:'plan',code:'STANDARD',name:'Standard',monthlyCents:0}],features:[],planFeatures:[],subscription:{plan:'STANDARD'},platformAdmin:true};
 const {SubscriptionSettings}=load('src/components/subscription-settings.tsx',{react:h.api,'../lib/response-object':responseObject,'./help-popup':{HelpPopup:()=>null},'../lib/grooming-experience':{groomingExperienceFeature:'CARE'},'./currency-input':{CurrencyInput:()=>null},'./platform-access-settings':{PlatformAccessSettings},'../lib/employee-fetch':{employeeFetch:async()=>reply}});
 let tree;const render=()=>tree=h.render(()=>SubscriptionSettings({platformAccessFirst:true}));render();h.effects();await tick();render();assert.equal(walk(tree,node=>node.type===PlatformAccessSettings).length,1);assert.equal(walk(tree,node=>node.props?.role==='alert').length,1);let retry=walk(tree,node=>node.type==='button'&&node.props.children==='Retry')[0];assert.ok(retry);reply=Response.json(data);retry.props.onClick();await tick();render();assert.equal(walk(tree,node=>node.props?.role==='alert').length,0);assert.ok(walk(tree,node=>node.type==='strong'&&String(node.props.children).includes('Standard')).length);
});
test('employee and subscription service failures return safe JSON without exposing database details',async()=>{
 const oldError=console.error,logged=[];console.error=(...args)=>logged.push(args);
 try{
  const fail=()=>{throw Object.assign(Error('Database password should never appear'),{code:'P1001'})};
  const common={'next/server':{NextResponse:{json:Response.json}},'@/src/lib/db':{},'@/src/lib/audit':{}};
  const pin=load('app/api/employee/session/route.ts',{...common,'@/src/lib/device-authorization':{},'@/src/lib/roles':{},'@/src/lib/pin-vault':{},'@/src/lib/platform-restrictions':{},'@/src/lib/pin':{},'@/src/lib/employee-session':{createDeviceId:()=> 'device'},'@/src/lib/pin-attempts':{allowPinAttempt:fail},'@/src/lib/business-context':{},'@/src/lib/platform-business':{}});
  const r=await pin.POST({headers:{get:()=> 'business'},cookies:{get:()=>undefined},json:async()=>({pin:'654321'})});assert.equal(r.status,503);assert.equal((await r.json()).code,'SIGN_IN_UNAVAILABLE');
  const subscriptions=load('app/api/subscriptions/route.ts',{...common,'@/src/lib/grooming-experience':{},'@/src/lib/request-policy':{withRequestPolicy:()=>fail},'@/src/lib/platform-access':{}});const result=await subscriptions.GET({});assert.equal(result.status,503);assert.equal((await result.json()).code,'SUBSCRIPTIONS_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(logged),/password|654321/);assert.ok(logged.every(row=>row[1].code==='P1001'));
 }finally{console.error=oldError}
});
