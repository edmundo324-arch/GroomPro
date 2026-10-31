import {groupedTicketLines} from './service-promotion';
export function petItemGroups(lines:any[],petIds:string[]){
 const groups=new Map<string,{petId:string;entries:{line:any;index:number}[]}>();
 for(const petId of petIds)groups.set(petId,{petId,entries:[]});
 for(const entry of groupedTicketLines(lines,petIds)){const id=entry.line.petId||entry.line.pet?.id||'';if(!groups.has(id))groups.set(id,{petId:id,entries:[]});groups.get(id)!.entries.push(entry)}
 return [...groups.values()].filter(group=>group.entries.length>0);
}
