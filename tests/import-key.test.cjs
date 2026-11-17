require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),{createCipheriv,createDecipheriv,randomBytes}=require('node:crypto'),{gzipSync,gunzipSync}=require('node:zlib');
const {seal,unseal}=require('../src/lib/import/crypto.ts');
async function secret(value,fn,alias){
 const values={GROOMPRO_IMPORT_KEY:value,GROOMPRO_IMPORT_SECRET:alias};
 const previous={};
 try{
  for(const [name,value] of Object.entries(values)){
   previous[name]=process.env[name];
   if(value===undefined)delete process.env[name];else process.env[name]=value;
  }
  return await fn();
 }finally{
  for(const [name,value] of Object.entries(previous)){
   if(value===undefined)delete process.env[name];else process.env[name]=value;
  }
 }
}
test('existing short and non-hexadecimal import secrets round-trip protected data',async ()=>{for(const value of ['1234567','Aa7Bb8C','Aa7Bb8Cc9D','private-password','key with spaces!'])(await secret(value,async ()=>{const encrypted=(await seal({notes:'protected customer information'},'tenant-one'));assert.equal(encrypted.includes('protected customer information'),false);assert.deepEqual((await unseal(encrypted,'tenant-one')),{notes:'protected customer information'});(await assert.rejects(async ()=>(await unseal(encrypted,'tenant-two'))));assert.notEqual((await seal({notes:'protected customer information'},'tenant-one')),encrypted);}));});
test('old raw hexadecimal keys remain compatible in both encryption directions',async ()=>(await secret('ab'.repeat(32),async ()=>{const key=Buffer.from(process.env.GROOMPRO_IMPORT_KEY,'hex'),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('tenant'));const body=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify({legacy:true})))),cipher.final()]);const old=[iv,cipher.getAuthTag(),body].map(b=>b.toString('base64')).join('.');assert.deepEqual((await unseal(old,'tenant')),{legacy:true});const [newIv,tag,newBody]=(await seal({new:true},'tenant')).split('.').map(v=>Buffer.from(v,'base64'));const decipher=createDecipheriv('aes-256-gcm',key,newIv);decipher.setAAD(Buffer.from('tenant'));decipher.setAuthTag(tag);assert.deepEqual(JSON.parse(gunzipSync(Buffer.concat([decipher.update(newBody),decipher.final()])).toString()),{new:true});})));
test('missing secrets and different secrets still cannot read protected imports',async ()=>{const encrypted=(await secret('1234567',async ()=>(await seal({private:true},'tenant'))));(await secret('7654321',async ()=>(await assert.rejects(async ()=>(await unseal(encrypted,'tenant'))))));(await secret('1234567',async ()=>assert.deepEqual((await unseal(encrypted,'tenant')),{private:true})));for(const value of [undefined,'','   '])(await secret(value,async ()=>(await assert.rejects(async ()=>(await seal({},'tenant')),/Import storage is unavailable/))));});

test('alternate name reads existing import history when the original is missing or blank',async ()=>{
 const value='Aa7Bb8C';
 const encrypted=(await secret(value,async ()=>(await seal({old:true},'tenant'))));
 for(const unavailable of [undefined,'','   ']){
  (await secret(unavailable,async ()=>assert.deepEqual((await unseal(encrypted,'tenant')),{old:true}),value));
 }
 (await secret(value,async ()=>assert.deepEqual((await unseal(encrypted,'tenant')),{old:true}),'another-secret'));
});
function store(rows=new Map()){
 return {rows,tenantSetting:{
  findUnique:async({where})=>rows.get(where.tenantId_settingKey.tenantId)||null,
  upsert:async({create})=>{if(!rows.has(create.tenantId))rows.set(create.tenantId,{value:create.value});return rows.get(create.tenantId);}
 }};
}
test('new imports automatically protect data, survive restarts and stay tenant isolated',()=>secret(undefined,async()=>{
 const db=store(),data={notes:'private customer notes'};
 const values=await Promise.all(Array.from({length:8},()=>seal(data,'one',db)));
 assert.equal(db.rows.size,1);assert.equal(new Set(values).size,8);
 for(const value of values){assert.ok(value.startsWith('managed.v1.'));assert.equal(value.includes(data.notes),false);assert.deepEqual(await unseal(value,'one',store(db.rows)),data);}
 await seal(data,'two',db);assert.notEqual(db.rows.get('one').value.key,db.rows.get('two').value.key);
 await assert.rejects(()=>unseal(values[0],'two',db));
 await secret('new-environment-secret',async()=>assert.deepEqual(await unseal(values[0],'one',db),data));
 const parts=values[0].split('.');const bytes=Buffer.from(parts[4],'base64');bytes[0]^=1;parts[4]=bytes.toString('base64');
 await assert.rejects(()=>unseal(parts.join('.'),'one',db));
}));
test('missing keys are never recreated when reading; rolled-back keys are not cached',()=>secret(undefined,async()=>{
 const db=store(),old=await seal({a:1},'one',db);db.rows.clear();
 await assert.rejects(()=>unseal(old,'one',db),/database backup/);assert.equal(db.rows.size,0);
 const fresh=await seal({a:2},'one',db);assert.deepEqual(await unseal(fresh,'one',db),{a:2});await assert.rejects(()=>unseal(old,'one',db));
}));
test('older imports explain recovery without blocking new uploads',async()=>{
 const old=await secret('old secret',()=>seal({old:true},'one'));
 await secret(undefined,async()=>{await assert.rejects(()=>unseal(old,'one',store()),/older import/);const db=store();assert.deepEqual(await unseal(await seal({new:true},'one',db),'one',db),{new:true});});
});
test('managed keys cannot be returned or changed by browser business settings',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../app/api/business-settings/route.ts'),'utf8');
 assert.match(source,/NOT:.*settingKey:"IMPORT_ENCRYPTION_KEY"/);
 const allowed=source.match(/const allowed = new Set\(\[([^\]]+)\]/)[1];assert.equal(allowed.includes('IMPORT_ENCRYPTION_KEY'),false);
});
