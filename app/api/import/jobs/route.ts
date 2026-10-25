import {withRequestPolicy} from '@/src/lib/request-policy';
import {requestLocation} from '@/src/lib/request-location';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {getActiveEmployeeSession} from '@/src/lib/employee-session';
import {parseFile} from '@/src/lib/import/parsers';
import {Dataset} from '@/src/lib/import/fields';
import {fingerprint,seal,unseal} from '@/src/lib/import/crypto';
import {planImport,publicReport,executeImport,rollbackImport} from '@/src/lib/import/engine';
export const runtime='nodejs';
async function access(r:NextRequest){const tenantId=r.headers.get('x-tenant-id')||r.cookies.get('groompro_tenant')?.value||process.env.GROOMPRO_DEV_TENANT_ID||'',sid=r.cookies.get('groompro_session')?.value;const session=tenantId&&sid?await getActiveEmployeeSession(tenantId,sid):null;return {tenantId,session};}
async function handlePolicyGET(r:NextRequest){const {tenantId,session}=await access(r);if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});if(!['DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'Manager access required.'},{status:403});const id=r.nextUrl.searchParams.get('id');if(!id)return NextResponse.json({jobs:await db.importJob.findMany({where:{tenantId},select:{id:true,source:true,status:true,mode:true,createdAt:true,completedAt:true},orderBy:{createdAt:'desc'},take:100})});const job=await db.importJob.findFirst({where:{id,tenantId}});if(!job)return NextResponse.json({error:'Import not found.'},{status:404});const datasets=unseal(job.encryptedData,tenantId) as Dataset[];return NextResponse.json({id:job.id,source:job.source,mode:job.mode,status:job.status,report:job.report,datasets:datasets.map(d=>({...d,rows:undefined,sourceCells:undefined,rowCount:d.rows.length}))});}
async function handlePolicyPOST(r:NextRequest){
 const {tenantId,session}=await access(r);if(!session)return NextResponse.json({error:'Employee PIN is required.'},{status:401});if(!['DEVELOPER','ADMIN','MANAGER'].includes(session.user.role))return NextResponse.json({error:'Manager access required.'},{status:403});
 try{
 if(r.headers.get('content-type')?.includes('multipart/form-data')){const form=await r.formData(),files=form.getAll('files') as File[];if(!files.length||files.length>30||files.reduce((n,f)=>n+f.size,0)>40*1024*1024)throw Error('Upload up to 30 files totaling 40 MB.');const datasets=(await Promise.all(files.map(async f=>parseFile(f.name,new Uint8Array(await f.arrayBuffer()))))).flat();
 // Parsing is read-only. Sensitive fields are masked in the preview, while originals stay encrypted server-side.
 const job=await db.importJob.create({data:{tenantId,source:'123Pet',encryptedData:seal(datasets,tenantId),report:{},fingerprint:fingerprint(datasets),createdBy:session.user.id}});
 return NextResponse.json({id:job.id,datasets:datasets.map(d=>({...d,rows:undefined,sourceCells:undefined,rowCount:d.rows.length})),message:'Staged only. No customer, pet, employee or service records have changed.'});}
 const b=await r.json(),id=String(b.id||''),job=await db.importJob.findFirst({where:{id,tenantId}});if(!job)throw Error('Import not found.');
 if(b.action==='ROLLBACK')return NextResponse.json(await rollbackImport(db,tenantId,id));
 if(b.action==='EXECUTE'){const report=await executeImport(db,tenantId,id);return NextResponse.json({id,status:'COMPLETED',report});}
 if(b.action==='VALIDATE'){
 if(job.status==='COMPLETED')throw Error('Create a new staged job to reimport a completed migration.');
 const source=String(b.source||'').trim();if(!source||source.length>191)throw Error('Source namespace must contain 1-191 characters. Keep it unchanged for reimports.');
 const locationId=await requestLocation(r,tenantId);
 const stored=unseal(job.encryptedData,tenantId) as Dataset[];const datasets=stored.map(d=>{const choice=b.datasets?.find((x:any)=>x.name===d.name);if(!choice)return {...d,locationId:locationId||undefined};return {...d,locationId:locationId||undefined,entity:choice.entity,mapping:choice.mapping,idColumn:choice.idColumn,matches:choice.matches,dateFormat:choice.dateFormat,sourceTimezone:choice.sourceTimezone,selected:choice.selected!==false};});
 const plan=await planImport(db,tenantId,source,datasets.filter(d=>d.selected!==false),b.mode),report=publicReport(plan),status=plan.issues.length?'NEEDS_REVIEW':'VALIDATED';
 // Keep all uploaded datasets in staging; only selected datasets are committed in the execution envelope.
 await db.importJob.update({where:{id},data:{source,mode:b.mode,status,encryptedData:seal(datasets,tenantId),fingerprint:fingerprint(report),report:report as any}});
 return NextResponse.json({id,status,report});}
 if(b.action==='SOURCE'){const datasets=unseal(job.encryptedData,tenantId) as Dataset[];const dataset=datasets.find(d=>d.name===b.dataset);if(!dataset)throw Error('Dataset not found.');const row=dataset.rows[Number(b.row)-2];if(!row)throw Error('Record not found.');const {sensitive}=await import('@/src/lib/import/fields');return NextResponse.json({values:Object.fromEntries(Object.entries(row).map(([k,v])=>[k,(sensitive(k)||dataset.mapping[k]==='SECURE')?'[protected; retained encrypted]':v]))});}
 throw Error('Unknown import action.');
 }catch(e){const message=(e as Error).message;return NextResponse.json({error:(/Prisma|Invalid .*invocation|Foreign key|Transaction|Unique constraint/.test(message))?'Import could not commit. No operational changes were committed; validate and retry.':message},{status:400});}
}

export const GET=withRequestPolicy(handlePolicyGET, {});
export const POST=withRequestPolicy(handlePolicyPOST, {});
