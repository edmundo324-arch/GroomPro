import {Prisma} from '@prisma/client';
import {sharingScope,customerSharingWhere,sharingKey,sharedLocations} from './customer-sharing-context';
const models=new Map(Prisma.dmmf.datamodel.models.map(m=>[m.name,m]));
const paths=new Map<string,string[]>([['Customer',[]]]);
// Only follow foreign keys towards a customer, never reverse collections or Tenant/User.
for(let pass=0;pass<5;pass++)for(const model of models.values()){
 if(paths.has(model.name)||['Tenant','User','Location'].includes(model.name))continue;
 const relation=model.fields.find(f=>f.kind==='object'&&!f.isList&&f.relationFromFields?.length&&paths.has(f.type));
 if(relation)paths.set(model.name,[relation.name,...paths.get(relation.type)!]);
}
export function sharingWhere(model:string):any{
 const scope=sharingScope.getStore();
 if(model==='PosDraft'&&scope)return {tenantId:scope.tenantId,locationId:{in:scope.locations}};
 if(!scope||!paths.has(model))return null;
 return paths.get(model)!.reduceRight((where,key)=>({[key]:where}),customerSharingWhere());
}
export function scopeQuery(model:string,args:any={}){
 const next={...args},where=sharingWhere(model);
 if(where)next.where={...args.where,AND:[...(args.where?.AND?Array.isArray(args.where.AND)?args.where.AND:[args.where.AND]:[]),where]};
 for(const mode of ['include','select'])if(args[mode]){
  next[mode]={...args[mode]};for(const [key,value] of Object.entries(args[mode])){
   const relation=models.get(model)?.fields.find(f=>f.name===key&&f.kind==='object');
   if(!relation||!value)continue;
   if(relation.isList)next[mode][key]=scopeQuery(relation.type,value===true?{}:value);
   else if(typeof value==='object')next[mode][key]=scopeNested(relation.type,value);
  }
 }
 return next;
}
function scopeNested(model:string,args:any){const scoped=scopeQuery(model,args);delete scoped.where;return scoped;}
export async function checkSharingReferences(client:any,data:any){
 if(!data||typeof data!=='object'||!sharingScope.getStore())return;
 const scope=sharingScope.getStore()!;
 for(const [key,table] of [['membershipId','Membership'],['agreementId','SignedDocument'],['document','SignedDocument']] as const){const id=data[key];if(typeof id==='string'&&id){const rows=await client.$queryRawUnsafe('SELECT customerId FROM `'+table+'` WHERE tenantId = ? AND id = ?',scope.tenantId,id);if(!rows.length)throw Error('This record is unavailable.');await checkSharingReferences(client,{customerId:rows[0].customerId});}}
 for(const [key,value] of Object.entries(data)){
  const linked=({customer:'Customer',pet:'Pet',ticket:'Ticket'} as any)[key];
  if(linked&&value&&typeof value==='object')await checkSharingReferences(client,{[key+'Id']:(value as any).connect?.id||(value as any).id});
  const model=({customerId:'Customer',petId:'Pet',ticketId:'Ticket'} as any)[key];
  if(model&&typeof value==='string'&&value){const delegate=model[0].toLowerCase()+model.slice(1);if(!await client[delegate].findFirst({where:{id:value,...sharingWhere(model)},select:{id:true}}))throw Error('This record is not shared with your shop. Ask a manager to review Settings → Locations & hours → Customer sharing.');}
  if(value&&typeof value==='object')await checkSharingReferences(client,value);
 }
}
export function scopedClient(client:any):any{
 return new Proxy(client,{get(owner,key){
  if((key==='$queryRaw'||key==='$queryRawUnsafe')&&sharingScope.getStore())return async(...args:any[])=>{const result=await owner[key](...args);if(!Array.isArray(result))return result;const allowed:Record<string,Set<string>>={};for(const [field,model] of [['customerId','Customer'],['petId','Pet'],['ticketId','Ticket']]){const ids=[...new Set(result.map((row:any)=>row[field]).filter(Boolean))];if(ids.length){const delegate=model[0].toLowerCase()+model.slice(1);allowed[field]=new Set((await owner[delegate].findMany({where:{id:{in:ids},...sharingWhere(model)},select:{id:true}})).map((row:any)=>row.id));}}return result.filter((row:any)=>Object.entries(allowed).every(([field,ids])=>!row[field]||ids.has(row[field])));};
  if(key==='$transaction')return typeof owner.$transaction==='function'?(work:any,options:any)=>typeof work==='function'?owner.$transaction((tx:any)=>work(scopedClient(tx)),options):owner.$transaction(work,options):undefined;
  const value=Reflect.get(owner,key,owner),model=[...models.keys()].find(name=>name[0].toLowerCase()+name.slice(1)===key);
  if(!model||!sharingScope.getStore())return typeof value==='function'?value.bind(owner):value;
  return new Proxy(value,{get(delegate,method){const fn=delegate[method];if(typeof fn!=='function')return fn;
   return async(args:any={})=>{
    const scope=sharingScope.getStore();if(!scope)return fn.call(delegate,args);
    const operation=String(method),writing=/^(create|update|upsert|delete)/.test(operation);
    if(writing)for(const data of [args.data,args.create,args.update])await checkSharingReferences(owner,data);
    if(model==='Customer'&&operation==='create'){
     const create=async(tx:any)=>{await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${scope.tenantId} FOR UPDATE`;const config=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:scope.tenantId,settingKey:sharingKey}}}))?.value;const locations=config?sharedLocations(config,scope.locationId):scope.locations;if(!locations.length)throw Error('This shop is no longer assigned to a customer-sharing group. Ask a manager to review the groups.');const result=await tx.customer.create({...args,data:{...args.data,locationAccess:{create:locations.map(locationId=>({tenantId:scope.tenantId,locationId}))}},...(args.select?{select:{...args.select,id:true}}:{})});await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId:scope.tenantId,settingKey:'CUSTOMER_HOME_LOCATION:'+result.id}},create:{tenantId:scope.tenantId,settingKey:'CUSTOMER_HOME_LOCATION:'+result.id,value:{locationId:scope.locationId}},update:{}});if(args.select&&!args.select.id)delete result.id;return result};
     return typeof owner.$transaction==='function'?owner.$transaction(create):create(owner);
    }
    if(operation.startsWith('create'))return fn.call(delegate,args);
    const result=await fn.call(delegate,scopeQuery(model,args));
    if(model==='PosDraft'&&operation.startsWith('find')){const permitted=async(row:any)=>{try{await checkSharingReferences(owner,row?.payload);return true}catch{return false}};if(Array.isArray(result)){const decisions=await Promise.all(result.map(permitted));return result.filter((_:any,i:number)=>decisions[i]);}if(result&&!await permitted(result))return null;}
    return result;
   };
  }});
 }});
}
