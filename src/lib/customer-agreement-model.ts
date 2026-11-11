export const agreementChannels=['link','tablet','online'] as const;
export type AgreementChannel=typeof agreementChannels[number];
export type AgreementKind='intake'|'vip';
export const agreementTitle={intake:'New Customer Intake',vip:'VIP Signup Agreement'} as const;
export const customerFields={
 firstName:'First name',lastName:'Last name',email:'Email',address1:'Street address',address2:'Apartment or suite',
 city:'City',state:'State',postalCode:'ZIP code',additionalPhone:'Additional phone',thirdPhone:'Third phone',referralSource:'How did you hear about us? Include the referrer’s name if applicable.',
};
export const dogFields={
 name:'Dog name',breed:'Breed',weightLbs:'Weight (lb)',color:'Color',groomingNotes:'Special grooming instructions',
 medicalNotes:'Medical conditions',behaviorNotes:'Special behaviors',veterinarian:'Veterinarian',
};
export type Clause={title:string;text:string;video?:string;initialsRequired?:boolean};
export type Terms={version:string;clauses:Clause[]};
export type AgreementConfig={channels:AgreementChannel[];intake:Terms;vip:Terms;shopEmail:string;bookingUrl?:string;tabletVerifyExisting?:boolean};
export type Quote={petId:string;priceCents:number;planId?:string;planName?:string;billing?:string};
export type AgreementPet={id:string;pictureUrl?:string|null}&Partial<Record<keyof typeof dogFields,string|number|null>>;
export type AgreementProfile={id:string;phone:string;pets:AgreementPet[]}&Partial<Record<keyof typeof customerFields,string|null>>;
export type Stroke=Array<[number,number]>;
export type Signature={name:string;adopted:boolean;acknowledged:number[];initials:Record<string,Stroke[]>};
export const formatAgreementPrice=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);

export function quotePrice(input:unknown){
 const value=typeof input==='string'?input.trim():'';
 if(!/^\d{1,6}(\.\d{1,2})?$/.test(value))throw Error('Enter a price in dollars and cents for each selected dog.');
 const [dollars,cents='']=value.split('.');
 return Number(dollars)*100+Number(cents.padEnd(2,'0'));
}
export function verifiedSignature(input:Signature,clauses:Clause[]){
 const count=clauses.length;
 const required=clauses.flatMap((clause,index)=>clause.initialsRequired===false?[]:[index]);
 const name=typeof input?.name==='string'?input.name.trim():'';
 if(!name||name.length>191||input.adopted!==true)throw Error('Type your name and adopt your signature.');
 if(!Array.isArray(input.acknowledged)||input.acknowledged.length!==count||input.acknowledged.some((n,i)=>n!==i))throw Error('Review and acknowledge each section.');
 if(!input.initials||Object.keys(input.initials).length!==required.length)throw Error('Initial every section.');
 for(const i of required){
  const strokes=input.initials[i];
  if(!Array.isArray(strokes)||!strokes.length||strokes.length>24||!strokes.some(stroke=>Array.isArray(stroke)&&stroke.length>1))throw Error('Handwrite your initials in each required field.');
  if(strokes.some(stroke=>!Array.isArray(stroke)||stroke.length>180||stroke.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))))throw Error('Invalid initials. Clear them and try again.');
 }
 return {...input,name};
}
