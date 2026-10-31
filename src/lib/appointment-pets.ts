import {packageForPet} from './pet-package';
export function bookedPetIds(lines:any[]):string[]{return [...new Set<string>(lines.map(l=>l.petId||l.pet?.id).filter(Boolean))]}
export function attendingPets<T extends {pets:any[];lines:any[]}>(ticket:T):T{const ids=new Set(bookedPetIds(ticket.lines));return {...ticket,pets:ticket.pets.filter(p=>ids.has(p.petId||p.pet?.id||p.id))}}
// A name click targets the assigned grooming package, never arbitrary extras or Self Service.
export function petPackageToggle(pet:any,lines:any[],packages:any[],breeds:any[]=[]){
 const desired=packageForPet(pet,packages,breeds),preferred=pet.preferredPackageId||desired?.id;
 const existing=lines.find(l=>l.petId===pet.id&&l.packageId===preferred)||lines.find(l=>l.petId===pet.id&&l.packageId&&l.role==='GROOM');
 if(existing)return {pkg:packages.find(p=>p.id===existing.packageId)||{id:existing.packageId,name:existing.packageName},present:false};
 return desired?{pkg:desired,present:true}:null;
}

export function packageMembersForPet(lines:any[],petId:string,packageId:string){return lines.filter(l=>l.petId===petId&&l.packageId===packageId)}
