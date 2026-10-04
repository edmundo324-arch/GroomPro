import {createHmac,timingSafeEqual} from 'node:crypto';
export function validTwilioSignature(url:string,parameters:URLSearchParams,token:string,signature:string){
 const names=[...new Set(parameters.keys())].sort();
 if(names.some(name=>parameters.getAll(name).length!==1))return false;
 const payload=url+names.map(name=>name+parameters.get(name)).join('');
 const expected=createHmac('sha1',token).update(payload).digest();
 const actual=Buffer.from(signature,'base64');
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function deliveryCanAdvance(previous:string,next:string){
 if(['DELIVERED','READ','FAILED','UNDELIVERED'].includes(previous))return previous===next;
 const order=['NOT_CONFIGURED','UNKNOWN','SENDING','ACCEPTED','QUEUED','SENT','DELIVERED','READ'];
 return ['FAILED','UNDELIVERED'].includes(next)||order.indexOf(next)>=order.indexOf(previous);
}
