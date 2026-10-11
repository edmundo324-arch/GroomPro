import {gzipSync,gunzipSync} from 'node:zlib';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
function key(){const v=process.env.GROOMPRO_IMPORT_KEY||'';if(!/^[a-fA-F0-9]{64}$/.test(v))throw Error('Configure GROOMPRO_IMPORT_KEY as a private 64-character hexadecimal encryption key before staging imports. Keep a backed-up copy to read import history.');return Buffer.from(v,'hex');}
export function seal(value:unknown,tenantId:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);c.setAAD(Buffer.from(tenantId));const body=Buffer.concat([c.update(gzipSync(Buffer.from(JSON.stringify(value),'utf8'))),c.final()]);return [iv,c.getAuthTag(),body].map(b=>b.toString('base64')).join('.');}
export function unseal(value:string,tenantId:string){const [iv,tag,body]=value.split('.').map(s=>Buffer.from(s,'base64'));const c=createDecipheriv('aes-256-gcm',key(),iv);c.setAAD(Buffer.from(tenantId));c.setAuthTag(tag);return JSON.parse(gunzipSync(Buffer.concat([c.update(body),c.final()]),{maxOutputLength:512*1024*1024}).toString('utf8'));}
export const fingerprint=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
