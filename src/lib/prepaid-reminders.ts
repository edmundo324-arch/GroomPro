import {localToInstant,zonedParts} from './operating-hours';
export type PrepaidReminderPolicy={enabled:boolean;visits:number|null;days:number|null;time:string;text:string};
export const defaultPrepaidReminderPolicy:PrepaidReminderPolicy={enabled:false,visits:null,days:null,time:'09:00',text:'{business}: Your {package} package has {visits} prepaid visits remaining.{expiration} Contact us when you are ready to book.'};
export function prepaidReminderPolicy(value:unknown):PrepaidReminderPolicy{const p=(value??defaultPrepaidReminderPolicy) as PrepaidReminderPolicy;
 if(typeof p.enabled!=='boolean'||p.visits!==null&&(!Number.isInteger(p.visits)||p.visits<0||p.visits>10000)||p.days!==null&&(!Number.isInteger(p.days)||p.days<0||p.days>3650)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)||p.enabled&&p.visits===null&&p.days===null)throw Error('Choose a remaining-visit threshold or days before expiration before turning prepaid reminders on.');
 if(typeof p.text!=='string'||!p.text.trim()||p.text.length>1200||(p.text.match(/\{[^{}]*\}/g)||[]).some(t=>!['{business}','{customer}','{firstName}','{location}','{package}','{visits}','{expiration}'].includes(t)))throw Error('Use the listed prepaid details and keep the reminder under 1,200 characters.');
 return {...p,text:p.text.trim()};
}
export function prepaidReminderDue(p:any,policy:PrepaidReminderPolicy,timezone:string,now:Date){
 if(!policy.enabled||p.state!=='ACTIVE')return null;const today=zonedParts(now,timezone).date;if(p.expiresOn&&p.expiresOn<today)return null;
 if(now<localToInstant(today+'T'+policy.time,timezone))return null;
 const reasons:string[]=[];if(policy.visits!==null&&p.visitsRemaining<=policy.visits)reasons.push('BALANCE');
 if(policy.days!==null&&p.expiresOn&&p.visitsRemaining>0){const days=(+new Date(p.expiresOn+'T12:00:00Z')-+new Date(today+'T12:00:00Z'))/86400000;if(days<=policy.days)reasons.push('EXPIRY');}
 return reasons.length?reasons:null;
}
