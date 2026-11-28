import {localToInstant,zonedParts} from './operating-hours';
export type BirthdayPolicy={customers:boolean;pets:boolean;time:string;leapDay:'MARCH_1'|'FEBRUARY_28';customerText:string;petText:string};
export const defaultBirthdayPolicy:BirthdayPolicy={customers:true,pets:true,time:'08:00',leapDay:'MARCH_1',customerText:'Happy birthday, {customer}! Wishing you a wonderful day from everyone at {business}.',petText:'Happy birthday to {pet}! Sending birthday wishes from everyone at {business}.'};
export function birthdayPolicy(value:unknown):BirthdayPolicy{
 const p=(value??defaultBirthdayPolicy) as BirthdayPolicy;
 if(typeof p.customers!=='boolean'||typeof p.pets!=='boolean'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)||!['MARCH_1','FEBRUARY_28'].includes(p.leapDay))throw Error('Choose a birthday send time and a date for February 29 birthdays in non-leap years.');
 for(const key of ['customerText','petText'] as const){const allowed=key==='petText'?['{business}','{customer}','{firstName}','{location}','{pet}']:['{business}','{customer}','{firstName}','{location}'];if(typeof p[key]!=='string'||!p[key].trim()||p[key].length>1200||(p[key].match(/\{[^{}]*\}/g)||[]).some(t=>!allowed.includes(t)))throw Error('Write a birthday message using the listed details, up to 1,200 characters.');}
 return {...p,customerText:p.customerText.trim(),petText:p.petText.trim()};
}
export function birthdayDue(birth:Date|string|null,policy:BirthdayPolicy,timezone:string,now:Date){
 if(!birth)return null;const date=new Date(birth);if(!Number.isFinite(+date))return null;const today=zonedParts(now,timezone).date,year=Number(today.slice(0,4));if(date.toISOString().slice(0,10)>today)return null;
 let monthDay=date.toISOString().slice(5,10);if(monthDay==='02-29'&&new Date(Date.UTC(year,1,29)).getUTCMonth()!==1)monthDay=policy.leapDay==='MARCH_1'?'03-01':'02-28';
 return today.slice(5)===monthDay&&now>=localToInstant(today+'T'+policy.time,timezone)?year:null;
}
