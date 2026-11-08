require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const {singlePetBookingLines}=require('../src/lib/single-pet-booking.ts');
const source=ts.createSourceFile('pos.tsx',fs.readFileSync('src/components/pos-ticket-record.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='PosTicketRecord');
const code=component.body.statements.filter(n=>ts.isFunctionDeclaration(n)&&['chooseCustomer','addPetPackage','clickPet'].includes(n.name.text)).map(n=>n.getText(source)).join('\n');
for(const count of [1,2,3])test(`${count} dogs default selected and package toggles preserve other dogs and lines`,async()=>{
 const pets=Array.from({length:count},(_,i)=>({id:'dog'+i,name:'Dog '+i,active:true}));
 const pkg={id:'package',name:'Groom'};
 const ctx={creating:{current:false},savedId:{current:''},ticketId:'',terminal:false,ticket:{pets:[],lines:[{type:'PRODUCT',description:'Retail',quantity:2}],notes:'Keep me',arrivalPriority:4},catalog:{packages:[pkg],breeds:[],services:[]},customerPets:[],setTicket:f=>{ctx.ticket=typeof f==='function'?f(ctx.ticket):f},setCustomerPets:p=>ctx.customerPets=p,setPackagePet:()=>{},setChoosingCustomer:()=>{},setCustomerQuery:()=>{},setAccount:()=>{},setRewards:()=>{},setPanel:()=>{},setError:v=>{if(v)throw Error(v)},employeeFetch:async()=>({json:async()=>({})}),groomingEligibility:()=>({status:'eligible'}),expandPackage:(p,s,id)=>[{petId:id,packageId:p.id,description:'Prep'},{petId:id,packageId:p.id,description:'Groom'}],packageForPet:()=>pkg};
 Object.assign(ctx,{mounted:{current:true},customerChoiceVersion:{current:0},manualItemsVersion:{current:0},setBookingSeed:()=>{},packageIntents:{current:new Map()},crypto:require('node:crypto')});
 vm.createContext(ctx);vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 await ctx.chooseCustomer({id:'owner',pets});assert.equal(ctx.ticket.pets.length,count);
 for(const pet of pets)await ctx.addPetPackage(pet,pkg);
 assert.equal(ctx.ticket.lines.length,1+2*count);
 for(const pet of pets){await ctx.addPetPackage(pet,pkg);assert.equal(ctx.ticket.lines.filter(l=>l.petId===pet.id).length,0);assert.equal(ctx.ticket.lines.length,1+2*(count-1));await ctx.addPetPackage(pet,pkg);assert.equal(ctx.ticket.lines.length,1+2*count)}
 assert.equal(ctx.ticket.pets.length,count);assert.equal(ctx.ticket.notes,'Keep me');assert.equal(ctx.ticket.arrivalPriority,4);assert.equal(ctx.ticket.lines[0].quantity,2);
});

test('single-dog draft repeats the latest completed services using current catalog prices',()=>{
 const pet={id:'coco'};
 const service=(id,priceCents,extra={})=>({id,name:id,priceCents,active:true,durationMin:20,...extra});
 const line=(serviceId,extra={})=>({serviceId,petId:pet.id,lineType:'SERVICE',quantity:1,...extra});
 const visit=(day,lines,status='CLOSED')=>({scheduledStart:`2026-11-${day}T12:00:00Z`,status,lines});
 const catalog={services:[service('prep',1800),service('wash',4200),service('nails',1500),service('massage',1200),service('request',0,{customFields:{requestOnly:true}})],packages:[{id:'wash-pkg',name:'Wash package',active:true,priceCents:5000,items:[{serviceId:'prep',quantity:1},{serviceId:'wash',quantity:1}]}]};
 const history=[visit('01',[line('massage')]),visit('02',[line('prep',{packageId:'wash-pkg'}),line('wash',{packageId:'wash-pkg'}),line('nails',{quantity:2,unitPriceCents:1000,assignedUserId:'previous-worker',discountCents:500}),line('massage',{lineType:'PRODUCT'})]),visit('03',[line('request')]),visit('04',[line('massage',{petId:'other-pet'})]),visit('05',[line('massage')],'OPEN')];
 const result=singlePetBookingLines(pet,history,catalog);
 assert.deepEqual(result.map(line=>[line.serviceId,line.quantity,line.totalCents]),[['prep',1,2500],['wash',1,2500],['nails',2,3000]]);
 assert.ok(result.every(line=>line.petId===pet.id&&!line.assignedUserId));
 assert.equal(result[2].discountCents,undefined);
 assert.deepEqual(singlePetBookingLines({...pet,preferredPackageId:'wash-pkg'},[],catalog).map(line=>line.serviceId),['prep','wash']);
});
