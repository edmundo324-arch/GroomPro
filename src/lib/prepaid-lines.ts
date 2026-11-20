export const prepaidPurchaseSource='PREPAID_PURCHASE:';
export const isPrepaidPurchaseLine=(line:{sourceKey?:string|null})=>!!line.sourceKey?.startsWith(prepaidPurchaseSource);
export function prepaidTaxableCents(line:{sourceKey?:string|null;totalCents?:number}){if(!isPrepaidPurchaseLine(line))return null;const amount=Number(line.sourceKey!.split(':')[2]);return Number.isSafeInteger(amount)&&amount>=0?Math.min(amount,Math.max(0,line.totalCents||0)):0;}
export function prepaidVisitValue(priceCents:number,visits:number,used:number){if(!Number.isSafeInteger(priceCents)||priceCents<0||!Number.isSafeInteger(visits)||visits<1||!Number.isSafeInteger(used)||used<0||used>=visits)throw Error('This prepaid package has no visit available.');return Math.floor(priceCents*(used+1)/visits)-Math.floor(priceCents*used/visits);}
export function prepaidCommissionShares(amount:number,weights:number[]){if(!Number.isSafeInteger(amount)||amount<0||!weights.length||weights.some(w=>!Number.isSafeInteger(w)||w<0))throw Error('Review the prepaid service prices before closing.');const total=weights.reduce((a,b)=>a+b,0),basis=total?weights:weights.map(()=>1),sum=total||weights.length;let allocated=0;return basis.map((w,i)=>{const value=i===basis.length-1?amount-allocated:Math.floor(amount*w/sum);allocated+=value;return value});}

export function remainingPrepaidValues(p:any):number[]{
 if(Array.isArray(p.visitValuesCents)){if(p.visitValuesCents.length!==p.visitsRemaining||p.visitValuesCents.some((v:any)=>!Number.isSafeInteger(v)||v<0))throw Error('The saved prepaid visit values need review.');return [...p.visitValuesCents];}
 return Array.from({length:p.visitsRemaining},(_,i)=>prepaidVisitValue(p.offer.priceCents,p.offer.visits,p.used+i));
}
