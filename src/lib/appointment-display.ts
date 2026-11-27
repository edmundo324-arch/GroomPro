import {employeeName} from './employee-name';
import {ticketStatusLabel} from './ticket-status-label';

export const appointmentDisplayFields:Record<string,string>={
 'pet.name':'Dog Names',customer:'Customer Name',time:'Scheduled Time','ticket.arrivalPriority':'Arrival Order','ticket.orderNumber':'Ticket Number',package:'Services and Packages',date:'Appointment Date','ticket.status':'Appointment Status','pet.breed':'Breed','pet.weightLbs':'Weight',assignments:'Assigned Employees','ticket.durationMin':'Appointment Length','ticket.checkedInAt':'Checked-In Time','ticket.pickupAt':'Ready for Pick-Up Time',
};
export type AppointmentDisplayField={key:string;row:number;bold:boolean};
export type AppointmentDisplay={fields:AppointmentDisplayField[]};
const defaults:AppointmentDisplayField[]=[{key:'pet.name',row:0,bold:true},{key:'customer',row:1,bold:false},{key:'time',row:2,bold:true},{key:'ticket.arrivalPriority',row:2,bold:true},{key:'ticket.orderNumber',row:2,bold:false},{key:'package',row:3,bold:false}];
export function appointmentDisplay(settings:any={}){
 const seen=new Set<string>();
 const fields:AppointmentDisplayField[]=Array.isArray(settings?.appointmentDisplay?.fields)?settings.appointmentDisplay.fields.flatMap((entry:any)=>{
  if(!entry||!Object.hasOwn(appointmentDisplayFields,entry.key)||seen.has(entry.key))return [];
  seen.add(entry.key);return [{key:entry.key,row:Math.max(0,Math.min(7,Number.isInteger(entry.row)?entry.row:0)),bold:typeof entry.bold==='boolean'?entry.bold:defaults.find(item=>item.key===entry.key)?.bold||false}];
 }):[];
 return {fields:(fields.length?fields:defaults.filter(field=>field.key!=='ticket.arrivalPriority'||settings?.showCalendarArrivalOrder!==false).map(field=>({...field}))).sort((a,b)=>a.row-b.row)};
}
const unique=(values:unknown[])=>[...new Set(values.filter(value=>typeof value==='string'&&value.trim()).map(value=>String(value).trim()))].join(' · ');
function formatDate(ticket:any,value:any,date=false){
 if(!value)return '';
 const instant=new Date(value);if(!Number.isFinite(+instant))return '';
 const options:Intl.DateTimeFormatOptions={...(ticket.appointmentTimezone?{timeZone:ticket.appointmentTimezone}:{}),...(date?{month:'short',day:'numeric',year:'numeric'}:{hour:'numeric',minute:'2-digit'})};
 return date?instant.toLocaleDateString(undefined,options):instant.toLocaleTimeString(undefined,options);
}
export function appointmentDetailValue(ticket:any,key:string):string{
 const pets=(ticket.pets||[]).map((entry:any)=>entry.pet||entry),lines=ticket.lines||[];
 const petValues=(read:(pet:any)=>string)=>unique(pets.map((pet:any)=>{const value=read(pet);return value?(pets.length>1?pet.name+': '+value:value):''}));
 switch(key){
  case 'pet.name':return unique(pets.map((pet:any)=>pet.name))||'Appointment';
  case 'customer':return [ticket.customer?.firstName,ticket.customer?.lastName].filter(Boolean).join(' ');
  case 'time':return formatDate(ticket,ticket.scheduledStart)||'Unscheduled';
  case 'date':return formatDate(ticket,ticket.scheduledStart,true);
  case 'ticket.arrivalPriority':return Number(ticket.arrivalPriority)>0?'Order '+ticket.arrivalPriority:'';
  case 'ticket.orderNumber':return ticket.orderNumber!=null?'#'+ticket.orderNumber:'';
  case 'package':return unique(lines.map((line:any)=>line.packageName||line.description||line.service?.name))||'No Services Added';
  case 'ticket.status':return ticketStatusLabel(ticket);
  case 'pet.breed':return petValues(pet=>pet.breed||'');
  case 'pet.weightLbs':return petValues(pet=>pet.weightLbs!=null?Number(pet.weightLbs)+' lb':'');
  case 'assignments':return unique([...(ticket.assignments||[]).map((item:any)=>employeeName(item.user)),...lines.map((line:any)=>employeeName(line.assignedUser)),...(ticket.plannedAssignments||[]).map((item:any)=>employeeName(item.user))]);
  case 'ticket.durationMin':return Number(ticket.durationMin)>0?ticket.durationMin+' min':'';
  case 'ticket.checkedInAt':return ticket.checkedInAt?'In @ '+formatDate(ticket,ticket.checkedInAt):'';
  case 'ticket.pickupAt':return ticket.pickupAt?'Ready @ '+formatDate(ticket,ticket.pickupAt):'';
  default:return '';
 }
}
