require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {findBreed}=require('../src/lib/breed-classification.ts');
const {suppliedGroomingBreeds,breedGroomingDefault,initialGroomingInstructions}=require('../src/lib/grooming-note-defaults.ts');
test('every supplied breed resolves to the exact owner-supplied classification',()=>{
 for(const [choice,names] of Object.entries(suppliedGroomingBreeds))for(const name of names){assert.ok(findBreed(name),name);assert.equal(breedGroomingDefault({breed:name}),choice,name);assert.equal(breedGroomingDefault({breedId:findBreed(name).id}),choice,name);}
});
test('aliases share defaults but unspecified breeds and designer breeds are not guessed',()=>{
 assert.equal(breedGroomingDefault({breed:'Yorkie'}),'GR');assert.equal(breedGroomingDefault({breed:'LH Chihuahua'}),'GR');assert.equal(breedGroomingDefault({breed:'Chihuahua'}),'FW');
 for(const breed of ['Akita','Pomchi','Dachshund','American Eskimo Dog','Unknown'])assert.equal(breedGroomingDefault({breed}),null,breed);
 assert.equal(breedGroomingDefault({breedId:'unrecognized',breed:'Yorkie'}),null);
});
test('usual haircut takes priority, then previous instructions; copies stay independent and editable',()=>{
 const usual={classification:'FW',body:'Usual',tbf:'Round',ears:'Short',tail:'Trim',specialNotes:'Careful'},latest={...usual,classification:'GR',body:'Last'};
 const next=initialGroomingInstructions({breed:'Yorkie'},usual,latest);assert.deepEqual(next,usual);next.body='Changed';next.classification='FFT';assert.equal(usual.body,'Usual');assert.equal(usual.classification,'FW');
 assert.deepEqual(initialGroomingInstructions({breed:'Yorkie'},null,latest),latest);
 assert.equal(initialGroomingInstructions({breed:'Yorkie',weightLbs:100},null,null).classification,'GR');
});
