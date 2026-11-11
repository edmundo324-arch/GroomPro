import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {agreementChannels,quotePrice,type AgreementKind,type Quote} from '@/src/lib/customer-agreement-model';
import {isAgreementToken,readAccess,issueAgreement,readAgreementConfig,saveAgreementConfig} from '@/src/lib/customer-agreement-store';
import {parseAgreementPdf} from '@/src/lib/customer-agreement-signing';
import {isPlatformRole} from '@/src/lib/roles';

const tenantFrom=(r:NextRequest)=>r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
const headers={'Cache-Control':'no-store'};
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers});
const setupRole=(role:string)=>isPlatformRole(role)||['ADMIN','MANAGER'].includes(role);
const staff=async(r:NextRequest)=>{
 const tenantId=tenantFrom(r),sid=r.cookies.get('groompro_session')?.value;
 const session=sid?await getActiveEmployeeSession(tenantId,sid):null;
 return {tenantId,session};
};
async function read(r:NextRequest){
 const {tenantId,session}=await staff(r);
 if(!session)return json({error:'Enter your employee PIN.'},401);
 const token=r.headers.get('x-groompro-agreement');
 if(isAgreementToken(token)){
  try{const state=await readAccess(db,tenantId,token);return json({documentId:state.documentId||null});}
  catch{return json({error:'This agreement has expired.'},404);}
 }
 const id=r.nextUrl.searchParams.get('document');
 if(id){
  const [row]=await db.$queryRaw<{documentContent:string|null;documentType:string}[]>`SELECT documentContent,documentType FROM SignedDocument WHERE tenantId=${tenantId} AND id=${id}`;
  const pdf=row?.documentContent&&parseAgreementPdf(row.documentContent);
  return pdf?new NextResponse(new Uint8Array(Buffer.from(pdf,'base64')),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="signed-agreement.pdf"'}}):json({error:'Signed PDF not found.'},404);
 }
 const customerId=r.nextUrl.searchParams.get('customer');
 if(customerId){
  const profile=await db.customer.findFirst({where:{tenantId,id:customerId,active:true},select:{
   updatedAt:true,firstName:true,lastName:true,pets:{where:{tenantId,active:true},select:{id:true,name:true},orderBy:{name:'asc'}},
  }});
  if(!profile)return json({error:'Customer not found.'},404);
  if(r.nextUrl.searchParams.has('revision'))return json({updatedAt:profile.updatedAt});
  const documents=await db.$queryRaw<{id:string;title:string;signedAt:Date;sentCopy:boolean}[]>`SELECT id,title,signedAt,sentCopy FROM SignedDocument WHERE tenantId=${tenantId} AND customerId=${customerId} AND documentContent LIKE 'GROOMPRO_PDF_V1:%' ORDER BY signedAt DESC`;
  const config=await readAgreementConfig(tenantId);
  return json({tenantId,profile,documents,channels:config.channels,canConfigure:setupRole(session.user.role)});
 }
 if(!setupRole(session.user.role))return json({error:'An owner or manager can configure agreements.'},403);
 return json({tenantId,config:await readAgreementConfig(tenantId)});
}
async function update(r:NextRequest){
 const {tenantId,session}=await staff(r);
 if(!session)return json({error:'Enter your employee PIN.'},401);
 if(!setupRole(session.user.role))return json({error:'An owner or manager can configure agreements.'},403);
 try{return json({config:await saveAgreementConfig(tenantId,await r.json())});}
 catch(error){return json({error:error instanceof Error&&error.name==='AgreementError'?error.message:'Could not save the agreement settings.'},400);}
}
async function issue(r:NextRequest){
 const {tenantId,session}=await staff(r);
 if(!session)return json({error:'Enter your employee PIN.'},401);
 try{
  const {kind,channel,customerId,prices,planId,billing}=await r.json();
  if((kind!=='intake'&&kind!=='vip')||!agreementChannels.includes(channel)||channel==='online')return json({error:'Choose an agreement and delivery channel.'},400);
  const quote:Quote[]=[];
  if(customerId){
   const customer=await db.customer.findFirst({where:{tenantId,id:String(customerId),active:true},
    select:{pets:{where:{active:true,tenantId},select:{id:true}}}});
   if(!customer)return json({error:'Customer not found.'},404);
   if(kind==='vip'){
    if(!prices||typeof prices!=='object'||Array.isArray(prices))return json({error:'Enter a VIP price for each dog offered a membership.'},400);
    let planName:string|undefined;
    if(planId){
     const plan=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'VIP_PLAN:'+String(planId)}}});
     const value=plan?.value as {active?:boolean;name?:string}|null;
     if(!value?.active||!value.name||typeof billing!=='string'||!/^(MONTHLY|WEEKLY):[0-9]{1,2}$/.test(billing))return json({error:'Choose an active VIP plan and billing day.'},400);
     planName=value.name;
    }
    for(const [petId,price] of Object.entries(prices)){
     if(!customer.pets.some(p=>p.id===petId))return json({error:'Choose dogs on this customer’s profile.'},400);
     quote.push({petId,priceCents:quotePrice(price),...(planName?{planId:String(planId),planName,billing}:{})});
    }
   }
  }
  if(kind==='vip'&&(!customerId||!quote.length))return json({error:'Select at least one dog and enter their VIP price.'},400);
  const token=await issueAgreement(tenantId,kind as AgreementKind,channel,customerId?String(customerId):undefined,quote,session.user.id);
  return json({path:'/customer-forms?tenant='+encodeURIComponent(tenantId)+'#'+token,token},201);
 }catch(error){return json({error:error instanceof Error&&(error.name==='AgreementError'||error.message.startsWith('Enter a price'))?error.message:'Could not prepare the agreement.'},400);}
}
export const GET=withRequestPolicy(read,{feature:'CUSTOMERS'});
export const PUT=withRequestPolicy(update,{feature:'CUSTOMERS',configure:true});
export const POST=withRequestPolicy(issue,{feature:'CUSTOMERS'});
