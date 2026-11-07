const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/pin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require,Buffer});
const {hashPin,verifyPin,hashPinPrefixes,pinAssignmentError}=exportsObject;
async function record(pin){return {pinHash:await hashPin(pin),pinPrefixHashes:await hashPinPrefixes(pin)}}
test('new PINs need six digits and cannot share their first six',async()=>{
 const original=await record('12345678');
 assert.match(await pinAssignmentError('12345',[original]),/6 to 10/);
 assert.match(await pinAssignmentError('123456',[original]),/first six/);
 assert.match(await pinAssignmentError('12345690',[original]),/first six/);
 for(const pin of ['123457','123458','123459'])assert.equal(await pinAssignmentError(pin,[original]),null);
 assert.equal(await verifyPin('12345678',original.pinHash),true);
 assert.equal(await verifyPin('123456',original.pinHash),false);
});
test('a legacy PIN can still sign in without blocking unrelated assignments',async()=>{
 const old={pinHash:await hashPin('1245'),pinPrefixHashes:null};
 assert.equal(await verifyPin('1245',old.pinHash),true);
 assert.equal(await pinAssignmentError('812345',[old]),null);
});
