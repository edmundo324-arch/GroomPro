require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const {defaultCompensation}=require('../src/lib/compensation-rules.ts');
const rules={...defaultCompensation,hourlyCents:1850,basePercent:40,tiers:[{minimumAverage:6,minimumDaysEmployed:90,percent:45}],rules:[{scope:'SERVICE',match:'BATH',method:'PER_DOG',amount:500},{scope:'PRODUCT',match:'*',method:'PERCENT',amount:10},{scope:'PACKAGE',match:'FW',method:'PER_UNIT',amount:400},{scope:'VIP_FIRST_BILLING',match:'*',method:'PERCENT',amount:12}]};
const record=(extra={})=>({rules:structuredClone(rules),dateOfHire:'2026-01-15T12:00:00Z',workedDates:['2026-11-01','2026-11-02'],from:'2026-10-28',through:'2026-11-27',metric:{dogs:12,workedDays:2,average:6},qualification:{qualifiedPercent:45,appliedPercent:40,approvalPending:true},...extra});
function fixture(initiallyOpen=true){
 const slots=[],effects=[],requests=[];let cursor=0,dirty=true,tree;
 const hooks={
  useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;dirty=true}]},
  useRef:initial=>{const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index]},
  useEffect:(effect,deps)=>{const index=cursor++,previous=slots[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous[i]))){slots[index]=deps;effects.push(effect)}},
 };
 const jsx=(type,props)=>({type,props}),exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/employee-compensation.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>{
  if(id==='react')return hooks;if(id==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};if(id.endsWith('.css'))return {};
  if(id.endsWith('employee-payroll-method'))return {EmployeePayrollMethod:()=>null};
  if(id.endsWith('employee-fetch'))return {employeeFetch:(url,options)=>new Promise(resolve=>requests.push({url,body:JSON.parse(options.body),resolve}))};
  if(id.endsWith('form-hydration'))return require('../src/lib/form-hydration.ts');if(id.endsWith('compensation-rules'))return require('../src/lib/compensation-rules.ts');throw Error(id);
 }});
 const root=exports.EmployeeCompensation({userId:'employee',initiallyOpen});
 const render=()=>{cursor=0;dirty=false;tree=root.type(root.props);for(const effect of effects.splice(0))effect()};
 const flush=async()=>{for(let i=0;i<12;i++){if(dirty)render();await Promise.resolve()}};
 const text=node=>node==null||typeof node==='boolean'?'':typeof node==='object'?(Array.isArray(node)?node.map(text).join(''):text(node.props?.children)):String(node);
 const nodes=(predicate,node=tree)=>node==null||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>nodes(predicate,child??null)):[...(predicate(node)?[node]:[]),...nodes(predicate,node.props?.children??null)];
 const button=label=>nodes(node=>node.type==='button'&&text(node)===label)[0];
 const field=label=>{const container=nodes(node=>node.type==='label'&&text(node).startsWith(label))[0];return nodes(node=>['input','textarea','select'].includes(node.type),container)[0]};
 render();
 return {requests,flush,button,field,nodes,text,rerender:()=>{dirty=true},click:async label=>{const found=button(label);assert.ok(found,label+' exists');found.props.onClick();await flush()},change:async(label,value)=>{const found=field(label);assert.ok(found,label+' exists');found.props.onChange({target:{value,checked:value}});await flush()},reply:async(index,value,ok=true)=>{requests[index].resolve({ok,json:async()=>value});await flush()},get tree(){return tree}};
}

test('automatic compensation loading runs once, failed loading disables writes, and retry restores saved data',async()=>{
 const f=fixture();await f.flush();assert.equal(f.requests.length,1);assert.equal(f.requests[0].body.action,'VIEW');assert.ok(f.button('Save Compensation').props.disabled);
 assert.ok(f.field('Hourly Rate ($)'));assert.ok(f.field('Base Service Commission (%)'));assert.ok(f.field('Participates in Tips'));
 f.rerender();await f.flush();assert.equal(f.requests.length,1);await f.reply(0,{error:'Saved compensation is temporarily unavailable.'},false);
 assert.ok(f.button('Retry Loading Compensation'));assert.ok(f.button('Save Compensation').props.disabled);assert.ok(f.nodes(node=>node.type==='fieldset'&&node.props.className==='gp-compensation-content')[0].props.disabled);
 await f.click('Save Compensation');assert.equal(f.requests.length,1,'Even a direct handler call cannot save unloaded defaults');
 const retry=f.button('Retry Loading Compensation');retry.props.onClick();retry.props.onClick();await f.flush();assert.equal(f.requests.length,2);
 await f.reply(1,{});assert.ok(f.button('Save Compensation').props.disabled,'An empty successful response is not a loaded record');await f.click('Retry Loading Compensation');await f.reply(2,record());assert.equal(f.field('Hourly Rate ($)').props.value,18.5);assert.equal(f.field('Hire Date').props.value,'2026-01-15');assert.equal(f.field('Actual Worked Dates').props.value,'2026-11-01, 2026-11-02');assert.equal(f.button('Save Compensation').props.disabled,false);
});

test('saving keeps all commission choices and worked dates, preserves concurrent edits, and requires conflict review',async()=>{
 const f=fixture();await f.reply(0,record());await f.change('Hourly Rate ($)','22.75');await f.change('Base Service Commission (%)','45');
 await f.click('Save Compensation');const sent=f.requests[1].body;assert.equal(sent.action,'SAVE');assert.equal(sent.userId,'employee');assert.equal(sent.rules.hourlyCents,2275);assert.equal(sent.rules.basePercent,45);assert.deepEqual(sent.rules.tiers,rules.tiers);assert.deepEqual(sent.rules.rules,rules.rules);assert.equal(sent.dateOfHire,'2026-01-15');assert.deepEqual(sent.workedDates,['2026-11-01','2026-11-02']);
 await f.change('Base Service Commission (%)','55');await f.reply(1,record({rules:{...sent.rules,basePercent:50}}));
 assert.equal(f.field('Base Service Commission (%)').props.value,55,'An in-flight save cannot erase newer edits');assert.ok(f.button('Keep My Edits'));assert.ok(f.button('Save Compensation').props.disabled);
 await f.click('Save Compensation');assert.equal(f.requests.length,2);await f.click('Use Saved Values');assert.equal(f.field('Base Service Commission (%)').props.value,50);assert.equal(f.button('Save Compensation').props.disabled,false);
 await f.click('Approve Qualified Rate');assert.equal(f.requests[2].body.approveQualification,true);assert.equal(f.requests[2].body.rules.basePercent,50);await f.reply(2,record({rules:{...sent.rules,basePercent:50,approvedPercent:45},qualification:{qualifiedPercent:45,appliedPercent:45,approvalPending:false}}));assert.equal(f.button('Approve Qualified Rate'),undefined);assert.match(f.text(f.tree),/Closed tickets keep their original earnings/);
});

test('turning pay rules off keeps the visible fields and unsaved values while saving the existing opt-out representation',async()=>{
 const f=fixture();await f.reply(0,record());const count=f.nodes(node=>node.type==='input'||node.type==='select').length;
 await f.change('Hourly Rate ($)','23');await f.change('Use These Pay & Commission Settings',false);assert.equal(f.nodes(node=>node.type==='input'||node.type==='select').length,count);assert.equal(f.field('Hourly Rate ($)').props.value,23);assert.ok(f.nodes(node=>node.props.className==='gp-compensation-basic')[0].props.disabled);
 await f.change('Use These Pay & Commission Settings',true);assert.equal(f.field('Hourly Rate ($)').props.value,23);await f.change('Use These Pay & Commission Settings',false);await f.change('Actual Worked Dates','2026-11-01, 2026-11-03');await f.click('Save Compensation');assert.equal(f.requests[1].body.rules,null);assert.deepEqual(f.requests[1].body.workedDates,['2026-11-01','2026-11-03']);
});

test('existing callers keep the explicit Manage Compensation opener',async()=>{
 const f=fixture(false);await f.flush();assert.equal(f.requests.length,0);assert.ok(f.button('Manage Compensation'));await f.click('Manage Compensation');assert.equal(f.requests.length,1);assert.equal(f.requests[0].body.action,'VIEW');
});
