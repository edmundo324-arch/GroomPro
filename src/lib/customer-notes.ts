export function combinedCustomerNotes(customer:{notes?:string|null;popupNotes?:string|null}){
 const notes=customer.notes||'',old=customer.popupNotes||'';
 return !old||notes===old||notes.endsWith('\n\n'+old)?notes:[notes,old].filter(Boolean).join('\n\n');
}
