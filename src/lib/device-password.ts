import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export async function hashDevicePassword(password:string){
 if(password.length<12||password.length>128)throw Error('Use a device password with 12–128 characters. A phrase with spaces is welcome.');
 const salt=randomBytes(16).toString('hex'),key=await derive(password,salt,32) as Buffer;
 return salt+':'+key.toString('hex');
}
export async function checkDevicePassword(password:string,stored:unknown){
 if(typeof stored!=='string'||password.length>128||!/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(stored))return false;
 const [salt,key]=stored.split(':');return timingSafeEqual(await derive(password,salt,32) as Buffer,Buffer.from(key,'hex'));
}
export const devicePolicyKey='DEVICE_AUTH_POLICY';
export const deviceEmailVerifiedKey='DEVICE_EMAIL_VERIFIED';
