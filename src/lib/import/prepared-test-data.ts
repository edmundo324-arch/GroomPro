import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseFile} from './parsers';
import {planImport} from './engine';
import {insertAppointment} from './appointments';
const source='GroomPro Local Demo 2026';
const expected='52d79f0b28915f4c8a58bc2a360366238d9eb0a2fe3590433aac17fe4514aede';
// Only this already-published fictional fixture may use the direct seed path.
// Arbitrary uploaded data still uses the encrypted migration workflow.
export async function preparedTestData(db:any,tenantId:string,locationId:string,actorId:string,apply=false,customersAndPetsOnly=false){
 const bytes=await readFile(join(process.cwd(),'transfer-data','GroomPro-Full-Customer-and-Ticket-History.zip'));
 if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Prepared test-data file does not match the reviewed version.');
 const datasets=(await parseFile('GroomPro-Full-Customer-and-Ticket-History.zip',bytes)).map(d=>({...d,locationId}));
 if(datasets.some(d=>!['CUSTOMER','PET','APPOINTMENT'].includes(d.entity)))throw Error('Unexpected test-data entity.');
 return db.$transaction(async(tx:any)=>{
  const tenants=await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  if(!tenants.length)throw Error('Business not found.');
  if(!await tx.location.findFirst({where:{id:locationId,tenantId}}))throw Error('Select a location belonging to this business.');
  const selected=customersAndPetsOnly?datasets.filter(d=>d.entity!=='APPOINTMENT'):datasets;
  const employees=await tx.user.findMany({where:{tenantId}});
  const norm=(v:any)=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
  const aliases:Record<string,string[]>={
   'Zagla S':['Zagla Saenz'], 'Zagla Maria S':['Zagla Paz'],
   'Lisa A':['Lisa Allen'], 'Kandace Krueger':['Kandance Krueger'],
   'Hailey Pulsey':['Hailey Puly'],
   'Q Kirsten Walker':['Kirsten Walker','Kiersten Walker','Q Kiersten Walker']
  };
  let historicalEmployee:any=null;
  if(!customersAndPetsOnly)for(const d of selected.filter(d=>d.entity==='APPOINTMENT'))for(const row of d.rows){
   const refs=row.EmployeeReferences;
   if(!Array.isArray(refs))throw Error('Prepared employee references are invalid.');
   for(const ref of refs){
    const names=[ref.firstName+' '+ref.lastName,ref.displayName];
    let matches=employees.filter((e:any)=>names.some(n=>norm(n)===norm(e.firstName+' '+e.lastName)||norm(n)===norm(e.displayName)));
    if(!matches.length){const alternatives=aliases[ref.displayName]||[];matches=employees.filter((e:any)=>alternatives.some(n=>norm(n)===norm(e.firstName+' '+e.lastName)||norm(n)===norm(e.displayName)));}
    if(!matches.length&&ref.displayName==='Q Kirsten Walker'){
     historicalEmployee??={id:'hist_'+createHash('sha256').update(tenantId+':prepared:Q Kirsten Walker').digest('hex').slice(0,40),tenantId,locationId,firstName:'Q Kirsten',lastName:'Walker',displayName:'Q Kirsten Walker',jobTitle:'Historical Prep / Bath / FFT',role:'BACK',active:false,pinHash:'IMPORT_DISABLED'};
     matches=[historicalEmployee];
    }
    if(matches.length>1)throw Error('More than one employee matches '+ref.displayName+'.');
    if(matches.length===1){ref.firstName=matches[0].firstName;ref.lastName=matches[0].lastName;ref.displayName=matches[0].displayName;}
   }
  }
  // Preview resolves the proposed inactive identity without writing any records.
  const planner=historicalEmployee?new Proxy(tx,{get(target,key){if(key==='user')return {findMany:async()=>[...employees,historicalEmployee]};return target[key];}}):tx;
  const plan=await planImport(planner,tenantId,source,selected,'NEW');
  const issues=[...new Set(plan.issues.map(i=>i.message))];
  const counts=Object.fromEntries(['CUSTOMER','PET','APPOINTMENT'].map(entity=>[entity,{added:plan.plans.filter(p=>p.entity===entity&&p.action==='INSERT').length,existing:plan.plans.filter(p=>p.entity===entity&&p.action==='MATCH').length}]));
  if(!apply||issues.length)return {applied:false,issues,counts};
  if(historicalEmployee)await tx.user.create({data:historicalEmployee});
  for(const p of plan.plans){
   if(p.action==='INSERT'){
    if(p.entity==='APPOINTMENT')await insertAppointment(tx,tenantId,p.targetId!,p.data);
    else await tx[p.entity==='CUSTOMER'?'customer':'pet'].create({data:{...p.data,id:p.targetId,tenantId}});
   }
   // Retain source identifiers without making a plaintext copy of destination records.
   if(p.action==='INSERT'||!p.record)await tx.importRecord.upsert({where:{tenantId_source_entityType_sourceId:{tenantId,source,entityType:p.entity,sourceId:p.sourceId}},create:{tenantId,source,entityType:p.entity,sourceId:p.sourceId,targetId:p.targetId,payload:{preparedFixture:expected}},update:{targetId:p.targetId}});
  }
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actorId,entityType:'TENANT',entityId:tenantId,action:'PREPARED_TEST_DATA',summary:'Loaded prepared fictional customer and ticket history; existing records preserved.',details:{fixture:expected,locationId,counts,historicalEmployeeId:historicalEmployee?.id||null}}});
  return {applied:true,issues:[],counts};
 },{timeout:240000,maxWait:15000});
}
