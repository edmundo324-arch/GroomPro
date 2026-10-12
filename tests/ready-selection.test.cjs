require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {readySelection}=require('../src/lib/ready-selection.ts');
test('a first visit waits for data; returning to a loaded ticket is immediate',()=>{
 const view=readySelection();assert.equal(view.select('A'),false);
 assert.equal(view.resolve('A'),true);assert.equal(view.select('A'),true);
 assert.equal(view.select('B'),false);assert.equal(view.resolve('B'),true);
 assert.equal(view.select('A'),true);
});
test('late ticket loads cannot replace a newer selection',()=>{
 const view=readySelection();view.select('A');view.select('B');
 assert.equal(view.resolve('A'),false);assert.equal(view.resolve('B'),true);
 assert.equal(view.select('A'),true);
});
test('closing or cancelling prevents pending ticket loads from reopening a window',()=>{
 const view=readySelection();view.select('A');view.cancel();
 assert.equal(view.resolve('A'),false);assert.equal(view.select('A'),true);
});
test('changing security context discards ready selections',()=>{
 const view=readySelection();view.select('A');view.resolve('A');view.clear();
 assert.equal(view.select('A'),false);
});
