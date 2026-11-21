require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function fixture(change){
 let current=true,customerId='customer',writes=0;const errors=[];
 const rule={id:'00000000-0000-4000-8000-000000000001',revision:1,name:'VIP follow-up',event:'MEMBERSHIP_CANCEL_REQUESTED',state:'ACTIVE',activatedAt:'2020-01-01',existingRecords:'INCLUDE',delayMinutes:0,locationIds:[],conditions:{vip:'ANY',upcoming:'ANY',attendance:'ANY',tagIds:[]},actions:[{id:'00000000-0000-4000-8000-000000000002',kind:'TASK',title:'Call customer',body:'Discuss the request.',assigneeIds:['csr'],channels:[]}]};
 const audit={id:'event',entityType:'MEMBERSHIP',entityId:'membership',customerId:'customer',action:'MEMBERSHIP_CANCEL',occurredAt:new Date(Date.now()-10000)};
 const db={tenant:{findFirst:async()=>({id:'tenant'})},tenantSetting:{findMany:async()=>[{value:rule}],upsert:async q=>errors.push(q)},auditEntry:{findMany:async()=>[audit]}};
 const load=async()=>current?{customerId,timezone:'America/Chicago',values:{customerName:'Maria'},context:{id:'event',event:rule.event,occurredAt:audit.occurredAt.toISOString(),locationId:'shop',current:true,facts:{vipActive:true,hasUpcomingAppointment:false,attendanceConfirmed:false,tagIds:[]}}}:null;
 const deps={'./db':{db},'./platform-restrictions':{platformRestriction:async()=>null},'./feature-access':{isFeatureEnabled:async()=>true},'./custom-rule-membership-event':{membershipRuleEvent:()=>rule.event,loadMembershipRuleEvent:load},'./custom-rule-staff-actions':{recordRuleStaffAction:async(_db,_tenant,_rule,_action,event)=>{if(change==='resolved')current=false;if(change==='owner')customerId='different';assert.equal(typeof event.validate,'function');if(await event.validate(db))writes++;}},'./custom-rule-message':{sendCustomRuleMessage:async()=>{throw Error('No messages expected')}},'./appointment-message-store':{},'./custom-rule-balance-runner':{},'./custom-rule-booking-runner':{},'./custom-rule-task-runner':{}};
 const api={};new Function('require','exports',ts.transpileModule(fs.readFileSync('src/lib/custom-rule-runner.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>deps[n]||require('../src/lib/'+n.slice(2)+'.ts'),api);
 return {run:()=>api.runCustomStaffRules(null,db),errors,get writes(){return writes}};
}
test('VIP staff follow-up checks the current request before writing',async()=>{const f=fixture();await f.run();assert.equal(f.errors.length,0);assert.equal(f.writes,1)});
test('resolved or reassigned VIP requests cannot create obsolete staff tasks',async()=>{for(const change of ['resolved','owner']){const f=fixture(change);await f.run();assert.equal(f.errors.length,0);assert.equal(f.writes,0)}});
