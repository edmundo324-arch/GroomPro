require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {workflowDefaults}=require('../src/lib/workflow-defaults.ts');
function load(file,mocks={}){
 const exported={},source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(path.resolve(path.dirname(file),name+'.ts')),exported);return exported;
}
const workflow=load('src/lib/workflow-settings.ts',{'./db':{db:{}},'./manufacturer-colors':{manufacturerColors:async()=>({})}});
test('arrival display choices survive business settings validation without changing selected popup fields',()=>{
 const fields=['ticket.daycareStatus','ticket.arrivalPriority','time','customer','pet.name'];
 for(const showCalendarArrivalOrder of [true,false])for(const hoverArrivalPosition of ['TIME','DETAILS']){
  const saved=workflow.validateWorkflow({...workflowDefaults,showCalendarArrivalOrder,hoverArrivalPosition,hoverFields:fields});
  assert.equal(saved.showCalendarArrivalOrder,showCalendarArrivalOrder);assert.equal(saved.hoverArrivalPosition,hoverArrivalPosition);assert.deepEqual(saved.hoverFields,fields);
 }
});
test('older business settings keep their popup selections and gain arrival display defaults',async()=>{
 const fields=['time','customer'];const settings=await workflow.workflowSettings('business',{tenantSetting:{findUnique:async()=>({value:{hoverFields:fields}})}});
 assert.equal(settings.showCalendarArrivalOrder,true);assert.equal(settings.hoverArrivalPosition,'TIME');assert.deepEqual(settings.hoverFields,fields);
});
test('authorized personal appearance overrides persist independently of business defaults',async()=>{
 const appearance=load('src/lib/appearance-settings.ts',{'./db':{db:{tenantSetting:{findUnique:async()=>({value:{showCalendarArrivalOrder:false,hoverArrivalPosition:'DETAILS'}})}}},'./workflow-settings':{workflowSettings:async()=>({...workflowDefaults,appearanceRoles:['FRONT']})}});
 const personal=await appearance.employeeAppearance('business',{id:'front',role:'FRONT'});assert.equal(personal.showCalendarArrivalOrder,false);assert.equal(personal.hoverArrivalPosition,'DETAILS');
 const standard=await appearance.employeeAppearance('business',{id:'back',role:'BACK'});assert.equal(standard.showCalendarArrivalOrder,true);assert.equal(standard.hoverArrivalPosition,'TIME');
});
