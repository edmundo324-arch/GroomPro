require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {conversationPolicy,conversationResumeAt}=require('../src/lib/conversation-policy.ts');
const policy=conversationPolicy();
const resume=(sent,reply,overrides={})=>conversationResumeAt('PAUSE_NEXT_MONTH',null,null,new Date(sent),new Date(reply),'America/Chicago',conversationPolicy(overrides)).toISOString();
test('approved factory cutoff uses original offer date, next month uses customer reply date',()=>{
 assert.equal(resume('2026-11-22T18:00:00Z','2026-11-28T18:00:00Z'),'2026-12-01T15:00:00.000Z');
 assert.equal(resume('2026-11-23T18:00:00Z','2026-11-28T18:00:00Z'),'2026-12-15T15:00:00.000Z');
 assert.equal(resume('2026-10-23T18:00:00Z','2026-12-28T18:00:00Z'),'2027-01-15T15:00:00.000Z');
});
test('cutoff uses shop-local calendar day and daylight saving time',()=>{
 assert.equal(resume('2026-11-23T02:00:00Z','2026-11-28T18:00:00Z'),'2026-12-01T15:00:00.000Z');
 assert.equal(resume('2026-02-23T18:00:00Z','2026-02-24T18:00:00Z'),'2026-03-15T14:00:00.000Z');
});
test('tenant choices and explicit customer date take precedence',()=>{
 assert.equal(resume('2026-11-22T18:00:00Z','2026-11-28T18:00:00Z',{lateMonthStarts:20,lateResumeDay:12,time:'10:30'}),'2026-12-12T16:30:00.000Z');
 assert.equal(conversationResumeAt('PAUSE_UNTIL','2026-12-04','13:15',new Date('2026-11-23'),new Date('2026-11-28'),'America/Chicago',policy).toISOString(),'2026-12-04T19:15:00.000Z');
});
test('invalid dates, past requests and nonexistent local times require review',()=>{
 const args=[new Date('2026-01-01'),new Date('2026-01-02'),'America/Chicago',policy];
 assert.throws(()=>conversationResumeAt('PAUSE_UNTIL','2026-02-30',null,...args));
 assert.throws(()=>conversationResumeAt('PAUSE_UNTIL','2026-01-01',null,...args));
 assert.throws(()=>conversationResumeAt('PAUSE_UNTIL','2026-03-08','02:30',...args));
 for(const override of [{time:'25:00'},{lateMonthStarts:0},{earlyResumeDay:29},{enabled:'yes'}])assert.throws(()=>conversationPolicy(override));
});

test('acknowledgement wording remains tenant editable with verified automatic details',()=>{assert.equal(conversationPolicy({pauseText:'Hello {customer}, we will check back on {date}.'}).pauseText,'Hello {customer}, we will check back on {date}.');assert.throws(()=>conversationPolicy({pauseText:'Later.'}),/Include/);assert.throws(()=>conversationPolicy({stopText:'Stopped until {date}'}),/no follow-up date/);assert.throws(()=>conversationPolicy({pauseText:'Hello {unknown} on {date}'}),/automatic details/)});
