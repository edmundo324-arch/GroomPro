export type SalesRow={id:string;name:string;amountCents:number;quantity:number;tickets:number};
export function salesBreakdowns(closed:any[],employees:{id:string;firstName:string;lastName:string;displayName?:string|null}[],zone:string){
 const products=new Map<string,SalesRow>(),packages=new Map<string,SalesRow>(),staff=new Map<string,SalesRow>(),days=new Map<string,SalesRow>();
 const names=new Map(employees.map(e=>[e.id,e.displayName||[e.firstName,e.lastName].filter(Boolean).join(' ')]));
 let netLineSalesCents=0,excludedBalanceCents=0;
 const seen=new Map<SalesRow,Set<string>>();
 function add(map:Map<string,SalesRow>,id:string,name:string,amount:number,quantity:number,ticketId:string){
  const row=map.get(id)||{id,name,amountCents:0,quantity:0,tickets:0};
  row.amountCents+=amount;row.quantity+=quantity;
  const ids=seen.get(row)||new Set<string>();ids.add(ticketId);seen.set(row,ids);row.tickets=ids.size;map.set(id,row);
 }
 for(const ticket of closed){
  let amount=0;
  for(const line of ticket.lines||[]){
   if(/^Customer Account Balance$/i.test(line.description||'')){excludedBalanceCents+=line.totalCents;continue;}
   amount+=line.totalCents;
   if(line.lineType==='PRODUCT')add(products,line.productId||'description:'+line.description,line.description,line.totalCents,line.quantity,ticket.id);
   if(line.packageId||line.packageGroupKey||line.packageName)add(packages,line.packageId||'name:'+(line.packageName||line.packageGroupKey),line.packageName||'Saved package',line.totalCents,0,ticket.id);
   const id=line.assignedUserId||'unassigned';
   if(!line.assignedUserId||names.has(id))add(staff,id,names.get(id)||'Unassigned',line.totalCents,line.quantity,ticket.id);
  }
  netLineSalesCents+=amount;
  if(ticket.closedAt){const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ticket.closedAt)),part=(type:string)=>parts.find(p=>p.type===type)?.value;const date=[part('year'),part('month'),part('day')].join('-');add(days,date,date,amount,0,ticket.id);}
 }
 return {netLineSalesCents,excludedBalanceCents,products:[...products.values()],packages:[...packages.values()],employees:[...staff.values()],days:[...days.values()].sort((a,b)=>a.id.localeCompare(b.id))};
}
