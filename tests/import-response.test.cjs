require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {readImportResponse}=require('../src/lib/import/response.ts');
test('import response explains hosting authentication and upload limits without JSON parse errors',async()=>{
 await assert.rejects(readImportResponse(new Response('Unauthorized ',{status:401})),/hosting server denied access/);
 await assert.rejects(readImportResponse(new Response('<html>Too large</html>',{status:413})),/file size/);
 await assert.rejects(readImportResponse(new Response('<html>Gateway timeout</html>',{status:504})),/Check Import history/);
});
test('import response retains application errors and staged datasets',async()=>{
 await assert.rejects(readImportResponse(Response.json({error:'Configure the import encryption key.'},{status:400})),/encryption key/);
 assert.deepEqual(await readImportResponse(Response.json({id:'staged',datasets:[]})),{id:'staged',datasets:[]});
});
