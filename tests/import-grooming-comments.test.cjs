require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {datedGroomingComments,importedGroomingHistory}=require('../src/lib/import/grooming-comments.ts');
const {combinedCustomerNotes}=require('../src/lib/customer-notes.ts');
test('123Pet dated comments preserve structured fields and original text',()=>{
 const original='11/10/2026 Fluffy\nBody: #5\nTBF: round\nEars: short\nTail: long\n11/12/2026 Fluffy\nLeave ears long; nervous at dryer';
 const notes=datedGroomingComments(original,'Fluffy');assert.equal(notes.length,2);assert.equal(notes[0].date,'2026-11-10');assert.deepEqual(notes[0].instructions,{classification:null,body:'#5',tbf:'round',ears:'short',tail:'long',specialNotes:''});assert.equal(notes[1].instructions.specialNotes,'Leave ears long; nervous at dryer');assert.ok(notes[0].original.includes('Fluffy'));assert.equal(notes[0].instructions.tail,'long');
});
test('unlabeled, invalid-date and undated text is never given an invented date',()=>{
 assert.deepEqual(datedGroomingComments('Leave tail long'),[]);assert.deepEqual(datedGroomingComments('02/30/2026 Leave tail long'),[]);
 const notes=datedGroomingComments('2026-11-10\nUnrecognized text');assert.equal(notes[0].instructions.specialNotes,'Unrecognized text');
});
test('only exact linked pets and unambiguous date matches associate with a ticket',()=>{
 const pet={id:'pet-one',name:'Fluffy',groomingNotes:'11/10/2026 Fluffy\nBody: #5'};
 const unrelated={id:'wrong',historyDate:'2026-11-10',lines:[{petId:'different'}]};
 const ticket={id:'real',orderNumber:10,historyDate:'2026-11-10',lines:[{petId:'pet-one'}]};
 assert.equal(importedGroomingHistory([pet],'owner',[unrelated])[0].matchedTicketId,null);
 assert.equal(importedGroomingHistory([pet],'owner',[ticket])[0].matchedTicketId,'real');
 assert.equal(importedGroomingHistory([pet],'owner',[ticket,{...ticket,id:'other'}])[0].matchedTicketId,null);
 assert.equal(importedGroomingHistory([pet],'owner',[ticket])[0].ticketId,null);
});
test('source identities survive a newer import and duplicate entries are not repeated',()=>{
 const pet={id:'pet-one',name:'Fluffy',groomingNotes:'11/10/2026 Fluffy\nBody: #5'};
 const id=importedGroomingHistory([pet],'owner')[0].id;
 const updated=importedGroomingHistory([{...pet,groomingNotes:'11/12/2026 Fluffy\nBody: #4\n'+pet.groomingNotes}],'owner');assert.equal(updated[1].id,id);
 assert.equal(importedGroomingHistory([{...pet,groomingNotes:pet.groomingNotes+'\n'+pet.groomingNotes}],'owner').length,1);
});
test('customer-note consolidation keeps both distinct original notes',()=>{
 assert.equal(combinedCustomerNotes({notes:'Regular instructions',popupNotes:'Important information'}),'Regular instructions\n\nImportant information');
 assert.equal(combinedCustomerNotes({notes:'Regular\n\nOlder note',popupNotes:'Older note'}),'Regular\n\nOlder note');
 assert.equal(combinedCustomerNotes({notes:'Same',popupNotes:'Same'}),'Same');assert.equal(combinedCustomerNotes({popupNotes:'Older note'}),'Older note');
});
