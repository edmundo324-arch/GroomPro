import {DayHours,localToInstant,zonedParts} from './operating-hours';
import {GroomingInstructions,groomingChoiceLabels} from './grooming-note-defaults';
export const noteFields=['classification','body','tbf','ears','tail','specialNotes'] as const;
export const noteLabels={classification:'Grooming type',body:'Body',tbf:'Face/TBF',ears:'Ears',tail:'Tail',specialNotes:'Special notes'};
export type SpecialHours={date:string;closed:boolean;open:string;close:string};
export function parseSpecialHours(value:unknown):SpecialHours[]{
 if(!Array.isArray(value)||value.length>1000)throw Error('Choose valid holiday or special hours.');
 const seen=new Set();return value.map((h:any)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(h.date)||new Date(h.date+'T12:00:00Z').toISOString().slice(0,10)!==h.date||seen.has(h.date)||typeof h.closed!=='boolean'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close)||(!h.closed&&h.open>=h.close))throw Error('Each special date needs valid hours and can appear only once.');seen.add(h.date);return {date:h.date,closed:h.closed,open:h.open,close:h.close}});
}
export function notesDeadline(appointment:Date,hours:DayHours[],zone:string,special:SpecialHours[]=[]):Date {
 const day=new Date(zonedParts(appointment,zone).date+'T12:00:00Z');let openDays=0;
 for(let i=0;i<370;i++){day.setUTCDate(day.getUTCDate()+1);const date=day.toISOString().slice(0,10),h=special.find(h=>h.date===date)||hours.find(h=>h.day===day.getUTCDay());if(h&&!h.closed&&++openDays===2)return localToInstant(date+'T'+h.close,zone)}
 throw Error('Set at least two upcoming open business days before editing dated grooming notes.');
}
export function validInstructions(value:any):GroomingInstructions {
 if(!value||typeof value!=='object'||!['GR','FFT','FW',null].includes(value.classification))throw Error('Choose Grooming, FFT, or Full Wash.');
 const result:any={classification:value.classification};for(const key of noteFields.slice(1)){if(typeof value[key]!=='string'||value[key].length>4000)throw Error('Grooming instructions must be text of 4,000 characters or fewer per box.');result[key]=value[key]}return result;
}
export function groomingSummary(value:any){if(!value)return '';return [value.classification?groomingChoiceLabels[value.classification as keyof typeof groomingChoiceLabels]:'',value.body,value.tbf,value.ears,value.tail,value.specialNotes].filter(Boolean).join(' · ')}
