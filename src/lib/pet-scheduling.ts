export const lineTimeKey=(line:any)=>String(line.clientKey||line.id||line.sortOrder);
export function responsibleEmployee(lines:any[],petId:string){
 const dog=lines.filter(l=>(l.petId||l.pet?.id)===petId&&l.lineType!=='PRODUCT'&&l.type!=='PRODUCT');
 const role=dog.some(l=>l.role==='GROOM')?'GROOM':dog.some(l=>l.role==='BATH')?'BATH':null;
 return dog.find(l=>(!role||l.role===role)&&l.assignedUserId)||null;
}
export function lineSchedule(ticket:{scheduledStart?:string|Date|null;timingMode?:string;lines:any[];lineStarts?:Record<string,string>}){
 const anchor=ticket.scheduledStart?+new Date(ticket.scheduledStart):NaN,result:Record<string,string>={};if(!Number.isFinite(anchor))return result;
 const ids=[...new Set(ticket.lines.map(l=>l.petId||l.pet?.id||''))];let cursor=anchor;
 for(const petId of ids)for(const l of ticket.lines.filter(l=>(l.petId||l.pet?.id||'')===petId)){
  if(l.lineType==='PRODUCT'||l.type==='PRODUCT')continue;
  const key=lineTimeKey(l),override=ticket.lineStarts?.[key],start=override?+new Date(override):(ticket.timingMode==='CONCURRENT'?anchor:cursor);
  if(!Number.isFinite(start))continue;result[key]=new Date(start).toISOString();cursor=start+Math.max(0,Number(l.durationMin??l.service?.durationMin??0))*Math.max(1,Number(l.quantity)||1)*60000;
 }return result;
}
export function petSchedule(ticket:any,petId:string){const starts=lineSchedule(ticket),lines=ticket.lines.filter((l:any)=>(l.petId||l.pet?.id)===petId&&starts[lineTimeKey(l)]);const begin=lines.map((l:any)=>+new Date(starts[lineTimeKey(l)])),end=lines.map((l:any)=>+new Date(starts[lineTimeKey(l)])+Math.max(0,Number(l.durationMin??l.service?.durationMin??0))*Math.max(1,Number(l.quantity)||1)*60000);const start=begin.length?Math.min(...begin):+new Date(ticket.scheduledStart);return {start:new Date(start),durationMin:Math.max(15,end.length?Math.ceil((Math.max(...end)-start)/60000):ticket.durationMin||30)};}
export function movePetTimes(ticket:any,petId:string,start:Date){const current=petSchedule(ticket,petId);if(!Number.isFinite(+start)||!Number.isFinite(+current.start))throw Error('Choose a valid appointment time.');const delta=+start-+current.start,starts=lineSchedule(ticket);for(const l of ticket.lines)if(starts[lineTimeKey(l)]&&(ticket.timingMode==='CONCURRENT'||(l.petId||l.pet?.id)===petId))starts[lineTimeKey(l)]=new Date(+new Date(starts[lineTimeKey(l)])+delta).toISOString();return starts;}
export function scheduleBounds(ticket:any,starts:Record<string,string>){const dates=Object.values(starts).map(v=>+new Date(v));if(!dates.length)return {scheduledStart:ticket.scheduledStart,durationMin:ticket.durationMin||30};const begin=Math.min(...dates),ends=ticket.lines.filter((l:any)=>starts[lineTimeKey(l)]).map((l:any)=>+new Date(starts[lineTimeKey(l)])+Math.max(0,Number(l.durationMin??l.service?.durationMin??0))*Math.max(1,Number(l.quantity)||1)*60000);return {scheduledStart:new Date(begin),durationMin:Math.max(15,Math.ceil((Math.max(...ends)-begin)/60000))};}
