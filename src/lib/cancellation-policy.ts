// Shared by portal requests and staff review. The amount uses the existing NO_SHOW_FEE_CENTS setting.
export type CancellationNotice={amount:number;unit:'HOURS'|'DAYS'};
export const defaultCancellationNotice:CancellationNotice={amount:30,unit:'HOURS'};
export function cancellationNotice(value:unknown):CancellationNotice{
 const input=value as CancellationNotice;
 if(!input||typeof input.amount!=='number'||!Number.isFinite(input.amount)||input.amount<0||!['HOURS','DAYS'].includes(input.unit))throw Error('Enter the cancellation notice and choose hours or days.');
 if(!Number.isSafeInteger(Math.round(input.amount*(input.unit==='DAYS'?86400000:3600000))))throw Error('The cancellation notice is too large. Enter a smaller number.');
 return {amount:input.amount,unit:input.unit};
}
export function cancellationTiming(start:Date,requestedAt:Date,notice:CancellationNotice=defaultCancellationNotice){
 const rule=cancellationNotice(notice);
 if(!Number.isFinite(+start)||!Number.isFinite(+requestedAt))throw Error('The appointment time could not be read. Ask the shop to review this appointment.');
 const deadline=new Date(+start-rule.amount*(rule.unit==='DAYS'?86400000:3600000));
 if(!Number.isFinite(+deadline))throw Error('The cancellation notice is too large. Enter a smaller number.');
 return {requestedAt:requestedAt.toISOString(),deadline:deadline.toISOString(),late:+requestedAt>+deadline};
}

export const defaultCancellationWarning='{business} requires {notice} notice to cancel. This appointment is within that window, so a Reserved Appointment Fee of {fee} will apply. You can request a waiver for the shop to review. Your appointment stays booked until the shop responds.';
export type PortalPolicy={approval:'REVIEW'|'AUTOMATIC';notice:CancellationNotice;warning:string;bookableItems:string[];advanceDays:number};
export const defaultPortalPolicy:PortalPolicy={approval:'REVIEW',notice:defaultCancellationNotice,warning:defaultCancellationWarning,bookableItems:[],advanceDays:30};
export function portalPolicy(value:unknown):PortalPolicy{
 const input=value as PortalPolicy;
 if(!input||!['REVIEW','AUTOMATIC'].includes(input.approval))throw Error('Choose whether the shop reviews online bookings.');
 if(typeof input.warning!=='string'||!input.warning.trim()||input.warning.length>4000)throw Error('Enter a cancellation message of up to 4,000 characters.');
 const tokens=input.warning.match(/\{[^{}]*\}/g)||[];
 if(tokens.some(t=>!['{business}','{notice}','{fee}'].includes(t)))throw Error('Use {business}, {notice}, and {fee} for automatic details.');
 const bookableItems=input.bookableItems??[];
 if(!Array.isArray(bookableItems)||bookableItems.length>2000||bookableItems.some(id=>typeof id!=='string'||!/^(SERVICE|PACKAGE):[a-zA-Z0-9_-]+$/.test(id)))throw Error('Choose valid services and packages for online booking.');
 const advanceDays=input.advanceDays??30;if(!Number.isInteger(advanceDays)||advanceDays<1||advanceDays>730)throw Error('Choose a booking window of 1 to 730 days.');
 return {approval:input.approval,notice:cancellationNotice(input.notice),warning:input.warning.trim(),bookableItems:[...new Set(bookableItems)],advanceDays};
}
export function cancellationWarning(policy:PortalPolicy,business:string,feeCents:number){
 const values:Record<string,string>={business,notice:`${policy.notice.amount} ${policy.notice.unit==='DAYS'?(policy.notice.amount===1?'day':'days'):(policy.notice.amount===1?'hour':'hours')}`,fee:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(feeCents/100)};
 return policy.warning.replace(/\{(business|notice|fee)\}/g,(_,key)=>values[key]);
}

export function movedCancellationFee(originalStart:string,newStart:string,timezone:string,late:boolean,feeCents:number){
 const a=new Date(originalStart),b=new Date(newStart);
 if(!Number.isFinite(+a)||!Number.isFinite(+b)||!timezone)throw Error('Review the appointment dates and shop time zone before applying a fee.');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});
 return date.format(a)===date.format(b)||!late?0:feeCents;
}
