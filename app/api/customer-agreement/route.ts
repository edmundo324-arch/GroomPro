import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformRestriction} from '@/src/lib/platform-restrictions';
import {isAgreementToken,validTenant,readAccess,startPhoneVerification,verifyAgreementPhone,readableAgreement,agreementProfile,updateAgreementProfile,getAgreementPhoto,agreementPicturePath} from '@/src/lib/customer-agreement-store';
import {agreementRevision} from '@/src/lib/customer-agreement-pdf';
import {signAgreement} from '@/src/lib/customer-agreement-signing';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers});
export async function POST(request:NextRequest){
 try{
  const raw=await request.text();
  if(raw.length>300000)return reply({error:'This form update is too large.'},413);
  const body=JSON.parse(raw);
  const {tenant,token,action}=body;
  if(!validTenant(tenant)||await platformRestriction(tenant))return reply({error:'This form is unavailable.'},404);
  if(action==='sendCode'){
   const entry=isAgreementToken(token)?await readAccess(db,tenant,token):undefined;
   if(entry&&(entry.kind!=='intake'||entry.customerId||entry.phone))return reply({error:'Open the original intake link to start again.'},400);
   return reply({token:await startPhoneVerification(tenant,String(body.phone||''),entry)});
  }
  if(!isAgreementToken(token))return reply({error:'Open a valid form link.'},401);
  if(action==='verifyCode'){
   return await verifyAgreementPhone(tenant,token,String(body.code||''))?reply({verified:true}):reply({error:'Incorrect or expired verification code.'},400);
  }
  const state=await readAccess(db,tenant,token);
  if(action==='view'&&!state.phone&&!state.customerId&&state.kind==='intake')return reply({needsPhone:true});
  readableAgreement(state);
  if(action==='sign')return reply(await signAgreement(tenant,token,body));
  if(state.documentId)return reply({signed:true});
  if(action==='photo'){
   const profile=await agreementProfile(db,tenant,state);
   const pet=profile.pets.find(p=>p.id===body.petId);
   if(!pet||pet.pictureUrl!==agreementPicturePath(tenant,pet.id))return reply({error:'Photo not found.'},404);
   const image=await getAgreementPhoto(tenant,pet.id);
   return image?reply({photo:'data:image/jpeg;base64,'+image.toString('base64')}):reply({error:'Photo not found.'},404);
  }
  if(action!=='view'&&action!=='edit')return reply({error:'Choose a valid form action.'},400);
  const profile=action==='edit'?await updateAgreementProfile(tenant,token,body.fields||{}):await agreementProfile(db,tenant,state);
  const business=await db.tenant.findUnique({where:{id:tenant},select:{name:true}});
  return reply({profile,kind:state.kind,quote:state.quote,terms:state.terms,business:business?.name||'',
   revision:agreementRevision(profile,state.terms,state.quote)});
 }catch(error){
  const message=error instanceof Error?error.message:'Could not complete this form.';
  // Do not expose database queries, provider responses or customer data on errors.
  return reply({error:error instanceof Error&&error.name==='AgreementError'?message:'Could not save this form step. Check your details or ask the shop for help.'},400);
 }
}
