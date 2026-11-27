import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {listPetPhotos,readPetPhoto,savePetPhoto,petPhotoProfile,setPetProfilePhoto} from '@/src/lib/pet-photos';
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});try{
 if(r.method==='GET'){const profile=r.nextUrl.searchParams.get('profilePetId');
 if(profile)return NextResponse.json({pet:await petPhotoProfile(session.tenantId,profile)},{headers:{'Cache-Control':'no-store'}});
 const id=r.nextUrl.searchParams.get('id');if(id){const p=await readPetPhoto(session.tenantId,id);return new NextResponse(new Uint8Array(Buffer.from(p.data,'base64')),{headers:{'Content-Type':p.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(p.name)}});}const petId=r.nextUrl.searchParams.get('petId')||'';const [photos,pet]=await Promise.all([listPetPhotos(session.tenantId,petId,r.nextUrl.searchParams.get('ticketId')||undefined),petPhotoProfile(session.tenantId,petId)]);return NextResponse.json({photos,pet},{headers:{'Cache-Control':'no-store'}});}
 if(r.method==='PATCH')return NextResponse.json({pet:await setPetProfilePhoto(session.tenantId,session.user.id,await r.json())});
 const raw=await r.text();if(raw.length>7_010_000)throw Error('Choose a grooming photo no larger than 5 MB.');return NextResponse.json({photo:await savePetPhoto(session.tenantId,session.user.id,JSON.parse(raw))});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{feature:'PETS'});
export const POST=withRequestPolicy(handle,{feature:'PETS'});
export const PATCH=withRequestPolicy(handle,{feature:'PETS'});
