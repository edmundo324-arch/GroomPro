import {appointmentMessageTimes,type AppointmentMessagePolicy} from './appointment-message-policy';
export type PlannedAppointmentMessage={kind:'CONFIRMATION'|'REMINDER';at:Date};
export function planAppointmentMessages(ticket:any,state:any,policy:AppointmentMessagePolicy,activeSince:Date,now=new Date(),pendingCancellation=false,manualRequestAt?:string):PlannedAppointmentMessage[]{
 const start=new Date(ticket.scheduledStart);
 if(!policy.enabled||!ticket.scheduledStart||!Number.isFinite(+start)||!['OPEN','CONFIRMED'].includes(ticket.status)||['REQUESTED','PENDING','REJECTED'].includes(ticket.bookingDecision)||pendingCancellation)return [];
 const sameStart=!!state?.scheduledStart&&+new Date(state.scheduledStart)===+start,confirmed=sameStart&&!!state?.confirmedAt,paused=!!state?.requestsPausedForStart&&+new Date(state.requestsPausedForStart)===+start;
 if(+start<=+now){
  if(!manualRequestAt||!sameStart||paused||ticket.checkedInAt||state.newRequestAt!==manualRequestAt)return [];
  const at=new Date(manualRequestAt);
  return +at>=+start&&+at<=+now?[{kind:'CONFIRMATION',at}]:[];
 }
 const latest=(dates:Date[])=>dates.filter(d=>Number.isFinite(+d)&&+d>=+activeSince&&+d<=+now&&+d<+start).sort((a,b)=>+b-+a)[0];
 const plans:PlannedAppointmentMessage[]=[];
 if(!confirmed&&!paused){const dates=appointmentMessageTimes(start,ticket.location.timezone,policy.confirmationTimes).map(t=>t.at).filter(at=>!state?.requestScheduleStartsAt||+at>=+new Date(state.requestScheduleStartsAt));if(sameStart&&state?.newRequestAt)dates.push(new Date(state.newRequestAt));const at=latest(dates);if(at)plans.push({kind:'CONFIRMATION',at});}
 const reminder=latest(appointmentMessageTimes(start,ticket.location.timezone,state?.reminders||[]).map(t=>t.at));
 if(reminder&&!plans.some(p=>+p.at===+reminder))plans.push({kind:'REMINDER',at:reminder});
 return plans;
}
export function renderAppointmentMessage(text:string,values:Record<string,string>){
 return text.replace(/\{([^{}]+)\}/g,(_,key)=>{if(!(key in values)||!values[key])throw Error('The '+key+' detail is missing. Review this appointment before sending.');return values[key]});
}
