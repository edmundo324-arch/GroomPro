const test=require('node:test'),assert=require('node:assert/strict');const {correction}=require('../scripts/upgrade-imported-services.cjs');
test('service correction separates imported codes and only rewrites the explicit owner examples',()=>{
 const prep=correction({name:'1111',description:'My spa day started at my pace...',code:null});assert.equal(prep.code,'1111');assert.equal(prep.name,'Prepared Before Bath');assert.match(prep.description,/comfortable with my surroundings/);
 const shampoo=correction({name:'3pl Action Antifungal-Antimicrobial Corti',description:'DaySmart service ID: Silvet-Shampoo'});assert.equal(shampoo.code,'Silvet-Shampoo');assert.equal(shampoo.name,undefined);assert.match(shampoo.description,/8-minute Silvet treatment/);
 const unrelated=correction({name:'Custom haircut',description:'DaySmart service ID: MyCode'});assert.equal(unrelated.code,'MyCode');assert.equal(unrelated.description,undefined);
 assert.equal(correction({name:'Custom haircut',code:'MyCode',description:'Keep this valid custom description.'}),null);
});
