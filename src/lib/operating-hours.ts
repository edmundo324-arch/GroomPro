export type DayHours={day:number;closed:boolean;open:string;close:string};
export const defaultHours=():DayHours[]=>Array.from({length:7},(_,day)=>({day,closed:false,open:"08:30",close:"17:00"}));
export function validTimezone(zone:string){try{new Intl.DateTimeFormat("en-US",{timeZone:zone}).format();return true}catch{return false}}
export function zonedParts(date:Date,timeZone:string){const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date).map(p=>[p.type,p.value]));return{date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,second:Number(p.second)}}
export function wallTime(date:Date,zone:string){const p=zonedParts(date,zone);return `${p.date}T${p.time}`}
export function localToInstant(value:string,zone:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error("Choose a valid appointment date and time.");
 const target=Date.parse(value+":00Z");if(!Number.isFinite(target))throw new Error("Invalid appointment time.");let result=target;
 for(let i=0;i<4;i++){const p=zonedParts(new Date(result),zone);const represented=Date.parse(`${p.date}T${p.time}:${String(p.second).padStart(2,"0")}Z`);const delta=target-represented;if(!delta)break;result+=delta}
 if(wallTime(new Date(result),zone)!==value)throw new Error("That local time does not exist because the clocks change. Choose another time.");return new Date(result);
}
export function parseHours(value:unknown):DayHours[]{
 if(!Array.isArray(value)||value.length!==7)throw new Error("Set hours for all seven days.");const clock=/^(?:[01]\d|2[0-3]):[0-5]\d$/;const days=new Set<number>();
 return value.map((v:any)=>{if(!Number.isInteger(v.day)||v.day<0||v.day>6||days.has(v.day)||typeof v.closed!=="boolean"||!clock.test(v.open)||!clock.test(v.close)||(!v.closed&&v.open>=v.close))throw new Error("Each day needs valid opening and closing times, with closing after opening.");days.add(v.day);return{day:v.day,closed:v.closed,open:v.open,close:v.close}}).sort((a,b)=>a.day-b.day);
}
export function hoursError(start:Date,durationMin:number,hours:DayHours[],zone:string){
 if(!Number.isFinite(+start)||!Number.isInteger(durationMin)||durationMin<=0||durationMin>2147483647)return "Choose a valid appointment time and duration.";
 const p=zonedParts(start,zone),day=new Date(p.date+"T12:00:00Z").getUTCDay(),h=hours.find(h=>h.day===day);
 if(!h||h.closed)return `Appointments cannot start on the closed day ${new Date(p.date+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"long",timeZone:"UTC"})}. Choose an open day.`;
 if(p.time<h.open||p.time>=h.close)return `Appointments must start within ${h.open}–${h.close} (${zone}). Finishing after closing is allowed.`;
 return null;
}

