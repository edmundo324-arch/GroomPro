import {zonedParts} from './operating-hours';
import {petServiceType} from './calendar-presentation';
// Week extensions use the Monday–Sunday week containing the ordinary deadline.
export function rebookingDeadline(original:Date,weeks:number,timezone:string,throughWeekday:number|null=null){
 const date=zonedParts(original,timezone).date,deadline=new Date(date+'T12:00:00Z');deadline.setUTCDate(deadline.getUTCDate()+weeks*7);
 if(throughWeekday!==null){if(!Number.isInteger(throughWeekday)||throughWeekday<0||throughWeekday>6)throw Error('Choose a valid weekday for the extension.');const day=(deadline.getUTCDay()+6)%7,target=(throughWeekday+6)%7;deadline.setUTCDate(deadline.getUTCDate()+Math.max(0,target-day));}
 return deadline.toISOString().slice(0,10);
}
export function withinRebookingWindow(original:Date,next:Date,weeks:number,timezone:string,throughWeekday:number|null=null){const day=zonedParts(next,timezone).date;return day>=zonedParts(original,timezone).date&&day<=rebookingDeadline(original,weeks,timezone,throughWeekday);}
export function mainRebookingLineIds(ticket:any){
 const eligible=new Set<string>();
 for(const petId of new Set<string>((ticket.lines||[]).map((l:any)=>l.petId).filter(Boolean))){
  const lines=ticket.lines.filter((l:any)=>l.petId===petId&&l.lineType==='SERVICE'&&!String(l.sourceKey||'').startsWith('offer-today:')&&!String(l.sourceKey||'').startsWith('PREPAID'));
  const packageKey=(l:any)=>l.packageGroupKey||l.packageId||l.packageName||'';
  const mainKey=lines.find((l:any)=>packageKey(l)&&['PREP','BATH','DRY','GROOM'].includes(l.role));
  const main=mainKey?lines.filter((l:any)=>packageKey(l)===packageKey(mainKey)):lines.filter((l:any)=>['GROOM','BATH'].includes(l.role));
  const description=main.map((l:any)=>[l.packageName,l.description,l.service?.category,l.service?.code,l.service?.name].join(' ')).join(' ');
  if(/self[ -]?service|bath[ -]?only|brush[ -]?out/i.test(description)&&!main.some((l:any)=>l.role==='GROOM'))continue;
  const type=petServiceType({...ticket,lines:main},petId).replace(/ VIP$/,'').replace('GR/FFT','GR');
  if(['GR','FFT','FW'].includes(type))for(const line of main)eligible.add(line.id);
 }
 return eligible;
}

export function rebookingPercent(source:any,target:Date,bookedAt:Date,timezone:string,policy:any,advanceDateKept:boolean){
 const original=new Date(source.scheduledStart||source.closedAt);if(!Number.isFinite(+original))return 0;
 if((source.status==='CLOSED'||source.checkedInAt)&&withinRebookingWindow(original,target,2,timezone,policy.touchupWeekday))return 20;
 if(!advanceDateKept||zonedParts(original,timezone).date!==zonedParts(bookedAt,timezone).date)return 0;
 if(withinRebookingWindow(original,target,4,timezone,policy.tenPercentWeekday))return 10;
 if(withinRebookingWindow(original,target,6,timezone,policy.fivePercentWeekday))return 5;
 return 0;
}
