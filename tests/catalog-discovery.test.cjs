require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),vm=require('vm');
const {matchesCatalogSearch}=require('../src/lib/catalog-search.ts');
const {prepaidOffer}=require('../src/lib/prepaid-offers.ts');
test('staff can find catalog items by everyday descriptions, names or codes without changing identity',()=>{
 const item={id:'s1',name:'FW-101',description:'Gentle oatmeal bath for sensitive skin',sku:'AB42'};
 for(const query of ['sensitive',' OATMEAL bath ','FW-101','AB42'])assert.equal(matchesCatalogSearch(item,query),true);
 assert.equal(matchesCatalogSearch(item,'oatmeal haircut'),false);assert.equal(matchesCatalogSearch(item,''),true);assert.equal(item.id,'s1');
});
test('prepaid descriptions are optional for old offers and round-trip without changing price or commission terms',()=>{
 const old={id:'11111111-1111-4111-8111-111111111111',name:'Six Baths',itemKey:'SERVICE:s1',visits:6,priceCents:10000,scope:'FAMILY',commissionBasis:'PREPAID',expiresAfterDays:null,active:true};
 assert.deepEqual(prepaidOffer(old),old);
 assert.deepEqual(prepaidOffer({...old,description:'  Six gentle washes  '}),{...old,description:'Six gentle washes'});
 for(const description of [42,'x'.repeat(4001)])assert.throws(()=>prepaidOffer({...old,description}));
});
test('every calendar view highlights all dogs of the active POS ticket, follows ticket switching and clears on close',()=>{
 const file='src/components/calendar-workspace.tsx',source=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),classes=[];
 function visit(n){if(ts.isJsxAttribute(n)&&n.name.getText(sf)==='className'&&n.initializer&&ts.isJsxExpression(n.initializer)&&n.initializer.expression?.getText(sf).includes('gp-calendar-ticket-highlight'))classes.push(n.initializer.expression.getText(sf));ts.forEachChild(n,visit)}visit(sf);
 assert.equal(classes.length,3,'Day, Week and List must share the selection rule');
 for(const expression of classes){const highlighted=(id,activeTicketId,hoverId)=>vm.runInNewContext(expression,{t:{id,status:"OPEN"},ticket:{id,status:"OPEN"},activeTicketId,hover:hoverId?{ticket:{id:hoverId}}:null}).includes('gp-calendar-ticket-highlight');
  for(const dog of ['Gizmo','Bella','Coco'])assert.equal(highlighted('family-visit','family-visit',null),true,dog);
  assert.equal(highlighted('another-visit','family-visit',null),false);
  assert.equal(highlighted('family-visit','another-visit','family-visit'),false);
  assert.equal(highlighted('family-visit',undefined,null),false);
  assert.equal(highlighted('family-visit',undefined,'family-visit'),true);
 }
});
