import {gzipSync,gunzipSync} from 'node:zlib';
import {createCipheriv,createDecipheriv,createHash,randomBytes,scryptSync} from 'node:crypto';
export const importKeySetting = 'IMPORT_ENCRYPTION_KEY';
type KeyStore = {tenantSetting: {findUnique: (args:any)=>Promise<any>; upsert: (args:any)=>Promise<any>}};
let cachedSecret:string|undefined,cachedKey:Buffer|undefined;
function configuredKey(){
 const original=process.env.GROOMPRO_IMPORT_KEY;
 const secret=original?.trim()?original:process.env.GROOMPRO_IMPORT_SECRET;
 if(!secret?.trim())return null;
 if(secret===cachedSecret&&cachedKey)return cachedKey;
 const result=/^[a-fA-F0-9]{64}$/.test(secret)?Buffer.from(secret,'hex'):scryptSync(secret,'GroomPro import encryption v1',32);
 cachedSecret=secret;cachedKey=result;return result;
}
async function managedKey(tenantId:string,store:KeyStore|undefined,create:boolean){
 if(!store)throw Error('Import storage is unavailable. Please try importing again.');
 const where={tenantId_settingKey:{tenantId,settingKey:importKeySetting}};
 let row=await store.tenantSetting.findUnique({where});
 if(!row&&create)row=await store.tenantSetting.upsert({where,update:{settingKey:importKeySetting},create:{tenantId,settingKey:importKeySetting,value:{version:1,key:randomBytes(32).toString('hex')}}});
 if(row?.value?.version!==1||! /^[a-fA-F0-9]{64}$/.test(row?.value?.key||''))throw Error('The protection key for this saved import is unavailable. Restore it from the business database backup before opening this import.');
 return Buffer.from(row.value.key,'hex');
}
export async function seal(value:unknown,tenantId:string,store?:KeyStore){
 const configured=configuredKey(),key=configured||await managedKey(tenantId,store,true);
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(tenantId));
 const body=Buffer.concat([c.update(gzipSync(Buffer.from(JSON.stringify(value),'utf8'))),c.final()]);
 return (configured?'':'managed.v1.')+[iv,c.getAuthTag(),body].map(b=>b.toString('base64')).join('.');
}
export async function unseal(value:string,tenantId:string,store?:KeyStore){
 const managed=value.startsWith('managed.v1.');
 const key=managed?await managedKey(tenantId,store,false):configuredKey();
 if(!key)throw Error('This older import was protected with the previous import secret. Restore that secret to open it, or upload the original file as a new import.');
 const [iv,tag,body]=(managed?value.slice('managed.v1.'.length):value).split('.').map(s=>Buffer.from(s,'base64'));
 const c=createDecipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(tenantId));c.setAuthTag(tag);
 return JSON.parse(gunzipSync(Buffer.concat([c.update(body),c.final()]),{maxOutputLength:512*1024*1024}).toString('utf8'));
}
export const fingerprint=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
