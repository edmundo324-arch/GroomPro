import {selectCustomRule,type ExecutableCustomRule,type CustomRuleEventContext} from './custom-rule-plan';
export type PetTarget={petServiceIds?:string[];petPackageIds?:string[];petVipPlanIds?:string[]};
export const hasPetTarget=(rule:{conditions?:PetTarget})=>Boolean(rule.conditions?.petServiceIds?.length||rule.conditions?.petPackageIds?.length||rule.conditions?.petVipPlanIds?.length);
export function petTargetMatches(target:PetTarget,pet:{packageId?:string;serviceIds:string[];vipPlanIds:string[]}){
 return (!target.petPackageIds?.length||target.petPackageIds.includes(pet.packageId||''))&&(!target.petServiceIds?.length||target.petServiceIds.some(id=>pet.serviceIds.includes(id)))&&(!target.petVipPlanIds?.length||target.petVipPlanIds.some(id=>pet.vipPlanIds.includes(id)));
}
export async function rulePetFacts(client:any,tenantId:string,customerId:string):Promise<Array<{id:string;name:string;packageId?:string;serviceIds:string[];vipPlanIds:string[]}>>{
 const pets=await client.pet.findMany({where:{tenantId,customerId,active:true},select:{id:true,name:true,preferredPackageId:true}});if(!pets.length)return [];
 const packageIds=[...new Set(pets.map((p:any)=>p.preferredPackageId).filter(Boolean))];
 const [packages,memberships]=await Promise.all([
  packageIds.length?client.package.findMany({where:{tenantId,id:{in:packageIds},active:true},select:{id:true,items:{select:{serviceId:true}}}}):[],
  client.$queryRaw`SELECT id,petId FROM Membership WHERE tenantId=${tenantId} AND customerId=${customerId} AND status IN ('ACTIVE','CANCELLATION_REQUESTED','PAUSE_REQUESTED') AND endedAt IS NULL`
 ]);
 const plans=memberships.length?await client.tenantSetting.findMany({where:{tenantId,settingKey:{in:memberships.map((m:any)=>'MEMBERSHIP_PLAN:'+m.id)}},select:{settingKey:true,value:true}}):[];
 return pets.map((pet:any)=>{const pkg=packages.find((p:any)=>p.id===pet.preferredPackageId);return{id:pet.id,name:pet.name,packageId:pkg?.id,serviceIds:(pkg?.items||[]).map((i:any)=>i.serviceId).filter(Boolean),vipPlanIds:memberships.filter((m:any)=>m.petId===pet.id).map((m:any)=>plans.find((p:any)=>p.settingKey==='MEMBERSHIP_PLAN:'+m.id)?.value?.planId).filter(Boolean)};});
}
export async function selectCustomerRule(client:any,tenantId:string,customerId:string|undefined,rules:ExecutableCustomRule[],context:CustomRuleEventContext,now=new Date()){
 const targeted=rules.some(hasPetTarget),pets=targeted&&customerId?await rulePetFacts(client,tenantId,customerId):[];
 const eligible=rules.filter(r=>!hasPetTarget(r)||pets.some(p=>petTargetMatches(r.conditions,p))),plan=selectCustomRule(eligible,context,now);
 return plan?{...plan,...(hasPetTarget(plan.rule)?{targetPetNames:pets.filter(p=>petTargetMatches(plan.rule.conditions,p)).map(p=>p.name).join(', ')}:{})}:null;
}
export async function currentTargetNames(client:any,tenantId:string,customerId:string|undefined,rule:{conditions?:PetTarget}){
 if(!hasPetTarget(rule))return undefined;
 if(!customerId)return null;
 const pets=await rulePetFacts(client,tenantId,customerId),matching=pets.filter(p=>petTargetMatches(rule.conditions!,p));
 return matching.length?matching.map(p=>p.name).join(', '):null;
}
export async function validatePetTargets(client:any,tenantId:string,target:PetTarget){
 for(const [key,model] of [['petServiceIds','service'],['petPackageIds','package']] as const){const ids=target[key]||[];if(!ids.length)continue;const rows=await client[model].findMany({where:{tenantId,id:{in:ids},active:true},select:{id:true}});if(ids.some(id=>!rows.some((r:any)=>r.id===id)))throw Error('Choose active services and packages from this business.');}
 const ids=target.petVipPlanIds||[];if(ids.length){const rows=await client.tenantSetting.findMany({where:{tenantId,settingKey:{in:ids.map(id=>'VIP_PLAN:'+id)}},select:{settingKey:true,value:true}});if(ids.some(id=>!rows.some((r:any)=>r.settingKey==='VIP_PLAN:'+id&&r.value?.active)))throw Error('Choose active VIP plans from this business.');}
}
