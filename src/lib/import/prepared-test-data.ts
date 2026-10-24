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
export async function preparedTestData(db:any,tenantId:string,locationId:string,actorId:string,apply=false){
 const bytes=await readFile(join(process.cwd(),'transfer-data','GroomPro-Full-Customer-and-Ticket-History.zip'));
 if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Prepared test-data file does not match the reviewed version.');
 const datasets=(await parseFile('GroomPro-Full-Customer-and-Ticket-History.zip',bytes)).map(d=>({...d,locationId}));
 if(datasets.some(d=>!['CUSTOMER','PET','APPOINTMENT'].includes(d.entity)))throw Error('Unexpected test-data entity.');
 return db.$transaction(async(tx:any)=>{
  const tenants=await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
  if(!tenants.length)throw Error('Business not found.');
  if(!await tx.location.findFirst({where:{id:locationId,tenantId}}))throw Error('Select a location belonging to this business.');
  const plan=await planImport(tx,tenantId,source,datasets,'NEW');
  const issues=[...new Set(plan.issues.map(i=>i.message))];
  const counts=Object.fromEntries(['CUSTOMER','PET','APPOINTMENT'].map(entity=>[entity,{added:plan.plans.filter(p=>p.entity===entity&&p.action==='INSERT').length,existing:plan.plans.filter(p=>p.entity===entity&&p.action==='MATCH').length}]));
  if(!apply||issues.length)return {applied:false,issues,counts};
  for(const p of plan.plans){
   if(p.action==='INSERT'){
    if(p.entity==='APPOINTMENT')await insertAppointment(tx,tenantId,p.targetId!,p.data);
    else await tx[p.entity==='CUSTOMER'?'customer':'pet'].create({data:{...p.data,id:p.targetId,tenantId}});
   }
   // Retain source identifiers without making a plaintext copy of destination records.
   if(p.action==='INSERT'||!p.record)await tx.importRecord.upsert({where:{tenantId_source_entityType_sourceId:{tenantId,source,entityType:p.entity,sourceId:p.sourceId}},create:{tenantId,source,entityType:p.entity,sourceId:p.sourceId,targetId:p.targetId,payload:{preparedFixture:expected}},update:{targetId:p.targetId}});
  }
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actorId,entityType:'TENANT',entityId:tenantId,action:'PREPARED_TEST_DATA',summary:'Loaded prepared fictional customer and ticket history; existing records preserved.',details:{fixture:expected,locationId,counts}}});
  return {applied:true,issues:[],counts};
 },{timeout:240000,maxWait:15000});
}
