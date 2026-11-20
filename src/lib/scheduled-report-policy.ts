import {localToInstant,zonedParts} from './operating-hours';
export const scheduledReportChoices=[{id:'summary',name:'Summary, memberships and referrals',prefixes:['Summary','Current VIP','VIP membership','Referral']},{id:'sales',name:'Sales and reconciliation',prefixes:['Recorded refunds','Recorded POS payments','Service sales','Sales','Saved prices','Reconciliation','Merchandise cost']},{id:'employees',name:'Employee time, commissions and tips',prefixes:['Employee','Recorded commissions']},{id:'customers',name:'Customer balances, retention and lifetime sales',prefixes:['Customer','Outstanding','Unpaid','Lifetime','Return visits','Retention','Overdue weeks','Visited in','First-time','Returning visitors','Currently overdue','No completed']},{id:'appointments',name:'Appointments, cancellations and online bookings',prefixes:['Care stages','Appointment','Cancellation','Resumed','Online booking','Unfinished booking']},{id:'inventory',name:'Current inventory',prefixes:['Current inventory']},{id:'prepaid',name:'Prepaid packages and gift cards',prefixes:['Prepaid','Gift']},{id:'messages',name:'Automatic message delivery',prefixes:['Automatic message']}];
export type ScheduledReportPolicy={enabled:boolean;locationId:string;reports:string[];recipients:string[];frequency:'DAILY'|'WEEKLY'|'MONTHLY';time:string;weekday:number;monthDay:number};
export const defaultScheduledReport:ScheduledReportPolicy={enabled:false,locationId:'',reports:[],recipients:[],frequency:'DAILY',time:'08:00',weekday:1,monthDay:1};
export function scheduledReportPolicy(input:any):ScheduledReportPolicy{
 if(!input||typeof input.enabled!=='boolean'||!['DAILY','WEEKLY','MONTHLY'].includes(input.frequency)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)||!Number.isInteger(input.weekday)||input.weekday<0||input.weekday>6||!Number.isInteger(input.monthDay)||input.monthDay<1||input.monthDay>31)throw Error('Choose a report frequency, a valid time and a weekly or monthly day.');
 if(typeof input.locationId!=='string'||input.locationId.length>191||!Array.isArray(input.reports)||input.reports.some((id:any)=>!scheduledReportChoices.some(c=>c.id===id))||!Array.isArray(input.recipients)||input.recipients.length>20)throw Error('Choose the shop, reports and up to 20 email recipients.');
 const recipients=[...new Set<string>(input.recipients.map((v:any)=>typeof v==='string'?v.trim().toLowerCase():''))];if(recipients.some(v=>v.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(v)))throw Error('Enter a valid email address for each report recipient.');
 if(input.enabled&&(!input.locationId||!input.reports.length||!recipients.length))throw Error('Choose a shop, at least one report and an email recipient before enabling delivery.');
 return {enabled:input.enabled,locationId:input.locationId,reports:[...new Set<string>(input.reports)],recipients,frequency:input.frequency,time:input.time,weekday:input.weekday,monthDay:input.monthDay};
}
export function scheduledReportPeriod(policy:ScheduledReportPolicy,now:Date,timezone:string,enabledAt:string){
 const local=zonedParts(now,timezone),date=local.date,time=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now),day=new Date(date+'T12:00:00Z');
 if(time<policy.time||!policy.enabled||date<zonedParts(new Date(enabledAt),timezone).date)return null;
 if(policy.frequency==='WEEKLY'&&day.getUTCDay()!==policy.weekday||policy.frequency==='MONTHLY'&&day.getUTCDate()!==Math.min(policy.monthDay,new Date(Date.UTC(day.getUTCFullYear(),day.getUTCMonth()+1,0)).getUTCDate()))return null;
 const end=new Date(day);end.setUTCDate(end.getUTCDate()-1);const start=new Date(day);
 if(policy.frequency==='MONTHLY'){start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()-1);end.setTime(+day);end.setUTCDate(1);end.setUTCDate(0);}else start.setUTCDate(start.getUTCDate()-(policy.frequency==='WEEKLY'?7:1));
 return {key:date,from:start.toISOString().slice(0,10),through:end.toISOString().slice(0,10)};
}

export function* dueReportPeriods(policy:ScheduledReportPolicy,now:Date,timezone:string,enabledAt:string,after?:string){
 if(!policy.enabled||!Number.isFinite(+new Date(enabledAt)))return;
 const today=zonedParts(now,timezone).date,first=zonedParts(new Date(enabledAt),timezone).date;
 const day=new Date((after&&after>=first?after:first)+'T12:00:00Z');if(after&&after>=first)day.setUTCDate(day.getUTCDate()+1);
 for(;day.toISOString().slice(0,10)<=today;day.setUTCDate(day.getUTCDate()+1)){
  const date=day.toISOString().slice(0,10),due=localToInstant(date+'T'+policy.time,timezone);
  if(+due>+now||+due<+new Date(enabledAt))continue;
  const period=scheduledReportPeriod(policy,due,timezone,enabledAt);if(period)yield period;
 }
}
