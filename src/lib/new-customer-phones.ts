import {normalizePhone} from './phone-normalization';
export function newCustomerPhones(input:{phones?:unknown;phone?:unknown}){
 if(input.phones!==undefined&&!Array.isArray(input.phones))throw Error('Enter the customer’s phone number.');
 const rows=Array.isArray(input.phones)?input.phones.filter(p=>String(p?.number||'').trim()):input.phone?[{number:String(input.phone),isPrimary:true}]:[];
 if(!rows.length)throw Error('Enter a phone number before creating this customer.');
 if(rows.length>200)throw Error('Provide up to 200 phone contacts.');
 const numbers=rows.map(p=>normalizePhone(String(p.number)));
 if(numbers.some(n=>n.length<7||n.length>15))throw Error('Enter a valid phone number.');
 if(new Set(numbers).size!==numbers.length)throw Error('List each phone number once.');
 return rows;
}
