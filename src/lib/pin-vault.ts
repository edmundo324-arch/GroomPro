import {createCipheriv,createDecipheriv,randomBytes,scryptSync} from 'node:crypto';

export const pinVaultKey=(id:string)=>'EMPLOYEE_PIN_VAULT:'+id;
const configuredSecret=()=>process.env.GROOMPRO_PIN_VAULT_KEY?.trim()||'';
const isLegacyKey=(secret:string)=>/^[a-f0-9]{64}$/i.test(secret);

export function pinVaultConfigured(){return Boolean(configuredSecret())}
export function requirePinVault(){
 if(!pinVaultConfigured())throw Error('View Current PIN requires the GROOMPRO_PIN_VAULT_KEY secret. Add it to the running app and redeploy.');
}

export function sealPin(pin:string,tenantId:string,userId:string){
 requirePinVault();
 const secret=configuredSecret(),salt=isLegacyKey(secret)?undefined:randomBytes(16);
 const key=salt?scryptSync(secret,salt,32):Buffer.from(secret,'hex');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(JSON.stringify([tenantId,userId])));
 const data=Buffer.concat([cipher.update(pin,'utf8'),cipher.final()]);
 return {version:salt?2:1,...(salt?{salt:salt.toString('hex')}:{}),iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),data:data.toString('hex')};
}

export function openPin(value:any,tenantId:string,userId:string){
 requirePinVault();
 if(value?.version!==1&&value?.version!==2)throw Error('This PIN was not saved for viewing. Enter a new PIN in Reset PIN and choose Save employee, or have the employee sign in with their current PIN.');
 const secret=configuredSecret();
 try{
  if(value.version===1&&!isLegacyKey(secret))throw Error('Previous key required');
  const key=value.version===1?Buffer.from(secret,'hex'):scryptSync(secret,Buffer.from(value.salt,'hex'),32);
  const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(value.iv,'hex'));
  cipher.setAAD(Buffer.from(JSON.stringify([tenantId,userId])));
  cipher.setAuthTag(Buffer.from(value.tag,'hex'));
  return Buffer.concat([cipher.update(Buffer.from(value.data,'hex')),cipher.final()]).toString('utf8');
 }catch{
  throw Error('The configured secret cannot unlock this saved PIN. Restore the original secret, sign in with the current PIN, or reset the PIN to save it with the current secret.');
 }
}
