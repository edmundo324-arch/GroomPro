import {db} from './db';
import {defaultCareStages} from './grooming-experience';
export function summarizeCareStages(tickets:any[],records:any[]){
 const allowed=new Set(tickets.filter(t=>t.status==='CLOSED').map(t=>t.id));
 const rows=defaultCareStages.map(stage=>({id:stage.id,name:stage.name,started:0,completed:0,incomplete:0,invalid:0,totalSeconds:0,averageSeconds:null as number|null}));
 const seen=new Set<string>();
 for(const record of records){const v=record.value;if(!v||!allowed.has(v.ticketId)||!v.petId||seen.has(v.ticketId+':'+v.petId))continue;seen.add(v.ticketId+':'+v.petId);
  for(const row of rows){const stage=v.stages?.[row.id];if(!stage)continue;const start=Date.parse(stage.startedAt),end=Date.parse(stage.completedAt);if(!Number.isFinite(start)){row.invalid++;continue;}row.started++;if(!stage.completedAt){row.incomplete++;continue;}if(!Number.isFinite(end)||end<start){row.invalid++;continue;}row.completed++;row.totalSeconds+=(end-start)/1000;}
 }
 for(const row of rows)row.averageSeconds=row.completed?row.totalSeconds/row.completed:null;
 return {rows,recordedDogs:seen.size};
}
export async function careStageReport(tenantId:string,tickets:any[]){
 const keys=tickets.flatMap(t=>[...new Set<string>([...(t.pets||[]).map((p:any)=>p.petId),...(t.lines||[]).map((l:any)=>l.petId)].filter(Boolean))].map(petId=>'GROOMING_PROGRESS:'+t.id+':'+petId));
 const records=keys.length?await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:keys}},select:{value:true}}):[];
 return summarizeCareStages(tickets,records);
}
