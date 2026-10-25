import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export const pinVaultKey=(id:string)=>'EMPLOYEE_PIN_VAULT:'+id;
function key(){const value=process.env.GROOMPRO_PIN_VAULT_KEY||'';if(!/^[a-f0-9]{64}$/i.test(value))throw Error('Owner PIN viewing needs GROOMPRO_PIN_VAULT_KEY configured on this server.');return Buffer.from(value,'hex')}
export function sealPin(pin:string,tenantId:string,userId:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(JSON.stringify([tenantId,userId])));
 const data=Buffer.concat([cipher.update(pin,'utf8'),cipher.final()]);return {version:1,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),data:data.toString('hex')};
}
export function openPin(value:any,tenantId:string,userId:string){
 if(value?.version!==1)throw Error('This PIN was saved before owner viewing was available. Reset it once to enable viewing.');
 const cipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(value.iv,'hex'));cipher.setAAD(Buffer.from(JSON.stringify([tenantId,userId])));cipher.setAuthTag(Buffer.from(value.tag,'hex'));
 return Buffer.concat([cipher.update(Buffer.from(value.data,'hex')),cipher.final()]).toString('utf8');
}
