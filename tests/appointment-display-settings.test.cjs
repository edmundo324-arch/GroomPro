require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {workflowDefaults}=require('../src/lib/workflow-defaults.ts');
const {appointmentDisplay}=require('../src/lib/appointment-display.ts');
function load(file,mocks={}){const exported={},source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(path.resolve(path.dirname(file),name+'.ts')),exported);return exported;}
const workflow=load('src/lib/workflow-settings.ts',{'./db':{db:{}},'./manufacturer-colors':{manufacturerColors:async()=>({})}});
const fields=[{key:'time',row:0,bold:true},{key:'ticket.arrivalPriority',row:0,bold:true},{key:'pet.name',row:1,bold:false},{key:'pet.breed',row:1,bold:false}];
test('appointment details save line positions and emphasis without changing hover or colors',()=>{
 const original={...workflowDefaults,appointmentDisplay:{fields},hoverFields:['pet.name','ticket.notes'],statusStyles:{}};
 const before=JSON.stringify(original),saved=workflow.validateWorkflow(original);
 assert.deepEqual(saved.appointmentDisplay,{fields});assert.deepEqual(saved.hoverFields,original.hoverFields);assert.deepEqual(saved.statusStyles,{});assert.equal(JSON.stringify(original),before);
 assert.deepEqual(appointmentDisplay(saved),{fields});assert.equal(workflow.validateWorkflow({...workflowDefaults,showCalendarArrivalOrder:false}).appointmentDisplay.fields.some(field=>field.key==='ticket.arrivalPriority'),false);
});
test('business and employee appointment-detail choices remain separate and keep legacy arrival preference',async()=>{
 let personal={showCalendarArrivalOrder:false};const standard={...workflowDefaults,appointmentDisplay:{fields},appearanceRoles:['FRONT']},before=JSON.stringify(standard);
 const appearance=load('src/lib/appearance-settings.ts',{'./db':{db:{tenantSetting:{findUnique:async()=>({value:personal})}}},'./workflow-settings':{workflowSettings:async()=>standard}});
 const employee=await appearance.employeeAppearance('business',{id:'front',role:'FRONT'});
 assert.equal(employee.appointmentDisplay.fields.some(field=>field.key==='ticket.arrivalPriority'),false);assert.equal(employee.appointmentDisplay.fields.find(field=>field.key==='pet.breed').row,1);assert.equal(JSON.stringify(standard),before);
 personal={appointmentDisplay:{fields:[{key:'customer',row:0,bold:true}]}};
 assert.deepEqual((await appearance.employeeAppearance('business',{id:'front',role:'FRONT'})).appointmentDisplay,personal.appointmentDisplay);
 assert.deepEqual((await appearance.employeeAppearance('business',{id:'back',role:'BACK'})).appointmentDisplay,{fields});
});
test('Calendar appearance snapshots include selected appointment details',async()=>{
 const snapshot=load('src/lib/module-layout-snapshot.ts',{'./workflow-settings':{workflowSettings:async()=>({...workflowDefaults,appointmentDisplay:{fields}})},'./visual-layout-store':{saveLayoutVersion:async()=>[]}});
 const saved=await snapshot.moduleLayoutSnapshot({tenantSetting:{findMany:async()=>[]}},'business','Calendar');assert.deepEqual(saved.appearance.appointmentDisplay,{fields});
});
test('factory appearance carries an explicit empty configuration so reset removes custom fields',()=>{
 assert.equal(workflowDefaults.appointmentDisplay,null);
 const reset=workflow.validateWorkflow({...workflowDefaults,appointmentDisplay:{fields:[{key:'customer',row:5,bold:false}]},...Object.fromEntries(['appointmentDisplay','showCalendarArrivalOrder'].map(key=>[key,workflowDefaults[key]]))});
 assert.deepEqual(reset.appointmentDisplay,appointmentDisplay({}));
});
