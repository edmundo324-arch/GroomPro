import {recordedMembershipPayments} from './report-calculations';
export {recordedMembershipPayments} from './report-calculations';
import {db} from './db';

export async function membershipPaymentsReport(tenantId:string,start:Date,end:Date){const payments=await db.$queryRaw<any[]>`SELECT p.id,p.amountCents,p.taxCents,p.status,p.processedAt,m.customerId,m.name FROM MembershipPayment p INNER JOIN Membership m ON m.id=p.membershipId AND m.tenantId=p.tenantId WHERE p.tenantId=${tenantId} AND p.processedAt>=${start} AND p.processedAt<${end} AND p.status IN ('PAID','SUCCEEDED')`;return recordedMembershipPayments(payments);}
