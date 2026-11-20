// A current snapshot of enrollment groups, not reconstructed historical retention.
export function membershipEnrollment(memberships:any[],start:Date,end:Date,asOf:Date,timezone:string){
 const month=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit'});
 const rows=new Map<string,{month:string;name:string;enrolled:number;active:number;cancelRequested:number;pauseRequested:number;paused:number;ended:number;other:number}>();let invalidRecords=0;
 const seen=new Set<string>();
 for(const membership of memberships){
  if(!membership.id||seen.has(membership.id))continue;seen.add(membership.id);
  const date=membership.startedAt?new Date(membership.startedAt):null;
  if(!date||!Number.isFinite(+date)){invalidRecords++;continue;}
  if(+date<+start||+date>=+end||+date>+asOf)continue;
  const parts=month.formatToParts(date),label=parts.find(p=>p.type==='year')!.value+'-'+parts.find(p=>p.type==='month')!.value,name=membership.name||'Unnamed membership',key=JSON.stringify([label,name]);
  const row=rows.get(key)||{month:label,name,enrolled:0,active:0,cancelRequested:0,pauseRequested:0,paused:0,ended:0,other:0};row.enrolled++;
  const status=String(membership.status||'');
  if(membership.endedAt&&Number.isFinite(+new Date(membership.endedAt))&&+new Date(membership.endedAt)<=+asOf)row.ended++;
  else if(status==='ACTIVE')row.active++;
  else if(status==='CANCELLATION_REQUESTED')row.cancelRequested++;
  else if(status==='PAUSE_REQUESTED')row.pauseRequested++;
  else if(status==='PAUSED')row.paused++;
  else if(['CANCELLED','CANCELED','ENDED','EXPIRED'].includes(status))row.ended++;
  else row.other++;
  rows.set(key,row);
 }
 return {asOf:asOf.toISOString(),invalidRecords,rows:[...rows.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.name.localeCompare(b.name))};
}
