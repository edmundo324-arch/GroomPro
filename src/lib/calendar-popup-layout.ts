// The old `pet` choice included both name and breed. Preserve that until the
// tenant explicitly edits the selection; new selections store independent keys.
export function popupFields(fields:string[]){return [...new Set(fields.flatMap(key=>key==='pet'?['pet.name','pet.breed']:key==='pet.groomingNotes'?['notes']:key==='customer.vipStatus'?['pet.vipEligible']:[key]))]}
export const fixedPopupFields=new Set(['time','customer','pet.name','pet.weightLbs','pet.breed','pet.vipEligible','package','todayNotes','pet.notes']);
export function popupSection(key:string){return key==='notes'?'pet':key.startsWith('customer.')?'customer':key.startsWith('pet.')?'pet':key.startsWith('line.')?'service':'ticket'}
export function additionalPopupFields(fields:string[],section:string){return popupFields(fields).filter(key=>!fixedPopupFields.has(key)&&popupSection(key)===section)}
export function movePopupField(fields:string[],key:string,target:string){
 const next=popupFields(fields),from=next.indexOf(key),to=next.indexOf(target);
 if(from<0||to<0||fixedPopupFields.has(key)||fixedPopupFields.has(target)||popupSection(key)!==popupSection(target))return next;
 next.splice(from,1);next.splice(to,0,key);return next;
}
