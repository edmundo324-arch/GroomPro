require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,testSite){const out={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='./site-deployment'?{isTestSite:()=>testSite}:id==='node:crypto'?require(id):{db:{tenantSetting:{findUnique:()=>{throw Error('Unexpected database lookup')}}}},out);return out;}
test('separate testing sites cannot use even explicitly configured message credentials',async()=>{
 const original=process.env.GROOMPRO_TEST_SEND_CONFIG;process.env.GROOMPRO_TEST_SEND_CONFIG=JSON.stringify({home:{apiKey:'test-only'}});
 try{assert.equal(await load('src/lib/message-provider-connection.ts',true).messageProviderConnection('GROOMPRO_TEST_SEND_CONFIG','home'),null);assert.deepEqual(await load('src/lib/message-provider-connection.ts',false).messageProviderConnection('GROOMPRO_TEST_SEND_CONFIG','home'),{apiKey:'test-only'});}finally{if(original===undefined)delete process.env.GROOMPRO_TEST_SEND_CONFIG;else process.env.GROOMPRO_TEST_SEND_CONFIG=original;}
});
test('separate testing sites reject charges before contacting a provider',async()=>{
 const result=await load('src/lib/clover-payments.ts',true).chargeCloverToken({source:'test',amountCents:100});assert.equal(result.ok,false);assert.match(result.message,/disabled/);
});
