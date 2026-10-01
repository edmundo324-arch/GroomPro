export type SaleInput={type:"SERVICE"|"PRODUCT"|"PACKAGE";id:string;petId?:string;quantity?:number;role?:string;assignedUserId?:string};
export function distributePrice(total:number,quantities:number[]){
 if(!Number.isSafeInteger(total)||total<0||!quantities.length||quantities.some(q=>!Number.isInteger(q)||q<1||q>1000))throw Error('Invalid package price or quantities.');
 const units=quantities.reduce((a,b)=>a+b,0);let remaining=total;
 return quantities.map((quantity,i)=>{const share=i===quantities.length-1?remaining:Math.floor(total*quantity/units);remaining-=share;const unitPriceCents=Math.ceil(share/quantity);return{quantity,unitPriceCents,discountCents:unitPriceCents*quantity-share,totalCents:share}});
}
export async function resolveSaleLines(db:any,tenantId:string,inputs:SaleInput[],petIds:string[],locationId?:string){
 const lines:any[]=[];let durationMin=0;
 for(const input of inputs){
  if(!['SERVICE','PRODUCT','PACKAGE'].includes(input.type))throw Error('Choose a valid item type.');
  const quantity=input.quantity??1;if(!Number.isInteger(quantity)||quantity<1||quantity>1000)throw Error('Quantity must be a whole number from 1 to 1000.');
  const petId=input.petId||undefined;if(input.type!=='PRODUCT'&&(!petId||!petIds.includes(petId)))throw Error('Choose a dog on this ticket for each service or package.');if(petId&&!petIds.includes(petId))throw Error('The selected dog is not on this ticket.');
  if(input.assignedUserId&&!await db.user.findFirst({where:{id:input.assignedUserId,tenantId,active:true}}))throw Error('Assigned employee not found.');
  let entries:any[]=[];
  if(input.type==='PACKAGE'){
   const pkg=await db.package.findFirst({where:{id:input.id,tenantId,active:true},include:{items:{include:{service:true},orderBy:{sortOrder:'asc'}},locationPricing:{where:{locationId,active:true}}}});
   if(!pkg||!pkg.items.length||pkg.items.some((i:any)=>!i.service||!i.service.active||i.service.tenantId!==tenantId))throw Error('Package or included services are unavailable.');
   const pricing=pkg.locationPricing?.[0];const price=pricing?.priceOverrideCents??Math.round(pkg.basePriceCents*(1+Number(pricing?.priceAdjustmentPct||0)/100));
   const allocated=distributePrice(price*quantity,pkg.items.map((i:any)=>i.quantity*quantity));
   entries=pkg.items.map((i:any,n:number)=>({service:i.service,...allocated[n],role:i.role||'ADD_ON',description:pkg.name+' · '+i.service.name}));
  }else{
   const item=await db[input.type==='SERVICE'?'service':'product'].findFirst({where:{id:input.id,tenantId,active:true}});if(!item)throw Error('Item not found.');
   entries=[{service:input.type==='SERVICE'?item:null,product:input.type==='PRODUCT'?item:null,quantity,unitPriceCents:item.priceCents,discountCents:0,totalCents:item.priceCents*quantity,role:input.type==='PRODUCT'?'PRODUCT':input.role||'ADD_ON',description:item.name}];
  }
  for(const entry of entries){if(!['PREP','BATH','GROOM','ADD_ON','PRODUCT'].includes(entry.role))throw Error('Invalid line role.');const commissionPct=entry.service?.commissionPct==null?null:Number(entry.service.commissionPct);durationMin+=(entry.service?.durationMin||0)*entry.quantity;lines.push({lineType:entry.product?'PRODUCT':'SERVICE',serviceId:entry.service?.id||null,productId:entry.product?.id||null,description:entry.description,petId:petId||null,role:entry.role,quantity:entry.quantity,unitPriceCents:entry.unitPriceCents,discountCents:entry.discountCents,totalCents:entry.totalCents,commissionPct,commissionCents:commissionPct==null?0:Math.round(entry.totalCents*commissionPct/100),assignedUserId:input.assignedUserId||null,assignedAt:input.assignedUserId?new Date():null,sortOrder:lines.length})}
 }
 return{lines,serviceMinutes:durationMin,durationMin:Math.max(15,durationMin||30)};
}
