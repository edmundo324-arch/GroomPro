import {packageKey} from './package-display';
export type TipShare={userId:string;amountCents:number};
export function splitTip(amountCents:number,userIds:string[]):TipShare[]{
 if(!Number.isSafeInteger(amountCents)||amountCents<0)throw Error('Enter a valid tip amount.');
 const ids=[...new Set(userIds)].sort();if(!ids.length)throw Error('Assign the employees who worked on this ticket before splitting the tip.');
 const base=Math.floor(amountCents/ids.length),extra=amountCents%ids.length;
 return ids.map((userId,i)=>({userId,amountCents:base+(i<extra?1:0)}));
}
export function validateTipShares(value:unknown,total:number,allowed:Set<string>):TipShare[]{
 if(!Array.isArray(value)||value.length>200)throw Error('Choose the employees receiving this tip.');
 const rows=value.map(r=>({userId:String(r.userId||''),amountCents:r.amountCents}));
 if(new Set(rows.map(r=>r.userId)).size!==rows.length||rows.some(r=>!allowed.has(r.userId)||!Number.isSafeInteger(r.amountCents)||r.amountCents<0))throw Error('Choose each employee once and enter a valid amount.');
 if(rows.reduce((sum,r)=>sum+r.amountCents,0)!==total)throw Error('Assigned tips must add up to the full tip amount.');
 return rows.filter(r=>r.amountCents>0);
}

export function tipTeam(lines:any[],plans:any[]){
 const members=new Map<string,Set<string>>();
 const add=(id:string,role:string)=>{if(!id)return;const roles=members.get(id)||new Set<string>();roles.add(role||'OTHER');members.set(id,roles)};
 for(const line of lines)if(line.assignedUserId)add(line.assignedUserId,line.role);
 for(const plan of plans){
  const matching=lines.filter(l=>(l.petId||l.pet?.id)===plan.petId&&(!plan.packageKey||packageKey(l)===plan.packageKey)&&l.lineType!=='PRODUCT');
  if(!matching.length)continue;
  const role=['GROOM','BATH','DRY','PREP'].find(r=>matching.some(l=>l.role===r))||matching[0].role||'OTHER';
  add(plan.userId,role);
 }
 return [...members].map(([userId,roles])=>({userId,roles:[...roles].sort()}));
}
export function percentageTip(amountCents:number,team:{userId:string;roles:string[]}[],percentages:Record<string,number>):TipShare[]{
 const roles=[...new Set(team.flatMap(t=>t.roles))].sort();
 if(!roles.length)throw Error('Assign employees to the ticket before splitting the tip.');
 if(roles.some(r=>!Number.isFinite(percentages[r])||percentages[r]<0)||Math.abs(roles.reduce((sum,r)=>sum+(percentages[r]||0),0)-100)>0.00001)throw Error('The percentages for roles on this ticket must total 100%. Use Equal Split or enter the amounts manually if the saved roles do not match this team.');
 const portions=roles.map(role=>({role,raw:amountCents*percentages[role]/100}));
 const cents=portions.map(p=>Math.floor(p.raw));let left=amountCents-cents.reduce((a,b)=>a+b,0);
 for(const p of portions.map((p,i)=>({i,remainder:p.raw-cents[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i)){if(left-->0)cents[p.i]++;}
 const shares=new Map<string,number>();
 portions.forEach((p,i)=>{for(const s of splitTip(cents[i],team.filter(t=>t.roles.includes(p.role)).map(t=>t.userId)))shares.set(s.userId,(shares.get(s.userId)||0)+s.amountCents)});
 return [...shares].map(([userId,amountCents])=>({userId,amountCents}));
}
