import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';
import {db} from './db';

const settingKey = 'GOOGLE_PHOTOS_CONNECTION';
const picker = 'https://photospicker.googleapis.com/v1';
export const pickerScope = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
export const configured = () => Boolean(process.env.GOOGLE_PHOTOS_CLIENT_ID && process.env.GOOGLE_PHOTOS_CLIENT_SECRET && process.env.GOOGLE_PHOTOS_REDIRECT_URI);
export const canConnect = (role:string) => ['ADMIN','PLATFORM_OWNER','DEVELOPER'].includes(role);
const where = (tenantId:string) => ({tenantId_settingKey:{tenantId,settingKey}});

function key() {
  if (!configured()) throw Error('Ask your GroomPro administrator to enable Google Photos for this site.');
  return createHash('sha256').update('GroomPro Google Photos v1').update(process.env.GOOGLE_PHOTOS_CLIENT_SECRET!).digest();
}
export function protect(tenant:string, purpose:string, value:unknown) {
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key(),iv);
  cipher.setAAD(Buffer.from(JSON.stringify([tenant,purpose])));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');
}
export function openProtected(tenant:string,purpose:string,token:string) {
  try {
    const bytes=Buffer.from(token,'base64url'), decipher=createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));
    decipher.setAAD(Buffer.from(JSON.stringify([tenant,purpose])));
    decipher.setAuthTag(bytes.subarray(12,28));
    const data=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());
    if(data.expires && data.expires<Date.now()) throw Error();
    return data;
  } catch { throw Error('This Google Photos selection expired. Open Add From Google Photos again.'); }
}
export async function connection(tenantId:string) {
  const row=await db.tenantSetting.findUnique({where:where(tenantId)});
  return row?.value as {secret:string; version:string}|null;
}
async function tokenRequest(fields:Record<string,string>) {
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',cache:'no-store',body:new URLSearchParams({
    client_id:process.env.GOOGLE_PHOTOS_CLIENT_ID!,client_secret:process.env.GOOGLE_PHOTOS_CLIENT_SECRET!,...fields
  })});
  if(!response.ok)throw Error('Google could not authorize this account. Ask a business administrator to reconnect Google Photos.');
  return response.json();
}
export async function connect(tenantId:string,code:string) {
  const grant=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:process.env.GOOGLE_PHOTOS_REDIRECT_URI!});
  if(!grant.refresh_token || !String(grant.scope).split(' ').includes(pickerScope)) throw Error('Allow photo selection when connecting the business Google account.');
  const value={secret:protect(tenantId,'account',grant.refresh_token),version:randomBytes(16).toString('hex')};
  await db.tenantSetting.upsert({where:where(tenantId),create:{tenantId,settingKey,value},update:{value}});
}
export async function disconnect(tenantId:string) {await db.tenantSetting.deleteMany({where:{tenantId,settingKey}});}
export async function access(tenantId:string) {
  const account=await connection(tenantId);
  if(!account) throw Error('Ask a business administrator to connect the Google account used for grooming photos.');
  const grant=await tokenRequest({grant_type:'refresh_token',refresh_token:openProtected(tenantId,'account',account.secret)});
  return {token:String(grant.access_token),version:account.version};
}
export async function pickerRequest(path:string,token:string,method='GET',body?:object) {
  const response=await fetch(picker+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!response.ok) throw Error('Google Photos could not open this selection. Return to the gallery and try again.');
  return method==='DELETE'?null:response.json();
}
export async function selectedImages(sessionId:string,token:string) {
  const session=await pickerRequest('/sessions/'+encodeURIComponent(sessionId),token);
  if(!session.mediaItemsSet)throw Error('Finish choosing your photos in Google Photos, then return here.');
  const photos:{id:string;url:string;name:string}[]=[];
  let next='';
  do {
    const query=new URLSearchParams({sessionId,pageSize:'20'});
    if(next)query.set('pageToken',next);
    const page=await pickerRequest('/mediaItems?'+query,token);
    for(const item of page.mediaItems||[]) {
      if(item.type==='PHOTO')photos.push({id:item.id,url:item.mediaFile.baseUrl,name:item.mediaFile.filename||'Grooming Photo'});
    }
    next=page.nextPageToken||'';
  } while(next);
  if(!photos.length)throw Error('Choose at least one still photo for this dog.');
  return photos;
}
export async function imageData(base:string,token:string) {
  const url=new URL(base);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.googleusercontent.com'))throw Error('Google returned an unfamiliar photo address. Choose the photo again.');
  const response=await fetch(url.href+'=w1600-h1600',{headers:{Authorization:'Bearer '+token,Accept:'image/jpeg,image/png'},redirect:'error',cache:'no-store'});
  if(!response.ok||!response.body)throw Error('Google could not open the selected photo. Choose it again.');
  const reader=response.body.getReader(),parts:Buffer[]=[];
  let total=0;
  for(;;){
    const {value,done}=await reader.read();if(done)break;
    total+=value.byteLength;
    if(total>5*1024*1024){await reader.cancel();throw Error('This photo exceeds the gallery’s 5 MB limit. Choose a smaller copy.');}
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts).toString('base64');
}
