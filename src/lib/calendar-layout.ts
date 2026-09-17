export type TimedAppointment={id:string;scheduledStart:string|null;durationMin?:number};
export function minutesAt(date:Date){return date.getHours()*60+date.getMinutes()}
export function clockMinutes(time:string){const[h,m]=time.split(":").map(Number);return h*60+m}
// Partition overlapping appointments into lanes so no card covers another.
export function appointmentLayout<T extends TimedAppointment>(tickets:T[],day:Date){
 const dayStart=new Date(day);dayStart.setHours(0,0,0,0);const dayEnd=new Date(dayStart);dayEnd.setDate(dayEnd.getDate()+1);
 const items=tickets.filter(t=>t.scheduledStart).map(ticket=>{const start=new Date(ticket.scheduledStart!);const end=new Date(+start+Math.max(15,ticket.durationMin||30)*60000);return{ticket,start:start<dayStart?0:minutesAt(start),end:end>=dayEnd?1440:minutesAt(end),dateStart:start,dateEnd:end,lane:0,lanes:1}}).filter(x=>x.dateStart<dayEnd&&x.dateEnd>dayStart).sort((a,b)=>a.start-b.start||a.end-b.end);
 let group:typeof items=[],ends:number[]=[],groupEnd=-1;
 const flush=()=>{group.forEach(x=>x.lanes=ends.length);group=[];ends=[]};
 for(const item of items){if(item.start>=groupEnd){flush();groupEnd=-1}let lane=ends.findIndex(end=>end<=item.start);if(lane<0)lane=ends.length;item.lane=lane;ends[lane]=item.end;group.push(item);groupEnd=Math.max(groupEnd,item.end)}flush();return items;
}

