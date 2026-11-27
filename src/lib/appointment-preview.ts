import {popupFields} from './calendar-popup-layout';
import {appointmentServiceType,presentationKey} from './calendar-presentation';

export function appointmentSummaryTicket(ticket:any,timezone?:string){
 const name=(user:any)=>user?{displayName:user.displayName,firstName:user.firstName,lastName:user.lastName}:null;
 return {
  id:ticket.id,orderNumber:ticket.orderNumber,status:ticket.status,displayStatus:ticket.displayStatus,bookingDecision:ticket.bookingDecision,
  scheduledStart:ticket.scheduledStart,arrivalPriority:ticket.arrivalPriority,durationMin:ticket.durationMin,checkedInAt:ticket.checkedInAt,pickupAt:ticket.pickupAt,
  previewStage:presentationKey(ticket),presentationCategory:appointmentServiceType(ticket),
  ...(timezone?{appointmentTimezone:timezone}:{}),
  customer:{firstName:ticket.customer?.firstName||'',lastName:ticket.customer?.lastName||''},
  pets:(ticket.pets||[]).map(({pet}:any)=>({pet:{id:pet.id,name:pet.name,breed:pet.breed,weightLbs:pet.weightLbs}})),
  lines:(ticket.lines||[]).map((line:any)=>({id:line.id,petId:line.petId,packageId:line.packageId,packageName:line.packageName,packageGroupKey:line.packageGroupKey,description:line.description,totalCents:line.totalCents,assignedUser:name(line.assignedUser)})),
  assignments:(ticket.assignments||[]).map((assignment:any)=>({user:name(assignment.user)})),
 };
}

// Only the fields used to render the appointment popup leave the detail route.
// Extra customer, pet, employee and payment records stay on the server.
export function appointmentPreviewTicket(ticket:any,fields:string[],timezone?:string){
 const selected=new Set(popupFields(fields));
 return {
  id:ticket.id,orderNumber:ticket.orderNumber,status:ticket.status,displayStatus:ticket.displayStatus,
  scheduledStart:ticket.scheduledStart,arrivalPriority:ticket.arrivalPriority,
  ...(timezone?{appointmentTimezone:timezone}:{}),
  customer:{firstName:ticket.customer?.firstName||'',lastName:ticket.customer?.lastName||''},
  pets:(ticket.pets||[]).map(({pet}:any)=>({pet:{
   id:pet.id,name:pet.name,breed:pet.breed,weightLbs:pet.weightLbs,
   ...(selected.has('pet.vipEligible')?{vipEligible:pet.vipEligible,vipDoNotOffer:pet.vipDoNotOffer,vipMember:pet.vipMember}:{}),
   ...(selected.has('pet.notes')?{notes:pet.notes}:{}),
   ...(selected.has('notes')?{groomingNotes:pet.groomingNotes}:{}),
   ...(selected.has('todayNotes')?{todaysGroomingNotes:pet.todaysGroomingNotes}:{}),
  }})),
  lines:(ticket.lines||[]).map((line:any)=>({id:line.id,petId:line.petId,packageId:line.packageId,packageName:line.packageName,packageGroupKey:line.packageGroupKey,description:line.description,totalCents:line.totalCents})),
 };
}
