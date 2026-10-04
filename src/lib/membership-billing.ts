import {zonedParts,localToInstant} from './operating-hours';
export function nextMembershipBilling(start:Date,days:number[],timezone:string){
 if(!days.length||days.some(day=>!Number.isInteger(day)||day<1||day>28))throw Error('Choose supported billing days.');
 const localDate=zonedParts(start,timezone).date;
 for(let offset=0;offset<32;offset++){
  const date=new Date(Date.parse(localDate+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
  if(days.includes(Number(date.slice(-2))))return offset===0?start:localToInstant(date+'T00:00',timezone);
 }
 throw Error('The next billing date could not be calculated.');
}
