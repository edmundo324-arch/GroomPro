import {db} from './db';
import {workflowSettings} from './workflow-settings';
import {zonedParts,localToInstant} from './operating-hours';
import {calculateCommission,groomingAverage,qualifiedCommission,validateCompensation} from './compensation-rules';

export async function employeeQualification(tenantId:string,userId:string,now=new Date(),client:any=db){
 const employee=await client.user.findFirst({where:{id:userId,tenantId},include:{location:true}});
 if(!employee)throw Error('Employee not found.');
 const timezone=employee.location?.timezone||'America/Chicago';
 const through=zonedParts(now,timezone).date;
 const from=new Date(Date.parse(through+'T12:00:00Z')-29*86400000).toISOString().slice(0,10);
 const record=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'EMPLOYEE_WORK_DAYS:'+userId}}});
 const workedDates=Array.isArray(record?.value)?record.value as string[]:[];
 const lines=await client.ticketLine.findMany({where:{assignedUserId:userId,role:'GROOM',petId:{not:null},ticket:{tenantId,status:'CLOSED',closedAt:{gte:localToInstant(from+'T00:00',timezone),lte:now}}},include:{ticket:{select:{id:true,scheduledStart:true,checkedInAt:true,closedAt:true}}}});
 const visits=lines.map((line:any)=>({date:zonedParts(line.ticket.checkedInAt||line.ticket.scheduledStart||line.ticket.closedAt,timezone).date,ticketId:line.ticketId,petId:line.petId}));
 const metric=groomingAverage(workedDates,visits,from,through);
 const rules=employee.compensationRules?validateCompensation(employee.compensationRules):null;
 const daysEmployed=employee.dateOfHire?Math.max(0,Math.floor((Date.parse(through+'T00:00:00Z')-Date.parse(new Date(employee.dateOfHire).toISOString().slice(0,10)+'T00:00:00Z'))/86400000)):0;
 const options=await workflowSettings(tenantId,client);
 const qualification=rules?qualifiedCommission(rules,metric.average,daysEmployed,options.commissionApprovalRequired):null;
 return{employee,rules,metric,qualification,from,through,workedDates,daysEmployed};
}

// Called inside the close transaction. Historical closed tickets retain their
// original amounts; changing a compensation plan never rewrites past payroll.
export async function finalizeTicketCommissions(tx:any,tenantId:string,ticketId:string){
 const lines=await tx.ticketLine.findMany({where:{ticketId,ticket:{tenantId}},include:{service:true,product:true},orderBy:{sortOrder:'asc'}});
 const employees=new Map<string,Awaited<ReturnType<typeof employeeQualification>>>();const perDog=new Set<string>();
 for(const line of lines){
  if(!line.assignedUserId||line.sourceKey?.startsWith('MEMBERSHIP_START:')){await tx.ticketLine.update({where:{id:line.id},data:{commissionCents:0}});continue}
  let context=employees.get(line.assignedUserId);
  if(!context){context=await employeeQualification(tenantId,line.assignedUserId,new Date(),tx);employees.set(line.assignedUserId,context)}
  const {employee,rules,qualification}=context;
  const scope=line.packageId?'PACKAGE':line.lineType==='PRODUCT'?'PRODUCT':'SERVICE';
  const keys=[line.serviceId,line.service?.code,line.service?.category,line.productId,line.product?.category,line.packageId,line.role].filter(Boolean);
  const exemptRoles=Array.isArray(line.service?.commissionExemptRoles)?line.service.commissionExemptRoles:[];
  let commission=calculateCommission({rules,employeeRole:employee.role,exemptRoles,percent:qualification?.appliedPercent||0,scope,keys,totalCents:line.totalCents,quantity:line.quantity,hasPet:!!line.petId,legacyPercent:line.commissionPct==null?null:Number(line.commissionPct)});
  // Package components can still use per-service rules (prep/bath/dry), unless
  // a package-specific commission explicitly overrides that scope.
  const packageRule=rules?.rules.some(r=>r.scope==='PACKAGE'&&(r.match==='*'||keys.includes(r.match)));
  if(scope==='PACKAGE'&&!packageRule)commission=calculateCommission({rules,employeeRole:employee.role,exemptRoles,percent:qualification?.appliedPercent||0,scope:'SERVICE',keys,totalCents:line.totalCents,quantity:line.quantity,hasPet:!!line.petId,legacyPercent:line.commissionPct==null?null:Number(line.commissionPct)});
  const matched=rules?.rules.filter(r=>r.scope===(scope==='PACKAGE'&&!packageRule?'SERVICE':scope)).find(r=>r.match!=='*'&&keys.includes(r.match))||rules?.rules.find(r=>r.scope===(scope==='PACKAGE'&&!packageRule?'SERVICE':scope)&&r.match==='*');
  if(matched?.method==='PER_DOG'&&commission.commissionCents){const key=[employee.id,line.petId,matched.scope,matched.match].join(':');if(perDog.has(key))commission.commissionCents=0;else perDog.add(key)}
  await tx.ticketLine.update({where:{id:line.id},data:commission});
 }
}
