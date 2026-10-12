require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../src/lib/pet-package.ts');
const packages=[{id:'custom',name:'Custom groom',active:true},{id:'yorkie',name:'Yorkie',active:true,defaultForBreeds:'Yorkshire Terrier, Yorkie'}];
test('pet assignment takes precedence over breed defaults',()=>assert.equal(api.packageForPet({preferredPackageId:'custom',breed:'Yorkie'},packages).id,'custom'));
test('new pet uses explicit normalized breed default or a unique exact package name',()=>{assert.equal(api.packageForPet({breed:'  YORKSHIRE   TERRIER '},packages).id,'yorkie');assert.equal(api.packageForPet({breed:'Custom groom'},packages).id,'custom')});
test('missing, inactive, ambiguous and partial matches ask for a choice instead of guessing',()=>{assert.equal(api.packageForPet({breed:'York'},packages),null);assert.equal(api.packageForPet({breed:'Yorkie',preferredPackageId:'missing'},packages),null);assert.equal(api.packageForPet({breed:'Yorkie'},[...packages,{id:'other',name:'Other',active:true,defaultForBreeds:'Yorkie'}]),null);assert.equal(api.packageForPet({breed:'Yorkie'},packages.map(p=>({...p,active:false}))),null)});
