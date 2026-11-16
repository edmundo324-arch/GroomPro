require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
require.cache[require.resolve('../src/lib/db.ts')]={exports:{db:{}}};
const {validateWorkflow,workflowSettings,workflowDefaults}=require('../src/lib/workflow-settings.ts');
test('highlight choices survive workflow validation and remain isolated by business',async()=>{
 const saved=validateWorkflow({...workflowDefaults,hintHighlightColor:'#316ad4'});
 assert.equal(saved.hintHighlightColor,'#316ad4');
 assert.throws(()=>validateWorkflow({...workflowDefaults,hintHighlightColor:'not-a-color'}),/Choose a highlight color/);
 const client={tenantSetting:{findUnique:async({where})=>where.tenantId_settingKey?.tenantId==='business-a'?{value:saved}:null}};
 assert.equal((await workflowSettings('business-a',client)).hintHighlightColor,'#316ad4');
 assert.equal((await workflowSettings('business-b',client)).hintHighlightColor,'#c18b16');
});
