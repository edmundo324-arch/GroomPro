import {dogFields} from './customer-agreement-model';
export const petCareFields={
 medicalNotes:{label:dogFields.medicalNotes,help:'Record health information the owner has shared that staff need to know when caring for this dog. These are the same Medical conditions shown on the customer’s intake form and portal.'},
 behaviorNotes:{label:dogFields.behaviorNotes,help:'Record behaviors and handling instructions that help staff care for this dog. These are the same Special behaviors shown on the customer’s intake form and portal.'},
} as const;
export function petCareDetails(input:Record<string,unknown>){
 const data:Partial<Record<keyof typeof petCareFields,string|null>>={};
 for(const key of Object.keys(petCareFields) as (keyof typeof petCareFields)[]){
  if(input[key]===undefined)continue;
  if(input[key]!==null&&typeof input[key]!=='string')throw Error(petCareFields[key].label+' must be text.');
  data[key]=typeof input[key]==='string'?input[key].trim()||null:null;
 }
 return data;
}
