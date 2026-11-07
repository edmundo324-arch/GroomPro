require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {calendarWidth,calendarDeviceKind,employeeCalendarPolicy}=require('../src/lib/calendar-preferences.ts'),{ticketWorkspace}=require('../src/lib/pos-layout.ts');
test('touch defaults to 100px, valid saved choices always take priority',()=>{
 assert.equal(calendarWidth(null,true),'100');assert.equal(calendarWidth(null,false),'fit');
 for(const saved of ['fit','100','160','220'])for(const compact of [true,false])assert.equal(calendarWidth(saved,compact),saved);
 assert.equal(calendarWidth('broken',true),'100');
});
test('resizing a mouse-driven browser uses the narrow default instead of the PC default',()=>{
 let width=1280, coarse=false;
 global.window={matchMedia(query){
  const maximum=/max-width:(\d+)px/.exec(query);
  return {matches:maximum?width<=Number(maximum[1]):coarse};
 }};
 try{
  for(const [pixels,touch,kind,defaultWidth] of [
   [1280,false,'pc','fit'], [960,false,'narrow','100'], [700,false,'phone','100'],
   [1100,true,'tablet','100'], [1280,false,'pc','fit']
  ]){
   width=pixels;coarse=touch;
   assert.equal(calendarDeviceKind(),kind);
   assert.equal(employeeCalendarPolicy(null,null,kind).defaultWidth,defaultWidth);
  }
 }finally{delete global.window}
});
test('factory hides redundant Calendar heading and new-ticket button; tenants may enable both',()=>{
 assert.equal(ticketWorkspace(null).showCalendarHeading,false);assert.equal(ticketWorkspace(null).showNewPosTicket,false);
 const value=ticketWorkspace({showNewPosTicket:true,showCalendarHeading:true});assert.equal(value.showNewPosTicket,true);assert.equal(value.showCalendarHeading,true);
});
test('Calendar renders date/search/clear and overflow without the redundant heading or new-ticket button',()=>{
 const {CalendarWorkspace}=require('../src/components/calendar-workspace.tsx');
 const html=renderToStaticMarkup(React.createElement(CalendarWorkspace,{onNewTicket:()=>{},onOpenTicket:()=>{}}));
 for(const label of ['Calendar date','Search calendar','Calendar options','To Whiteboard','Time Block','Clear','Install GroomPro'])assert.ok(html.includes(label),label);
 assert.doesNotMatch(html,/>Refresh</);assert.doesNotMatch(html,/>New POS Ticket</);assert.doesNotMatch(html,/<h1/);
});
test('installed launch uses a stable root without preview tokens and supplies valid PNG icons',()=>{
 const manifest=require('../app/manifest.ts').default();assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');
 for(const size of [192,512]){const icon=manifest.icons.find(i=>i.sizes===`${size}x${size}`),bytes=fs.readFileSync('public'+icon.src);assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
});
