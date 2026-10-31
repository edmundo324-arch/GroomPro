import {packageKey} from './package-display';
export type PackageRemovalChoice='KEEP_DISCOUNT'|'REMOVE_DISCOUNT';
export function packageRemovalChoice(value:unknown):'ASK'|PackageRemovalChoice{return value==='KEEP_DISCOUNT'||value==='REMOVE_DISCOUNT'?value:'ASK';}
export function removePackageLine(lines:any[],removed:any,choice:PackageRemovalChoice,regularPrices:Record<string,number>){
 const group=packageKey(removed);return lines.filter(l=>l!==removed&&(removed.clientKey?l.clientKey!==removed.clientKey:!removed.id||l.id!==removed.id||l.petId!==removed.petId||packageKey(l)!==packageKey(removed))).map(l=>{if(choice!=='REMOVE_DISCOUNT'||!group||packageKey(l)!==group)return l;const price=regularPrices[l.serviceId||l.id];if(!Number.isSafeInteger(price)||price<0)throw Error('A regular service price is missing. Keep the discount or update the service catalog.');const totalCents=price*l.quantity,commissionCents=l.commissionPct==null?0:Math.round(totalCents*Number(l.commissionPct)/100);return {...l,unitPriceCents:price,discountCents:0,totalCents,commissionCents};});
}
