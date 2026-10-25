import {withRequestPolicy} from '@/src/lib/request-policy';
import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {writeAudit} from '@/src/lib/audit';
import {breedKey,findBreed,petBreedData,Breed} from '@/src/lib/breed-classification';
import {loadBreeds,breedSettingKey} from '@/src/lib/breed-store';
import {breedGroomingDefault} from '@/src/lib/grooming-note-defaults';
const tenant=(r:NextRequest)=>r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
async function handlePolicyGET(r:NextRequest){const tenantId=tenant(r);if(!tenantId)return NextResponse.json({error:'Business context is required.'},{status:401});const breeds=await loadBreeds(db,tenantId);return NextResponse.json({breeds:breeds.map(b=>({...b,groomingNotesDefault:breedGroomingDefault({breedId:b.id},breeds)}))});}
async function handlePolicyPOST(r:NextRequest){
 const tenantId=tenant(r),sid=r.cookies.get('groompro_session')?.value;const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;
 if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'Manager authorization is required.'},{status:403});
 try{const b=await r.json();const result=await db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
 const breeds=await loadBreeds(tx,tenantId);
 if(b.action==='RECONCILE'){
 const pets=await tx.pet.findMany({where:{tenantId,breedId:null,breed:{not:null}}});let linked=0;const review=[];
 for(const pet of pets){const match=findBreed(pet.breed||'',breeds);if(match){await tx.pet.updateMany({where:{id:pet.id,tenantId,breedId:null,breed:pet.breed},data:petBreedData({breed:pet.breed},breeds,pet)});linked++;}else review.push({id:pet.id,name:pet.name,breed:pet.breed,customerId:pet.customerId});}
 return{linked,review};
 }
 const name=String(b.name||'').trim(),aliases=Array.isArray(b.aliases)?b.aliases.map((a:unknown)=>String(a).trim()).filter(Boolean):[];
 if(!name||name.length>191||aliases.length>100||aliases.some((a:string)=>a.length>191))throw Error('Enter a breed name and valid aliases.');
 const id=b.id?String(b.id):'custom-'+randomUUID();if(b.id&&!breeds.some(x=>x.id===id))throw Error('Breed not found.');
 const keys=[name,...aliases].map(breedKey);if(keys.some(k=>!k)||breeds.some(x=>x.id!==id&&[x.name,...x.aliases].some(n=>keys.includes(breedKey(n)))))throw Error('That name or alias already belongs to another breed.');
 const parents=[b.primaryBreedId,b.secondaryBreedId].filter(Boolean);if(parents.some(p=>p===id||!breeds.some(x=>x.id===p&&!x.primaryBreedId&&!x.secondaryBreedId)))throw Error('Choose recognized foundation breeds for the parent breeds.');if(parents.length===2&&parents[0]===parents[1])throw Error('Choose two different parent breeds.');
 const existing=breeds.find(x=>x.id===id);const item:Breed={...existing,id,name,aliases:[...new Set(aliases)] as string[],...(b.primaryBreedId?{primaryBreedId:String(b.primaryBreedId)}:{primaryBreedId:undefined}),...(b.secondaryBreedId?{secondaryBreedId:String(b.secondaryBreedId)}:{secondaryBreedId:undefined}),source:existing?.source||'Business-approved breed'};
 const setting=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:breedSettingKey}}});const overrides=Array.isArray(setting?.value)?setting.value as any[]:[];const value=JSON.parse(JSON.stringify([...overrides.filter(x=>x.id!==id),item]));
 await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:breedSettingKey}},create:{tenantId,settingKey:breedSettingKey,value},update:{value}});return{breed:item};
 },{timeout:120000});await writeAudit({tenantId,actorUserId:session.user.id,entityType:'TENANT',entityId:tenantId,action:'BREED_DICTIONARY',summary:b.action==='RECONCILE'?'Linked recognized pet breeds; preserved original descriptions.':'Updated breed dictionary.'});return NextResponse.json(result);
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Breed update failed.'},{status:400});}
}

export const GET=withRequestPolicy(handlePolicyGET, {});
export const POST=withRequestPolicy(handlePolicyPOST, {});
