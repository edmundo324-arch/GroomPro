// Keep the existing local wall-clock value; only replace the edited part.
export function appointmentPart(value:string,part:'date'|'time',input:string){
 const [date='',time='']=value.split('T');
 return part==='date'?`${input}T${time}`:`${date}T${input}`;
}
