export function promotionDisplay(lines:any[],saved:any){
 const adjustments:Record<string,number>={},rows:{id:string;name:string;amountCents:number}[]=[];
 for(const group of Array.isArray(saved)?saved:[]){let amountCents=0;
  for(const allocation of group.allocations||[]){const line=lines.find(l=>l.id===allocation.lineId);if(!line||adjustments[line.id]!==undefined||line.discountCents!==allocation.discountCents||line.totalCents!==allocation.totalCents||line.unitPriceCents!==allocation.unitPriceCents||line.quantity!==allocation.quantity)continue;
   const cents=allocation.discountCents;if(!Number.isSafeInteger(cents)||cents<=0)continue;adjustments[line.id]=cents;amountCents+=cents;
  }
  if(amountCents)rows.push({id:group.id,name:String(group.name||'Promotion'),amountCents});
 }
 return {adjustments,rows};
}
