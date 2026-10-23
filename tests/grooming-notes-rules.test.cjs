require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {defaultHours}=require('../src/lib/operating-hours.ts');
const {notesDeadline,validInstructions,parseSpecialHours}=require('../src/lib/grooming-notes-rules.ts');
const hours=defaultHours().map(h=>({...h,closed:h.day===0,close:'18:00'}));
test('Saturday notes lock at Tuesday closing, skipping Sunday and respecting the location timezone',()=>{assert.equal(notesDeadline(new Date('2026-10-17T15:00:00Z'),hours,'America/Chicago').toISOString(),'2026-10-20T23:00:00.000Z')});
test('holidays are skipped and the second open day uses its special closing time',()=>{assert.equal(notesDeadline(new Date('2026-10-17T15:00:00Z'),hours,'America/Chicago',[{date:'2026-10-19',closed:true,open:'08:30',close:'18:00'},{date:'2026-10-21',closed:false,open:'08:30',close:'14:00'}]).toISOString(),'2026-10-21T19:00:00.000Z')});
test('DST and end of month use calendar business days, not 48 elapsed hours',()=>{assert.equal(notesDeadline(new Date('2026-10-31T15:00:00Z'),hours,'America/Chicago').toISOString(),'2026-11-04T00:00:00.000Z')});
test('all three classifications are editable and malformed instructions are rejected',()=>{for(const classification of ['GR','FFT','FW',null])assert.equal(validInstructions({classification,body:'5',tbf:'Round',ears:'Trim',tail:'Leave',specialNotes:''}).classification,classification);assert.throws(()=>validInstructions({classification:'AUTO'}));assert.throws(()=>parseSpecialHours([{date:'2026-02-30',closed:true,open:'08:00',close:'17:00'}]));});
