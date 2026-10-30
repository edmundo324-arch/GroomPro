// Service merchandising preferences share the existing extensible service metadata.
// They never change Favorite service, pricing, workflow designation or permissions.
export function serviceIsPromoting(service:any):boolean{return service?.customFields?.promotingServices===true}
export function servicePromotionFields(current:unknown,promoting?:boolean,label?:string){if(current!=null&&(typeof current!=='object'||Array.isArray(current)))throw Error('Review this service’s existing details before changing its promotion setting.');return {...(current as Record<string,unknown>||{}),...(promoting!==undefined?{promotingServices:promoting}:{}),...(label!==undefined?{offerTodayLabel:label}:{} )}}
export function promotingServices(services:any[]){return services.filter(s=>s.active&&serviceIsPromoting(s)).slice().sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id))}
export function ticketItemPet(pets:any[],requested:string){return pets.some(p=>p.id===requested)?requested:pets[0]?.id||''}
export function promotingServiceItem(service:any,petId:string){return {type:'SERVICE',id:service.id,petId,quantity:1,role:service.workflowRole||'ADD_ON',offerToday:true,sourceKey:offerTodaySourceKey(service.id),description:service.name,durationMin:service.durationMin,unitPriceCents:service.priceCents,totalCents:service.priceCents}}

export function offerTodayLabel(service:any):string{return String(service?.customFields?.offerTodayLabel||'').trim()||service.name}
export function offerTodaySourceKey(serviceId:string){return 'offer-today:'+serviceId}
export function offerTodayLine(lines:any[],serviceId:string,petId:string){return lines.find(line=>line.petId===petId&&!line.packageId&&(line.serviceId||line.id)===serviceId&&line.sourceKey===offerTodaySourceKey(serviceId))}
export function setDraftOffer(lines:any[],item:any,present:boolean){const found=offerTodayLine(lines,item.id,item.petId);return present?(found?lines:[...lines,item]):lines.filter(line=>!(line.petId===item.petId&&!line.packageId&&(line.serviceId||line.id)===item.id&&line.sourceKey===offerTodaySourceKey(item.id)))}

// Preserve original indexes so grouped presentation never edits another dog's line.
export function groupedTicketLines(lines:any[],petIds:string[]){
 const petId=(line:any)=>line.petId||line.pet?.id||'';
 const packageId=(line:any)=>line.packageGroupKey||line.packageId||line.packageName||'';
 const rank=new Map(petIds.map((id,index)=>[id,index]));
 const packages=new Map<string,number>();
 for(const line of lines){
  const dog=petId(line);if(dog&&!rank.has(dog))rank.set(dog,rank.size);
  const pkg=packageId(line),key=dog+'\0'+pkg;if(pkg&&!packages.has(key))packages.set(key,packages.size);
 }
 return lines.map((line,index)=>({line,index})).sort((a,b)=>{
  const dogA=petId(a.line),dogB=petId(b.line);
  const dogOrder=(rank.get(dogA)??rank.size)-(rank.get(dogB)??rank.size);if(dogOrder)return dogOrder;
  const pkgA=packageId(a.line),pkgB=packageId(b.line);
  // Put each dog's package heading/components before that dog's loose extras.
  if(!!pkgA!==!!pkgB)return pkgA?-1:1;
  if(pkgA&&pkgB&&pkgA!==pkgB)return packages.get(dogA+'\0'+pkgA)!-packages.get(dogB+'\0'+pkgB)!;
  if(pkgA&&Number.isFinite(a.line.sortOrder)&&Number.isFinite(b.line.sortOrder)&&a.line.sortOrder!==b.line.sortOrder)return a.line.sortOrder-b.line.sortOrder;
  return a.index-b.index;
 });
}
