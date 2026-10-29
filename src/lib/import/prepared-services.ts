import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const expected='d49df9db687b9aaa4895fa283e448b7dfda874f4b839a269ce2a6feca89b05a8';
const source='GroomPro local service catalog';
const fields=['name','code','description','category','priceCents','durationMin','workflowRole','active','favorite','commissionExemptRoles','commissionPct'] as const;
const norm=(v:any)=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
function comparable(s:any){return JSON.stringify(fields.map(k=>k==='commissionPct'?s[k]==null?null:Number(s[k]):k==='commissionExemptRoles'?s[k]==null?null:[...s[k]].sort():s[k]??null))}
export async function loadPreparedServices(db:any,tenantId:string,actorId:string,apply=false){
 const bytes=await readFile(join(process.cwd(),'transfer-data','GroomPro-Local-Services.json'));
 if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('The prepared service file does not match the reviewed version.');
 const data=JSON.parse(bytes.toString('utf8'));
 if(data.version!==1||!Array.isArray(data.services)||!data.services.length||!Array.isArray(data.categories))throw Error('Invalid prepared service catalog.');
 const ids=new Set<string>();
 for(const s of data.services){
  if(typeof s.id!=='string'||!s.id||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>191)throw Error('Invalid or repeated service identifier.');ids.add(s.id);
  if(!Number.isInteger(s.priceCents)||s.priceCents<0||s.priceCents>2147483647||!Number.isInteger(s.durationMin)||s.durationMin<0||s.durationMin>1440)throw Error('Invalid service price or duration.');
  if(!['PREP','BATH','DRY','GROOM','ADD_ON'].includes(s.workflowRole)||typeof s.active!=='boolean'||typeof s.favorite!=='boolean')throw Error('Invalid service designation.');
 }
 return db.$transaction(async(tx:any)=>{
  const tenant=await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  if(!tenant.length)throw Error('Business not found.');
  const existing=await tx.service.findMany({where:{tenantId}});
  const links=await tx.importRecord.findMany({where:{tenantId,source,entityType:'SERVICE'}});
  const plans:any[]=[],issues:string[]=[];
  for(const s of data.services){
   const link=links.find((r:any)=>r.sourceId===s.id);
   let matches:any[]=[];
   if(link){matches=existing.filter((e:any)=>e.id===link.targetId);if(!matches.length){issues.push('A previously loaded service is missing: '+s.name);continue}}
   else if(s.code){matches=existing.filter((e:any)=>norm(e.code)===norm(s.code));if(!matches.length)matches=existing.filter((e:any)=>!e.code&&norm(e.name)===norm(s.name))}
   else matches=existing.filter((e:any)=>norm(e.name)===norm(s.name));
   if(matches.length>1){const exact=matches.filter(e=>comparable(e)===comparable(s));if(exact.length===1)matches=exact}
   if(matches.length>1){issues.push('More than one existing service matches: '+s.name);continue}
   const match=matches[0];
   if(match&&comparable(match)!==comparable(s)){issues.push('Existing service has different settings and was kept unchanged: '+s.name+(s.code?' ('+s.code+')':''));continue}
   plans.push({source:s,targetId:match?.id||randomUUID(),added:!match});
  }
  const counts={SERVICE:{added:plans.filter(p=>p.added).length,existing:plans.filter(p=>!p.added).length}};
  if(!apply||issues.length)return {applied:false,issues,counts};
  for(const p of plans){
   if(p.added){const values:any=Object.fromEntries(fields.filter(k=>p.source[k]!=null).map(k=>[k,p.source[k]]));await tx.service.create({data:{...values,id:p.targetId,tenantId}})}
   await tx.importRecord.upsert({where:{tenantId_source_entityType_sourceId:{tenantId,source,entityType:'SERVICE',sourceId:p.source.id}},create:{tenantId,source,entityType:'SERVICE',sourceId:p.source.id,targetId:p.targetId,payload:{preparedFixture:expected}},update:{targetId:p.targetId}});
  }
  const settingKey='SERVICE_CATEGORIES';
  const saved=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey}}});
  if(saved&&!Array.isArray(saved.value))throw Error('Existing service categories need review. No services were loaded.');
  const categories=[...(saved?.value||[])];
  for(const c of data.categories)if(!categories.some((x:any)=>norm(x.name)===norm(c.name)))categories.push({name:c.name,active:c.active!==false});
  await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey}},create:{tenantId,settingKey,value:categories},update:{value:categories}});
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actorId,entityType:'TENANT',entityId:tenantId,action:'PREPARED_SERVICES_LOADED',summary:'Loaded the reviewed local service catalog; existing services preserved.',details:{fixture:expected,counts}}});
  return {applied:true,issues:[],counts};
 },{timeout:60000,maxWait:15000});
}
