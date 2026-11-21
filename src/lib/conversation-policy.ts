import {localToInstant,zonedParts} from './operating-hours';
import {parseDate} from './schedule-dates';
export const conversationPolicyKey='AI_CONVERSATION_POLICY';
export const defaultConversationPolicy={revision:0,enabled:true,lateMonthStarts:23,earlyResumeDay:1,lateResumeDay:15,time:'09:00',pauseText:'Thanks for letting us know. We will check back about this offer on {date}.',stopText:'Understood. We will not follow up about this offer again.'};
export function conversationPolicy(value:any){
 const v={...defaultConversationPolicy,...value};
 if(typeof v.enabled!=='boolean'||!Number.isSafeInteger(v.revision)||v.revision<0||![v.lateMonthStarts,v.earlyResumeDay,v.lateResumeDay].every(n=>Number.isInteger(n)&&n>=1&&n<=28)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time))throw Error('Choose calendar days from 1 to 28 and a valid follow-up time.');
 for(const key of ['pauseText','stopText'])if(typeof v[key]!=='string'||!v[key].trim()||v[key].length>900||/\{(?!date\}|business\}|customer\})[^}]*\}/.test(v[key]))throw Error('Use a message up to 900 characters with {date}, {business} or {customer} for automatic details.');
 if(v.stopText.includes('{date}'))throw Error('The offer-stopped message has no follow-up date. Use {business} or {customer} instead.');
 if(!v.pauseText.includes('{date}'))throw Error('Include {date} so the customer knows when you will follow up.');
 return {pauseText:v.pauseText.trim(),stopText:v.stopText.trim(),revision:v.revision,enabled:v.enabled,lateMonthStarts:v.lateMonthStarts,earlyResumeDay:v.earlyResumeDay,lateResumeDay:v.lateResumeDay,time:v.time};
}
export async function readConversationPolicy(client:any,tenantId:string){return conversationPolicy((await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:conversationPolicyKey}}}))?.value);}
export function conversationResumeAt(intent:string,date:string|null,time:string|null,offerSentAt:Date,replyAt:Date,timezone:string,policy:ReturnType<typeof conversationPolicy>){
 if(intent==='PAUSE_NEXT_MONTH'){
  const sent=zonedParts(offerSentAt,timezone).date.split('-').map(Number),reply=zonedParts(replyAt,timezone).date.split('-').map(Number),month=new Date(Date.UTC(reply[0],reply[1],1));
  const day=sent[2]>=policy.lateMonthStarts?policy.lateResumeDay:policy.earlyResumeDay;
  return localToInstant(month.getUTCFullYear()+'-'+String(month.getUTCMonth()+1).padStart(2,'0')+'-'+String(day).padStart(2,'0')+'T'+policy.time,timezone);
 }
 if(intent!=='PAUSE_UNTIL'||!date)throw Error('A specific follow-up date is needed.');parseDate(date);
 if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('A valid follow-up time is needed.');
 const at=localToInstant(date+'T'+(time||policy.time),timezone);if(+at<=+replyAt)throw Error('The requested follow-up date needs staff review.');return at;
}
