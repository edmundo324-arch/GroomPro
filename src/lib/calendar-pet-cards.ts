// Preserve the real ticket ID for opening, updates and dragging. Only display keys differ.
export function calendarPetCards<T extends {id:string;pets:any[];lines:any[];plannedAssignments?:any[]}>(tickets:T[]):(T&{calendarPetId?:string})[]{
 return tickets.flatMap(ticket=>ticket.pets.length?ticket.pets.map(entry=>{const petId=entry.pet.id;return {...ticket,calendarPetId:petId,pets:[entry],lines:ticket.lines.filter(line=>(line.petId||line.pet?.id)===petId),...(ticket.plannedAssignments?{plannedAssignments:ticket.plannedAssignments.filter(p=>p.petId===petId)}:{})}}):[ticket]);
}
