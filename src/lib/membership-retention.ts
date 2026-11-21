type State='ACTIVE'|'PAUSED'|'ENDED'|'NOT_STARTED'|'UNKNOWN';
const stamp=(v:any)=>v?+new Date(v):NaN;
export function membershipStateAt(m:any,resumes:any[],at:number,asOf:number):State{
 const started=stamp(m.startedAt),ended=stamp(m.endedAt),paused=stamp(m.pausedAt);
 if(!Number.isFinite(started))return 'UNKNOWN';if(started>at)return 'NOT_STARTED';
 if(Number.isFinite(ended)&&ended<=at)return 'ENDED';
 if(m.status==='PAUSED'&&!Number.isFinite(paused))return at===asOf?'PAUSED':'UNKNOWN';
 if(['CANCELLED','ENDED','INACTIVE'].includes(m.status)&&!Number.isFinite(ended))return at===asOf?'ENDED':'UNKNOWN';
 const events=resumes.filter(a=>a.entityId===m.id&&a.action==='MEMBERSHIP_RESUME').map(a=>stamp(a.occurredAt)).filter(Number.isFinite).sort((a,b)=>a-b);
 if(Number.isFinite(paused)&&paused<=at&&!events.some(t=>t>=paused&&t<=at))return 'PAUSED';
 if(at===started)return 'ACTIVE';
 // Resuming clears pausedAt in older records. Do not invent the missing start
 // of that earlier pause when reconstructing a date before the resume.
 if(events.some(t=>t>at))return 'UNKNOWN';
 if(events.some(t=>t<=at))return 'ACTIVE';
 return ['ACTIVE','PAUSE_REQUESTED','CANCELLATION_REQUESTED'].includes(m.status)||Number.isFinite(ended)||Number.isFinite(paused)?'ACTIVE':'UNKNOWN';
}
export function membershipRetention(memberships:any[],audits:any[],start:Date,end:Date,asOf:Date){
 const finish=Math.min(+end-1,+asOf),rows:any[]=[];let activeAtStart=0,retained=0,paused=0,ended=0,unknown=0;
 if(finish<+start)return {rows,activeAtStart,retained,paused,ended,unknown,percent:null,through:new Date(finish).toISOString()};
 const seen=new Set<string>();for(const m of memberships){if(seen.has(m.id))continue;seen.add(m.id);const before=membershipStateAt(m,audits,+start,+asOf),after=membershipStateAt(m,audits,finish,+asOf);if(before==='NOT_STARTED'||before==='ENDED'||before==='PAUSED')continue;
  if(before==='UNKNOWN')unknown++;else {activeAtStart++;if(after==='ACTIVE')retained++;else if(after==='PAUSED')paused++;else if(after==='ENDED')ended++;else unknown++;}
  rows.push({membershipId:m.id,membershipName:m.name||'Unnamed membership',customerName:m.customerName||'Name not recorded',atStart:before,atEnd:after});
 }
 return {rows,activeAtStart,retained,paused,ended,unknown,percent:!unknown&&activeAtStart?retained/activeAtStart*100:null,through:new Date(finish).toISOString()};
}
