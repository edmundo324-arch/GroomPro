export const customerDetailFields = {
 address1:'Street address', address2:'Address line 2', city:'City', state:'State / province', postalCode:'Postal code',
 spouse:'Spouse / related contact', popupNotes:'Important popup notes', historyNotes:'Historical notes',
} as const;
export function customerDetails(input:Record<string,unknown>){
 const data:Record<string,string|null>={};
 for(const key of Object.keys(customerDetailFields))if(input[key]!==undefined){
  if(input[key]!==null&&typeof input[key]!=='string')throw Error('Customer details must be text.');
  const value=String(input[key]??'').trim();
  if(!['popupNotes','historyNotes'].includes(key)&&value.length>191)throw Error(`${customerDetailFields[key as keyof typeof customerDetailFields]} must be 191 characters or fewer.`);
  data[key]=value||null;
 }
 return data;
}
