import {membershipActivity} from './report-calculations';
export {membershipActivity} from './report-calculations';
import {membershipRetention} from './membership-retention';
import {db} from './db';
import {Prisma} from '@prisma/client';

export async function membershipActivityReport(tenantId:string,memberships:any[],start:Date,end:Date,asOf:Date){
 if(!memberships.length)return membershipActivity([],[],[],start,end,asOf);
 const customers=await db.customer.findMany({where:{tenantId,id:{in:[...new Set<string>(memberships.map(m=>m.customerId))]}},select:{id:true,firstName:true,lastName:true}}),names=new Map(customers.map(c=>[c.id,[c.firstName,c.lastName].filter(Boolean).join(' ')])),accessible=memberships.filter(m=>names.has(m.customerId)).map(m=>({...m,customerName:names.get(m.customerId)}));
 const ids=accessible.map(m=>m.id);if(!ids.length)return membershipActivity([],[],[],start,end,asOf);
 const [requests,audits]=await Promise.all([db.$queryRaw<any[]>`SELECT id,membershipId,requestType,receivedAt FROM MembershipRequest WHERE tenantId=${tenantId} AND membershipId IN (${Prisma.join(ids)}) AND receivedAt>=${start} AND receivedAt<${end}`,db.auditEntry.findMany({where:{tenantId,entityType:'MEMBERSHIP',entityId:{in:ids},action:'MEMBERSHIP_RESUME',occurredAt:{lte:asOf}},select:{id:true,entityId:true,action:true,occurredAt:true}})]);
 return membershipActivity(accessible,requests,audits,start,end,asOf);
}
