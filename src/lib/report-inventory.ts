import {isGiftCardLine} from './gift-card-line';
import {db} from './db';
export function inventorySnapshot(products:{id:string;name:string;sku:string|null;active:boolean;quantity:number;costCents:number;priceCents:number}[],asOf=new Date()){
 const rows=products.map(p=>({...p,recordedCostValueCents:p.quantity*p.costCents,retailValueCents:p.quantity*p.priceCents}));
 return {asOf:asOf.toISOString(),products:rows.length,units:rows.reduce((n,p)=>n+p.quantity,0),recordedCostValueCents:rows.reduce((n,p)=>n+p.recordedCostValueCents,0),retailValueCents:rows.reduce((n,p)=>n+p.retailValueCents,0),zeroCostProducts:rows.filter(p=>p.quantity>0&&p.costCents===0).length,rows};
}
export async function currentInventoryReport(tenantId:string,asOf=new Date()){
 return inventorySnapshot(await db.product.findMany({where:{tenantId},select:{id:true,name:true,sku:true,active:true,quantity:true,costCents:true,priceCents:true},orderBy:{name:'asc'}}),asOf);
}

export function soldProductCosts(closed:any[],audits:any[]){
 const snapshots=new Map<string,any[]>();for(const a of audits){const d=a.details||{},key=JSON.stringify([d.ticketId,a.entityId]);snapshots.set(key,[...(snapshots.get(key)||[]),d]);}
 const products=new Map<string,any>();let salesCents=0,knownCostCents=0,salesWithKnownCostCents=0,unitsWithoutCost=0;
 for(const t of closed){const groups=new Map<string,any>();for(const l of t.lines||[]){if(l.lineType!=='PRODUCT'||isGiftCardLine(l))continue;const id=l.productId||'line:'+l.id;const g=groups.get(id)||{id,productId:l.productId,name:l.description,units:0,salesCents:0};g.units+=l.quantity;g.salesCents+=l.totalCents;groups.set(id,g);}
  for(const g of groups.values()){const costs=snapshots.get(JSON.stringify([t.id,g.productId]))||[],cost=costs.length===1?costs[0]:null;const known=cost&&Number.isSafeInteger(cost.unitCostCents)&&cost.unitCostCents>=0&&cost.sold===g.units&&g.units>0;const row=products.get(g.id)||{id:g.id,name:g.name,units:0,salesCents:0,knownCostCents:0,salesWithKnownCostCents:0,unitsWithoutCost:0};row.units+=g.units;row.salesCents+=g.salesCents;salesCents+=g.salesCents;if(known){const amount=cost.unitCostCents*g.units;row.knownCostCents+=amount;row.salesWithKnownCostCents+=g.salesCents;knownCostCents+=amount;salesWithKnownCostCents+=g.salesCents;}else{row.unitsWithoutCost+=g.units;unitsWithoutCost+=g.units;}products.set(g.id,row);}
 }
 return {salesCents,knownCostCents,salesWithKnownCostCents,unitsWithoutCost,recordedMarginCents:salesWithKnownCostCents-knownCostCents,rows:[...products.values()]};
}
export async function productCostReport(tenantId:string,closed:any[]){
 const tickets=closed.filter(t=>t.lines.some((l:any)=>l.lineType==='PRODUCT'));
 const audits=tickets.length?await db.auditEntry.findMany({where:{tenantId,action:'TICKET_STOCK_SALE',OR:tickets.map(t=>({details:{path:'$.ticketId',equals:t.id}}))},select:{entityId:true,details:true}}):[];
 return soldProductCosts(tickets,audits);
}
