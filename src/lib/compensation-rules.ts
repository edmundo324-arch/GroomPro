export type CommissionRule={scope:'SERVICE'|'PRODUCT'|'PACKAGE'|'VIP_FIRST_BILLING';match:string;method:'PERCENT'|'PER_DOG'|'PER_UNIT';amount:number};
export type CompensationRules={hourlyCents:number;participatesInTips:boolean;basePercent:number;tiers:{minimumAverage:number;minimumDaysEmployed:number;percent:number}[];rules:CommissionRule[];approvedPercent?:number};
export const defaultCompensation:CompensationRules={hourlyCents:0,participatesInTips:true,basePercent:0,tiers:[],rules:[]};
export function validateCompensation(input:any):CompensationRules{
 const number=(n:any,max:number)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>max)throw Error('Compensation amounts must be valid nonnegative numbers.');return n};
 if(!input||!Array.isArray(input.tiers)||!Array.isArray(input.rules)||input.tiers.length>20||input.rules.length>100)throw Error('Invalid compensation configuration.');
 return {hourlyCents:Math.round(number(input.hourlyCents,100000)),participatesInTips:!!input.participatesInTips,basePercent:number(input.basePercent,100),
  tiers:input.tiers.map((t:any)=>({minimumAverage:number(t.minimumAverage,1000),minimumDaysEmployed:Math.round(number(t.minimumDaysEmployed,36500)),percent:number(t.percent,100)})).sort((a:any,b:any)=>a.minimumAverage-b.minimumAverage||a.minimumDaysEmployed-b.minimumDaysEmployed),
  rules:input.rules.map((r:any)=>{if(!['SERVICE','PRODUCT','PACKAGE','VIP_FIRST_BILLING'].includes(r.scope)||!['PERCENT','PER_DOG','PER_UNIT'].includes(r.method))throw Error('Invalid compensation rule.');return{scope:r.scope,match:String(r.match||'*').trim().slice(0,191),method:r.method,amount:number(r.amount,r.method==='PERCENT'?100:100000)}}),
  ...(input.approvedPercent===undefined?{}:{approvedPercent:number(input.approvedPercent,100)})};
}
// A worked day with zero dogs still belongs in the denominator. Multiple lines
// for the same dog on a date count once, not once per service or duplicate ticket.
export function groomingAverage(workedDates:string[],visits:{date:string;ticketId:string;petId:string}[],from:string,through:string){
 const days=new Set(workedDates.filter(d=>d>=from&&d<=through));const dogs=new Set<string>();
 for(const visit of visits){if(visit.date<from||visit.date>through)continue;days.add(visit.date);dogs.add(`${visit.date}:${visit.petId}`)}
 return {dogs:dogs.size,workedDays:days.size,average:days.size?dogs.size/days.size:0};
}
export function qualifiedCommission(rules:CompensationRules,average:number,daysEmployed:number,approvalRequired:boolean){
 let qualifiedPercent=rules.basePercent;
 for(const tier of rules.tiers)if(average>=tier.minimumAverage&&daysEmployed>=tier.minimumDaysEmployed)qualifiedPercent=tier.percent;
 const appliedPercent=approvalRequired?(rules.approvedPercent??rules.basePercent):qualifiedPercent;
 return {qualifiedPercent,appliedPercent,approvalPending:approvalRequired&&appliedPercent!==qualifiedPercent};
}
export function calculateCommission(input:{rules:CompensationRules|null;employeeRole:string;exemptRoles:string[];percent:number;scope:CommissionRule['scope'];keys:string[];totalCents:number;quantity:number;hasPet:boolean;legacyPercent?:number|null}){
 if(input.exemptRoles.includes(input.employeeRole))return{commissionPct:0,commissionCents:0};
 if(!input.rules){const percent=input.legacyPercent??0;return{commissionPct:percent,commissionCents:Math.round(input.totalCents*percent/100)}}
 // First specific match wins; wildcard is only a fallback.
 const candidates=input.rules.rules.filter(r=>r.scope===input.scope);
 const rule=candidates.find(r=>r.match!=='*'&&input.keys.includes(r.match))||candidates.find(r=>r.match==='*');
 const percent=rule?.method==='PERCENT'?rule.amount:(input.scope==='SERVICE'||input.scope==='PACKAGE'?input.percent:0);
 if(rule&&rule.method!=='PERCENT')return{commissionPct:null,commissionCents:Math.round(rule.amount*(rule.method==='PER_DOG'?(input.hasPet?1:0):input.quantity))};
 return{commissionPct:percent,commissionCents:Math.round(input.totalCents*percent/100)};
}
