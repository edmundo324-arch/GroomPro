export const pickupCallAction = 'PICKUP_CALL_RECORDED';

export function pickupCallTime(entry:{details:unknown;occurredAt:Date}|null){
 if(!entry)return null;
 const at=(entry.details as {calledAt?:unknown}|null)?.calledAt;
 return typeof at==='string'&&Number.isFinite(Date.parse(at))?at:entry.occurredAt.toISOString();
}

export function pickupContacts<T extends {ticketId:string|null;subject:string|null;sentAt:Date|null;channel:string}>(
 ticketId:string,pickupAt:Date|string|null|undefined,communications:readonly T[],
){
 const ready=pickupAt?+new Date(pickupAt):NaN;
 let pickupTextedAt:Date|null=null,readyContacted=false;
 if(Number.isFinite(ready))for(const contact of communications){
  if(contact.ticketId!==ticketId||contact.subject!=='Ready for pickup'||!contact.sentAt||+contact.sentAt<ready)continue;
  readyContacted=true;
  if(contact.channel==='SMS'&&(!pickupTextedAt||contact.sentAt>pickupTextedAt))pickupTextedAt=contact.sentAt;
 }
 return {pickupTextedAt,readyContacted};
}

export const pickupContactAction='PICKUP_CONTACT_RECORDED';
export const pickupContactMethods={TEXT:'Text Message',CALL:'Phone Call',OTHER:'Other'};
export function recordedPickupContact(entry:{details:unknown;occurredAt:Date}|null){
 if(!entry)return null;const d=entry.details as any;
 if(!d||!Object.hasOwn(pickupContactMethods,d.method)||!Number.isFinite(Date.parse(d.contactedAt)))return null;
 return {method:d.method as keyof typeof pickupContactMethods,contactedAt:d.contactedAt as string,note:typeof d.note==='string'?d.note:''};
}
