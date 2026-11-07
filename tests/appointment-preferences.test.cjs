require('./load-ts.cjs');const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const {appointmentStyle,presentationKey,presetStyle,validateStyles}=require('../src/lib/calendar-presentation.ts');
test('configured style overrides preset without hiding main color; gradient and border validated',()=>{const s=appointmentStyle({status:'CONFIRMED',lines:[{role:'GROOM'}]},{statusStyles:{'CONFIRMED|GR':{...presetStyle('CONFIRMED|GR'),color:'#123456',borderWidth:4,gradientIntensity:.25}}});assert.ok(s.background.includes('#123456'));assert.match(s.border,/^4px/);assert.throws(()=>validateStyles({READY:{color:'#ffffff',border:'#000000',gradientIntensity:2}}));assert.equal(presentationKey({status:'OPEN',isNewCustomer:true}),'ACCEPTED');assert.equal(presentationKey({status:'OPEN',displayStatus:'Waiting'}),'Waiting')});
test('service and VIP presets vary while status base remains consistent',()=>{assert.notEqual(presetStyle('CONFIRMED|FW').border,presetStyle('CONFIRMED|GR').border);assert.notEqual(presetStyle('READY|GR/FFT VIP').border,presetStyle('READY|GR').border);assert.equal(presetStyle('CONFIRMED').color,'#228B22')});
function rules(settings,tickets){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/booking-rules.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n==='./workflow-settings'?{workflowSettings:async()=>settings}:{db:{ticket:{findMany:async({where})=>tickets.filter(t=>t.id!==where.id?.not)}}},Date});return exports.checkCustomerBookingRules}
const at=new Date('2026-10-23T16:00:00Z'),rows=[{id:'a',orderNumber:1,scheduledStart:at,durationMin:30,pets:[{petId:'dog1',pet:{name:'Bella'}}]},{id:'b',orderNumber:2,scheduledStart:new Date(+at+86400000),durationMin:30,pets:[{petId:'dog2',pet:{name:'Charlie'}}]}],settings={bookingWarnings:true,warningDays:14,warningScope:'PET',warningPetMessage:'Same dog',warningHouseholdMessage:'Household'};
test('spacing warns above the configured gap and overlap remains separate',async()=>{
 const check=(days,dayOffset,scope='PET',excludeId)=>rules({...settings,warningDays:days,warningScope:scope},rows)('t','c',new Date(+at+dayOffset*86400000),30,['dog1'],excludeId);
 assert.equal((await check(30,21)).conflicts.length,0);
 assert.equal((await check(30,40)).conflicts[0].orderNumber,1);
 assert.equal((await check(1,1)).conflicts.length,0);
 assert.equal((await check(1,2)).conflicts[0].orderNumber,1);
 assert.equal((await check(1,2,'HOUSEHOLD')).conflicts.length,0);
 assert.equal((await check(30,0)).hardOverlap,true);
 assert.equal((await check(30,0,'PET','a')).conflicts.length,0);
 assert.equal((await rules({...settings,bookingWarnings:false},rows)('t','c',at,30,['dog1'])).conflicts.length,0);
});
const {resolvedStyle}=require('../src/lib/calendar-presentation.ts');
test('text color persists and legacy dark backgrounds receive readable text',()=>{const saved=validateStyles({'CONFIRMED|GR':{...presetStyle('CONFIRMED|GR'),color:'#102030',textColor:'#ffffff'}});assert.equal(appointmentStyle({status:'CONFIRMED',lines:[{role:'GROOM'}]},{statusStyles:saved}).color,'#ffffff');assert.equal(resolvedStyle('CONFIRMED|FW',{statusStyles:{CONFIRMED:{color:'#102030'}}}).textColor,'#ffffff');assert.throws(()=>validateStyles({READY:{...presetStyle('READY'),textColor:'bad'}}));const copy=resolvedStyle('CONFIRMED|GR',{statusStyles:saved});assert.deepEqual(validateStyles({'READY|FW':copy})['READY|FW'],copy)});
