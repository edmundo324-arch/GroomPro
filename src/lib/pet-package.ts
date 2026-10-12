import {Breed,GroomingPet,GroomingOffer,baseBreeds,breedKey,findBreed,groomingEligibility} from './breed-classification';
type PetPackage=GroomingOffer&{id:string;name:string;active:boolean;defaultForBreeds?:string|null};
export function packageForPet(pet:GroomingPet,packages:PetPackage[],breeds:Breed[]=baseBreeds){
 const active=packages.filter(p=>p.active&&groomingEligibility(pet,p,breeds).status==='eligible');
 if(pet.preferredPackageId)return active.find(p=>p.id===pet.preferredPackageId)||null;
 const breed=pet.breedId||findBreed(pet.breed||'',breeds)?.id;
 const matches=(text:string)=>breed?findBreed(text,breeds)?.id===breed:!!pet.breed&&breedKey(text)===breedKey(pet.breed);
 const explicit=active.filter(p=>(p.defaultForBreeds||'').split(',').some(matches));
 if(explicit.length)return explicit.length===1?explicit[0]:null;
 const named=active.filter(p=>matches(p.name));if(named.length)return named.length===1?named[0]:null;
 const ruled=active.filter(p=>!p.defaultForBreeds&&(p.minimumWeightLbs!=null||p.maximumWeightLbs!=null||Object.values(p.groomingRules||{}).some(v=>v?.length)));
 return ruled.length===1?ruled[0]:null;
}
