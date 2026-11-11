import type {Prisma} from '@prisma/client';
import {createHash,randomBytes,randomInt,randomUUID} from 'node:crypto';
import {db} from './db';
import {normalizePhone} from './phone-normalization';
import {configFor} from './sms';
import rubberDoggiesTemplates from './rubber-doggies-agreement-templates.json';
import {customerReferrals,saveCustomerReferral} from './customer-referrals';
import {loadBreeds} from './breed-store';
import {petBreedData} from './breed-classification';
import {agreementChannels,customerFields,dogFields,type AgreementChannel,type AgreementConfig,type AgreementKind,type AgreementProfile,type Quote,type Terms} from './customer-agreement-model';

export type AgreementAccess={
 kind:AgreementKind;channel:AgreementChannel;expires:number;terms:Terms;shopEmail:string;
 customerId?:string;phone?:string;proof?:string;pinExpires?:number;attempts?:number;quote:Quote[];
 documentId?:string;actorId?:string;bookingUrl?:string;tabletStation?:boolean;
};
const configKey='CUSTOMER_AGREEMENT_CONFIG';
const tokenKey=(token:string)=>'CUSTOMER_AGREEMENT:'+digest(token);
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const defaults:AgreementConfig={channels:[...agreementChannels],intake:{version:'',clauses:[]},vip:{version:'',clauses:[]},shopEmail:'',tabletVerifyExisting:false};
export const allowedAgreementEmail=(email:string)=>email.length<=191&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const settingWhere=(tenantId:string,settingKey:string)=>({tenantId_settingKey:{tenantId,settingKey}});
export const agreementPicturePath=(tenantId:string,petId:string)=>'/api/customer-agreement/photo?tenant='+encodeURIComponent(tenantId)+'&pet='+encodeURIComponent(petId);
const pictureKey=(petId:string)=>'CUSTOMER_AGREEMENT_PHOTO:'+petId;
export const newToken=()=>randomBytes(32).toString('hex');
export const isAgreementToken=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const validTenant=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
export const agreementError=(message:string)=>Object.assign(new Error(message),{name:'AgreementError'});

export async function readAgreementConfig(tenantId:string,client:Prisma.TransactionClient=db){
 const row=await client.tenantSetting.findUnique({where:settingWhere(tenantId,configKey)});
 if(row)return {...defaults,...row.value as Partial<AgreementConfig>};
 const business=await client.tenant.findUnique({where:{id:tenantId},select:{name:true}});
 return /^(Rubber Doggies|Rubber Doggies Grooming)$/i.test(business?.name||'')?rubberDoggiesTemplates as AgreementConfig:defaults;
}
export async function saveAgreementConfig(tenantId:string,input:AgreementConfig){
 if(!Array.isArray(input.channels)||input.channels.some(c=>!agreementChannels.includes(c)))throw agreementError('Choose valid form channels.');
 const shopEmail=String(input.shopEmail||'').trim().toLowerCase();
 if(shopEmail&&!allowedAgreementEmail(shopEmail))throw agreementError('Enter a valid shop email.');
 const terms=(value:Terms)=>{
  if(!Array.isArray(value?.clauses)||value.clauses.length>20)throw agreementError('Use up to 20 policy sections.');
  const clauses=value.clauses.map(clause=>{
   const title=String(clause.title||'').trim(),text=String(clause.text||'').trim(),video=String(clause.video||'').trim();
   if(!title||title.length>120||!text||text.length>6000)throw agreementError('Each policy section needs a title and up to 6,000 characters of text.');
   if(video&&!/^https:\/\/[^\s]+$/i.test(video))throw agreementError('Enter an HTTPS video URL.');
   return {title,text,initialsRequired:clause.initialsRequired!==false,...(video?{video}:{})};
  });
  return {version:randomUUID(),clauses};
 };
 const bookingUrl=String(input.bookingUrl||'').trim();
 if(bookingUrl){let valid=false;try{const url=new URL(bookingUrl);valid=url.protocol==='https:'&&!url.username&&!url.password;}catch{}if(!valid||bookingUrl.length>1000)throw agreementError('Enter a valid HTTPS booking page address.');}
 const value={channels:[...new Set(input.channels)],intake:terms(input.intake),vip:terms(input.vip),shopEmail,bookingUrl,tabletVerifyExisting:input.tabletVerifyExisting===true};
 await db.tenantSetting.upsert({where:settingWhere(tenantId,configKey),create:{tenantId,settingKey:configKey,value},update:{value}});
 return value;
}

async function saveAccess(client:Prisma.TransactionClient,tenantId:string,token:string,state:AgreementAccess){
 const settingKey=tokenKey(token);
 const value=JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
 await client.tenantSetting.upsert({where:settingWhere(tenantId,settingKey),create:{tenantId,settingKey,value},update:{value}});
}
export async function readAccess(client:Prisma.TransactionClient,tenantId:string,token:string,lock=false){
 if(lock)await client.$queryRaw`SELECT settingKey FROM TenantSetting WHERE tenantId=${tenantId} AND settingKey=${tokenKey(token)} FOR UPDATE`;
 const row=await client.tenantSetting.findUnique({where:settingWhere(tenantId,tokenKey(token))});
 const state=row?.value as AgreementAccess|undefined;
 if(!state||state.expires<Date.now())throw agreementError('This form link expired. Ask the shop for a new link.');
 return state;
}
export async function issueAgreement(tenantId:string,kind:AgreementKind,channel:AgreementChannel,customerId:string|undefined,quote:Quote[],actorId?:string){
 const config=await readAgreementConfig(tenantId);
 if(!config.channels.includes(channel))throw agreementError('The shop has turned off this form channel.');
 const terms=config[kind];
 if(!terms.clauses.length||!config.shopEmail)throw agreementError('The shop must set up this agreement and its copy email first.');
 const token=newToken();
 const tabletStation=kind==='intake'&&channel==='tablet'&&!customerId;
 await saveAccess(db,tenantId,token,{kind,channel,customerId,quote,terms,shopEmail:config.shopEmail,expires:tabletStation?Number.MAX_SAFE_INTEGER:Date.now()+86400000,actorId,tabletStation});
 return token;
}
export async function clearTabletForm(tenantId:string,token:string){
 await db.$transaction(async tx=>{
  const state=await readAccess(tx,tenantId,token,true);
  if(state.channel!=='tablet'||state.tabletStation)throw agreementError('This form cannot be cleared.');
  await tx.tenantSetting.delete({where:settingWhere(tenantId,tokenKey(token))});
 });
}
export async function startTabletIntake(tenantId:string,stationToken:string,input:string){
 const station=await readAccess(db,tenantId,stationToken);
 const config=await readAgreementConfig(tenantId);
 if(!station.tabletStation||!config.channels.includes('tablet'))throw agreementError('This tablet is no longer set up for intake.');
 const phone=normalizePhone(input);
 if(!/^\d{10}$/.test(phone))throw agreementError('Enter a 10-digit mobile number.');
 const registered=await db.customerPhone.findUnique({where:{tenantId_normalized:{tenantId,normalized:phone}},select:{customerId:true,customer:{select:{active:true}}}});
 if(registered&&!registered.customer.active)throw agreementError('This profile is inactive. Ask the shop for help.');
 if(registered&&config.tabletVerifyExisting)return {token:await startPhoneVerification(tenantId,phone,{...station,terms:config.intake,shopEmail:config.shopEmail}),needsCode:true};
 const token=newToken();
 await saveAccess(db,tenantId,token,{kind:'intake',channel:'tablet',terms:config.intake,shopEmail:config.shopEmail,
  phone,customerId:registered?.customerId,quote:[],expires:Number.MAX_SAFE_INTEGER});
 return {token,needsCode:false};
}
export async function startPhoneVerification(tenantId:string,input:string,entry?:AgreementAccess){
 const normalized=normalizePhone(input);
 if(!/^\d{10}$/.test(normalized))throw agreementError('Enter a 10-digit mobile number.');
 const config=await readAgreementConfig(tenantId);
 const channel=entry?.channel||'online';
 if(!config.channels.includes(channel)||!(entry?.terms||config.intake).clauses.length||!(entry?.shopEmail||config.shopEmail))throw agreementError('Online intake is unavailable. Ask the shop for an intake link.');
 const sms=configFor(tenantId);
 if(!sms)throw agreementError('Text verification is unavailable. Ask the shop for an intake link.');
 const pin=String(randomInt(100000,1000000)),token=newToken(),now=Date.now();
 await db.$transaction(async tx=>{
  const tenant=await tx.$queryRaw<{id:string}[]>`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  if(!tenant.length)throw agreementError('This intake link is unavailable.');
  const keys=['CUSTOMER_AGREEMENT_SMS','CUSTOMER_AGREEMENT_SMS:'+digest(normalized)];
  for(const [i,key] of keys.entries()){
   const row=await tx.tenantSetting.findUnique({where:settingWhere(tenantId,key)});
   const prior=row?.value as {expires:number;count:number}|undefined;
   const count=prior&&prior.expires>now?prior.count:0;
   if(count>=(i===0?30:3))throw agreementError('Too many verification requests. Try again later.');
   const value={count:count+1,expires:count?prior!.expires:now+3600000};
   await tx.tenantSetting.upsert({where:settingWhere(tenantId,key),create:{tenantId,settingKey:key,value},update:{value}});
  }
  await saveAccess(tx,tenantId,token,{kind:'intake',channel,terms:entry?.terms||config.intake,shopEmail:entry?.shopEmail||config.shopEmail,
   bookingUrl:channel==='online'?config.bookingUrl:undefined,expires:now+3600000,pinExpires:now+600000,attempts:0,phone:normalized,proof:digest(token+':'+pin),quote:[]});
 });
 const response=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+sms.accountSid+'/Messages.json',{
  method:'POST',headers:{Authorization:'Basic '+Buffer.from(sms.accountSid+':'+sms.authToken).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({To:'+1'+normalized,From:sms.from,Body:'Your GroomPro verification code is '+pin+'. It expires in 10 minutes.'}),
  signal:AbortSignal.timeout(10000),
 });
 if(!response.ok)throw agreementError('The verification text could not be sent. Ask the shop for help.');
 return token;
}
export async function verifyAgreementPhone(tenantId:string,token:string,pin:string){
 return db.$transaction(async tx=>{
  const state=await readAccess(tx,tenantId,token,true);
  if(!state.proof||!state.phone||!state.pinExpires||state.pinExpires<Date.now()||(state.attempts||0)>=5)return false;
  if(!/^\d{6}$/.test(pin)||digest(token+':'+pin)!==state.proof){
   await saveAccess(tx,tenantId,token,{...state,attempts:(state.attempts||0)+1});return false;
  }
  const phone=await tx.customerPhone.findUnique({where:{tenantId_normalized:{tenantId,normalized:state.phone}},select:{customerId:true,isPrimary:true,customer:{select:{active:true}}}});
  if(phone&&(!phone.isPrimary||!phone.customer.active))throw agreementError('Ask the shop to help update your profile.');
  const {proof,pinExpires,attempts,...verified}=state;
  if(phone)verified.customerId=phone.customerId;
  if(state.channel==='tablet')verified.expires=Number.MAX_SAFE_INTEGER;
  await saveAccess(tx,tenantId,token,verified);
  return true;
 });
}

export async function agreementProfile(tx:Prisma.TransactionClient,tenantId:string,state:AgreementAccess):Promise<AgreementProfile>{
 if(!state.customerId)return {id:'',phone:state.phone||'',pets:[]};
 const c=await tx.customer.findFirst({
  where:{id:state.customerId,tenantId,active:true},
  select:{id:true,firstName:true,lastName:true,email:true,address1:true,address2:true,city:true,state:true,postalCode:true,
   phones:{where:{tenantId},select:{number:true},orderBy:[{isPrimary:'desc'},{id:'asc'}]},
   pets:{where:{tenantId,active:true},orderBy:{id:'asc'},select:{id:true,name:true,breed:true,weightLbs:true,color:true,groomingNotes:true,
    medicalNotes:true,behaviorNotes:true,veterinarian:true,pictureUrl:true}}},
 });
 if(!c)throw agreementError('The shop must update this customer profile before signing.');
 const {phones,pets,...profile}=c;
 const referral=(await customerReferrals(tenantId,[c.id],tx)).get(c.id);
 return {...profile,referralSource:referral?.referralSource||'',phone:phones[0]?.number||'',additionalPhone:phones[1]?.number||'',thirdPhone:phones[2]?.number||'',
  pets:pets.filter(p=>state.kind==='intake'||state.quote.some(q=>q.petId===p.id)).map(p=>({...p,weightLbs:p.weightLbs?.toNumber()??null}))};
}
function field(value:unknown,max=191){
 if(typeof value!=='string'||value.trim().length>max)throw agreementError('Enter a shorter value.');
 return value.trim();
}
export function readableAgreement(state:AgreementAccess){
 if(state.proof||(!state.customerId&&!state.phone))throw agreementError('Verify your phone number first.');
}
export async function updateAgreementProfile(tenantId:string,token:string,input:Record<string,unknown>){
 return db.$transaction(async tx=>{
  const state=await readAccess(tx,tenantId,token,true);readableAgreement(state);
  if(state.documentId)throw agreementError('This agreement is already signed.');
  if(state.customerId)await tx.$queryRaw`SELECT id FROM Customer WHERE id=${state.customerId} AND tenantId=${tenantId} FOR UPDATE`;
  if(!state.customerId){
   const firstName=field(input.firstName),lastName=field(input.lastName),email=field(input.email).toLowerCase();
   if(!firstName||!lastName||!allowedAgreementEmail(email))throw agreementError('Enter your name and email.');
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
   if(await tx.customer.findFirst({where:{tenantId,email},select:{id:true}}))throw agreementError('Ask the shop for a link to update your existing profile.');
   const phone=state.phone!;
   const existing=await tx.customerPhone.findUnique({where:{tenantId_normalized:{tenantId,normalized:phone}},select:{customerId:true}});
   if(existing)throw agreementError('This phone now matches a profile. Reopen the form and verify the number again.');
   const c=await tx.customer.create({data:{tenantId,firstName,lastName,email,phones:{create:{tenantId,number:phone,normalized:phone,isPrimary:true}}}});
   state.customerId=c.id;
   await saveAccess(tx,tenantId,token,state);
  }else if(input.petId!==undefined){
   if(!input.petId&&state.kind==='vip')throw agreementError('Ask the shop to add a dog to this VIP quote.');
   const petId=typeof input.petId==='string'?input.petId:'';
   if(state.kind==='vip'&&!state.quote.some(p=>p.petId===petId))throw agreementError('This dog is not part of this VIP quote.');
   const pet=petId?await tx.pet.findFirst({where:{id:petId,tenantId,customerId:state.customerId,active:true}}):null;
   if(petId&&!pet)throw agreementError('Dog not found.');
   const owner=await tx.customer.findFirst({where:{id:state.customerId,tenantId,active:true},select:{id:true}});
   if(!owner)throw agreementError('Customer not found.');
   const data:Record<string,string|number|null>={};
   for(const key of Object.keys(dogFields)){
    if(input[key]===undefined)continue;
    if(key==='weightLbs'){
     const value=input[key]===''?null:Number(input[key]);
     if(value!==null&&(!Number.isFinite(value)||value<=0||value>9999.99))throw agreementError('Enter a valid dog weight.');
     data[key]=value;
    }else data[key]=field(input[key],key.endsWith('Notes')?2000:191)||null;
   }
   if((!pet||input.name!==undefined)&&!data.name)throw agreementError('Enter the dog’s name.');
   const id=pet?.id||randomUUID();
   if(input.photo!==undefined){
    const photo=String(input.photo);
    if(!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(photo)||photo.length>240000)throw agreementError('Choose a smaller photo.');
    const key=pictureKey(id);
    await tx.tenantSetting.upsert({where:settingWhere(tenantId,key),create:{tenantId,settingKey:key,value:photo},update:{value:photo}});
    data.pictureUrl=agreementPicturePath(tenantId,id);
   }
   if(data.breed!==undefined)Object.assign(data,petBreedData({breed:data.breed||''},await loadBreeds(tx,tenantId),pet||{}));
   if(pet)await tx.pet.update({where:{id:pet.id},data});
   else await tx.pet.create({data:{...data,id,tenantId,customerId:state.customerId,name:String(data.name)}});
  }else{
   const data:Record<string,string|null>={};
   for(const key of Object.keys(customerFields)){
    if(input[key]===undefined||['referralSource','additionalPhone','thirdPhone'].includes(key))continue;
    const value=field(input[key]);
    if(['firstName','lastName'].includes(key)&&!value)throw agreementError('Enter a name.');
    if(key==='email'&&value&&!allowedAgreementEmail(value))throw agreementError('Enter a valid email.');
    data[key]=value||null;
   }
   if(Object.keys(data).length){
    const result=await tx.customer.updateMany({where:{id:state.customerId,tenantId,active:true},data});
    if(!result.count)throw agreementError('Customer not found.');
   }
   if(input.referralSource!==undefined)await saveCustomerReferral(tx,tenantId,state.customerId,{referralSource:field(input.referralSource)});
   for(const [index,key] of ['additionalPhone','thirdPhone'].entries()){
    if(input[key]===undefined)continue;
    const number=field(input[key]),normalized=normalizePhone(number);
    if(number&&!/^\d{10}$/.test(normalized))throw agreementError('Enter a valid phone number.');
    const phones=await tx.customerPhone.findMany({where:{tenantId,customerId:state.customerId},orderBy:[{isPrimary:'desc'},{id:'asc'}]});
    const current=phones[index+1];
    if(number&&phones.some(p=>p.id!==current?.id&&p.normalized===normalized))throw agreementError('This phone is already on your profile.');
    if(!number&&current)await tx.customerPhone.delete({where:{id:current.id}});
    else if(number&&current)await tx.customerPhone.update({where:{id:current.id},data:{number,normalized}});
    else if(number)await tx.customerPhone.create({data:{tenantId,customerId:state.customerId,number,normalized}});
   }
  }
  await tx.customer.updateMany({where:{id:state.customerId,tenantId},data:{updatedAt:new Date()}});
  return agreementProfile(tx,tenantId,state);
 });
}
export async function getAgreementPhoto(tenantId:string,petId:string){
 const row=await db.tenantSetting.findUnique({where:settingWhere(tenantId,pictureKey(petId))});
 const value=row?.value;
 if(typeof value!=='string'||!value.startsWith('data:image/jpeg;base64,'))return null;
 return Buffer.from(value.slice(23),'base64');
}
export function markAgreementSigned(tx:Prisma.TransactionClient,tenantId:string,token:string,state:AgreementAccess,documentId:string){
 return saveAccess(tx,tenantId,token,{...state,documentId,expires:Math.min(state.expires,Date.now()+86400000)});
}
