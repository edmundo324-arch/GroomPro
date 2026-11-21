require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {readPublicHintSettings}=require('../src/lib/public-hint-settings.ts');
const {describeCustomerField}=require('../src/lib/customer-field-purpose.ts');
test('public hints use the selected tenant preference and expose no other workflow fields',async()=>{
 const client={tenantSetting:{findUnique:async({where})=>{assert.equal(where.tenantId_settingKey.settingKey,'WORKFLOW');return where.tenantId_settingKey.tenantId==='a'?{value:{helpfulHints:false,hintHighlightColor:'#316ad4',inactivityMinutes:12,privateValue:'not public'}}:null}}};
 assert.deepEqual(await readPublicHintSettings(client,'a'),{enabled:false,highlightColor:'#316ad4'});
 assert.deepEqual(await readPublicHintSettings(client,'b'),{enabled:true,highlightColor:'#c18b16'});
});
function field(name,help){return {dataset:{},matches:s=>s==='input,select,textarea',getAttribute:k=>k==='aria-label'?name:k==='data-customer-help'?help:null};}
test('customer hints have useful guidance without staff search destinations',()=>{
 const hint=describeCustomerField(field('Dog name'));
 assert.match(hint.help,/greet/);assert.equal(hint.path,'');assert.equal(hint.name,'Dog name');
 assert.equal(describeCustomerField(field('Staff discount percent')),null);
 assert.equal(describeCustomerField(field('Reminder 2','Choose when this reminder should arrive.')).help,'Choose when this reminder should arrive.');
});
