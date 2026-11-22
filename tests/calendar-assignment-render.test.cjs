require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
test('rendered Calendar keeps approved Tuesday and late-finish dogs under staff with Working Only enabled',()=>{
 const fixture={date:new Date(2026,11,29,12),employees:[{id:'g',firstName:'Kandance',lastName:'Krueger',active:true},{id:'b',firstName:'Anton',lastName:'Johnson',active:true}],tickets:[]};
 for(const [id,employee,name,approved] of [['a','g','Tuesday Dog',true],['b','b','Late Finish Dog',true],['c','g','Unapproved Dog',false]])fixture.tickets.push({id,orderNumber:1,locationId:'shop',scheduledStart:'2026-12-29T16:30:00',durationMin:100,timingMode:'CONCURRENT',status:'OPEN',customer:{firstName:'Sample',lastName:'Family'},pets:[{pet:{id,name}}],lines:[{id,petId:id,lineType:'SERVICE',role:'GROOM',description:'Grooming',durationMin:100,quantity:1}],assignments:[],plannedAssignments:[{petId:id,userId:employee,calendarAvailabilityApproved:approved}]});
 let source=fs.readFileSync('src/components/calendar-workspace.tsx','utf8').replace('useState<Employee[]>([])','useState<Employee[]>(fixture.employees)').replace('useState<Ticket[]>([])','useState<Ticket[]>(fixture.tickets)').replace('useState(()=>dayStart(new Date()))','useState(()=>dayStart(fixture.date))').replace('[loading,setLoading]=useState(true)','[loading,setLoading]=useState(false)').replace('[workingOnly,setWorkingOnly]=useState(false)','[workingOnly,setWorkingOnly]=useState(true)');
 const exports={},noop=()=>{},react={...React,useState:v=>[typeof v==='function'?v():v,noop],useEffect:noop,useLayoutEffect:noop,useRef:v=>({current:v}),useMemo:f=>f()};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,fixture,Date,Map,Set,console,require:id=>{
  if(id==='react')return react;if(id==='react/jsx-runtime')return require(id);
  if(id.startsWith('../lib/'))return require(path.resolve('src/lib',id.slice('../lib/'.length)+'.ts'));
  if(id==='./module-view')return {useModuleRefresh:()=>({visible:true,revision:0})};
  if(id==='./floating-editor-window')return {usePreferenceScope:()=> 'test'};
  if(id==='./use-calendar-width')return {useCalendarWidth:()=>['fit',noop]};
  return new Proxy({},{get:()=>()=>null});
 }});
 const html=renderToStaticMarkup(exports.CalendarWorkspace({onNewTicket:noop,onOpenTicket:noop,refreshKey:0}));
 const column=id=>html.split(`data-resource-id="${id}"`)[1]?.split('data-resource-id=')[0]||'';
 assert.match(column('g'),/Tuesday Dog/);assert.doesNotMatch(column('g'),/Unapproved Dog/);
 assert.match(column('b'),/Late Finish Dog/);assert.match(column('unassigned'),/Unapproved Dog/);
 assert.doesNotMatch(column('unassigned'),/Tuesday Dog|Late Finish Dog/);
 if(process.env.CALENDAR_RENDER_OUTPUT)fs.writeFileSync(process.env.CALENDAR_RENDER_OUTPUT,'<!doctype html><html><head><meta charset="utf-8"><style>'+fs.readFileSync('app/globals.css','utf8')+'</style></head><body>'+html+'</body></html>');
});
