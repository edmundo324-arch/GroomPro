import {convert} from '../../import/fields';
import {localToInstant} from '../../operating-hours';
export function sourceTime(value:any,zone:string){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/.test(value))throw Error('Source time needs review.');
 return new Date(+localToInstant(value.slice(0,16),zone)+Number(value.slice(17,19))*1000+Number(value.slice(20,23)));
}
const cents=(v:any)=>{const n=convert(v,{target:'amount',kind:'money'});if(n===null||!Number.isSafeInteger(n))throw Error('Missing or invalid amount.');return n as number;};
const integer=(v:any)=>{const n=convert(v,{target:'quantity',kind:'int'});if(n===null||Number(n)<0)throw Error('Invalid quantity.');return n as number;};
export function mapTicket(summary:any,rows:any[],zone:string,resolve:(table:string,id:any)=>string|null){
 if(summary.fldTicketType!==0)throw Error('Nonstandard ticket type requires review.');
 const statuses:Record<string,string>={Open:'OPEN',Closed:'CLOSED',Voided:'CANCELLED'};
 const status=statuses[summary.fldTicketStatus];if(!status)throw Error('Unknown source status.');
 const customerId=resolve('tblClients',summary.fldClientID);if(!customerId)throw Error('Ticket customer is unresolved.');
 if(!rows.length)throw Error('Ticket has no source lines.');
 const lines=rows.map((row,index)=>{
  if(!['S','P','X','F'].includes(row.fldPS))throw Error('Unsupported source line type.');
  const description=convert(row.fldDescription,{target:'description',kind:'text'});if(!description)throw Error('Missing line description.');
  const quantity=integer(row.fldQuantity),unitPriceCents=cents(row.fldPrice),totalCents=cents(row.fldRowTotal);
  const discountCents=quantity*unitPriceCents-totalCents;
  if(unitPriceCents<0||totalCents<0||discountCents<0||!Number.isSafeInteger(discountCents))throw Error('Refund or adjusted line requires review.');
  if(['X','F'].includes(row.fldPS)&&(quantity!==0||totalCents!==0))throw Error('Billable timing segment requires review.');
  const petId=row.fldPetID==null?null:resolve('tblPets',row.fldPetID);
  if(row.fldPetID!=null&&!petId)throw Error('Line pet is unresolved.');
  const assignedUserId=row.fldEmployeeID==null?null:resolve('tblEmployees',row.fldEmployeeID);
  if(row.fldEmployeeID!=null&&!assignedUserId)throw Error('Line employee is unresolved.');
  const start=row.fldPS==='P'?null:sourceTime(row.fldStartDateTime,zone),end=row.fldPS==='P'?null:sourceTime(row.fldEndDateTime,zone);
  const durationMin=start&&end?(+end-+start)/60000:0;if(!Number.isInteger(durationMin)||durationMin<0)throw Error('Line duration requires review.');
  const catalogId=resolve(row.fldPS==='P'?'catalog:P':'catalog:S',row.fldID);
  return {sourcePk:String(row.fldPK),start,end,data:{lineType:row.fldPS==='P'?'PRODUCT':'SERVICE',role:'ADD_ON',description,petId,assignedUserId,serviceId:row.fldPS==='P'?null:catalogId,productId:row.fldPS==='P'?catalogId:null,quantity,unitPriceCents,discountCents,totalCents,durationMin,sortOrder:index,sourceKey:'123pet:'+row.fldPK}};
 });
 const timed=lines.filter(l=>l.start&&l.end);if(!timed.length)throw Error('Retail-only ticket has no appointment time.');
 const scheduledStart=new Date(Math.min(...timed.map(l=>+l.start!))),end=Math.max(...timed.map(l=>+l.end!));
 const durationMin=(end-+scheduledStart)/60000;if(!Number.isInteger(durationMin)||durationMin<1)throw Error('Appointment duration requires review.');
 const totalCents=cents(summary.fldTotal),salesTaxCents=['fldTax1','fldTax2','fldTax3'].reduce((n,k)=>n+cents(summary[k]??'0'),0),tipCents=cents(summary.fldTip??'0');
 if(lines.reduce((n,l)=>n+l.data.totalCents,0)+salesTaxCents+tipCents!==totalCents)throw Error('Ticket totals do not reconcile.');
 let closedAt:Date|null=null;
 if(status==='CLOSED'){
  if(!summary.fldDateClosed||!summary.fldTimeClosed)throw Error('Closing time is missing.');
  closedAt=sourceTime(summary.fldDateClosed.slice(0,10)+'T'+summary.fldTimeClosed.slice(11),zone);
 }
 const payments:any[]=[];
 for(const i of [1,2]){
  const amount=cents(summary['fldTender'+i]??'0');if(amount===0)continue;
  if(summary['fldPayType'+i]!=='Cash')throw Error('Payment type needs verified mapping.');
  const net=amount-(i===1?cents(summary.fldChange??'0'):0);if(net<0||!closedAt)throw Error('Payment amount or date needs review.');
  payments.push({sourceIndex:i,amount:(net/100).toFixed(2),paymentType:'CASH',paidAt:closedAt});
 }
 if(status==='CLOSED'&&payments.reduce((n,p)=>n+Math.round(Number(p.amount)*100),0)!==totalCents)throw Error('Closed-ticket payments do not reconcile.');
 return {data:{customerId,scheduledStart,durationMin,status,totalCents,salesTaxCents,tipCents,closedAt,timingMode:'CONCURRENT'},lines,payments,petIds:[...new Set(lines.map(l=>l.data.petId).filter(Boolean))] as string[]};
}
