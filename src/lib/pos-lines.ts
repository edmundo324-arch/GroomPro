import {allocatePackage as distributePrice} from './package-lines';
export type SaleInput={type:"SERVICE"|"PRODUCT"|"PACKAGE";id:string;petId?:string;quantity?:number;role?:string;assignedUserId?:string;packageId?:string;durationMin?:number};
export {allocatePackage as distributePrice} from './package-lines';
export async function resolveSaleLines(db:any,tenantId:string,inputs:SaleInput[],petIds:string[],locationId?:string){
 const lines:any[]=[];let durationMin=0;
 for(const input of inputs){
  if(!['SERVICE','PRODUCT','PACKAGE'].includes(input.type))throw Error('Choose a valid item type.');
  const quantity=input.quantity??1;if(!Number.isInteger(quantity)||quantity<1||quantity>1000)throw Error('Quantity must be a whole number from 1 to 1000.');
  const petId=input.petId||undefined;if(input.type!=='PRODUCT'&&(!petId||!petIds.includes(petId)))throw Error('Choose a dog on this ticket for each service or package.');if(petId&&!petIds.includes(petId))throw Error('The selected dog is not on this ticket.');
  if(input.assignedUserId&&!await db.user.findFirst({where:{id:input.assignedUserId,tenantId,active:true}}))throw Error('Assigned employee not found.');
  let entries:any[]=[];
  if(input.type==='PACKAGE'||input.packageId){
   const pkg=await db.package.findFirst({where:{id:input.packageId||input.id,tenantId,active:true},include:{items:{include:{service:true},orderBy:{sortOrder:'asc'}},locationPricing:{where:{locationId,active:true}}}});
   if(!pkg||!pkg.items.length||pkg.items.some((i:any)=>!i.service||!i.service.active||i.service.tenantId!==tenantId))throw Error('Package or included services are unavailable.');
   const pricing=pkg.locationPricing?.[0];const price=pricing?.priceOverrideCents??Math.round(pkg.basePriceCents*(1+Number(pricing?.priceAdjustmentPct||0)/100));
   const multiplier=input.packageId?1:quantity;const allocated=distributePrice(price*multiplier,pkg.items.map((i:any)=>i.quantity*multiplier));
   entries=pkg.items.map((i:any,n:number)=>({service:i.service,...allocated[n],role:i.role||'ADD_ON',description:pkg.name+' · '+i.service.name,packageId:pkg.id,packageGroupKey:petId+':'+pkg.id,packageName:pkg.name}));
   if(input.packageId){entries=entries.filter(e=>e.service.id===input.id);if(!entries.length)throw Error('Service does not belong to this package.');entries=entries.map(e=>({...e,quantity,discountCents:quantity===e.quantity?e.discountCents:0,totalCents:e.unitPriceCents*quantity-(quantity===e.quantity?e.discountCents:0)}));}
  }else{
   const item=await db[input.type==='SERVICE'?'service':'product'].findFirst({where:{id:input.id,tenantId,active:true}});if(!item)throw Error('Item not found.');
   entries=[{service:input.type==='SERVICE'?item:null,product:input.type==='PRODUCT'?item:null,quantity,unitPriceCents:item.priceCents,discountCents:0,totalCents:item.priceCents*quantity,role:input.type==='PRODUCT'?'PRODUCT':input.role||'ADD_ON',description:item.name}];
  }
  for(const entry of entries){if(!['PREP','BATH','GROOM','ADD_ON','PRODUCT'].includes(entry.role))throw Error('Invalid line role.');const commissionPct=entry.service?.commissionPct==null?null:Number(entry.service.commissionPct);const minutes=input.durationMin??entry.service?.durationMin??0;if(!Number.isInteger(minutes)||minutes<0||minutes>1440)throw Error('Duration must be 0–1440 minutes.');durationMin+=minutes*entry.quantity;lines.push({durationMin:entry.product?0:minutes,reportCardDescription:entry.service?.description||null,packageId:entry.packageId||null,packageGroupKey:entry.packageGroupKey||null,packageName:entry.packageName||null,lineType:entry.product?'PRODUCT':'SERVICE',serviceId:entry.service?.id||null,productId:entry.product?.id||null,description:entry.description,petId:petId||null,role:entry.role,quantity:entry.quantity,unitPriceCents:entry.unitPriceCents,discountCents:entry.discountCents,totalCents:entry.totalCents,commissionPct,commissionCents:commissionPct==null?0:Math.round(entry.totalCents*commissionPct/100),assignedUserId:input.assignedUserId||null,assignedAt:input.assignedUserId?new Date():null,sortOrder:lines.length})}
 }
 return{lines,serviceMinutes:durationMin,durationMin:Math.max(15,durationMin||30)};
}
