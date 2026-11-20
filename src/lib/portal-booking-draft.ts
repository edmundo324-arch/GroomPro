export type PortalBookingDraft={selections:{petId:string;itemKey:string}[];date:string;preferredStart:string};
export function bookingDraftChoices(input:any,petIds:string[]){
 if(!input||!Array.isArray(input.selections)||input.selections.length>50)throw Error('Choose up to 50 dogs for one appointment.');
 const seen=new Set<string>();const selections=input.selections.map((s:any)=>{if(typeof s?.petId!=='string'||!petIds.includes(s.petId)||seen.has(s.petId))throw Error('Choose dogs from your current profile.');seen.add(s.petId);if(typeof s.itemKey!=='string'||(s.itemKey&&!/^(SERVICE|PACKAGE):[a-zA-Z0-9_-]{1,191}$/.test(s.itemKey)))throw Error('Choose a service or package from the shop’s list.');return {petId:s.petId,itemKey:s.itemKey};});
 const date=String(input.date||'');if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date))throw Error('Choose a valid booking date.');
 const preferredStart=String(input.preferredStart||'');if(preferredStart&&(!Number.isFinite(Date.parse(preferredStart))||preferredStart.length>40))throw Error('Choose a valid appointment time.');
 return {selections,date,preferredStart};
}
