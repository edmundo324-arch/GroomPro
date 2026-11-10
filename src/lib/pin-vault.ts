import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export const pinVaultKey=(id:string)=>'EMPLOYEE_PIN_VAULT:'+id;
export function pinVaultConfigured(){return /^[a-f0-9]{64}$/i.test(process.env.GROOMPRO_PIN_VAULT_KEY?.trim()||'')}
export function requirePinVault(){if(!pinVaultConfigured())throw Error('View Current PIN requires the GROOMPRO_PIN_VAULT_KEY secret on this server.')}
function key(){requirePinVault();return Buffer.from(process.env.GROOMPRO_PIN_VAULT_KEY!.trim(),'hex')}
export function sealPin(pin:string,tenantId:string,userId:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(JSON.stringify([tenantId,userId])));
 const data=Buffer.concat([cipher.update(pin,'utf8'),cipher.final()]);return {version:1,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),data:data.toString('hex')};
}
export function openPin(value:any,tenantId:string,userId:string){
 requirePinVault();
 if(value?.version!==1)throw Error('This PIN was not saved for viewing. Enter a new PIN in Reset PIN and choose Save employee, or have the employee sign in with their current PIN.');
 const cipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(value.iv,'hex'));cipher.setAAD(Buffer.from(JSON.stringify([tenantId,userId])));cipher.setAuthTag(Buffer.from(value.tag,'hex'));
 return Buffer.concat([cipher.update(Buffer.from(value.data,'hex')),cipher.final()]).toString('utf8');
}
