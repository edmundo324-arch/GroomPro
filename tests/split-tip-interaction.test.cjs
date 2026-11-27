require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function harness(){
 const cells=[],effects=[],deps=[];let index=0,dirty=false,tree,closed=0,saved=0,linked=0,posts=[];
 const data={tipCents:0,status:'OPEN',allocation:{revision:0,shares:[]},employees:[{id:'g',firstName:'Solo',lastName:'Groomer'}],workedUserIds:['g'],team:[{userId:'g',roles:['GROOM']}],rolePercentages:{}};
 const react={useState:initial=>{const i=index++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return [cells[i],v=>{const next=typeof v==='function'?v(cells[i]):v;if(next!==cells[i]){cells[i]=next;dirty=true}}]},useRef:v=>{const i=index++;return cells[i]||(cells[i]={current:v})},useEffect:(fn,values)=>{const i=index++;if(!deps[i]||values.some((v,j)=>v!==deps[i][j])){deps[i]=values;effects.push(fn)}}};
 function CurrencyInput(){}function FloatingEditorWindow(){}
 const api={};new Function('require','exports',ts.transpileModule(fs.readFileSync('src/components/ticket-tips.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>{
 if(id==='react')return react;if(id==='react/jsx-runtime')return require(id);if(id.endsWith('.css'))return {};
 if(id==='../lib/employee-fetch')return {employeeFetch:async(url,options)=>{if(!options)return Response.json(data);const body=JSON.parse(options.body);posts.push(body);return Response.json({tipCents:body.tipCents,allocation:{revision:1,shares:body.shares}})}};
 if(id==='../lib/human-communication')return require('../src/lib/human-communication.ts');
 if(id==='../lib/ticket-tips')return require('../src/lib/ticket-tips.ts');if(id==='./currency-input')return {CurrencyInput};if(id==='./floating-editor-window')return {FloatingEditorWindow};throw Error(id);
 },api);
 const props={ticketId:'t',locationId:'shop',initialTipCents:4000,onTipChange:n=>linked=n,onClose:()=>closed++,onSaved:async n=>saved=n};
 function render(){index=0;dirty=false;tree=api.TicketTips(props);effects.splice(0).forEach(fn=>fn());}
 async function settle(){for(let n=0;n<10;n++){if(!tree||dirty)render();await new Promise(r=>setImmediate(r));if(!dirty&&!effects.length)break}}
 function find(predicate,node=tree){if(!node||typeof node!=='object')return; if(predicate(node))return node;for(const child of [].concat(node.props?.children||[]).flat(Infinity)){const found=find(predicate,child);if(found)return found}}
 return {settle,find,CurrencyInput,props,posts,get closed(){return closed},get saved(){return saved},get linked(){return linked}};
}
test('single worker gets full tip, amount edits link to POS, and Save Tip records and closes',async()=>{const f=harness();await f.settle();let share=f.find(n=>n.type===f.CurrencyInput&&n.props['aria-label']==='Tip for Solo Groomer');assert.equal(share.props.value,'4000');const amount=f.find(n=>n.type===f.CurrencyInput&&!n.props['aria-label']);amount.props.onValueChange('6000');await f.settle();assert.equal(f.linked,6000);share=f.find(n=>n.type===f.CurrencyInput&&n.props['aria-label']);assert.equal(share.props.value,'6000');f.find(n=>n.type==='button'&&n.props.children==='Save Tip').props.onClick();await f.settle();assert.equal(f.posts[0].tipCents,6000);assert.deepEqual(f.posts[0].shares,[{userId:'g',amountCents:6000}]);assert.equal(f.saved,6000);assert.equal(f.closed,1)});
test('changing the quick POS amount updates an already open Split Tip window',async()=>{const f=harness();await f.settle();f.props.initialTipCents=7000;f.find(n=>n.type===f.CurrencyInput&&!n.props['aria-label']).props.onValueChange('5000');await f.settle();assert.equal(f.find(n=>n.type===f.CurrencyInput&&!n.props['aria-label']).props.value,7000)});
