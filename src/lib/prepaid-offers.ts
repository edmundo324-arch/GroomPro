export type PrepaidOffer={id:string;name:string;itemKey:string;visits:number;priceCents:number;scope:'FAMILY'|'PET';commissionBasis:'PREPAID'|'REGULAR';expiresAfterDays:number|null;active:boolean};
export const prepaidOffersKey='PREPAID_OFFERS';
export function prepaidOffer(value:unknown):PrepaidOffer{
 const v=value as PrepaidOffer;if(!v||typeof v.id!=='string'||!/^[0-9a-f-]{36}$/i.test(v.id))throw Error('Reopen the prepaid package before saving.');
 if(typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>191)throw Error('Give the prepaid package a name of up to 191 characters.');
 if(typeof v.itemKey!=='string'||!(/^(SERVICE|PACKAGE):[^:]{1,191}$/).test(v.itemKey))throw Error('Choose the service or grooming package covered by each visit.');
 if(!Number.isSafeInteger(v.visits)||v.visits<1||v.visits>10000)throw Error('Enter the number of prepaid visits, from 1 to 10,000.');
 if(!Number.isSafeInteger(v.priceCents)||v.priceCents<1||v.priceCents>2147483647)throw Error('Enter the total prepaid price in dollars and cents.');
 if(!['PREPAID','REGULAR'].includes(v.commissionBasis))throw Error('Choose whether commission uses the prepaid price per visit or the regular service price.');
 if(!['FAMILY','PET'].includes(v.scope)||typeof v.active!=='boolean')throw Error('Choose who can use the prepaid visits and whether this offer is available.');
 if(v.expiresAfterDays!==null&&(!Number.isInteger(v.expiresAfterDays)||v.expiresAfterDays<1||v.expiresAfterDays>36500))throw Error('Leave expiration empty for no expiration, or enter the number of days after purchase.');
 return {id:v.id,name:v.name.trim(),itemKey:v.itemKey,visits:v.visits,priceCents:v.priceCents,scope:v.scope,commissionBasis:v.commissionBasis,expiresAfterDays:v.expiresAfterDays,active:v.active};
}
