const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');require('./load-ts.cjs');
const {newCustomerPhones}=require('../src/lib/new-customer-phones.ts');
test('new customers require a valid phone, including when using the contacts form',()=>{
 for(const input of [{},{phones:[]},{phones:[{number:''}]},{phone:'123'}])assert.throws(()=>newCustomerPhones(input),/phone/i);
 assert.equal(newCustomerPhones({phone:'(555) 555-0100'})[0].number,'(555) 555-0100');assert.equal(newCustomerPhones({phones:[{number:''},{number:'5555550100'}]}).length,1);
 assert.throws(()=>newCustomerPhones({phones:[{number:'5555550100'},{number:'(555) 555-0100'}]}),/once/);
});
test('customer identity lookup uses every normalized phone, not name or email',async()=>{
 let query;const exports={};const dependencies={'./db':{db:{customer:{findFirst:async q=>{query=q;return {id:'existing'}}}}},'./phone-normalization':require('../src/lib/phone-normalization.ts')};
 const js=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/customer.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',js)(k=>dependencies[k]||{},exports);
 assert.equal((await exports.findPossibleDuplicateCustomer('tenant',{firstName:'Same',lastName:'Name',email:'same@example.invalid',phones:['(555) 555-0100','5555550101']})).id,'existing');
 assert.deepEqual(query.where,{tenantId:'tenant',phones:{some:{tenantId:'tenant',normalized:{in:['5555550100','5555550101']}}}});assert.equal(query.where.active,undefined);
});
