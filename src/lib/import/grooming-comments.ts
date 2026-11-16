import {createHash} from 'node:crypto';
// Preserve the original comments. This projection also works for previously
// imported pets and disappears naturally if an import is rolled back.
export function datedGroomingComments(text:string, petName='') {
 const marker=/^(?:\s*)(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})(?=\s|[:,;|]|$)/gm;
 const matches=[...text.matchAll(marker)];
 const history:{date:string;instructions:{classification:null;body:string;tbf:string;ears:string;tail:string;specialNotes:string};original:string}[]=[];
 for(let i=0;i<matches.length;i++){
  const m=matches[i],parts=m[1].split(/[\/-]/).map(Number);
  const [year,month,day]=m[1].match(/^\d{4}/)?parts:[parts[2],parts[0],parts[1]];
  const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const checked=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(+checked)||checked.toISOString().slice(0,10)!==date)continue;
  const original=text.slice(m.index!,matches[i+1]?.index??text.length).trim();
  let contents=text.slice(m.index!+m[0].length,matches[i+1]?.index??text.length).trim().replace(/^[:,;|\s]+/,'');
  // A name is removed only when it exactly matches this already-linked pet.
  if(petName&&contents.toLowerCase().startsWith(petName.toLowerCase())&&/^[\s:;,|\-]/.test(contents.slice(petName.length)))contents=contents.slice(petName.length).replace(/^[\s:;,|\-]+/,'');
  const labels=[...contents.matchAll(/(?:^|[\n\r;,|]|\s)(Body|Face\s*\/\s*TBF|TBF|Ears?|Tail|Special\s+Notes)\s*[:=]\s*/gi)];
  const instructions={classification:null,body:'',tbf:'',ears:'',tail:'',specialNotes:''};
  if(!labels.length)instructions.specialNotes=contents;
  else {
   instructions.specialNotes=contents.slice(0,labels[0].index).trim();
   labels.forEach((label,j)=>{
    const key=/body/i.test(label[1])?'body':/tbf/i.test(label[1])?'tbf':/ear/i.test(label[1])?'ears':/tail/i.test(label[1])?'tail':'specialNotes';
    const value=contents.slice(label.index!+label[0].length,labels[j+1]?.index??contents.length).trim().replace(/[;,|]+$/,'').trim();
    instructions[key]=[instructions[key],value].filter(Boolean).join('\n');
   });
  }
  history.push({date,instructions,original});
 }
 return history;
}

export function importedGroomingHistory(pets:{id:string;name:string;groomingNotes?:string|null}[],customerId:string,tickets:any[]=[]) {
 const seen=new Set<string>();
 return pets.flatMap(p=>datedGroomingComments(p.groomingNotes||'',p.name).map((entry,index)=>{
  const matching=tickets.filter(t=>t.historyDate===entry.date&&t.lines?.some((l:any)=>l.petId===p.id));
  return {id:`imported-comment:${p.id}:${createHash('sha256').update(entry.original).digest('hex').slice(0,24)}`,petId:p.id,customerId,ticketId:null,
   matchedTicketId:matching.length===1?matching[0].id:null,orderNumber:matching.length===1?matching[0].orderNumber:null,
   appointmentAt:entry.date+'T12:00:00.000Z',sourceDate:entry.date,instructions:entry.instructions,
   source:'Imported grooming comments',sourceText:entry.original,imported:true,usual:false,revision:0,lockedAt:entry.date+'T12:00:00.000Z',status:'IMPORTED'};
 })).filter(record=>{if(seen.has(record.id))return false;seen.add(record.id);return true});
}
