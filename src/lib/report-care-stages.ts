import {summarizeCareStages} from './report-calculations';
export {summarizeCareStages} from './report-calculations';
import {db} from './db';
import {defaultCareStages} from './grooming-experience';

export async function careStageReport(tenantId:string,tickets:any[]){
 const keys=tickets.flatMap(t=>[...new Set<string>([...(t.pets||[]).map((p:any)=>p.petId),...(t.lines||[]).map((l:any)=>l.petId)].filter(Boolean))].map(petId=>'GROOMING_PROGRESS:'+t.id+':'+petId));
 const records=keys.length?await db.tenantSetting.findMany({where:{tenantId,settingKey:{in:keys}},select:{value:true}}):[];
 return summarizeCareStages(tickets,records);
}
