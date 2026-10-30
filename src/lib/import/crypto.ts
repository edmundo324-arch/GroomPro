import {gzipSync,gunzipSync} from 'node:zlib';
import {createCipheriv,createDecipheriv,createHash,randomBytes,scryptSync} from 'node:crypto';
let cachedSecret:string|undefined,cachedKey:Buffer|undefined;
function key(){
 const secret=process.env.GROOMPRO_IMPORT_KEY||'';
 if(!secret.trim())throw Error('Set GROOMPRO_IMPORT_KEY to your private secret before importing.');
 if(secret===cachedSecret&&cachedKey)return cachedKey;
 // Keep existing encrypted history readable; other secret formats use a KDF.
 const result=/^[a-fA-F0-9]{64}$/.test(secret)?Buffer.from(secret,'hex'):scryptSync(secret,'GroomPro import encryption v1',32);
 cachedSecret=secret;cachedKey=result;return result;
}
export function seal(value:unknown,tenantId:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);c.setAAD(Buffer.from(tenantId));const body=Buffer.concat([c.update(gzipSync(Buffer.from(JSON.stringify(value),'utf8'))),c.final()]);return [iv,c.getAuthTag(),body].map(b=>b.toString('base64')).join('.');}
export function unseal(value:string,tenantId:string){const [iv,tag,body]=value.split('.').map(s=>Buffer.from(s,'base64'));const c=createDecipheriv('aes-256-gcm',key(),iv);c.setAAD(Buffer.from(tenantId));c.setAuthTag(tag);return JSON.parse(gunzipSync(Buffer.concat([c.update(body),c.final()]),{maxOutputLength:512*1024*1024}).toString('utf8'));}
export const fingerprint=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
