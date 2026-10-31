require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {validateVisualLayout,retainLayoutVersions,preserveTicketSizes,layoutEqual}=require('../src/lib/visual-layout.ts');
const {defaultTicketLayout}=require('../src/lib/pos-layout.ts');
const {applyBusinessTiming}=require('../src/lib/business-ticket-timing.ts');
const {saveLayoutVersion}=require('../src/lib/visual-layout-store.ts');
test('tenant labels, colors and order preserve Developer dimensions; size escalation and CSS injection are rejected',()=>{
 const previous={controls:{date:{width:140,fontSize:13}}};
 const value=validateVisualLayout({controls:{date:{label:'Visit date',color:'#123456',background:'#abcdef',order:2}}},false,previous);
 assert.deepEqual(value.controls.date,{label:'Visit date',color:'#123456',background:'#abcdef',order:2,width:140,fontSize:13});
 assert.throws(()=>validateVisualLayout({controls:{date:{width:200}}},false,previous),/Only Developers/);
 assert.equal(validateVisualLayout({controls:{date:{width:200,height:44,fontSize:16}}},true,previous).controls.date.width,200);
 assert.equal(validateVisualLayout({controls:{}},false,previous).controls.date.width,140);
 assert.throws(()=>validateVisualLayout({controls:{date:{color:'url(javascript:alert(1))'}}},true),/valid color/);
 assert.throws(()=>validateVisualLayout({controls:{date:{order:-1}}},true),/order/);
});
test('history retains exactly five independent configurations; object key order does not create versions',()=>{
 let history=[];for(let i=0;i<8;i++)history=retainLayoutVersions(history,{controls:{save:{label:'Save '+i}}},'developer',{controls:{}},new Date(2026,9,31,9,i));
 assert.equal(history.length,5);assert.equal(new Set(history.map(h=>h.id)).size,5);assert.equal(history[0].value.controls.save.label,'Save 3');assert.equal(history.at(-1).value.controls.save.label,'Save 7');
 assert.ok(layoutEqual({controls:{date:{label:'Date',color:'#ffffff'}}},{controls:{date:{color:'#ffffff',label:'Date'}}}));
 const unchanged=retainLayoutVersions(history,history.at(-1).value,'developer',{});assert.equal(unchanged.length,5);assert.equal(unchanged.at(-1).id,history.at(-1).id);
});
test('POS typeset size is protected on the server independently of visual editor visibility',()=>{
 const value={desktop:defaultTicketLayout(),phone:defaultTicketLayout()},previous=structuredClone(value);value.desktop.fontSize=16;
 assert.throws(()=>preserveTicketSizes(value,previous,false),/Only Developers/);assert.equal(preserveTicketSizes(value,previous,true).desktop.fontSize,16);
});
test('business timing recalculates all open tickets and drafts without changing dates, assignments or closed history',async()=>{
 const updates=[],draftUpdates=[],lineData=[{lineType:'SERVICE',durationMin:30,quantity:1},{lineType:'SERVICE',durationMin:60,quantity:1}],oldDraft={ticket:{customer:{id:'customer'},timingMode:'SEQUENTIAL',lines:lineData},newStart:'2026-10-31T09:00'};
 const tx={$queryRaw:async()=>[],ticket:{findMany:async query=>{assert.deepEqual(query.where,{tenantId:'business',status:{notIn:['CLOSED','CANCELLED','NO_SHOW']}});return [{id:'open',timingMode:'SEQUENTIAL',durationMin:90,lines:lineData},{id:'same',timingMode:'CONCURRENT',durationMin:60,lines:lineData}]},update:async value=>updates.push(value)},posDraft:{findMany:async query=>{assert.deepEqual(query.where,{tenantId:'business',promotedAt:null});return [{id:'draft',payload:oldDraft}]},update:async value=>draftUpdates.push(value)}};
 assert.equal(await applyBusinessTiming(tx,'business','CONCURRENT'),1);assert.deepEqual(updates,[{where:{id:'open'},data:{timingMode:'CONCURRENT',durationMin:60}}]);
 assert.equal(draftUpdates[0].data.payload.ticket.timingMode,'CONCURRENT');assert.equal(draftUpdates[0].data.payload.newStart,oldDraft.newStart);assert.deepEqual(draftUpdates[0].data.payload.ticket.customer,{id:'customer'});assert.equal(oldDraft.ticket.timingMode,'SEQUENTIAL');
});
test('configuration history storage is scoped to the business and module and never includes customer records',async()=>{
 const writes=[],tx={tenantSetting:{findUnique:async({where})=>{assert.equal(where.tenantId_settingKey.tenantId,'business');return null},upsert:async v=>writes.push(v)}};
 await saveLayoutVersion(tx,'business','Calendar:phone',{controls:{save:{label:'Book'}}},{controls:{}},'owner');assert.equal(writes[0].create.settingKey,'LAYOUT_HISTORY:Calendar:phone');assert.equal(writes[0].create.value.length,2);assert.ok(writes[0].create.value.every(v=>v.value.controls));
});
test('POS sample renders actual shared editable-item table and controls instead of placeholder blocks',()=>{
 const {TicketLayoutPreview}=require('../src/components/pos-layout-controls.tsx');const html=renderToStaticMarkup(React.createElement(TicketLayoutPreview,{layout:defaultTicketLayout()}));
 assert.ok(html.includes('gp-pos-table'));assert.ok(html.includes('gp-pos-pet-strip'));assert.ok(html.includes('gp-pos-promotions'));assert.ok(html.includes('type="date"'));assert.ok(html.includes('type="time"'));assert.ok(html.includes('Edit customer'));assert.ok(html.includes('Change customer'));assert.ok(!html.includes('gp-layout-preview-control'));assert.ok(html.includes('$86.60'));assert.ok(html.includes('data-pos-control="recordPayment"'));
});
