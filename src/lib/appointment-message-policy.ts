import {localToInstant,zonedParts} from './operating-hours';
export type MessageTime={daysBefore:number;time:string};
export type AppointmentMessagePolicy={publicOrigin:string;enabled:boolean;promptOnReschedule:boolean;channels:Array<'SMS'|'EMAIL'>;confirmationTimes:MessageTime[];confirmationText:string;feeReminder:string;reminderText:string};
export const defaultAppointmentMessagePolicy:AppointmentMessagePolicy={
 publicOrigin:'',enabled:true,promptOnReschedule:true,channels:['SMS'],
 confirmationTimes:[7,5,3,2,0].map(daysBefore=>({daysBefore,time:daysBefore===0?'07:00':'09:00'})),
 confirmationText:'{business}: Please confirm the appointment for {pets} on {appointmentDate} at {appointmentTime}. {portalLink}',
 feeReminder:'{business} requires {notice} notice to cancel or move to another day. Missed appointments and late cancellations will incur a Reserved Appointment Fee of {fee}.',
 reminderText:'{business}: A reminder for {pets}’s appointment on {appointmentDate} at {appointmentTime}. {portalLink}',
};
export function messageTimes(value:unknown):MessageTime[]{
 if(!Array.isArray(value)||value.length>30)throw Error('Choose up to 30 reminder times.');
 const seen=new Set<string>();return value.map(v=>{
  if(!v||!Number.isInteger(v.daysBefore)||v.daysBefore<0||v.daysBefore>365||typeof v.time!=='string'||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.time))throw Error('Choose the number of days before the appointment and a valid clock time.');
  const key=v.daysBefore+':'+v.time;if(seen.has(key))throw Error('That reminder time is already listed. Choose a different time.');seen.add(key);return {daysBefore:v.daysBefore,time:v.time};
 });
}
const variables=['business','customer','firstName','pets','appointmentDate','appointmentTime','location','portalLink','notice','fee'];
export function appointmentMessagePolicy(value:unknown):AppointmentMessagePolicy{
 const v=value as AppointmentMessagePolicy;
 if(!v||typeof v.enabled!=='boolean'||typeof v.promptOnReschedule!=='boolean'||!Array.isArray(v.channels)||!v.channels.length||v.channels.some(c=>!['SMS','EMAIL'].includes(c)))throw Error('Choose SMS, email, or both for appointment messages.');
 const texts:Record<string,string>={};for(const key of ['confirmationText','feeReminder','reminderText'] as const){const text=v[key];if(typeof text!=='string'||!text.trim()||text.length>1200)throw Error('Keep each message section between 1 and 1,200 characters.');if((text.match(/\{[^{}]*\}/g)||[]).some(t=>!variables.includes(t.slice(1,-1))))throw Error('Use the listed automatic details in appointment messages.');texts[key]=text.trim();}
 return {publicOrigin:messagePublicOrigin(v.publicOrigin||''),enabled:v.enabled,promptOnReschedule:v.promptOnReschedule,channels:[...new Set(v.channels)],confirmationTimes:messageTimes(v.confirmationTimes),confirmationText:texts.confirmationText,feeReminder:texts.feeReminder,reminderText:texts.reminderText};
}
// Preserve the shop's wall-clock choice across daylight-saving changes.
// The caller decides eligibility and records any invalid local clock time for staff review.
export function appointmentMessageTimes(start:Date,timezone:string,times:MessageTime[]){
 if(!Number.isFinite(+start))throw Error('Review the appointment date before scheduling messages.');
 const date=zonedParts(start,timezone).date;
 return messageTimes(times).map(rule=>{const day=new Date(date+'T12:00:00Z');day.setUTCDate(day.getUTCDate()-rule.daysBefore);return {...rule,at:localToInstant(day.toISOString().slice(0,10)+'T'+rule.time,timezone)};}).filter(rule=>+rule.at<+start).sort((a,b)=>+a.at-+b.at);
}

export function messagePublicOrigin(value:string){
 if(!value.trim())return '';
 let url:URL;try{url=new URL(value.trim())}catch{throw Error('Enter the secure website address customers use to open GroomPro.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname)||url.hostname==='localhost'||/^(127\.|0\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname)||url.hostname.startsWith('['))throw Error('Use GroomPro’s public https website address, without a page path or private preview token.');
 return url.origin;
}
