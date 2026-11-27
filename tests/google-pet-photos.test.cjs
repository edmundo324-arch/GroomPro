const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, dependencies, fetch) {
  const source = fs.readFileSync(require.resolve('../' + file), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  const env = {GOOGLE_PHOTOS_CLIENT_ID:'test', GOOGLE_PHOTOS_CLIENT_SECRET:'fixture secret', GOOGLE_PHOTOS_REDIRECT_URI:'https://example.invalid/callback'};
  new Function('exports','require','fetch','process',js)(exports, id => dependencies[id] ?? require(id), fetch, {env});
  return exports;
}

test('selected photos are imported for only the connected business, employee and dog', async () => {
  const accounts = new Map(), stored = new Map(), attempts = [];
  let actor = 'staff', tenant = 'businessA', failSecond = true;
  const setting = {
    upsert: async ({create}) => accounts.set(create.tenantId,create.value),
    findUnique: async ({where}) => ({value:accounts.get(where.tenantId_settingKey.tenantId)}),
    deleteMany: async ({where}) => accounts.delete(where.tenantId)
  };
  const photo = id => ({id,type:'PHOTO',mediaFile:{filename:id+'.jpg',baseUrl:'https://lh3.googleusercontent.com/'+id}});
  const fetch = async (url,options) => {
    if(url.includes('oauth2.googleapis.com')) {
      if(options.body.get('code'))return Response.json({refresh_token:options.body.get('code'),scope:google.pickerScope});
      assert.equal(options.body.get('refresh_token'),tenant+'-grant');
      return Response.json({access_token:'access'});
    }
    if(url.includes('googleusercontent.com')){
      assert.equal(options.headers.Authorization,'Bearer access');
      if(url.includes('/second') && failSecond){failSecond=false;return new Response(null,{status:503});}
      return new Response(Buffer.from([255,216,255]));
    }
    if(options.method==='DELETE')return new Response(null,{status:204});
    if(url.endsWith('/sessions'))return Response.json({id:'session',pickerUri:'https://photos.google.com/example'});
    if(url.includes('/sessions/'))return Response.json({mediaItemsSet:true});
    if(url.includes('pageToken='))return Response.json({mediaItems:[photo('second')]});
    return Response.json({mediaItems:[photo('first'),{type:'VIDEO'}],nextPageToken:'page2'});
  };
  const google = load('src/lib/google-photos.ts',{'./db':{db:{tenantSetting:setting}}},fetch);
  await google.connect(tenant,tenant+'-grant');
  await google.connect('businessB','businessB-grant');
  assert.throws(()=>google.openProtected('businessB','account',accounts.get(tenant).secret));
  await assert.rejects(()=>google.imageData('https://example.invalid/photo','access'));
  const route=load('app/api/pets/photos/google/route.ts',{
    'next/server':{NextResponse:Response},
    '@/src/lib/google-photos':google,
    '@/src/lib/platform-access':{platformSession:async()=>({tenantId:tenant,user:{id:actor}})},
    '@/src/lib/db':{db:{}},'@/src/lib/request-policy':{withRequestPolicy:fn=>fn},
    '@/src/lib/pet-documents':{petDocumentAccess:async()=>{}},
    '@/src/lib/pet-photos':{savePetPhoto:async(business,employee,item)=>{
      attempts.push(item.id);
      assert.equal(business,'businessA');assert.equal(employee,'staff');assert.equal(item.petId,'guillermo');
      stored.set(item.id,item);
      return item.useAsProfile?{pet:{id:item.petId,pictureUrl:'photo/'+item.id}}:{};
    }}
  },fetch);
  const post=(action,params={})=>route.POST({json:async()=>({petId:'guillermo',date:'2026-11-27',stage:'OTHER',useAsProfile:true,action,...params})});
  const {selection}=await (await post('start')).json();
  assert.ok(selection);
  assert.equal((await post('save',{selection,petId:'bentley'})).status,400);
  actor='another';assert.equal((await post('save',{selection})).status,400);actor='staff';
  tenant='businessB';assert.equal((await post('save',{selection})).status,400);tenant='businessA';
  const partial=await (await post('save',{selection})).json();
  assert.equal(partial.saved,1);
  const done=await (await post('save',{selection})).json();
  assert.equal(done.saved,2);assert.equal(done.pet.id,'guillermo');assert.equal(stored.size,2);
  assert.equal(attempts[0],attempts[1]);
  assert.deepEqual([...stored.values()].map(p=>[p.name,p.useAsProfile]),[['first.jpg',true],['second.jpg',false]]);
  await google.disconnect(tenant);
  assert.equal(accounts.has(tenant),false);assert.ok(accounts.has('businessB'));
});
