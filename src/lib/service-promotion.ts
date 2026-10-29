// Service merchandising preferences share the existing extensible service metadata.
// They never change Favorite service, pricing, workflow designation or permissions.
export function serviceIsPromoting(service:any):boolean{return service?.customFields?.promotingServices===true}
export function servicePromotionFields(current:unknown,promoting:boolean){if(current!=null&&(typeof current!=='object'||Array.isArray(current)))throw Error('Review this service’s existing details before changing its promotion setting.');return {...(current as Record<string,unknown>||{}),promotingServices:promoting}}
export function promotingServices(services:any[]){return services.filter(s=>s.active&&serviceIsPromoting(s)).slice().sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id))}
export function ticketItemPet(pets:any[],requested:string){return pets.some(p=>p.id===requested)?requested:pets[0]?.id||''}
export function promotingServiceItem(service:any,petId:string){return {type:'SERVICE',id:service.id,petId,quantity:1,role:service.workflowRole||'ADD_ON',description:service.name,durationMin:service.durationMin,unitPriceCents:service.priceCents,totalCents:service.priceCents}}
