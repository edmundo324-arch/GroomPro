require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {describeField}=require('../src/lib/field-discovery.ts');
const {fieldPurposes}=require('../src/lib/field-purpose.ts');
function pair(name,aria,help){
 const label={dataset:{},matches:()=>false,closest:()=>null,cloneNode:()=>({textContent:name,querySelectorAll:()=>[]}),querySelector:()=>control,getAttribute:()=>null};
 const control={dataset:{},matches:selector=>selector==='input,select,textarea',closest:()=>null,labels:[label],querySelector:()=>null,getAttribute:key=>key==='aria-label'?aria:key==='data-help'?help:null};
 return {label,control};
}
test('short field label and its specifically named control share the reviewed purpose',()=>{
 const old=global.document;global.document={querySelector:()=>null};
 try{for(const [label,aria] of [['Percent','Staff discount percent'],['Received by','Deposit payment method'],['Show','Show calendar resources']]){
  const fields=pair(label,aria,null);
  assert.equal(describeField(fields.label).help,fieldPurposes[aria]);
  assert.equal(describeField(fields.control).help,fieldPurposes[aria]);
  assert.equal(describeField(fields.label).name,label);
 }}finally{global.document=old;}
});
test('field-specific guidance wins and an unknown field does not invent a business rule',()=>{
 const old=global.document;global.document={querySelector:()=>null};
 try{const fields=pair('Received by','Deposit payment method','This form has its own reviewed guidance.');
 assert.equal(describeField(fields.label).help,'This form has its own reviewed guidance.');
 assert.equal(describeField(pair('Unreviewed field','Unreviewed control',null).label).help,'');
 }finally{global.document=old;}
});
