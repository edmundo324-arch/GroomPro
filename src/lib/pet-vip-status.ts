export const petVipLabels={MEMBER:'VIP member',ELIGIBLE:'VIP eligible',DO_NOT_OFFER:'Do not offer VIP',ASSESS:'Assess for VIP'};
export function petVipStatus(pet:any){
 if(pet.vipMember===true)return {code:'MEMBER',label:petVipLabels.MEMBER};
 if(pet.vipAssessmentStatus==='DO_NOT_OFFER'||pet.vipDoNotOffer===true)return {code:'DO_NOT_OFFER',label:petVipLabels.DO_NOT_OFFER};
 if(pet.vipEligible===true)return {code:'ELIGIBLE',label:petVipLabels.ELIGIBLE};
 return {code:'ASSESS',label:petVipLabels.ASSESS};
}
export function petVipCode(label:string){return Object.entries(petVipLabels).find(([,value])=>value===label)?.[0]||'ASSESS'}
