require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {sideHintPlacement}=require('../src/lib/hint-placement.ts');
const {fieldHint}=require('../src/lib/field-guide.ts');
const {hintHighlightColor,defaultHintHighlightColor}=require('../src/lib/hint-appearance.ts');
function clearOfField(field,p){return p.left+p.width<=field.left||p.left>=field.right||p.top+p.maxHeight<=field.top||p.top>=field.bottom;}
test('hints prefer the right and use the left near the right edge',()=>{
 const viewport={width:1200,height:800};
 const field={left:40,right:400,top:200,bottom:240};
 const right=sideHintPlacement(field,viewport);assert.ok(right.left>field.right);assert.ok(clearOfField(field,right));
 const edge={left:850,right:1150,top:200,bottom:260};
 const left=sideHintPlacement(edge,viewport);assert.ok(left.left+left.width<edge.left);assert.ok(clearOfField(edge,left));
});
test('phone hints never overlap the described field and stay inside available space',()=>{
 const viewport={width:390,height:844};
 for(const field of [{left:16,right:374,top:100,bottom:150},{left:16,right:374,top:730,bottom:790}]){
  const p=sideHintPlacement(field,viewport);assert.ok(clearOfField(field,p));assert.ok(p.left>=8);assert.ok(p.left+p.width<=382);assert.ok(p.top>=8);assert.ok(p.top+p.maxHeight<=836);
 }
});
test('reduced side space narrows the hint without covering the field',()=>{
 const field={left:20,right:500,top:20,bottom:80};const p=sideHintPlacement(field,{width:768,height:1024});
 assert.ok(p.width>=180&&p.width<320);assert.ok(clearOfField(field,p));
});
test('Historical notes explains unmatched imported customer notes without changing its name',()=>{
 const hint=fieldHint('Historical notes');assert.equal(hint.name,'Historical notes');assert.match(hint.help,/could not match to an existing note field/);assert.match(hint.path,/Additional notes/);
});
test('tenant highlight colors are retained and missing or invalid values use factory gold',()=>{
 assert.equal(hintHighlightColor('#316ad4'),'#316ad4');
 assert.equal(hintHighlightColor('#ABCDEF'),'#ABCDEF');
 for(const value of [undefined,null,'red','var(--other)',''])assert.equal(hintHighlightColor(value),defaultHintHighlightColor);
});
