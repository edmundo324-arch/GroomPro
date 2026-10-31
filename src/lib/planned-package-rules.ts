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
 const plans=ticket.plannedAssignments;if(!plans?.length)return ticket;
 const legacy=''; // With per-dog planning enabled, a newly added dog starts at Assign later.
 const lines=ticket.lines.filter(l=>{const petId=l.petId||l.pet?.id;if(!petId)return false;let id=plannedFor(ticket.lines,plans,petId,packageKey(l),legacy);if(ticket.checkedInAt){const group=ticket.lines.filter(v=>v.petId===petId&&(!packageKey(l)||packageKey(v)===packageKey(l)));const primary=group.find(v=>v.role==='GROOM'&&v.assignedUserId)||group.find(v=>v.role==='BATH'&&v.assignedUserId);if(primary)id=primary.assignmentUnavailable?'':primary.assignedUserId;}
 return (id&&available.has(id)?id:'unassigned')===resourceId});
 const pets=new Set(lines.map(l=>l.petId||l.pet?.id));for(const p of ticket.pets){if(ticket.lines.some(l=>(l.petId||l.pet?.id)===p.pet.id))continue;const id=plannedFor(ticket.lines,plans,p.pet.id,'',legacy);if((id&&available.has(id)?id:'unassigned')===resourceId)pets.add(p.pet.id)}if(!pets.size)return null;return {...ticket,lines,pets:ticket.pets.filter(p=>pets.has(p.pet.id)),plannedAssignments:plans.filter(p=>pets.has(p.petId)&&(!p.packageKey||lines.some(l=>packageKey(l)===p.packageKey)))};
}
