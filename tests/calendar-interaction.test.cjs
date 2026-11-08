const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/calendar-interaction.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,Date});
const {popupPosition,slotMinute,intervalsOverlap}=exportsObject;
test('popup stays beside appointment at both viewport edges',()=>{for(const rect of [{left:5,right:150,top:100},{left:900,right:1020,top:100},{left:400,right:650,top:100}]){const p=popupPosition(rect,1024,768);assert.ok(p.left>=0);assert.ok(p.left+p.width<=1024);assert.ok(p.left>=rect.right||p.left+p.width<=rect.left)}});
test('empty calendar slots snap to five minutes and preserve selected hour',()=>{assert.equal(slotMinute(136,100,480),510);assert.equal(slotMinute(211,100,480),570);assert.equal(slotMinute(10000,0,480),1435);assert.equal(slotMinute(149,100,480,1.6),510)});
test('time blocks include overlap but permit adjacent bookings',()=>{const at=h=>`2026-10-14T${h}:00:00Z`;assert.equal(intervalsOverlap(at('09'),at('10'),at('10'),at('11')),false);assert.equal(intervalsOverlap(at('09'),at('11'),at('10'),at('12')),true)});
test('touching a grip on a narrow card opens on tap, previews on hold, and moves only after dragging',()=>{
 const file=ts.createSourceFile('calendar.tsx',fs.readFileSync('src/components/calendar-workspace.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let handle;
 function find(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='touchHandle')handle=node.getText(file);else ts.forEachChild(node,find)}
 find(file);assert.ok(handle);
 const ticket={id:'narrow-ticket',status:'OPEN'},opened=[],moved=[],ghosts=[];
 const context={touchInput:true,pointerKind:{current:'touch'},touchMove:{current:null},longPressed:{current:false},ignoreClickUntil:{current:0},Date,
  require:()=>({jsx:(_type,props)=>props}),exports:{},clearHold(){},finishTouch(){},setHover(){},
  beginHold(){context.longPressed.current=false},setTouchGhost:ghost=>ghosts.push(ghost),
  openAppointment:(t,explicit)=>opened.push([t.id,explicit]),
  touchDestination:()=>({label:'Lisa',resource:{id:'lisa'},start:new Date(0)}),
  moveToResource:(t,start,r)=>moved.push([t.id,start,r.id]),minutesAt:()=>0,timeLabel:()=> '8:30 AM',
  localInputDate:x=>x,localToInstant:x=>x,timezone:'America/Chicago',window:{innerWidth:400,innerHeight:750}};
 vm.runInNewContext(ts.transpileModule(handle,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 const props=context.touchHandle(ticket),target={closest:()=>({getBoundingClientRect:()=>({top:100})}),setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};
 const pointer=(x=1,y=100)=>({pointerId:1,pointerType:'touch',clientX:x,clientY:y,currentTarget:target,preventDefault(){},stopPropagation(){}});
 props.onPointerDown(pointer());props.onPointerUp(pointer());assert.deepEqual(opened,[['narrow-ticket',true]]);
 props.onPointerDown(pointer());context.longPressed.current=true;props.onPointerUp(pointer());assert.equal(opened.length,1);assert.equal(moved.length,0);
 props.onPointerDown(pointer());props.onPointerMove(pointer(24,125));assert.match(ghosts.at(-1).destination,/Lisa.*8:30 AM/);
 props.onPointerUp(pointer(24,125));assert.deepEqual(moved,[['narrow-ticket',new Date(0),'lisa']]);assert.equal(opened.length,1);
 props.onPointerDown(pointer());props.onPointerCancel(pointer());props.onPointerUp(pointer());assert.equal(opened.length,1);
});
