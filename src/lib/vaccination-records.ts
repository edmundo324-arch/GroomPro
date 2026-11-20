import {createHash} from 'node:crypto';
export function vaccinationRevision(record:any){return createHash('sha256').update(JSON.stringify([record.id,record.vaccineName,new Date(record.administeredAt).toISOString(),record.expiresAt?new Date(record.expiresAt).toISOString():null,record.documentUrl||null,record.notes||null])).digest('hex');}
export function vaccinationFields(input:any){
 const vaccineName=String(input.vaccineName||'').trim(),notes=String(input.notes||'').trim();if(!vaccineName||vaccineName.length>100)throw Error('Enter the vaccine name shown on the record, using up to 100 characters.');if(notes.length>4000)throw Error('Keep vaccination notes within 4,000 characters.');
 function date(value:unknown,label:string){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw Error('Enter a valid '+label+' date from the vaccination record.');return new Date(value+'T12:00:00Z');}
 const administeredAt=date(input.administeredAt,'administered'),expiresAt=input.expiresAt?date(input.expiresAt,'expiration'):null;if(expiresAt&&expiresAt<administeredAt)throw Error('The expiration date is before the administered date. Check both dates against the record.');return {vaccineName,administeredAt,expiresAt,notes:notes||null};
}
