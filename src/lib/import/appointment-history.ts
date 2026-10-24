import {validInstructions} from '../grooming-notes-rules';
export function employeeReference(reference:any,employees:any[]){
 const norm=(s:any)=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
 if(!reference||typeof reference!=='object')throw Error('Employee reference needs a name.');
 const full=norm(reference.firstName+' '+reference.lastName),display=norm(reference.displayName);
 const candidates=employees.filter(e=>(full&&norm(e.firstName+' '+e.lastName)===full)||(display&&norm(e.displayName)===display));
 if(candidates.length!==1)throw Error(`Employee ${reference.displayName||full}: ${candidates.length?'ambiguous match':'not found'}. Match the existing employee name before importing; no employee will be created.`);
 return candidates[0];
}
export function historyData(value:any,petIds:string[],resolve:(entity:string,id:string)=>any,total:number,status:string){
 if(!value)return null;if(value.version!==1)throw Error('Unsupported ticket history version.');
 const date=(v:any)=>{if(v==null)return null;if(typeof v!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('History dates must include a timezone.');return new Date(v)};
 const list=(v:any)=>{if(v==null)return [];if(!Array.isArray(v)||v.length>10000)throw Error('Invalid history records.');return v};
 const integer=(n:any)=>{if(!Number.isSafeInteger(n)||n<0||n>2147483647)throw Error('Invalid history amount.');return n};
 const payments=list(value.payments).map((p:any)=>{if(!['CASH','VISA','MASTERCARD','AMEX','DISCOVER','DEBIT','GIFT_CARD','OTHER'].includes(p.paymentType))throw Error('Invalid historical payment type.');const at=date(p.paidAt);if(!at)throw Error('Payment date required.');return {amount:(integer(p.amountCents)/100).toFixed(2),paymentType:p.paymentType,paidAt:at,externalId:null}});
 if(status==='CLOSED'&&payments.reduce((n:number,p:any)=>n+Math.round(Number(p.amount)*100),0)!==total)throw Error('Closed ticket historical payments must equal its total.');
 const snapshot=(s:any)=>s==null?null:({...s,instructions:validInstructions(s.instructions),usual:!!s.usual,at:date(s.at)?.toISOString()});
 const notes=list(value.groomingNotes).map((n:any)=>{const pet=resolve('PET',String(n.petId));if(!pet||!petIds.includes(pet.id))throw Error('Historical notes must belong to a pet on the ticket.');return {petId:pet.id,instructions:validInstructions(n.instructions),usual:!!n.usual,usualAt:date(n.usualAt),revision:integer(n.revision||0),lockedAt:date(n.lockedAt),closureSnapshot:snapshot(n.closureSnapshot),finalSnapshot:snapshot(n.finalSnapshot)}});
 if(new Set(notes.map((n:any)=>n.petId)).size!==notes.length)throw Error('Duplicate pet grooming history.');
 const assignments=list(value.assignments).map((a:any)=>{const employee=resolve('EMPLOYEE',String(a.employeeId));if(!employee)throw Error('Historical employee could not be matched.');if(!['GROOMER','PLANNED_GROOMER','PREPPER','BATHER','DRYER'].includes(a.role))throw Error('Invalid historical assignment role.');return {userId:employee.id,role:a.role,assignedAt:date(a.assignedAt)||undefined}});
 const timestamps={checkedInAt:date(value.checkedInAt),pickupAt:date(value.pickupAt),pickupCompletedAt:date(value.pickupCompletedAt),closedAt:date(value.closedAt)};
 if(status==='CLOSED'&&(!timestamps.closedAt||!timestamps.pickupCompletedAt))throw Error('Closed history requires closing and pickup dates.');
 const scheduleHistory=list(value.scheduleHistory).map((s:any)=>{if(!['CREATED','MOVED'].includes(s.changeType))throw Error('Invalid schedule history type.');const newStart=date(s.newStart),changedAt=date(s.changedAt);if(!newStart||!changedAt)throw Error('Schedule history dates required.');return {changeType:s.changeType,previousStart:date(s.previousStart),newStart,changedAt}});
 const auditHistory=list(value.auditHistory).map((a:any)=>{const occurredAt=date(a.occurredAt);if(!occurredAt||typeof a.summary!=='string'||a.summary.length>191)throw Error('Invalid source audit history.');return {occurredAt,summary:a.summary,details:{sourceAction:String(a.action||''),sourceEmployeeName:String(a.employeeName||''),sourceDetails:a.details??null}}});
 return {payments,notes,assignments,timestamps,scheduleHistory,auditHistory,sourceTicketNumber:value.sourceTicketNumber??null};
}
