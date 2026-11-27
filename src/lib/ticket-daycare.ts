type DaycareService={id?:string;name?:string|null;category?:string|null};
type DaycareLine={id?:string;serviceId?:string|null;service?:DaycareService|null;description?:string|null;packageName?:string|null;quantity?:number;type?:string;lineType?:string;productId?:string|null};

const isDaycareName=(value:string|null|undefined)=>/^day[\s-]*care$/i.test((value||'').trim().replace(/[.,;:!]+$/,'').trim());

// A service added through Items is daycare too; the separate Whiteboard flag
// must not make that booked service disappear from the POS account summary.
export function ticketDaycareLabel(ticket:{daycareStatus?:string;lines?:DaycareLine[]},services:DaycareService[]=[]){
 if(ticket.daycareStatus==='STAYING')return 'Staying';
 const added=(ticket.lines||[]).some(line=>{
  if((line.quantity??1)<=0||line.productId||line.type==='PRODUCT'||line.lineType==='PRODUCT')return false;
  const serviceId=line.serviceId||(line.type==='SERVICE'?line.id:null);
  const service=line.service||services.find(item=>!!serviceId&&item.id===serviceId);
  if(service?.category?.trim().toUpperCase()==='DAYCARE'||isDaycareName(service?.name))return true;
  const prefix=line.packageName?line.packageName+' · ':'';
  const description=prefix&&line.description?.startsWith(prefix)?line.description.slice(prefix.length):line.description;
  return isDaycareName(description);
 });
 return added?'Added':'Not added';
}
