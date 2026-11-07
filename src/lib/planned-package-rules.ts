import {responsibleEmployee,lineSchedule,lineTimeKey} from './pet-scheduling';
import {packageKey} from './package-display';
export type PlannedPackage={petId:string;packageKey?:string;userId:string|null};
export function plannedKey(p:PlannedPackage){return p.petId+'|'+(p.packageKey||'')}
export function validatePlannedPackages(value:any,pets:string[],lines:any[],individual:boolean):PlannedPackage[]{
 if(!Array.isArray(value)||value.length>100)throw Error('Choose valid planned employee assignments.');
 const seen=new Set<string>();return value.map(p=>{if(!p||!pets.includes(p.petId)||p.userId!==null&&typeof p.userId!=='string')throw Error('Choose a dog and employee on this appointment.');
 const key=individual&&p.packageKey?String(p.packageKey):undefined;if(key&&!lines.some(l=>(l.petId||l.pet?.id)===p.petId&&packageKey(l)===key))throw Error('Package is not on this dog’s appointment.');
 const result={petId:p.petId,...(key?{packageKey:key}:{}),userId:p.userId||null};if(seen.has(plannedKey(result)))throw Error('An assignment is repeated.');seen.add(plannedKey(result));return result;});
}
export function plannedFor(lines:any[],plans:PlannedPackage[],petId:string,key:string,fallback=''){return plans.find(p=>p.petId===petId&&p.packageKey===key)?.userId??(plans.some(p=>p.petId===petId&&p.packageKey===key)?'':plans.find(p=>p.petId===petId&&!p.packageKey)?.userId??(plans.some(p=>p.petId===petId&&!p.packageKey)?'':fallback))}
// Filter a card's contents to the dogs/packages booked with this resource.
export function plannedCalendarCard<T extends {pets:any[];lines:any[];assignments:any[];plannedAssignments?:PlannedPackage[];checkedInAt?:any}>(ticket:T,resourceId:string,available:Set<string>):T|null{
 const plans=ticket.plannedAssignments||[];
 const legacy=plans.length?'':(ticket as any).legacyPlannedUserId||ticket.assignments?.find(a=>a.role==='PLANNED_GROOMER')?.userId||ticket.assignments?.find(a=>a.role==='PLANNED_GROOMER')?.user?.id||ticket.assignments?.find(a=>a.role==='GROOMER')?.userId||ticket.assignments?.find(a=>a.role==='GROOMER')?.user?.id||'';
 const lines=ticket.lines.filter(l=>{const petId=l.petId||l.pet?.id;if(!petId)return false;const actual=responsibleEmployee(ticket.lines,petId);const id=actual?(actual.assignmentUnavailable?'':actual.assignedUserId):plannedFor(ticket.lines,plans,petId,packageKey(l),legacy);return (id&&available.has(id)?id:'unassigned')===resourceId});
 const pets=new Set(lines.map(l=>l.petId||l.pet?.id));
 for(const entry of ticket.pets){
  const petId=entry.pet?.id||entry.petId;
  if(!petId||ticket.lines.some(l=>(l.petId||l.pet?.id)===petId))continue;
  const plan=plannedFor(ticket.lines,plans,petId,'',legacy);
  if((plan&&available.has(plan)?plan:'unassigned')===resourceId)pets.add(petId);
 }
 if(!pets.size){if(!ticket.pets.length&&resourceId===(legacy&&available.has(legacy)?legacy:'unassigned'))return {...ticket,lines:ticket.lines,pets:[],plannedAssignments:[]};return null;}const source=ticket as any,allTimes=source.lineStarts&&ticket.lines.every(l=>l.lineType==='PRODUCT'||source.lineStarts[lineTimeKey(l)])?source.lineStarts:lineSchedule(source);return {...ticket,lineStarts:allTimes,lines,pets:ticket.pets.filter(p=>pets.has(p.pet.id)),plannedAssignments:plans.filter(p=>pets.has(p.petId)&&(!p.packageKey||lines.some(l=>packageKey(l)===p.packageKey)))};
}
