import {calculateCommission,validateCompensation} from './compensation-rules';

// Billing integrations call this in their payment-confirmation transaction.
// A pending/scheduled charge, including the $1 activation, never earns this fee.
export async function recordFirstBillingCommission(tx:any,tenantId:string,paymentId:string){
 const payments=await tx.$queryRaw`SELECT p.*,m.petId FROM MembershipPayment p INNER JOIN Membership m ON m.id=p.membershipId AND m.tenantId=p.tenantId WHERE p.id=${paymentId} AND p.tenantId=${tenantId} AND p.status IN ('PAID','SUCCEEDED') AND p.processedAt IS NOT NULL AND p.paymentType<>'START_VIP'`;
 const payment=payments[0];if(!payment)return null;
 await tx.$queryRaw`SELECT id FROM Membership WHERE id=${payment.membershipId} AND tenantId=${tenantId} FOR UPDATE`;
 const prior=await tx.$queryRaw`SELECT id FROM MembershipPayment WHERE tenantId=${tenantId} AND membershipId=${payment.membershipId} AND status IN ('PAID','SUCCEEDED') AND processedAt IS NOT NULL AND paymentType<>'START_VIP' ORDER BY processedAt ASC,id ASC LIMIT 1`;
 if(prior[0]?.id!==paymentId)return null;
 const key={tenantId,settingKey:'VIP_COMMISSION:'+payment.membershipId};
 const existing=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:key}});if(existing)return existing.value;
 const source=await tx.ticketLine.findFirst({where:{sourceKey:'MEMBERSHIP_START:'+payment.membershipId,ticket:{tenantId}},include:{assignedUser:true}});
 if(!source?.assignedUser||!source.assignedUser.compensationRules)return null;
 const snapshot=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'MEMBERSHIP_PLAN:'+payment.membershipId}}});
 const plan=snapshot?.value as any;
 const ids=(plan?.items||[]).map((i:any)=>i.serviceId);
 const services=await tx.service.findMany({where:{tenantId,id:{in:ids}},select:{id:true,code:true,category:true}});
 const rules=validateCompensation(source.assignedUser.compensationRules);
 const amount=calculateCommission({rules,employeeRole:source.assignedUser.role,exemptRoles:[],percent:0,scope:'VIP_FIRST_BILLING',keys:[plan?.planId,...services.flatMap((s:any)=>[s.id,s.code,s.category])].filter(Boolean),totalCents:payment.amountCents,quantity:1,hasPet:true});
 const value={membershipId:payment.membershipId,paymentId,userId:source.assignedUserId,ticketId:source.ticketId,amountCents:amount.commissionCents,earnedAt:new Date(payment.processedAt).toISOString()};
 await tx.tenantSetting.create({data:{...key,value}});return value;
}
