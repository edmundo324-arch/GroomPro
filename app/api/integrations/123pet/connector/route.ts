import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {fingerprint} from '@/src/lib/import/crypto';
import {readManifest} from '@/src/lib/integrations/123pet/manifest';
import {receiveBatch} from '@/src/lib/integrations/123pet/inbox';
import {receiveTicketBundle} from '@/src/lib/integrations/123pet/tickets';
import {pendingWrites,acknowledgeWrite} from '@/src/lib/integrations/123pet/outbox';
import {ConnectorConfig,connectorPrefix,tokenIdentity,acceptsToken,assertRead,validateSchema,renewLease} from '@/src/lib/integrations/123pet/control';
import {initialSetupStatus,snapshotChunk,demoWriteAuthorization,recordDemoWriteResult} from '@/src/lib/integrations/123pet/initial-setup';
export const runtime='nodejs';
export async function POST(r:NextRequest){
 let stage='AUTH',authenticated:{tenantId:string;id:string}|null=null;
 try{
  const token=r.headers.get('authorization')?.replace(/^Bearer /,'')||'',{tenantId,id}=tokenIdentity(token);
  const reader=r.body?.getReader();if(!reader)throw Error('Missing connector message.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2*1024*1024){await reader.cancel();throw Error('Connector report is too large.');}chunks.push(part.value);}}finally{reader.releaseLock();}
  const b=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const result=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
   const row=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:connectorPrefix+id}}});
   const config=row?.value as unknown as ConnectorConfig;
   if(!row||!acceptsToken(config,token))throw Error('Connector credential is invalid or revoked.');
   authenticated={tenantId,id};
   renewLease(config,String(b.instance||''));
   let batch:any=undefined,manifest:any=undefined,commands:any=undefined;
   if(b.action==='SCHEMA'){
    if(config.revoked)throw Error('Connector is revoked.');const schema=validateSchema(b.schema,config),{capturedAt,...structure}=schema,hash=fingerprint(structure);
    await tx.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId,settingKey:'123PET_SCHEMA:'+id}},create:{tenantId,settingKey:'123PET_SCHEMA:'+id,value:schema},update:{value:schema}});
    if(hash!==config.schemaFingerprint)await tx.auditEntry.create({data:{tenantId,actorType:'SYSTEM',entityType:'TENANT',entityId:id,action:'CONNECTOR_SCHEMA',summary:'Received 123Pet database metadata for mapping review.',details:{fingerprint:hash,columnCount:schema.columns.length}}});
    config.schemaFingerprint=hash;config.status='Schema received; operation mapping review required';
   }else if(b.action==='MANIFEST'||b.action==='BATCH'||b.action==='TICKET_BUNDLE'){
    stage=b.action==='BATCH'?'BATCH:'+String(b.table).replace(/[^A-Za-z0-9_]/g,'').slice(0,64):b.action;
    assertRead(config);
    const saved=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'123PET_SCHEMA:'+id}}});
    if(!saved)throw Error('Inspect the source schema first.');
    if(b.action==='MANIFEST')manifest=readManifest(saved.value);
    else if(b.action==='TICKET_BUNDLE')batch=await receiveTicketBundle(tx,tenantId,id,saved.value,b);
    else batch=await receiveBatch(tx,tenantId,id,saved.value,b);
    config.status='Receiving source records; operational mapping pending';
   }else if(b.action==='INITIAL_SETUP')batch=config.initialSource==='GROOMPRO_DEMO'&&!config.readEnabled?await initialSetupStatus(tx,config):null;
   else if(b.action==='SNAPSHOT_CHUNK')batch=await snapshotChunk(tx,config,String(b.jobId),b.index);
   else if(b.action==='DEMO_AUTHORIZE_CHECK')batch=await demoWriteAuthorization(tx,config,String(b.jobId));
   else if(b.action==='DEMO_WRITE_RESULT')batch=await recordDemoWriteResult(tx,config,b);
   else if(b.action==='POLL_WRITES')commands=await pendingWrites(tx,config);
   else if(b.action==='WRITE_RESULT')await acknowledgeWrite(tx,config,b);
   else if(b.action!=='HEARTBEAT')throw Error('Unsupported connector message.');
   config.lastSeen=new Date().toISOString();
   await tx.tenantSetting.update({where:{id:row.id},data:{value:config as any}});
   return {readEnabled:config.readEnabled,writeEnabled:config.writeEnabled,environment:config.environment,schemaReceived:!!config.schemaFingerprint,status:config.status,manifest,batch,commands};
  },{timeout:30000});
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  const error=e as any,code=String(error.code||error.name||'ERROR').replace(/[^A-Za-z0-9_]/g,'').slice(0,64);
  // Never log a Prisma query or raw exception: it may contain customer fields.
  console.error('123Pet connector rejected',stage,code);
  if(authenticated){const a=authenticated as {tenantId:string;id:string};await db.tenantSetting.upsert({where:{tenantId_settingKey:{tenantId:a.tenantId,settingKey:'123PET_ERROR:'+a.id}},create:{tenantId:a.tenantId,settingKey:'123PET_ERROR:'+a.id,value:{stage,code,at:new Date().toISOString()}},update:{value:{stage,code,at:new Date().toISOString()}}}).catch(()=>{});}
  return NextResponse.json({error:'Connector request rejected. Check its credential, connection permissions and schema report.',stage,code},{status:403});
 }
}
