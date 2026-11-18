const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {inboundSmsPreference}=require('../src/lib/sms-preference.ts');
test('provider preference classification takes precedence, including custom keywords',()=>{
 assert.equal(inboundSmsPreference(new URLSearchParams({OptOutType:'STOP',Body:'custom'})),false);
 assert.equal(inboundSmsPreference(new URLSearchParams({OptOutType:'START',Body:'custom'})),true);
 assert.equal(inboundSmsPreference(new URLSearchParams({OptOutType:'HELP',Body:'STOP'})),null);
});
test('standalone STOP/START keywords change texting but normal appointment replies do not',()=>{
 for(const Body of ['STOP',' stopall ','unsubscribe','Cancel','END','QUIT','REVOKE','OPTOUT'])assert.equal(inboundSmsPreference(new URLSearchParams({Body})),false);
 for(const Body of ['START','unstop'])assert.equal(inboundSmsPreference(new URLSearchParams({Body})),true);
 for(const Body of ['YES','Please cancel my appointment','Do not stop','help',''])assert.equal(inboundSmsPreference(new URLSearchParams({Body})),null);
});
