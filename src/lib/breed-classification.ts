import source from './breed-source.json';
export type Breed={id:string;name:string;aliases:string[];primaryBreedId?:string;secondaryBreedId?:string;source?:string;referenceWeight?:string};
export const baseBreeds:Breed[]=source;
export const breedKey=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function findBreed(text:string,breeds:Breed[]=baseBreeds){const key=breedKey(text);if(!key)return null;const found=breeds.filter(b=>[b.name,...b.aliases].some(n=>breedKey(n)===key));return found.length===1?found[0]:null;}
export function petBreedData(input:any,breeds:Breed[]=baseBreeds,previous:any={}){
 const text=String(input.breed??previous.breed??'').trim();if(text.length>191)throw Error('Breed name must be 191 characters or fewer.');
 const selected=input.breedId?breeds.find(b=>b.id===input.breedId):findBreed(text,breeds);if(input.breedId&&!selected)throw Error('Choose a breed from this business’s dictionary.');
 const component=(key:string,fallback?:string)=>{const id=input[key]===undefined?(selected?.[key as 'primaryBreedId']||fallback||(text===previous.breed?previous[key]:null)||null):input[key]||null;if(id&&!breeds.some(b=>b.id===id))throw Error('Choose a recognized parent breed.');return id;};
 return {breed:text||selected?.name||null,breedId:selected?.id||null,originalBreed:previous.originalBreed||previous.breed||text||null,primaryBreedId:component('primaryBreedId',selected?.primaryBreedId),secondaryBreedId:component('secondaryBreedId',selected?.secondaryBreedId)};
}
export const coatLengths=['Hairless','Short','Medium','Long'];
export const coatTextures=['Smooth','Straight','Wavy','Curly','Wiry','Double coat','Corded'];
export type GroomingRules={coatLengths?:string[];coatTextures?:string[];breedIds?:string[];excludedBreedIds?:string[];classifications?:string[]};
export function groomingRules(value:any):GroomingRules|null{
 if(value==null)return null;if(typeof value!=='object'||Array.isArray(value))throw Error('Invalid grooming rules.');
 const result:GroomingRules={};for(const key of ['coatLengths','coatTextures','breedIds','excludedBreedIds','classifications'] as const){const values=value[key]??[];if(!Array.isArray(values)||values.length>500||values.some(v=>typeof v!=='string'||v.length>191))throw Error('Invalid '+key+' rule.');result[key]=[...new Set(values.map(v=>v.trim()).filter(Boolean))];}
 return result;
}
export type GroomingPet={breed?:string|null;breedId?:string|null;primaryBreedId?:string|null;secondaryBreedId?:string|null;weightLbs?:number|string|{toString():string}|null;coatLength?:string|null;coatTexture?:string|null;groomingClassification?:string|null;preferredPackageId?:string|null};
export type GroomingOffer={minimumWeightLbs?:number|string|null;maximumWeightLbs?:number|string|null;groomingRules?:GroomingRules|null};
// Missing measurements are reviewable, never inferred from typical breed ranges.
export function groomingEligibility(pet:GroomingPet,offer:GroomingOffer,breeds:Breed[]=baseBreeds):{status:'eligible'|'ineligible'|'review';reason:string}{
 const missing:string[]=[],failed:string[]=[];
 if(offer.minimumWeightLbs!=null||offer.maximumWeightLbs!=null){const w=pet.weightLbs==null||pet.weightLbs===''?NaN:Number(pet.weightLbs);if(!Number.isFinite(w))missing.push('actual weight');else if((offer.minimumWeightLbs!=null&&w<Number(offer.minimumWeightLbs))||(offer.maximumWeightLbs!=null&&w>Number(offer.maximumWeightLbs)))failed.push('weight outside this range');}
 const rules=offer.groomingRules||{};
 for(const [field,allowed,label] of [['coatLength',rules.coatLengths,'coat length'],['coatTexture',rules.coatTextures,'coat type'],['groomingClassification',rules.classifications,'grooming classification']] as const){if(allowed?.length){const v=pet[field];if(!v)missing.push(label);else if(!allowed.some(a=>breedKey(a)===breedKey(v)))failed.push(label+' does not match');}}
 const recognized=pet.breedId||findBreed(pet.breed||'',breeds)?.id;const breed=breeds.find(b=>b.id===recognized);const ids=[recognized,pet.primaryBreedId||breed?.primaryBreedId,pet.secondaryBreedId||breed?.secondaryBreedId].filter(Boolean);
 if(rules.breedIds?.length){if(!ids.length)missing.push('recognized breed');else if(!ids.some(id=>rules.breedIds!.includes(id!)))failed.push('breed not included');}
 if(rules.excludedBreedIds?.length){if(!ids.length)missing.push('recognized breed');else if(ids.some(id=>rules.excludedBreedIds!.includes(id!)))failed.push('breed excluded');}
 return failed.length?{status:'ineligible',reason:failed.join('; ')}:missing.length?{status:'review',reason:'Enter '+missing.join(', ')+' in the pet profile.'}:{status:'eligible',reason:''};
}
