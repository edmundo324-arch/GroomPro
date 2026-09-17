const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const exp={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/module-navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,{exports:exp});
const modules=['Calendar','Customers','Pets','Tickets','Whiteboard','Messaging','Inventory','Reports','Services','Products','Packages','VIP Memberships','Schedule','Settings'];
test('populated API code fields and partial configuration preserve existing navigation',()=>{
 for(const features of [[],[{code:'CALENDAR',enabled:true}],[{featureCode:'CALENDAR',enabled:true}],modules.map(m=>({code:m.toUpperCase().replaceAll(' ','_'),enabled:true}))])assert.deepEqual(Array.from(exp.visibleModules(modules,features)),modules);
});
test('explicit optional opt-outs still work and Calendar is always accessible',()=>{
 const actual=Array.from(exp.visibleModules(modules,[{code:'CALENDAR',enabled:false},{code:'REPORTS',enabled:false}]));
 assert.ok(actual.includes('Calendar'));assert.ok(!actual.includes('Reports'));assert.ok(actual.includes('Customers'));
});

