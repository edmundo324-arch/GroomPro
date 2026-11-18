import {db} from './db';
import {defaultPortalPolicy,portalPolicy} from './cancellation-policy';
export const portalPolicyKey='CUSTOMER_PORTAL_POLICY';
export async function readPortalPolicy(tenantId:string,client:any=db){
 const row=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:portalPolicyKey}}});
 return row?portalPolicy(row.value):defaultPortalPolicy;
}
