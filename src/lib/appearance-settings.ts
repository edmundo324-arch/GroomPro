import {db} from './db';import {workflowSettings} from './workflow-settings';
export const appearanceKeys=['hoverFields','hoverLabels','statusStyles','historyUpcomingSort','historyPreviousSort','historyPresentation','rememberWarningPosition'];
export function mayPersonalize(s:any,user:any){return !!user&&(s.appearanceRoles?.includes(user.role)||s.appearanceEmployees?.includes(user.id))}
export async function employeeAppearance(tenantId:string,user:any){const s=await workflowSettings(tenantId);if(!mayPersonalize(s,user))return s;const row=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'APPEARANCE:'+user.id}}});const v=row?.value as any;return {...s,...Object.fromEntries(appearanceKeys.filter(k=>v&&Object.hasOwn(v,k)).map(k=>[k,v[k]]))}}
