import type {PublicHintSettings} from './public-hint-settings';
import {deviceRead,deviceUpdate} from './offline-device-store';
import {customerFields,dogFields,type AgreementKind,type AgreementProfile,type Quote,type Signature,type Terms} from './customer-agreement-model';

export type AgreementView={hints?:PublicHintSettings;profile:AgreementProfile;kind:AgreementKind;quote:Quote[];terms:Terms;tablet?:boolean;revision:string;business:string};
export type IntakeStation={hints?:PublicHintSettings;terms:Terms;business:string;verifyExisting?:boolean;profiles?:{phones:string[];profile:AgreementProfile;revision:string}[];verificationPhones?:string[]};
export type TabletDraft={
 id:string;token:string;phone:string;expectedCustomerId?:string;view:AgreementView;serverRevision:string;
 edits:Record<string,unknown>[];submission?:{signature:Signature;selectedPets:string[]};documentId?:string;issue?:string;
};
const key=(tenant:string)=>'intake-station:'+tenant;
const draftKey=(tenant:string)=>'intake-draft:'+tenant;
const queueKey=(tenant:string)=>'intake-queue:'+tenant;

export const readIntakeStation=(tenant:string)=>deviceRead<IntakeStation>(key(tenant));
export const saveIntakeStation=(tenant:string,value:IntakeStation)=>deviceUpdate<IntakeStation>(key(tenant),()=>value);
export const readTabletDraft=(tenant:string)=>deviceRead<TabletDraft>(draftKey(tenant));
export const saveTabletDraft=(tenant:string,value?:TabletDraft)=>deviceUpdate<TabletDraft>(draftKey(tenant),()=>value);
export const readTabletQueue=(tenant:string)=>deviceRead<TabletDraft[]>(queueKey(tenant));
export const updateTabletQueue=(tenant:string,update:(queue:TabletDraft[])=>TabletDraft[])=>deviceUpdate<TabletDraft[]>(queueKey(tenant),current=>update(current||[]));

export function projectAgreementEdit(draft:TabletDraft,fields:Record<string,unknown>):TabletDraft{
 const profile=structuredClone(draft.view.profile);
 if(fields.email!==undefined&&(typeof fields.email!=='string'||!/^\S+@\S+\.\S+$/.test(fields.email.trim())))throw Error('Enter a valid email address.');
 if(fields.weightLbs!==undefined&&fields.weightLbs!==''&&(!Number.isFinite(Number(fields.weightLbs))||Number(fields.weightLbs)<=0||Number(fields.weightLbs)>9999.99))throw Error('Enter a valid dog weight.');
 let edit=fields;
 if(fields.petId!==undefined){
  const dog=profile.pets.find(pet=>pet.id===fields.petId);
  if(fields.petId&&!dog)throw Error('Dog not found.');
  const details=Object.fromEntries(Object.keys(dogFields).filter(key=>typeof fields[key]==='string').map(key=>[key,fields[key]]));
  if(dog){Object.assign(dog,details);if(typeof fields.photo==='string')dog.pictureUrl=fields.photo;}
  else{
   if(typeof fields.name!=='string'||!fields.name.trim())throw Error('Enter the dog’s name.');
   const id=crypto.randomUUID();
   profile.pets.push({id,...details,name:fields.name.trim()});
   edit={...fields,newPetId:id};
  }
 }else{
  for(const key of Object.keys(customerFields) as (keyof typeof customerFields)[]){
   if(typeof fields[key]==='string')profile[key]=fields[key].trim();
  }
  if(!profile.id)profile.id='offline-'+draft.id;
 }
 return {...draft,view:{...draft.view,profile},edits:[...draft.edits,edit]};
}

type Send=(action:string,data:object,token:string)=>Promise<any>;
export async function replayTabletEdits(draft:TabletDraft,send:Send){
 let current=await send('view',{},draft.token);
 if(current.signed)return current;
 const signedTerms=draft.view.terms;
 const currentTerms=current.terms as Terms;
 if(currentTerms.version!==signedTerms.version||currentTerms.clauses.length!==signedTerms.clauses.length||
  currentTerms.clauses.some((clause,index)=>{
   const previous=signedTerms.clauses[index];
   return clause.title!==previous.title||clause.text!==previous.text||clause.video!==previous.video||clause.initialsRequired!==previous.initialsRequired;
  })){
  throw Object.assign(Error('The intake policies changed. Staff must review this saved form.'),{name:'AgreementResponseError'});
 }
 if(!draft.edits.length&&draft.serverRevision&&current.revision!==draft.serverRevision)throw Object.assign(Error('The profile changed on another device. Staff must review this saved form.'),{name:'AgreementResponseError'});
 let revision=draft.serverRevision||current.revision;
 for(const [index,fields] of draft.edits.entries()){
  current=await send('edit',{fields,offlineEditIndex:index,expectedRevision:revision},draft.token);
  revision=current.revision;
 }
 return current;
}
const activeSyncs=new Set<string>();
export async function syncTabletAgreements(tenant:string,send:Send){
 const sync=async()=>{
  for(let draft of await readTabletQueue(tenant)||[]){
   if(draft.issue)continue;
   try{
    if(!draft.token){
     const started=await send('startTablet',{phone:draft.phone,offlineId:draft.id,expectedCustomerId:draft.expectedCustomerId,station:true},'');
     draft={...draft,token:started.token};
     await updateTabletQueue(tenant,queue=>queue.map(item=>item.id===draft.id?draft:item));
    }
    if(!draft.documentId){
     const current=await replayTabletEdits(draft,send);
     const result=await send('sign',{...draft.submission,revision:current.revision},draft.token);
     draft={...draft,documentId:result.id};
     if(!result.emailed){
      await updateTabletQueue(tenant,queue=>queue.map(item=>item.id===draft.id?{...draft,edits:[],submission:undefined}:item));
      continue;
     }
    }else if(!(await send('sign',{},draft.token)).emailed)continue;
    await updateTabletQueue(tenant,queue=>queue.filter(item=>item.id!==draft.id));
    await send('clearTabletForm',{},draft.token).catch(()=>{});
   }catch(error){
    if(error instanceof Error&&error.name==='AgreementResponseError'){
     const issue=error.message;
     await updateTabletQueue(tenant,queue=>queue.map(item=>item.id===draft.id?{...item,issue}:item));
    }
   }
  }
 };
 if(navigator.locks){
  await navigator.locks.request('groompro-agreements:'+tenant,{ifAvailable:true},async lock=>{if(lock)await sync();});
 }else if(!activeSyncs.has(tenant)){
  activeSyncs.add(tenant);
  try{await sync();}finally{activeSyncs.delete(tenant);}
 }
}
