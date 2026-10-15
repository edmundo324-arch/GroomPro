import {calendarHoverFields} from './calendar-hover-fields';
export type HoverDetail={key:string;label:string;value:string;petId?:string;lineId?:string};
export function friendlyHoverLabel(key:string){const field=key.split('.').pop()||key;return ({name:'Name',weightLbs:'Weight',weightDescription:'Weight',packageName:'Services',description:'Services',unitPriceCents:'Price',totalCents:'Total',balanceCents:'Balance',creditCents:'Credit',durationMin:'Duration'} as Record<string,string>)[field]||(calendarHoverFields[key]||field).replace(/^(Ticket|Customer|Pet|Service line) — /,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/ Cents$/i,'').replace(/^./,s=>s.toUpperCase());}
export function hoverValue(key:string,v:any):string{
 if(v==null||v==='')return '';
 if(key.endsWith('totalVisits'))return v+' visits';
 if(key.endsWith('loyaltyPoints'))return v+' points';
 if(/Cents$/.test(key))return '$'+(Number(v)/100).toFixed(2);
 if(key.endsWith('weightLbs'))return Number(v)+' lb';
 if(key.endsWith('durationMin'))return v+' min';
 if(v instanceof Date)return v.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
 if(typeof v==='boolean')return v?'Yes':'No';
 if(Array.isArray(v))return v.map(x=>hoverValue(key,x)).filter(Boolean).join(', ');
 if(typeof v==='object')return Object.entries(v).filter(([,x])=>x).map(([k,x])=>x===true?k:k+': '+x).join(', ');
 return String(v);
}
export function buildHoverDetails(ticket:any,fields:string[]):HoverDetail[]{
 const result:HoverDetail[]=[];
 const add=(key:string,v:any,petId?:string,lineId?:string)=>{const value=hoverValue(key,v);if(value)result.push({key,label:friendlyHoverLabel(key),value,petId,lineId});};
 for(const key of fields){if(!Object.hasOwn(calendarHoverFields,key))continue;const [group,field]=key.split('.');
 if(group==='ticket')add(key,ticket[field]);
 if(group==='customer')add(key,field==='phones'?ticket.customer.phones.map((p:any)=>p.number).join(' · '):ticket.customer[field]);
 if(group==='pet')for(const {pet} of ticket.pets)add(key,field==='vaccinations'?pet.vaccinations.map((v:any)=>v.vaccineName+(v.expiresAt?' ('+hoverValue('date',v.expiresAt)+')':'')).join(', '):pet[field],pet.id);
 if(group==='line')for(const line of ticket.lines)add(key,line[field],line.petId||undefined,line.id);
 if(key==='payments')add(key,ticket.payments.map((p:any)=>p.paymentType+' $'+Number(p.amount).toFixed(2)).join(' · '));
 if(key==='assignments')add(key,ticket.assignments.map((a:any)=>a.user.firstName+' '+a.user.lastName).join(' · '));
 }return result;
}
