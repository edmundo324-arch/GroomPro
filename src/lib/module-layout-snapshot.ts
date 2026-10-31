import {ticketWorkspace} from './pos-layout';
import {workflowSettings} from './workflow-settings';
import {saveLayoutVersion} from './visual-layout-store';
export const calendarAppearanceKeys=['hoverFields','hoverLabels','statusStyles'] as const;
export async function moduleLayoutSnapshot(tx:any,tenantId:string,module:string,workflow?:any){
 const rows=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{in:['MODULE_LAYOUT:'+module+':desktop','MODULE_LAYOUT:'+module+':phone']}}});
 const snapshot:any={desktop:rows.find((r:any)=>r.settingKey.endsWith(':desktop'))?.value||{controls:{}},phone:rows.find((r:any)=>r.settingKey.endsWith(':phone'))?.value||{controls:{}}};
 if(module==='POS Ticket'||module==='Calendar'){const s=workflow||await workflowSettings(tenantId,tx);if(module==='POS Ticket'){const p=ticketWorkspace(s.posLayout);snapshot.ticket={desktop:p.desktop,phone:p.phone};}else snapshot.appearance=Object.fromEntries(calendarAppearanceKeys.map(k=>[k,s[k]]));}
 return snapshot;
}
export async function recordModuleLayout(tx:any,tenantId:string,module:string,previous:any,actorId:string){const snapshot=await moduleLayoutSnapshot(tx,tenantId,module);const history=await saveLayoutVersion(tx,tenantId,'MODULE:'+module,snapshot,previous,actorId);return {snapshot,history};}
