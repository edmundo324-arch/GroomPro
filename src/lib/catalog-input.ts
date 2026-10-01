export type CatalogKind="services"|"products"|"packages"|"plans";
export function catalogInput(body:any){
 if(!["services","products","packages","plans"].includes(body.kind))throw new Error("Choose a catalog type.");
 const kind=body.kind as CatalogKind,name=String(body.name||"").trim();if(!name||name.length>191)throw new Error("Name must contain 1–191 characters.");
 const integer=(value:any,label:string,max=2147483647)=>{if(typeof value!=="number"||!Number.isInteger(value)||value<0||value>max)throw new Error(`${label} must be a valid non-negative whole number.`);return value};
 if(String(body.defaultForBreeds||"").length>191)throw new Error("Breed defaults may contain up to 191 characters.");
 const priceCents=integer(body.priceCents,"Price");
 const durationMin=kind==="services"?integer(body.durationMin,"Duration",1440):30;if(kind==="services"&&durationMin<5)throw new Error("Service duration must be at least 5 minutes.");
 const commissionPct=body.commissionPct===null||body.commissionPct===undefined?null:Number(body.commissionPct);
 if(commissionPct!==null&&(!Number.isFinite(commissionPct)||commissionPct<0||commissionPct>100))throw new Error("Commission must be between 0 and 100 percent.");
 const items:Array<{serviceId:string;quantity:number;role:string}>=(kind==="packages"||kind==="plans")?(Array.isArray(body.items)?body.items:[]).map((i:any)=>({serviceId:String(i.serviceId||""),quantity:integer(i.quantity,"Service quantity",1000),role:String(i.role||"ADD_ON")})):[];
 if((kind==="packages"||kind==="plans")&&(!items.length||items.some(i=>!i.serviceId||!i.quantity||!["PREP","BATH","GROOM","ADD_ON"].includes(i.role))||new Set(items.map(i=>i.serviceId)).size!==items.length))throw new Error("Select at least one service with a positive quantity; each service can appear once.");
 if(typeof body.active!=="boolean")throw new Error("Choose whether this item is active.");
 const billingDay=kind==="plans"?integer(Number(body.billingDay??1),"Billing day",28):1;const billingDaySecond=body.billingDaySecond?integer(Number(body.billingDaySecond),"Second billing day",28):null;if(kind==="plans"&&(!billingDay||billingDaySecond===billingDay))throw new Error("Choose distinct billing dates from 1 through 28.");
 return{defaultForBreeds:body.defaultForBreeds===undefined?undefined:String(body.defaultForBreeds||"").trim()||null,billingDay,billingDaySecond,kind,name,description:String(body.description||"").trim()||null,active:body.active,priceCents,durationMin,commissionPct,category:String(body.category||"").trim()||null,sku:String(body.sku||"").trim()||null,quantity:kind==="products"?integer(body.quantity,"Stock quantity"):0,costCents:kind==="products"?integer(body.costCents,"Cost"):0,items};
}

