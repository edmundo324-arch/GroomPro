export const reportHistoryParts=['customers','tickets','visits','payments','employees','settings','audits','products','memberships','membershipRequests','membershipPayments','accountEntries','shifts','overrides','messages'] as const;
export type ReportHistoryPart=typeof reportHistoryParts[number];
export type ReportHistory={version:1;accessKey?:string;scope:{tenantId:string;locationId:string;employeeId:string};location:{id:string;name:string;timezone:string};canManageTime:boolean;asOf:string;parts:Record<ReportHistoryPart,any[]>};
export function emptyReportParts(){return Object.fromEntries(reportHistoryParts.map(key=>[key,[] as any[]])) as Record<ReportHistoryPart,any[]>;}
export async function downloadReportHistory(fetchPage:(part:ReportHistoryPart,after:string)=>Promise<any>,current:()=>boolean){
 let archive:ReportHistory|undefined;
 for(const part of reportHistoryParts){let after='';const seen=new Set<string>();do{
  if(!current())return null;const page=await fetchPage(part,after);if(!current())return null;
  if(!page||page.version!==1||page.part!==part||!Array.isArray(page.rows)||!page.scope||!page.location)throw Error('Reporting history could not be prepared. Reconnect to try again.');
  if(!archive)archive={version:1,accessKey:page.accessKey,scope:page.scope,location:page.location,canManageTime:page.canManageTime,asOf:page.asOf,parts:emptyReportParts()};
  if(JSON.stringify(archive.scope)!==JSON.stringify(page.scope)||archive.canManageTime!==page.canManageTime||archive.accessKey!==page.accessKey)throw Error('Your report access changed. Reconnect to refresh this device.');
  archive.parts[part].push(...page.rows);archive.asOf=page.asOf;const next=page.next||'';if(next&&(next===after||seen.has(next)))throw Error('Reporting history did not finish downloading. Reconnect to try again.');seen.add(next);after=next;
 }while(after);}
 return archive||null;
}
