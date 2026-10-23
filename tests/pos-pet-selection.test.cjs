const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=ts.createSourceFile('pos.tsx',fs.readFileSync('src/components/pos-ticket-record.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='PosTicketRecord');
const code=component.body.statements.filter(n=>ts.isFunctionDeclaration(n)&&['chooseCustomer','addPetPackage','clickPet'].includes(n.name.text)).map(n=>n.getText(source)).join('\n');
for(const count of [1,2,3])test(`${count} dogs default selected and package toggles preserve other dogs and lines`,async()=>{
 const pets=Array.from({length:count},(_,i)=>({id:'dog'+i,name:'Dog '+i,active:true}));
 const pkg={id:'package',name:'Groom'};
 const ctx={creating:{current:false},savedId:{current:''},ticketId:'',terminal:false,ticket:{pets:[],lines:[{type:'PRODUCT',description:'Retail',quantity:2}],notes:'Keep me',arrivalPriority:4},catalog:{packages:[pkg],breeds:[],services:[]},customerPets:[],setTicket:f=>{ctx.ticket=typeof f==='function'?f(ctx.ticket):f},setCustomerPets:p=>ctx.customerPets=p,setPackagePet:()=>{},setChoosingCustomer:()=>{},setCustomerQuery:()=>{},setAccount:()=>{},setRewards:()=>{},setPanel:()=>{},setError:v=>{if(v)throw Error(v)},employeeFetch:async()=>({json:async()=>({})}),groomingEligibility:()=>({status:'eligible'}),expandPackage:(p,s,id)=>[{petId:id,packageId:p.id,description:'Prep'},{petId:id,packageId:p.id,description:'Groom'}],packageForPet:()=>pkg};
 vm.createContext(ctx);vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 await ctx.chooseCustomer({id:'owner',pets});assert.equal(ctx.ticket.pets.length,count);
 for(const pet of pets)await ctx.addPetPackage(pet,pkg);
 assert.equal(ctx.ticket.lines.length,1+2*count);
 for(const pet of pets){await ctx.addPetPackage(pet,pkg);assert.equal(ctx.ticket.lines.filter(l=>l.petId===pet.id).length,0);assert.equal(ctx.ticket.lines.length,1+2*(count-1));await ctx.addPetPackage(pet,pkg);assert.equal(ctx.ticket.lines.length,1+2*count)}
 assert.equal(ctx.ticket.pets.length,count);assert.equal(ctx.ticket.notes,'Keep me');assert.equal(ctx.ticket.arrivalPriority,4);assert.equal(ctx.ticket.lines[0].quantity,2);
});
