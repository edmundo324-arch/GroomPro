import {db} from './db';
export const sharedMessageConnectionKey='PLATFORM_TEST_MESSAGE_CONNECTION';
// Only platform business creation may establish this link. Business-specific
// credentials always win; no secrets are copied into a business record.
export async function messageProviderConnection(environment:string,tenantId:string,client:any=db){
 let configs:any;try{configs=JSON.parse(process.env[environment]||'{}')}catch{return null}
 if(Object.hasOwn(configs,tenantId))return configs[tenantId];
 const setting=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:sharedMessageConnectionKey}}});
 const source=(setting?.value as any)?.sourceTenantId;
 return typeof source==='string'&&source!==tenantId?configs[source]||null:null;
}

export async function sharedMessageTenants(environment:string,sourceTenantId:string,client:any=db){
 let configs:any;try{configs=JSON.parse(process.env[environment]||'{}')}catch{return [sourceTenantId]}
 const rows=await client.tenantSetting.findMany({where:{settingKey:sharedMessageConnectionKey,value:{path:'$.sourceTenantId',equals:sourceTenantId}},select:{tenantId:true}});
 return [sourceTenantId,...rows.map((r:any)=>r.tenantId).filter((id:string)=>id!==sourceTenantId&&!Object.hasOwn(configs,id))];
}

export async function sharedSmsRecipients(sourceTenantId:string,normalized:string,client:any=db){
 const tenants=await sharedMessageTenants('GROOMPRO_SMS_TENANTS_JSON',sourceTenantId,client);
 if(tenants.length===1)return [sourceTenantId];
 const phones=await client.customerPhone.findMany({where:{tenantId:{in:tenants},normalized},select:{tenantId:true}});
 const matches=[...new Set(phones.map((p:any)=>p.tenantId))];
 // Never place one tester's reply in another business's customer account.
 return matches as string[];
}
