export type TimingMode='SEQUENTIAL'|'CONCURRENT';
export function timingMode(value:unknown):TimingMode {if(value!=='SEQUENTIAL'&&value!=='CONCURRENT')throw Error('Choose sequential or concurrent timing.');return value}
export function ticketDuration(lines:{durationMin?:number|null;quantity:number;service?:{durationMin:number}|null;lineType?:string}[],mode:string='SEQUENTIAL'){
 timingMode(mode);const durations=lines.filter(l=>l.lineType!=='PRODUCT').map(l=>{const minutes=l.durationMin??l.service?.durationMin??0;if(!Number.isInteger(minutes)||minutes<0||minutes>1440||!Number.isInteger(l.quantity)||l.quantity<1)throw Error('Invalid service duration or quantity.');return minutes*l.quantity});
 return Math.max(15,(mode==='CONCURRENT'?Math.max(0,...durations):durations.reduce((a,b)=>a+b,0))||30);
}
