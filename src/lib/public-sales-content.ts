export type PublicPlan={name:string;monthlyCents:number;features:string[]};
// Only an explicitly approved public catalog is exposed; never query private tenant settings.
export function publicPlans(value:string|undefined):PublicPlan[]{
 if(!value)return [];
 try{const rows=JSON.parse(value);if(!Array.isArray(rows)||rows.length>12)return [];
  if(rows.some(p=>!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!Number.isSafeInteger(p.monthlyCents)||p.monthlyCents<0||!Array.isArray(p.features)||p.features.length>30||p.features.some((f:unknown)=>typeof f!=='string'||f.length>200)))return [];
  return rows.map(p=>({name:p.name,monthlyCents:p.monthlyCents,features:p.features}));
 }catch{return []}
}
