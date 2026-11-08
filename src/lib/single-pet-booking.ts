import {groomingEligibility} from './breed-classification';
import {isRequestLine} from './calendar-presentation';
import {expandPackage} from './package-lines';
import {packageForPet} from './pet-package';

function bookedServices(ticket:any,petId:string,services:any[]){
 return (ticket.lines||[]).filter((line:any)=>{
  if((line.petId||line.pet?.id)!==petId||line.lineType!=='SERVICE')return false;
  const service=line.service||services.find(item=>item.id===line.serviceId);
  return !isRequestLine({...line,service});
 });
}

export function latestSinglePetServiceVisit(petId:string,history:any[],services:any[]=[]){
 const date=(ticket:any)=>+new Date(ticket.scheduledStart||ticket.closedAt||ticket.createdAt||0);
 return history.filter(ticket=>ticket.status==='CLOSED'&&bookedServices(ticket,petId,services).length).sort((a,b)=>date(b)-date(a))[0];
}

export function singlePetBookingLines(pet:any,history:any[],catalog:any){
 const services=catalog.services||[],packages=catalog.packages||[];
 const previous=latestSinglePetServiceVisit(pet.id,history,services);
 const result:any[]=[],addedPackages=new Set<string>();
 const addPackage=(pkg:any)=>{
  if(!pkg?.active||addedPackages.has(pkg.id)||groomingEligibility(pet,pkg,catalog.breeds).status!=='eligible')return;
  if(!pkg.items?.length||pkg.items.some((item:any)=>!services.some((service:any)=>service.id===item.serviceId&&service.active)))return;
  result.push(...expandPackage(pkg,services,pet.id));
  addedPackages.add(pkg.id);
 };
 if(previous){
  const previousLines=bookedServices(previous,pet.id,services).sort((a:any,b:any)=>(a.sortOrder??0)-(b.sortOrder??0));
  for(const line of previousLines){
   if(line.packageId||line.packageName){
    const matches=packages.filter((pkg:any)=>line.packageId?pkg.id===line.packageId:pkg.name===line.packageName);
    if(matches.length===1)addPackage(matches[0]);
    continue;
   }
   const service=services.find((item:any)=>item.id===line.serviceId&&item.active);
   if(!service||isRequestLine({...line,service}))continue;
   const quantity=Number.isInteger(line.quantity)&&line.quantity>0&&line.quantity<=1000?line.quantity:1;
   result.push({type:'SERVICE',id:service.id,serviceId:service.id,petId:pet.id,quantity,role:service.workflowRole||line.role||'ADD_ON',description:service.name,durationMin:service.durationMin,unitPriceCents:service.priceCents,totalCents:service.priceCents*quantity});
  }
 }
 if(!result.length)addPackage(packageForPet(pet,packages,catalog.breeds));
 return result;
}
