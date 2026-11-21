const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function mount(){
 let value=null;const effects=[],events=new Map(),timers=new Map();let next=0;
 const surface={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),innerWidth:1200,innerHeight:800};
 const field={closest:()=>null,querySelector:()=>null};
 const target={closest:selector=>selector.startsWith('label,')?field:null};
 const deps={react:{useEffect:fn=>effects.push(fn),useState:()=>[value,v=>value=v]},'react-dom':{createPortal:()=>null},'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'../lib/hint-placement':{sideHintPlacement:()=>({left:400,top:20,width:320,maxHeight:200}),hintTargets:()=>[],targetsBox:()=>({})},'../lib/field-discovery':{describeField:()=>({name:'Owes',help:'Customer balance due',path:'Customer Profile → Account',element:field})}};
 const api={};new Function('require','exports','document','window','setTimeout','clearTimeout','Element',ts.transpileModule(fs.readFileSync('src/components/field-hints.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(key=>deps[key],api,surface,surface,fn=>{timers.set(++next,fn);return next},id=>timers.delete(id),class {});
 api.FieldHints({enabled:true});const cleanup=effects[0]();
 return {hover:()=>events.get('pointerover')({type:'pointerover',target}),event:(name,data={})=>events.get(name)(data),flush:()=>{for(const [id,fn]of timers){timers.delete(id);fn()}},value:()=>value,cleanup,events};
}
test('Escape cancels a delayed hint before it appears',()=>{const h=mount();h.hover();h.event('keydown',{key:'Escape'});h.flush();assert.equal(h.value(),null);h.hover();h.flush();assert.equal(h.value().name,'Owes');h.event('keydown',{key:'Escape'});assert.equal(h.value(),null);h.cleanup();assert.equal(h.events.size,0)});
test('leaving the window cancels delayed hints and hides visible hints',()=>{for(const event of ['pointerout','blur']){const h=mount();h.hover();h.event(event,{relatedTarget:null});h.flush();assert.equal(h.value(),null);h.hover();h.flush();assert.ok(h.value());h.event(event,{relatedTarget:null});assert.equal(h.value(),null);h.cleanup()}});
