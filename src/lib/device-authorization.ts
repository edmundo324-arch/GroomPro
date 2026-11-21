import {messageProviderConnection} from "./message-provider-connection";
import {checkDevicePassword,devicePolicyKey,deviceEmailVerifiedKey} from './device-password';
import {createHash,randomBytes,randomInt} from 'node:crypto';
import {db} from './db';
import {businessOwnerKey} from './platform-business';
import {platformRestriction} from './platform-restrictions';
export const deviceApprovalCookie='groompro_device_approval';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const challengeKey=(token:string)=>'DEVICE_CHALLENGE:'+hash(token);
const approvalKey=(token:string)=>'DEVICE_APPROVAL:'+hash(token);
const fail=(message:string)=>Object.assign(new Error(message),{name:'DeviceAuthorizationError'});
export async function ownerBusinesses(email:string,client:any=db){
 const users=await client.user.findMany({where:{email,active:true},select:{id:true,tenantId:true,tenant:{select:{name:true}}}});
 const matches=[];
 for(const user of users){
  const owner=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:user.tenantId,settingKey:businessOwnerKey}}});
  if(owner?.value?.userId===user.id&&!await platformRestriction(user.tenantId,user.id))matches.push({id:user.tenantId,name:user.tenant.name});
 }
 return matches.sort((a,b)=>a.id.localeCompare(b.id));
}
export async function deviceApproved(tenantId:string,deviceId:string,token:string,client:any=db){
 if(!tenantId||!deviceId||!/^\w{64}$/.test(token))return false;
 const row=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:approvalKey(token)}}});
 const value=row?.value;
 return !!value&&value.deviceId===deviceId&&value.expiresAt>Date.now();
}
export async function sendDeviceCode(input:unknown){
 const email=String(input||'').trim().toLowerCase();
 if(email.length>191||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('Enter the business owner’s email.');
 const token=randomBytes(32).toString('hex'),owned=await ownerBusinesses(email);const businesses:{id:string;name:string}[]=[];
 for(const business of owned){const [policy,ready]=await Promise.all([db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:business.id,settingKey:devicePolicyKey}}}),db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:business.id,settingKey:deviceEmailVerifiedKey}}})]);if((policy?.value as any)?.mode!=='PASSWORD'||ready?.value!==true)businesses.push(business);}
 // A response never identifies businesses before ownership is verified.
 if(!businesses.length)return token;
 const tenantId=businesses[0].id;
 let config:any;try{const configs=await Promise.all(businesses.map(b=>messageProviderConnection('GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON',b.id)));config=configs.find(c=>typeof c?.apiKey==='string'&&typeof c?.from==='string');}catch{}
 if(!config)throw fail('Email verification is not ready for this business. Ask the Platform Owner to configure email delivery; Platform Owner sign-in remains available.');
 const code=String(randomInt(100000,1000000)),now=Date.now();
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const settingKey='DEVICE_CODE_RATE:'+hash(email),key={tenantId,settingKey};
  const previous=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:key}}))?.value as any;
  if(previous?.until>now&&previous.count>=3)throw fail('Please wait a minute before requesting another code.');
  const value={until:previous?.until>now?previous.until:now+60000,count:previous?.until>now?previous.count+1:1};
  await tx.tenantSetting.upsert({where:{tenantId_settingKey:key},create:{...key,value},update:{value}});
  await tx.tenantSetting.create({data:{tenantId,settingKey:challengeKey(token),value:{email,emailProof:true,allowedTenantIds:businesses.map(b=>b.id),codeHash:hash(token+':'+code),expiresAt:now+600000,attempts:0,verified:false}}});
 });
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json','Idempotency-Key':'device-'+token},body:JSON.stringify({from:config.from,to:[email],subject:'Verify your GroomPro device',text:`Your verification code is ${code}. It expires in 10 minutes. Use it only on the device you are setting up. If you did not request this code, do not share it.`}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error();
 }catch{throw fail('We could not confirm the verification email was sent. Check your inbox before requesting another code.');}
 return token;
}
export async function verifyDeviceCode(token:string,code:string){
 if(!/^[a-f0-9]{64}$/.test(token)||!/^\d{6}$/.test(code))throw fail('Enter the six-digit code from the owner’s email.');
 const result=await db.$transaction(async tx=>{
  const row=await tx.tenantSetting.findFirst({where:{settingKey:challengeKey(token)}});
  if(!row)return null;
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${row.tenantId} FOR UPDATE`;
  const current=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:row.tenantId,settingKey:row.settingKey}}});
  const value=current?.value as any;
  if(!value||value.expiresAt<Date.now()||value.attempts>=5)return null;
  const valid=value.codeHash===hash(token+':'+code);
  await tx.tenantSetting.update({where:{tenantId_settingKey:{tenantId:row.tenantId,settingKey:row.settingKey}},data:{value:{...value,attempts:value.attempts+1,verified:valid}}});
  return valid?{email:value.email as string,allowedTenantIds:value.allowedTenantIds as string[]}:null;
 });
 if(!result)throw fail('That code is incorrect or expired. Check the code or request a new one.');
 return (await ownerBusinesses(result.email)).filter(b=>result.allowedTenantIds.includes(b.id));
}
export async function approveDevice(token:string,tenantId:string,deviceId:string){
 if(!/^[a-f0-9]{64}$/.test(token))throw fail('Verify the owner’s email first.');
 const proof=randomBytes(32).toString('hex');
 await db.$transaction(async tx=>{
  const row=await tx.tenantSetting.findFirst({where:{settingKey:challengeKey(token)}});
  if(!row)throw fail('Request a new verification code.');
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${row.tenantId} FOR UPDATE`;
  const current=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:row.tenantId,settingKey:row.settingKey}}});
  const value=current?.value as any;
  if(!value?.verified||value.expiresAt<Date.now())throw fail('Verify the owner’s email first.');
  if((value.allowedTenantIds&&!value.allowedTenantIds.includes(tenantId))||!(await ownerBusinesses(value.email,tx)).some(b=>b.id===tenantId))throw fail('Choose a business belonging to this owner.');
  if(value.emailProof){
   const [policy,ready]=await Promise.all([tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:devicePolicyKey}}}),tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:deviceEmailVerifiedKey}}})]);
   if((policy?.value as any)?.mode==='PASSWORD'&&ready?.value===true)throw fail('This business now uses a device password. Verify the password before continuing.');
  }else {
   const policy=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:devicePolicyKey}}}))?.value as any;
   if(policy?.mode!=='PASSWORD'||policy.revision!==value.policyRevisions?.[tenantId])throw fail('Device verification changed. Verify this business again.');
  }
  if(value.emailProof)await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:deviceEmailVerifiedKey}},create:{tenantId,settingKey:deviceEmailVerifiedKey,value:true},update:{value:true}});
  await tx.tenantSetting.create({data:{tenantId,settingKey:approvalKey(proof),value:{deviceId,expiresAt:Date.now()+365*86400000}}});
  await tx.tenantSetting.delete({where:{tenantId_settingKey:{tenantId:row.tenantId,settingKey:row.settingKey}}});
  await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'TENANT',entityId:tenantId,action:'DEVICE_AUTHORIZED',summary:'Owner verified a new device for employee PIN sign-in.'}});
 });
 return proof;
}

export async function verifyDevicePassword(input:unknown,password:string){
 const email=String(input||'').trim().toLowerCase(),businesses=await ownerBusinesses(email);
 if(!businesses.length||password.length>128)throw fail('The email or device password was not recognized. Check the owner email and device password, or contact the Platform Owner.');
 const tenantId=businesses[0].id,now=Date.now();
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  const key={tenantId,settingKey:'DEVICE_PASSWORD_RATE:'+hash(email)},previous=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:key}}))?.value as any;
  if(previous?.until>now&&previous.count>=5)throw fail('Please wait a minute before trying another password.');
  const value={until:previous?.until>now?previous.until:now+60000,count:previous?.until>now?previous.count+1:1};
  await tx.tenantSetting.upsert({where:{tenantId_settingKey:key},create:{...key,value},update:{value}});
 });
 const allowed=[],policyRevisions:Record<string,number>={};
 for(const business of businesses){
  const [policy,ready]=await Promise.all([db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:business.id,settingKey:devicePolicyKey}}}),db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:business.id,settingKey:deviceEmailVerifiedKey}}})]);
  const value=policy?.value as any;
  if(ready?.value===true&&value?.mode==='PASSWORD'&&await checkDevicePassword(password,value.passwordHash)){allowed.push(business);policyRevisions[business.id]=value.revision||0;}
 }
 if(!allowed.length)throw fail('The email or device password was not recognized. Check the owner email and device password, or contact the Platform Owner.');
 const token=randomBytes(32).toString('hex');
 await db.tenantSetting.create({data:{tenantId,settingKey:challengeKey(token),value:{email,verified:true,expiresAt:now+600000,attempts:0,policyRevisions,allowedTenantIds:allowed.map(b=>b.id)}}});
 return {token,businesses:allowed};
}
