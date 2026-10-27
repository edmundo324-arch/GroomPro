import {convert} from '../../import/fields';
import {fingerprint,seal,unseal} from '../../import/crypto';
import {conflictingFields} from './profiles';
export function catalogData(table:string,row:any):{model:string;data:Record<string,any>}|null{
 const text=(v:any)=>convert(v,{target:'text',kind:'text'});
 if(table==='tblEmployees'){
  const firstName=text(row.fldFirstName)||'',lastName=text(row.fldLastName)||'';
  if(!firstName&&!lastName)throw Error('Missing employee name.');
  return {model:'user',data:{firstName,lastName,displayName:text(row.fldABName),jobTitle:text(row.fldCategory)}};
 }
 if(table!=='tblProductsAndServices')return null;
 if(!['S','P'].includes(row.fldPS))throw Error('Unknown catalog item type.');
 const name=text(row.fldName);if(!name)throw Error('Missing item name.');
 const money=(v:any)=>{const n=convert(v,{target:'price',kind:'money'});if(n===null||Number(n)<0)throw Error('Invalid catalog price.');return n;};
 const active=row.fldInactive===null?{}:{active:convert(row.fldInactive,{target:'active',kind:'inactive'})};
 if(row.fldPS==='S'){
  const durationMin=convert(row.fldDur,{target:'durationMin',kind:'int'});if(durationMin===null||Number(durationMin)<0)throw Error('Invalid duration.');
  return {model:'service',data:{name,code:text(row.fldID),category:text(row.fldCategory),priceCents:money(row.fldRetail),durationMin,...active}};
 }
 const quantity=convert(row.fldStockCount,{target:'quantity',kind:'int'});if(quantity===null)throw Error('Invalid inventory quantity.');
 return {model:'product',data:{name,sku:text(row.fldID),priceCents:money(row.fldRetail),costCents:money(row.fldWholeSale),quantity,...active}};
}
export async function projectCatalog(tx:any,tenantId:string,source:string,table:string,sourceId:string,row:any,previous:any){
 let result;try{result=catalogData(table,row);}catch{return {state:'REVIEW',reason:'Catalog or employee field validation failed.'};}
 if(!result)return null;
 const {model,data}=result,targetId=previous?.targetId||'sync_'+fingerprint([tenantId,source,table,sourceId]).slice(0,40);
 const current=await tx[model].findFirst({where:{tenantId,id:targetId}});
 if(previous?.payload?.mappingOnly)return current?{state:'APPLIED',targetId,mappingOnly:true}:{state:'REVIEW',reason:'The explicitly linked record was removed.',mappingOnly:true};
 const baseline=previous?.payload?.projected?unseal(previous.payload.projected,tenantId):null;
 if(current&&!baseline||!current&&previous?.targetId)return {state:'REVIEW',reason:'Source link requires reconciliation.'};
 if(current){const fields=conflictingFields(current,baseline,data);if(fields.length)return {state:'CONFLICT',reason:'Both systems changed this record.',conflictFields:fields};}
 if(!current){
  if(model==='user'&&await tx.user.findFirst({where:{tenantId,firstName:data.firstName,lastName:data.lastName}}))return {state:'REVIEW',reason:'An employee with this name exists. Explicitly link the employee before importing.'};
  if(model==='product'&&data.sku&&await tx.product.findFirst({where:{tenantId,sku:data.sku}})||model==='service'&&data.code&&await tx.service.findFirst({where:{tenantId,code:data.code}}))return {state:'REVIEW',reason:'The catalog code is already in use. Explicitly link the item.'};
  await tx[model].create({data:{...data,id:targetId,tenantId,...(model==='user'?{active:false,pinHash:'IMPORT_DISABLED',role:'FRONT'}:{})}});
 }else if(Object.keys(data).some(k=>JSON.stringify(current[k]??null)!==JSON.stringify((data as any)[k]??null)))await tx[model].update({where:{id:targetId},data});
 return {state:'APPLIED',targetId,projected:seal(data,tenantId)};
}
