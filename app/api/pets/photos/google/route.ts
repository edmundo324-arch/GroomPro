import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {db} from '@/src/lib/db';
import {petDocumentAccess} from '@/src/lib/pet-documents';
import {savePetPhoto} from '@/src/lib/pet-photos';
import {access,protect,openProtected,pickerRequest,selectedImages,imageData} from '@/src/lib/google-photos';

async function handle(r:NextRequest) {
  const employee=await platformSession(r);
  if(!employee)return NextResponse.json({error:'Sign in to GroomPro first.'},{status:401});
  try {
    const tenant=employee.tenantId,actor=employee.user.id,input=await r.json();
    const petId=String(input.petId||'');
    await petDocumentAccess(db,tenant,petId);
    const {token,version}=await access(tenant);
    if(input.action==='start'){
      const session=await pickerRequest('/sessions',token,'POST',{pickingConfig:{maxItemCount:'10'}});
      const selection=protect(tenant,'selection',{id:session.id,version,actor,petId,ticketId:input.ticketId||null,date:input.date,stage:input.stage,caption:input.caption||'',profile:input.useAsProfile===true,expires:Date.parse(session.expireTime)||Date.now()+3600000});
      return NextResponse.json({selection,url:session.pickerUri});
    }
    const s=openProtected(tenant,'selection',String(input.selection||''));
    if(s.actor!==actor||s.petId!==petId||s.version!==version)throw Error('Reopen Google Photos for this dog with the connected business account.');
    const path='/sessions/'+encodeURIComponent(s.id);
    if(input.action==='cancel'){await pickerRequest(path,token,'DELETE');return NextResponse.json({ok:true});}
    if(input.action!=='save'||s.profile!==(input.useAsProfile===true))throw Error('Reopen this photo selection.');
    const photos=await selectedImages(s.id,token);
    let saved=0,pet;
    for(const photo of photos){
      try {
        const hash=createHash('sha256').update(JSON.stringify([tenant,petId,s.id,photo.id])).digest('hex');
        const id=[hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20,32)].join('-');
        const result=await savePetPhoto(tenant,actor,{id,petId,ticketId:s.ticketId,date:s.date,stage:s.stage,caption:s.caption,useAsProfile:s.profile&&saved===0,name:photo.name,data:await imageData(photo.url,token)});
        if(result.pet)pet=result.pet;
        saved++;
      } catch(e){return NextResponse.json({saved,pet,error:(e as Error).message},{status:400});}
    }
    await pickerRequest(path,token,'DELETE').catch(()=>{});
    return NextResponse.json({saved,pet});
  } catch(e) {return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const POST=withRequestPolicy(handle,{feature:'PETS'});
