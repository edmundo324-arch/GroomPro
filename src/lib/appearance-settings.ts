import {db} from './db';import {workflowSettings} from './workflow-settings';
import {appointmentDisplay} from './appointment-display';
export const appearanceKeys=['appointmentDisplay','showCalendarArrivalOrder','hoverArrivalPosition','hoverFields','hoverLabels','statusStyles','historyUpcomingSort','historyPreviousSort','historyPresentation','rememberWarningPosition'];
export function mayPersonalize(s:any,user:any){return !!user&&(s.appearanceRoles?.includes(user.role)||s.appearanceEmployees?.includes(user.id))}
export async function employeeAppearance(tenantId:string,user:any){const s=await workflowSettings(tenantId);if(!mayPersonalize(s,user))return s;const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'APPEARANCE:'+user.id}}});const v=row?.value as any;const result={...s,...Object.fromEntries(appearanceKeys.filter(k=>v&&Object.hasOwn(v,k)).map(k=>[k,v[k]]))};if(s.appointmentDisplay&&!v?.appointmentDisplay&&typeof v?.showCalendarArrivalOrder==='boolean'){
 const fields=appointmentDisplay(s).fields.filter(field=>field.key!=='ticket.arrivalPriority');
 if(v.showCalendarArrivalOrder){const time=fields.find(field=>field.key==='time');fields.push({key:'ticket.arrivalPriority',row:time?.row??2,bold:time?.bold??true})}
 result.appointmentDisplay={fields:fields.length?fields:[{key:'pet.name',row:0,bold:true}]};
 }return result}
