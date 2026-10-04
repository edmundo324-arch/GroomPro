const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/pin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require,Buffer});
const {hashPin,verifyPin,hashPinPrefixes,pinAssignmentError}=exportsObject;
async function record(pin){return {pinHash:await hashPin(pin),pinPrefixHashes:await hashPinPrefixes(pin)}}
test('PIN rules reject exact and both prefix directions while allowing a later occurrence',async()=>{
 const short=await record('124');assert.equal(await verifyPin('124',short.pinHash),true);
 for(const invalid of ['124','1245','124999'])assert.match(await pinAssignmentError(invalid,[short]),/different starting/);
 for(const valid of ['2124','3124823','23245124'])assert.equal(await pinAssignmentError(valid,[short]),null);
 assert.match(await pinAssignmentError('124',[await record('124999')]),/different starting/);
});
test('legacy hashes require sign-in upgrade; salted prefix records disclose no plaintext',async()=>{
 const old={pinHash:await hashPin('1245'),pinPrefixHashes:null};assert.match(await pinAssignmentError('812',[old]),/sign in once/);
 old.pinPrefixHashes=await hashPinPrefixes('1245');assert.equal(await pinAssignmentError('812',[old]),null);
 assert.equal(old.pinPrefixHashes.length,1);assert.match(old.pinPrefixHashes[0],/^[a-f0-9]{32}:[a-f0-9]{128}$/);
 assert.equal(await verifyPin('12',old.pinHash),false);
});
