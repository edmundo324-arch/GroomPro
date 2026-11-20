import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {listPetPhotos,readPetPhoto,savePetPhoto} from '@/src/lib/pet-photos';
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});try{
 if(r.method==='GET'){const id=r.nextUrl.searchParams.get('id');if(id){const p=await readPetPhoto(session.tenantId,id);return new NextResponse(new Uint8Array(Buffer.from(p.data,'base64')),{headers:{'Content-Type':p.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(p.name)}});}return NextResponse.json({photos:await listPetPhotos(session.tenantId,r.nextUrl.searchParams.get('petId')||'',r.nextUrl.searchParams.get('ticketId')||undefined)},{headers:{'Cache-Control':'no-store'}});}
 const raw=await r.text();if(raw.length>7_010_000)throw Error('Choose a grooming photo no larger than 5 MB.');return NextResponse.json({photo:await savePetPhoto(session.tenantId,session.user.id,JSON.parse(raw))});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{feature:'PETS'});
export const POST=withRequestPolicy(handle,{feature:'PETS'});
