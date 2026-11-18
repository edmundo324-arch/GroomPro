import type {PortalPolicy} from './cancellation-policy';
import {zonedParts} from './operating-hours';

export function onlineStartAllowed(start:Date,zone:string,policy:PortalPolicy,now=new Date()){
 const lead=(policy.minimumLeadHours??0)*3600000,interval=policy.slotIntervalMinutes??30;
 if(!Number.isFinite(+start)||+start<=+now||+start<+now+lead||+start>+now+policy.advanceDays*86400000)return false;
 const [hours,minutes]=zonedParts(start,zone).time.split(':').map(Number);
 return (hours*60+minutes)%interval===0&&start.getUTCSeconds()===0&&start.getUTCMilliseconds()===0;
}
