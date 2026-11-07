require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),{createCipheriv,createDecipheriv,randomBytes}=require('node:crypto'),{gzipSync,gunzipSync}=require('node:zlib');
const {seal,unseal}=require('../src/lib/import/crypto.ts');
function secret(value,fn,alias){
 const values={GROOMPRO_IMPORT_KEY:value,GROOMPRO_IMPORT_SECRET:alias};
 const previous={};
 try{
  for(const [name,value] of Object.entries(values)){
   previous[name]=process.env[name];
   if(value===undefined)delete process.env[name];else process.env[name]=value;
  }
  return fn();
 }finally{
  for(const [name,value] of Object.entries(previous)){
   if(value===undefined)delete process.env[name];else process.env[name]=value;
  }
 }
}
test('existing short and non-hexadecimal import secrets round-trip protected data',()=>{for(const value of ['1234567','Aa7Bb8C','Aa7Bb8Cc9D','private-password','key with spaces!'])secret(value,()=>{const encrypted=seal({notes:'protected customer information'},'tenant-one');assert.equal(encrypted.includes('protected customer information'),false);assert.deepEqual(unseal(encrypted,'tenant-one'),{notes:'protected customer information'});assert.throws(()=>unseal(encrypted,'tenant-two'));assert.notEqual(seal({notes:'protected customer information'},'tenant-one'),encrypted);});});
test('old raw hexadecimal keys remain compatible in both encryption directions',()=>secret('ab'.repeat(32),()=>{const key=Buffer.from(process.env.GROOMPRO_IMPORT_KEY,'hex'),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('tenant'));const body=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify({legacy:true})))),cipher.final()]);const old=[iv,cipher.getAuthTag(),body].map(b=>b.toString('base64')).join('.');assert.deepEqual(unseal(old,'tenant'),{legacy:true});const [newIv,tag,newBody]=seal({new:true},'tenant').split('.').map(v=>Buffer.from(v,'base64'));const decipher=createDecipheriv('aes-256-gcm',key,newIv);decipher.setAAD(Buffer.from('tenant'));decipher.setAuthTag(tag);assert.deepEqual(JSON.parse(gunzipSync(Buffer.concat([decipher.update(newBody),decipher.final()])).toString()),{new:true});}));
test('missing secrets and different secrets still cannot read protected imports',()=>{const encrypted=secret('1234567',()=>seal({private:true},'tenant'));secret('7654321',()=>assert.throws(()=>unseal(encrypted,'tenant')));secret('1234567',()=>assert.deepEqual(unseal(encrypted,'tenant'),{private:true}));for(const value of [undefined,'','   '])secret(value,()=>assert.throws(()=>seal({},'tenant'),/running app did not receive an import secret/));});

test('alternate name reads existing import history when the original is missing or blank',()=>{
 const value='Aa7Bb8C';
 const encrypted=secret(value,()=>seal({old:true},'tenant'));
 for(const unavailable of [undefined,'','   ']){
  secret(unavailable,()=>assert.deepEqual(unseal(encrypted,'tenant'),{old:true}),value);
 }
 secret(value,()=>assert.deepEqual(unseal(encrypted,'tenant'),{old:true}),'another-secret');
});
