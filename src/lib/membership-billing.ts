import {zonedParts,localToInstant} from './operating-hours';
export function nextMembershipBilling(start:Date,days:number[],timezone:string,cadence:'MONTHLY'|'WEEKLY'='MONTHLY'){
 const weekly=cadence==='WEEKLY';
 if(!days.length||days.some(day=>!Number.isInteger(day)||day<(weekly?0:1)||day>(weekly?6:31)))throw Error('Choose supported billing days.');
 const localDate=zonedParts(start,timezone).date;
 for(let offset=0;offset<63;offset++){
  const date=new Date(Date.parse(localDate+'T12:00:00Z')+offset*86400000),iso=date.toISOString().slice(0,10);
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  if(weekly?days.includes(date.getUTCDay()):days.some(day=>Math.min(day,last)===date.getUTCDate()))return offset===0?start:localToInstant(iso+'T00:00',timezone);
 }
 throw Error('The next billing date could not be calculated.');
}
