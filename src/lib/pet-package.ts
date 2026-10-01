type PetPackage={id:string;name:string;active:boolean;defaultForBreeds?:string|null};
const normalize=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ');
export function packageForPet(pet:{preferredPackageId?:string|null;breed?:string|null},packages:PetPackage[]){
 const active=packages.filter(p=>p.active);
 if(pet.preferredPackageId)return active.find(p=>p.id===pet.preferredPackageId)||null;
 const breed=normalize(pet.breed||'');if(!breed)return null;
 const explicit=active.filter(p=>(p.defaultForBreeds||'').split(',').some(b=>normalize(b)===breed));
 if(explicit.length)return explicit.length===1?explicit[0]:null;
 const named=active.filter(p=>normalize(p.name)===breed);return named.length===1?named[0]:null;
}
