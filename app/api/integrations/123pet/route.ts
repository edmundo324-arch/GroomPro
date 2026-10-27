import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession,isPlatformAdmin} from '@/src/lib/platform-access';
import {requestAuthorization} from '@/src/lib/request-authorization';
import {ConnectorConfig,connectorPrefix,newConnector,publicConnector} from '@/src/lib/integrations/123pet/control';
import {enqueueWrite} from '@/src/lib/integrations/123pet/outbox';
import {connectionReview,linkReviewedRecord} from '@/src/lib/integrations/123pet/review';
import {prepareDemoSnapshot,initialSetupStatus} from '@/src/lib/integrations/123pet/initial-setup';
export const runtime='nodejs';
async function handle(r:NextRequest){
 const actor=await platformSession(r);
 if(!actor)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!isPlatformAdmin(actor))return NextResponse.json({error:'Platform Owner or Developer access is required.'},{status:403});
 try{
  if(r.method==='GET'){
   const tenantId=r.nextUrl.searchParams.get('tenantId')||actor.tenantId;
   const rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:connectorPrefix}}});
   const connections=await Promise.all(rows.map(async row=>{const config=row.value as unknown as ConnectorConfig;return {...publicConnector(config),initialSetup:await initialSetupStatus(db,config),...await connectionReview(db,tenantId,config.id)}}));
   return NextResponse.json({connections},{headers:{'Cache-Control':'no-store'}});
  }
  const b=await r.json(),tenantId=String(b.tenantId||actor.tenantId);
  if(!await db.tenant.findUnique({where:{id:tenantId}}))throw Error('Business not found.');
  if(b.action==='CREATE'){
   const {config,token}=newConnector(tenantId,b);
   await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
    const existing=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:connectorPrefix}}});
    if(existing.some(row=>{const c=row.value as any;return !c.revoked&&String(c.server).toLowerCase()===config.server.toLowerCase()&&String(c.database).toLowerCase()===config.database.toLowerCase()}))throw Error('This database already has a connector. Use its existing connection to avoid duplicate records.');
    await tx.tenantSetting.create({data:{tenantId,settingKey:connectorPrefix+config.id,value:config as any}});
    await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actor.user.id,entityType:'TENANT',entityId:config.id,action:'CONNECTOR_CREATED',summary:'Authorized 123Pet '+config.environment.toLowerCase()+' connector; writing disabled.'}});
   });
   return NextResponse.json({connection:publicConnector(config),token},{headers:{'Cache-Control':'no-store'}});
  }
  const id=String(b.id||'');if(!/^[a-f0-9]{32}$/.test(id))throw Error('Choose a connection.');
  const result=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
   const row=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:connectorPrefix+id}}});
   if(!row)throw Error('Connection not found.');
   const config=row.value as unknown as ConnectorConfig;
   if(b.action==='PREPARE_DEMO')return prepareDemoSnapshot(tx,config,actor.user.id);
   if(b.action==='INITIAL_SOURCE'){
    if(config.revoked||config.writeEnabled)throw Error('Disable writes before changing the initial source.');
    if(!['123PET','GROOMPRO_DEMO'].includes(b.source)||b.source==='GROOMPRO_DEMO'&&config.environment!=='TEST')throw Error('GroomPro-first setup requires a Test connection.');
    config.initialSource=b.source;config.readEnabled=b.source==='123PET';
   }
   else if(b.action==='LINK')return linkReviewedRecord(tx,tenantId,id,String(b.recordId||''),String(b.targetId||''),actor.user.id);
   else if(b.action==='QUEUE_WRITE')return enqueueWrite(tx,config,b.command,actor.user.id);
   else if(b.action==='REVOKE'){config.revoked=true;config.readEnabled=false;config.writeEnabled=false;}
   else if(b.action==='READ'&&typeof b.enabled==='boolean'){if(config.revoked)throw Error('Create a new connection to replace a revoked credential.');config.readEnabled=b.enabled;}
   else if(b.action==='WRITE'&&b.enabled===false)config.writeEnabled=false;
   else throw Error('Write activation requires verified operation mappings and test evidence. No 123Pet operation has been approved yet.');
   config.updatedAt=new Date().toISOString();
   await tx.tenantSetting.update({where:{id:row.id},data:{value:config as any}});
   await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actor.user.id,entityType:'TENANT',entityId:id,action:'CONNECTOR_ACCESS_CHANGED',summary:b.action+' '+String(b.enabled??''),details:{readEnabled:config.readEnabled,writeEnabled:config.writeEnabled,revoked:config.revoked}}});
   return publicConnector(config);
  },{timeout:120000});
  return NextResponse.json({connection:result});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
}
export const GET=(r:NextRequest)=>requestAuthorization.run(new Map(),()=>handle(r));
export const POST=(r:NextRequest)=>requestAuthorization.run(new Map(),()=>handle(r));
