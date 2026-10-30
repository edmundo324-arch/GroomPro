require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {servicePromotionFields,offerTodayLabel,offerTodayLine,promotingServiceItem,setDraftOffer,groupedTicketLines}=require('../src/lib/service-promotion.ts');
const {resolveSaleLines}=require('../src/lib/pos-lines.ts');
const {setOfferTodayLine}=require('../src/lib/offer-today-lines.ts');
const {catalogInput}=require('../src/lib/catalog-input.ts');
const service={id:'brush',name:'Tooth Brushing with Fresh Breath Treatment',active:true,priceCents:1000,durationMin:5,workflowRole:'ADD_ON'};
const item=petId=>promotingServiceItem(service,petId);
test('Offer Today labels survive disabling, partial edits and re-enabling',()=>{
 let fields=servicePromotionFields({unrelated:'keep'},true,'Fresh Breath');
 fields=servicePromotionFields(fields,false);assert.equal(fields.offerTodayLabel,'Fresh Breath');
 fields=servicePromotionFields(fields,true);assert.equal(offerTodayLabel({...service,customFields:fields}),'Fresh Breath');assert.equal(fields.unrelated,'keep');
 assert.equal(offerTodayLabel({...service,customFields:servicePromotionFields(fields,undefined,'')}),service.name);
 const input={kind:'services',name:'Brushing',priceCents:1000,durationMin:5,active:true};
 assert.equal(catalogInput({...input,offerTodayLabel:' Fresh Breath '}).offerTodayLabel,'Fresh Breath');assert.equal(catalogInput(input).offerTodayLabel,undefined);
 assert.throws(()=>catalogInput({...input,offerTodayLabel:'a'.repeat(61)}));assert.throws(()=>catalogInput({...input,offerTodayLabel:12}));
});
test('draft offers toggle independently without removing package or ordinary extras',()=>{
 const ordinary={...item('coco'),id:'brush',sourceKey:null,offerToday:undefined};const packageLine={...ordinary,packageId:'bundle'};
 let lines=[ordinary,packageLine];lines=setDraftOffer(lines,item('coco'),true);lines=setDraftOffer(lines,item('coco'),true);lines=setDraftOffer(lines,item('fluffy'),true);
 assert.equal(lines.length,4);assert.ok(offerTodayLine(lines,'brush','coco'));assert.ok(offerTodayLine(lines,'brush','fluffy'));
 lines=JSON.parse(JSON.stringify(lines));lines=setDraftOffer(lines,item('coco'),false);lines=setDraftOffer(lines,item('coco'),false);
 assert.equal(lines.length,3);assert.ok(lines.some(l=>l.packageId==='bundle'));assert.ok(lines.some(l=>l.petId==='coco'&&!l.sourceKey&&!l.packageId));assert.ok(offerTodayLine(lines,'brush','fluffy'));
});
test('booking resolves trusted price and persists offer provenance without deduplicating regular items',async()=>{
 const inputs=[item('coco'),item('coco'),item('fluffy'),{...item('coco'),offerToday:false,sourceKey:'untrusted'}];
 const {lines}=await resolveSaleLines({service:{findFirst:async()=>service}},'tenant',inputs,['coco','fluffy']);
 assert.equal(lines.length,3);assert.equal(lines[0].sourceKey,'offer-today:brush');assert.equal(lines[1].petId,'fluffy');assert.equal(lines[2].sourceKey,undefined);assert.equal(lines[0].unitPriceCents,1000);
});
function fixture(){let lines=[{id:'manual',serviceId:'brush',petId:'coco',quantity:1,role:'ADD_ON',durationMin:5,sortOrder:0},{id:'package',serviceId:'brush',petId:'coco',packageId:'bundle',quantity:1,role:'ADD_ON',durationMin:5,sortOrder:1}];let next=0,checks=0;
 const ticket={id:'ticket',tenantId:'tenant',locationId:'location',status:'OPEN',timingMode:'SEQUENTIAL',pets:[{petId:'coco'},{petId:'fluffy'}]};
 const tx={ticket:{findFirst:async q=>{assert.equal(q.where.tenantId,'tenant');return {...ticket,lines}},update:async()=>{}},service:{findFirst:async q=>{assert.equal(q.where.tenantId,'tenant');return service}},ticketLine:{create:async({data})=>{const line={...data,id:'offer'+(++next)};lines.push(line);return line},deleteMany:async({where})=>{lines=lines.filter(l=>!Object.entries(where).every(([key,value])=>(l[key]??null)===value));}}};
 for(const l of lines)l.ticketId='ticket';
 return{tx,ticket,get lines(){return lines},check:async()=>{checks++},get checks(){return checks}};
}
test('saved offer desired-state requests are idempotent, pet scoped and reversible after reopening',async()=>{
 const f=fixture(),apply=(petId,present)=>setOfferTodayLine(f.tx,'tenant','ticket',{id:'brush',petId,present},f.check);
 await apply('coco',true);await apply('coco',true);await apply('fluffy',true);assert.equal(f.lines.length,4);assert.equal(f.checks,2);
 const reopened=JSON.parse(JSON.stringify(f.lines));assert.ok(offerTodayLine(reopened,'brush','coco'));
 await apply('coco',false);await apply('coco',false);assert.equal(f.lines.length,3);assert.ok(f.lines.some(l=>l.id==='manual'));assert.ok(f.lines.some(l=>l.id==='package'));assert.ok(offerTodayLine(f.lines,'brush','fluffy'));
 await assert.rejects(()=>apply('foreign',true),/not on this ticket/);f.ticket.status='CLOSED';await assert.rejects(()=>apply('fluffy',false),/closed/);
});
test('grouping dogs keeps original edit indexes and service order intact',()=>{const lines=[{petId:'coco',id:'one'},{petId:'fluffy',id:'two'},{petId:'coco',id:'extra'}];assert.deepEqual(groupedTicketLines(lines,['coco','fluffy']).map(x=>[x.line.id,x.index]),[['one',0],['extra',2],['two',1]]);assert.deepEqual(lines.map(x=>x.id),['one','two','extra']);});

test('interleaved packages, extras and offers group beneath each dog package while keeping edit indexes',()=>{const lines=[{petId:'fluffy',id:'fluffy-extra'},{petId:'coco',id:'coco-extra'},{petId:'fluffy',id:'fluffy-bath',packageId:'fw',sortOrder:2},{petId:'coco',id:'coco-offer',sourceKey:'offer-today:brush'},{petId:'coco',id:'coco-groom',packageId:'gr',sortOrder:3},{petId:'fluffy',id:'fluffy-offer',sourceKey:'offer-today:brush'},{petId:'coco',id:'coco-prep',packageId:'gr',sortOrder:1}];const grouped=groupedTicketLines(lines,['coco','fluffy']);assert.deepEqual(grouped.map(x=>x.line.id),['coco-prep','coco-groom','coco-extra','coco-offer','fluffy-bath','fluffy-extra','fluffy-offer']);for(const row of grouped)assert.equal(lines[row.index],row.line);});
test('dogs absent from the selector and nested pet identities are still grouped independently',()=>{const lines=[{pet:{id:'x'},id:'x1'},{petId:'y',id:'y1'},{petId:'x',id:'x2'},{petId:'y',id:'y2'}];assert.deepEqual(groupedTicketLines(lines,[]).map(x=>x.line.id),['x1','x2','y1','y2']);});
