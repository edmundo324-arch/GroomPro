// Allocate the ticket's actual tax for display only. No new charge or payment split.
function taxable(line:any,catalog?:any){const item=line.service||line.product||(line.lineType==='PRODUCT'||line.type==='PRODUCT'?catalog?.products:catalog?.services)?.find((v:any)=>v.id===(line.serviceId||line.productId||line.id));return item?.taxConfiguration?.taxable!==false}
export function dogTicketTotals(lines:any[],taxCents:number,catalog?:any){
 const sums=new Map<string,number>();for(const line of lines){const key=line.petId||line.pet?.id||'';sums.set(key,(sums.get(key)||0)+Math.max(0,Number(line.totalCents??((line.unitPriceCents||0)*(line.quantity||1)-(line.discountCents||0)))))}
 const weights=new Map<string,number>();for(const line of lines)if(taxable(line,catalog)){const key=line.petId||line.pet?.id||'';weights.set(key,(weights.get(key)||0)+Math.max(0,Number(line.totalCents??((line.unitPriceCents||0)*(line.quantity||1)-(line.discountCents||0)))))}const taxableTotal=[...weights.values()].reduce((n,c)=>n+c,0);
 const entries=[...sums],total=taxableTotal||entries.reduce((n,[,c])=>n+c,0),tax=Math.max(0,Math.round(taxCents||0));
 const shares=entries.map(([petId,subtotal])=>({petId,subtotal,tax:total?Math.floor(tax*(taxableTotal?(weights.get(petId)||0):subtotal)/total):0,remainder:total?(tax*(taxableTotal?(weights.get(petId)||0):subtotal))%total:0}));
 let remaining=tax-shares.reduce((n,s)=>n+s.tax,0);if(total)for(const share of [...shares].sort((a,b)=>b.remainder-a.remainder||a.petId.localeCompare(b.petId))){if(remaining--<=0)break;share.tax++}
 return Object.fromEntries(shares.map(s=>[s.petId,{subtotalCents:s.subtotal,totalCents:s.subtotal+s.tax}]));
}
export function defaultTicketTax(lines:any[],rate:number,catalog?:any){return Math.round(lines.reduce((n,l)=>n+(taxable(l,catalog)?Math.max(0,Number(l.totalCents)||0):0),0)*rate/100)}
