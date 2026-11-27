import {allocatePackage} from './package-lines';
import {identifyPackageLines} from './package-identification';
import {zonedParts} from './operating-hours';

export type CatalogSyncScope='NONE'|'ALL'|'FUTURE';
export type CatalogChange={kind:'services'|'packages'|'plans';before:any;after:any;services?:any[];packages?:any[];locationPricing?:any[];beforeLocationPricing?:any[];locationId?:string};
export type CatalogSyncSummary={updated:number;unchanged:number;review:{ticketId:string;orderNumber:number;reason:string}[];ticketIds:string[]};
export function catalogSyncScope(value:unknown):CatalogSyncScope{
 if(value===undefined)return 'NONE';
 if(typeof value!=='string'||!['NONE','ALL','FUTURE'].includes(value))throw Error('Choose where to apply these changes.');
 return value as CatalogSyncScope;
}
export const emptyCatalogSync=():CatalogSyncSummary=>({updated:0,unchanged:0,review:[],ticketIds:[]});
export function catalogSyncTicketAllowed(ticket:any,scope:CatalogSyncScope,now:Date){
 if(scope==='NONE'||ticket.closedAt||['CLOSED','CANCELLED','NO_SHOW','VOID','VOIDED'].includes(ticket.status)||/void/i.test(ticket.displayStatus||''))return false;
 // Even a partially paid ticket is protected: changing the agreed amount needs
 // the existing individual-ticket payment/review workflow.
 if(ticket.payments?.length||Number(ticket.accountCreditCents)>0||ticket.noShowFeeProcessedAt)return false;
 const zone=ticket.location?.timezone||'America/Chicago',today=zonedParts(now,zone).date;
 const date=ticket.scheduledStart?zonedParts(new Date(ticket.scheduledStart),zone).date:null;
 return scope==='FUTURE'?!!date&&date>today&&!ticket.checkedInAt:!date||date>=today;
}
function locationPrice(base:number,locationId:string,rules:any[]=[]){const rule=rules.find(r=>r.locationId===locationId&&r.active!==false);return rule?.priceOverrideCents??Math.round(base*(1+Number(rule?.priceAdjustmentPct||0)/100));}
function net(line:any,price:number,discount=line.discountCents){
 const gross=price*line.quantity;
 if(!Number.isSafeInteger(gross)||gross>2147483647||discount>gross)throw Error('The saved discount needs review before this price can change.');
 return {...line,unitPriceCents:price,discountCents:discount,totalCents:gross-discount,commissionCents:Math.round((gross-discount)*Number(line.commissionPct||0)/100)};
}
const lineFields=['description','reportCardDescription','packageId','packageGroupKey','packageName','durationMin','role','quantity','unitPriceCents','discountCents','totalCents','commissionCents','sortOrder'];
export function changedCatalogLine(before:any,after:any){return lineFields.some(key=>before[key]!==after[key]);}

// Legacy package lines stored only "Package · Service". Match the complete
// BEFORE catalog so a service rename cannot turn those into retail services.
// Ambiguous or missing identities require review rather than inferred prices.
export function normalizeCatalogTicketPackages(ticket:any,change:CatalogChange){
 const lines=ticket.lines.map((line:any)=>line.sourceKey&&!String(line.sourceKey).startsWith('offer-today:')?line:identifyPackageLines<any>([line],change.packages||[])[0]);
 for(const line of lines){
  if(line.packageId)continue;
  if(change.kind==='services'&&line.serviceId===change.before.id){
   if(line.sourceKey&&!String(line.sourceKey).startsWith('offer-today:'))continue;
   if(line.packageName||line.description.includes(' · '))throw Error('An older package could not be matched safely. Review its included services in POS before applying changes.');
  }
  if(change.kind==='packages'&&(line.packageName===change.before.name||line.description.startsWith(change.before.name+' · ')))throw Error('An older package could not be matched safely. Review its included services in POS before applying changes.');
 }
 return {...ticket,lines};
}

// Reconcile snapshots instead of rebuilding the ticket, retaining employee IDs,
// discounts, service-line IDs and unrelated extras. A conflict leaves the whole
// affected ticket for individual review, never a half-updated package.
export function planCatalogTicketUpdate(ticket:any,change:CatalogChange){
 const {before,after}=change;let lines=normalizeCatalogTicketPackages(ticket,change).lines.map((line:any)=>({...line}));const notes:string[]=[];
 if(change.kind==='services'){
  for(const line of lines.filter((l:any)=>l.serviceId===before.id)){
   if(line.sourceKey&&!String(line.sourceKey).startsWith('offer-today:')){notes.push('A prepaid or other special service keeps its saved terms.');continue;}
   if(line.totalCents!==line.unitPriceCents*line.quantity-line.discountCents)throw Error('An item has an individually saved total. Review this ticket in POS.');
   if(before.name!==after.name){const expected=line.packageName?line.packageName+' · '+before.name:before.name;if(line.description===expected)line.description=line.packageName?line.packageName+' · '+after.name:after.name;else notes.push('Staff-entered item wording was kept.');}
   if(before.description!==after.description&&String(line.reportCardDescription??before.description??'')===String(before.description??''))line.reportCardDescription=after.description;
   if(before.durationMin!==after.durationMin){if(line.durationMin==null||line.durationMin===before.durationMin)line.durationMin=after.durationMin;else notes.push('A staff-entered service duration was kept.');}
   // A service's retail price never replaces its allocated package price.
   if(!line.packageId&&!line.packageName){
    const oldPrice=locationPrice(before.priceCents,ticket.locationId,change.beforeLocationPricing??change.locationPricing),newPrice=locationPrice(after.priceCents,ticket.locationId,change.locationPricing);
    if(oldPrice!==newPrice){
    if(line.unitPriceCents===oldPrice)Object.assign(line,net(line,newPrice));else notes.push('A staff-entered item price was kept.');
    }
   }
   if(!line.packageId&&!line.packageName&&before.workflowRole!==after.workflowRole&&after.workflowRole&&line.role===before.workflowRole){
    if(!line.assignedUserId)line.role=after.workflowRole;else notes.push('The assigned employee’s work role was kept.');
   }
  }
 }else if(change.kind==='packages'){
  const groups=new Map<string,any[]>();for(const line of lines.filter((l:any)=>l.packageId===before.id)){const key=line.petId+'\0'+(line.packageGroupKey||before.id);groups.set(key,[...(groups.get(key)||[]),line]);}
  for(const group of groups.values()){
   if(group.some(l=>l.sourceKey))throw Error('This package includes a prepaid or other special item. Review it in POS.');
   if(group.length!==before.items.length||before.items.some((item:any)=>group.filter(l=>l.serviceId===item.serviceId).length!==1))throw Error('The package’s included services were adjusted on this ticket. Review it in POS.');
   const multipliers=before.items.map((item:any)=>group.find(l=>l.serviceId===item.serviceId).quantity/item.quantity),multiplier=multipliers[0];
   if(!Number.isInteger(multiplier)||multiplier<1||multipliers.some((v:number)=>v!==multiplier))throw Error('The package quantities were adjusted on this ticket. Review it in POS.');
   const oldPrice=locationPrice(before.basePriceCents,ticket.locationId,change.beforeLocationPricing??change.locationPricing),newPrice=locationPrice(after.basePriceCents,ticket.locationId,change.locationPricing);
   const oldPrices=allocatePackage(oldPrice*multiplier,before.items.map((i:any)=>i.quantity*multiplier));
   const newPrices=allocatePackage(locationPrice(after.basePriceCents,ticket.locationId,change.locationPricing)*multiplier,after.items.map((i:any)=>i.quantity*multiplier));
   const priceChanged=oldPrice!==newPrice,contentsChanged=JSON.stringify(before.items.map((i:any)=>[i.serviceId,i.quantity,i.role]))!==JSON.stringify(after.items.map((i:any)=>[i.serviceId,i.quantity,i.role]));
   if((priceChanged||contentsChanged)&&group.some(l=>{const index=before.items.findIndex((i:any)=>i.serviceId===l.serviceId),old=oldPrices[index];return l.unitPriceCents!==old.unitPriceCents||l.totalCents!==l.unitPriceCents*l.quantity-l.discountCents||l.discountCents<old.discountCents}))throw Error('This package has an individual price. Review it in POS before updating its price or contents.');
   const removed=group.filter(l=>!after.items.some((i:any)=>i.serviceId===l.serviceId));
   if(removed.some(l=>l.assignedUserId||l.discountCents!==oldPrices[before.items.findIndex((i:any)=>i.serviceId===l.serviceId)].discountCents))throw Error('A removed service has assigned work or a discount. Review this package in POS.');
   const replacement=after.items.map((item:any,index:number)=>{
    const service=change.services?.find(s=>s.id===item.serviceId);if(!service||!service.active)throw Error('An included service is unavailable. Review this package’s services.');
    const existing=group.find(l=>l.serviceId===item.serviceId),oldItem=before.items.find((i:any)=>i.serviceId===item.serviceId);
    if(existing&&oldItem.role!==item.role&&existing.assignedUserId)throw Error('A changed work role has an assigned employee. Review this package in POS.');
    const line=existing?{...existing}:{lineType:'SERVICE',serviceId:service.id,productId:null,petId:group[0].petId,packageId:after.id,packageGroupKey:group[0].packageGroupKey||group[0].petId+':'+after.id,assignedUserId:null,assignedAt:null,commissionPct:service.commissionPct==null?null:Number(service.commissionPct),reportCardDescription:service.description||null,durationMin:service.durationMin,role:item.role};
    if(!existing||existing.packageName===before.name)line.packageName=after.name;
    if(!existing||existing.description===before.name+' · '+service.name)line.description=after.name+' · '+service.name;
    if(existing&&oldItem.role!==item.role&&line.role===oldItem.role)line.role=item.role;
    if(!existing||priceChanged||contentsChanged){
     const old=existing?oldPrices[before.items.findIndex((i:any)=>i.serviceId===item.serviceId)]:null;
     const extra=existing?existing.discountCents-old!.discountCents:0;
     line.quantity=newPrices[index].quantity;
     Object.assign(line,net(line,newPrices[index].unitPriceCents,newPrices[index].discountCents+extra));
    }
    return line;
   });
   const first=lines.findIndex((l:any)=>l.id===group[0].id),ids=new Set(group.map(l=>l.id));
   lines=lines.filter((l:any)=>!ids.has(l.id));lines.splice(first,0,...replacement);
  }
 }
 if(lines.length!==ticket.lines.length||lines.some((l:any,index:number)=>!l.id||l.id!==ticket.lines[index]?.id))lines=lines.map((line:any,sortOrder:number)=>({...line,sortOrder}));
 return {lines,notes:[...new Set(notes)],changed:lines.some((line:any)=>!line.id||changedCatalogLine(ticket.lines.find((l:any)=>l.id===line.id),line))||lines.length!==ticket.lines.length};
}
