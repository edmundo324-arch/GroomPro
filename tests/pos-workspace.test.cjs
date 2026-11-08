require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {ticketLayout,ticketWorkspace,ticketControls,ticketTabs,ticketBottomControls,relocateControl,relocateBottom}=require('../src/lib/pos-layout.ts');
const {dogTicketTotals,defaultTicketTax}=require('../src/lib/dog-ticket-summary.ts');
const {validatePlannedPackages,plannedCalendarCard,plannedFor}=require('../src/lib/planned-package-rules.ts');
const {packageKey}=require('../src/lib/package-display.ts');
const {PosItems}=require('../src/components/pos-items.tsx');
test('compact POS header shows a ticket number and accessible icon controls',()=>{
 const {PosTicketLabel,PosHeaderMenu}=require('../src/components/pos-ticket-header.tsx');
 const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
 const compact=render(PosTicketLabel,{number:476,compact:true});
 assert.match(compact,/<svg/);assert.match(compact,/#476/);
 assert.match(render(PosTicketLabel,{number:476}),/POS Ticket.*#476/);
 const actions=render(PosHeaderMenu,{onDetails:()=>{},onCall:()=>{}});
 assert.match(actions,/aria-label="Ticket actions"/);assert.match(actions,/>⋯<\/button>/);assert.doesNotMatch(actions,/>Details</);
 const record=fs.readFileSync('src/components/pos-ticket-record.tsx','utf8');
 assert.match(record,/\{!phone&&ticketTabsControl\}[\s\S]*?<PromotingServices[\s\S]*?\{phone&&ticketTabsControl\}/);
});
const lines=[{id:'c1',petId:'coco',packageId:'p',packageName:'Existing actual package',packageGroupKey:'coco:p',description:'Existing actual package · Prep',role:'PREP',totalCents:2666,unitPriceCents:2666,quantity:1,durationMin:30},{id:'c2',petId:'coco',packageId:'p',packageName:'Existing actual package',packageGroupKey:'coco:p',description:'Existing actual package · Bath',role:'BATH',totalCents:2666,unitPriceCents:2666,quantity:1,durationMin:30},{id:'c3',petId:'coco',packageId:'p',packageName:'Existing actual package',packageGroupKey:'coco:p',description:'Existing actual package · Groom',role:'GROOM',totalCents:2668,unitPriceCents:2668,quantity:1,durationMin:100},{id:'c-extra',petId:'coco',description:'Massage',role:'ADD_ON',totalCents:1800,unitPriceCents:1800,quantity:1},{id:'f',petId:'fluffy',packageId:'f',packageName:'Other actual package',description:'Bath',role:'BATH',totalCents:8800,unitPriceCents:8800,quantity:1}];
test('factory tabs use the approved order and malformed layouts never remove or repeat controls',()=>{const s=ticketWorkspace({desktop:{rows:[['date','date','bad'],[],[]],bottomRows:[['save','save'],[],[]],tabs:['Notes','bad','Notes'],fontSize:500}});assert.deepEqual(ticketWorkspace(null).desktop.tabs,ticketTabs);assert.equal(s.desktop.rows.flat().length,Object.keys(ticketControls).length);assert.equal(new Set(s.desktop.rows.flat()).size,Object.keys(ticketControls).length);assert.equal(s.desktop.bottomRows.flat().length,Object.keys(ticketBottomControls).length);assert.equal(s.desktop.fontSize,18);assert.equal(s.desktop.tabs.length,ticketTabs.length);assert.equal(s.taxRatePct,8.25);});
test('desktop and phone placement stay independent and moving controls preserves every action',()=>{const source=ticketWorkspace(null),moved=relocateControl(source.desktop,'date',2,0);assert.equal(moved.rows[2][0],'date');assert.equal(source.phone.rows[0][0],'date');assert.equal(moved.rows.flat().filter(k=>k==='date').length,1);const bottom=relocateBottom(moved,'recordPayment',0,0);assert.equal(bottom.bottomRows[0][0],'recordPayment');assert.equal(bottom.bottomRows.flat().length,10);});
test('dog headings allocate the actual ticket tax without changing lines, tip or money owed',()=>{const before=JSON.stringify(lines),result=dogTicketTotals(lines,1535);assert.equal(result.coco.subtotalCents,9800);assert.equal(result.coco.totalCents,10609);assert.equal(result.fluffy.subtotalCents,8800);assert.equal(result.fluffy.totalCents,9526);assert.equal(result.coco.totalCents+result.fluffy.totalCents,18600+1535);assert.equal(JSON.stringify(lines),before);const pennies=dogTicketTotals([{petId:'a',totalCents:1},{petId:'b',totalCents:1},{totalCents:1}],2);assert.equal(Object.values(pennies).reduce((n,v)=>n+v.totalCents-v.subtotalCents,0),2);assert.equal(defaultTicketTax(lines,8.25),1535);assert.equal(defaultTicketTax([{totalCents:1000,service:{taxConfiguration:{taxable:false}}}],8.25),0);});
test('assignments are dog-specific, optionally package-specific, and explicit Assign later does not inherit a groomer',()=>{const base=[{petId:'coco',userId:null}];assert.equal(plannedFor(lines,base,'coco',packageKey(lines[0]),'old-groomer'),'');assert.equal(plannedFor(lines,base,'fluffy',packageKey(lines[4]),'old-groomer'),'old-groomer');assert.throws(()=>validatePlannedPackages([{petId:'someone-else',userId:'employee'}],['coco'],lines,false));assert.throws(()=>validatePlannedPackages([{petId:'coco',packageKey:'other-package',userId:'employee'}],['coco'],lines,true));assert.deepEqual(validatePlannedPackages([{petId:'coco',packageKey:packageKey(lines[0]),userId:'employee'}],['coco'],lines,false),[{petId:'coco',userId:'employee'}]);});
test('one appointment projects only the right dogs on each Calendar column without touching actual employees',()=>{const ticket={pets:[{pet:{id:'coco'}},{pet:{id:'fluffy'}}],lines,assignments:[],plannedAssignments:[{petId:'coco',userId:'bather-3'},{petId:'fluffy',userId:'groomer-1'}]},original=JSON.stringify(ticket),active=new Set(['bather-3','groomer-1']);const coco=plannedCalendarCard(ticket,'bather-3',active),fluffy=plannedCalendarCard(ticket,'groomer-1',active);assert.deepEqual(coco.pets.map(p=>p.pet.id),['coco']);assert.equal(coco.lines.length,4);assert.deepEqual(fluffy.pets.map(p=>p.pet.id),['fluffy']);assert.equal(plannedCalendarCard(ticket,'unassigned',active),null);assert.equal(JSON.stringify(ticket),original);const away=plannedCalendarCard(ticket,'unassigned',new Set(['groomer-1']));assert.deepEqual(away.pets.map(p=>p.pet.id),['coco']);});
test('checked-in actual work overrides planned Calendar placement while actual lines stay unchanged',()=>{const ticket={checkedInAt:'2026-10-30',pets:[{pet:{id:'coco'}}],lines:[{...lines[2],assignedUserId:'actual-groomer'}],assignments:[],plannedAssignments:[{petId:'coco',userId:'planned-groomer'}]};assert.ok(plannedCalendarCard(ticket,'actual-groomer',new Set(['actual-groomer','planned-groomer'])));assert.equal(plannedCalendarCard(ticket,'planned-groomer',new Set(['actual-groomer','planned-groomer'])),null);});
test('rendered package summaries preserve all editable line controls and phone Show buttons',()=>{const html=renderToStaticMarkup(React.createElement(PosItems,{lines,pets:[{id:'coco',name:'Coco'},{id:'fluffy',name:'Fluffy'}],employees:[{id:'b',firstName:'Bather',lastName:'Three',active:true}],catalog:{services:[]},disabled:false,selectedPet:'coco',salesTaxCents:1535,onAdd:()=>{},onEdit:()=>{},onRemove:()=>{},onPet:()=>{},onPlan:()=>{}}));assert.match(html,/Coco — Existing actual package/);assert.match(html,/\$98\.00 \/ \$106\.09/);for(const name of ['Employee for','Minutes for','Quantity for','Remove','Planned employee for'])assert.ok(html.includes(name),name);assert.equal((html.match(/>Show<\/button>/g)||[]).length,2);assert.doesNotMatch(html,/Small Groom/);assert.equal((html.match(/aria-label="Employee for/g)||[]).length,lines.length);});
test('three-month calendar handles leap years and renders date navigation separately from booking actions',()=>{const {calendarMonth,CalendarSidebar}=require('../src/components/calendar-sidebar.tsx');const feb=calendarMonth(new Date(2028,1,10),0);assert.equal(feb.cells.filter(Boolean).length,29);const html=renderToStaticMarkup(React.createElement(CalendarSidebar,{date:new Date(2026,9,30),settings:ticketWorkspace(null),onDate:()=>{},onFilters:()=>{},onSearch:()=>{},onWhiteboard:()=>{}}));assert.match(html,/October 2026/);assert.match(html,/November 2026/);assert.match(html,/December 2026/);assert.match(html,/Collapse Calendar sidebar/);assert.match(html,/View October 30, 2026/);});

test('dog tax displays respect known exempt items without inventing extra charges',()=>{const result=dogTicketTotals([{petId:'exempt',totalCents:1000,service:{taxConfiguration:{taxable:false}}},{petId:'taxable',totalCents:1000}],83);assert.equal(result.exempt.totalCents,1000);assert.equal(result.taxable.totalCents,1083);});

test('adding another dog to a planned appointment leaves that dog unassigned until explicitly chosen',()=>{const t={pets:[{pet:{id:'old'}},{pet:{id:'new'}}],lines:[{petId:'old',description:'Groom'},{petId:'new',description:'Bath'}],assignments:[{user:{id:'groomer'},role:'GROOMER'}],plannedAssignments:[{petId:'old',userId:'groomer'}]};assert.deepEqual(plannedCalendarCard(t,'unassigned',new Set(['groomer'])).pets.map(p=>p.pet.id),['new']);});

test('a schedule exception moves the planned dog to Unassigned without clearing the saved plan',()=>{
 const ticket={pets:[{pet:{id:'coco'}}],lines:[lines[0]],assignments:[],plannedAssignments:[{petId:'coco',userId:'employee'}]},active=new Set(['employee']);
 assert.equal(plannedCalendarCard(ticket,'employee',active,()=>false),null);
 assert.equal(plannedCalendarCard(ticket,'unassigned',active,()=>false).pets[0].pet.id,'coco');
 assert.equal(plannedCalendarCard(ticket,'employee',active,()=>true).pets[0].pet.id,'coco');
 assert.equal(ticket.plannedAssignments[0].userId,'employee');
});
test('coverage distinguishes groomers, wash-qualified bathers and bathers who can do FFT',()=>{
 const {coverageQualified}=require('../src/lib/calendar-coverage.ts');
 const groomer={role:'GROOMER',jobTitle:'Groom'},wash={role:'BACK',jobTitle:'Bath'},fft={role:'BACK',jobTitle:'Bath, FFT'};
 for(const type of ['GR','GR/FFT VIP']){assert.equal(coverageQualified(groomer,type),true);assert.equal(coverageQualified(fft,type),false)}
 for(const type of ['FW','FW VIP'])assert.equal(coverageQualified(wash,type),true);
 assert.equal(coverageQualified(wash,'FFT'),false);assert.equal(coverageQualified(fft,'FFT'),true);
});

test('the paper ticket shows pet icons and inline service types without repeating the planned label',()=>{
 const {PosPetStrip}=require('../src/components/pos-pet-strip.tsx');
 const {PosCustomerTitle,PosVisitStamps}=require('../src/components/pos-ticket-header.tsx');
 const noop=()=>{},pets=[{id:'coco',name:'Coco',vipMember:true},{id:'fluffy',name:'Fluffy',vipEligible:true,careFlags:{vipConversationAt:true}}];
 const strip=renderToStaticMarkup(React.createElement(PosPetStrip,{pets,indicators:ticketWorkspace(null).petIndicators,packageIds:[],summaries:{},onPackage:noop,onNotes:noop}));
 assert.doesNotMatch(strip,/>Pets \(2\)/);assert.match(strip,/Coco: VIP member/);assert.match(strip,/Fluffy: VIP conversation recorded/);
 const items=renderToStaticMarkup(React.createElement(PosItems,{lines,pets,employees:[],catalog:{},selectedPet:'coco',serviceTypeControl:()=>React.createElement('button',null,'GR'),onAdd:noop,onEdit:noop,onRemove:noop,onPet:noop,onPlan:noop}));
 assert.match(items,/Existing actual package<\/strong><span class="gp-dog-service-type"/);
 assert.doesNotMatch(items,/>Planned employee</);assert.match(items,/aria-label="Planned employee for Coco"/);
 const header=renderToStaticMarkup(React.createElement(PosCustomerTitle,{name:'Betty Smith',onEdit:noop,onReplace:noop}));
 assert.match(header,/Edit customer Betty Smith/);assert.match(header,/Replace customer/);assert.equal((header.match(/<svg /g)||[]).length,2);
 const stamps=renderToStaticMarkup(React.createElement(PosVisitStamps,{timezone:'America/Chicago',completed:'2026-11-09T15:00:00Z',contactNeeded:true}));
 for(const label of ['Checked in','Completed','Called','Texted'])assert.ok(stamps.includes(`aria-label="${label}"`));
 assert.match(stamps,/<time dateTime="2026-11-09T15:00:00Z"/);assert.match(stamps,/Call and text/);
});
test('toolbar fitting reserves required tabs and moves extras as room changes',()=>{
 const {fittingTabs}=require('../src/lib/fitting-tabs.ts');
 const tabs=['Items','Rebook','History','Notes','VIP'],widths=new Map(tabs.map(tab=>[tab,50]));
 assert.deepEqual(fittingTabs(tabs,['Items','Rebook','Notes'],widths,199,32),['Items','Rebook','Notes']);
 assert.deepEqual(fittingTabs(tabs,['Items','Rebook','Notes'],widths,232,32),['Items','Rebook','History','Notes']);
 assert.deepEqual(fittingTabs(tabs,['Items','Rebook','Notes'],widths,250,32),tabs);
});
test('pickup timestamps use the recorded call and a sent SMS for the current ready event',()=>{
 const {pickupCallTime,pickupContacts}=require('../src/lib/pickup-call.ts');
 const ready=new Date('2026-11-09T15:00:00Z'),sms=new Date('2026-11-09T15:04:00Z');
 const contact=(sentAt,channel,subject='Ready for pickup',ticketId='ticket')=>({sentAt,channel,subject,ticketId});
 assert.equal(pickupCallTime({occurredAt:sms,details:{calledAt:'2026-11-09T15:02:00Z'}}),'2026-11-09T15:02:00Z');
 assert.deepEqual(pickupContacts('ticket',ready,[contact(new Date(+ready-1),'SMS'),contact(sms,'SMS','Reminder'),contact(sms,'SMS','Ready for pickup','other')]),{readyContacted:false,pickupTextedAt:null});
 assert.deepEqual(pickupContacts('ticket',ready,[contact(new Date(+sms+60000),'EMAIL'),contact(sms,'SMS')]),{readyContacted:true,pickupTextedAt:sms});
});
test('a saved POS ticket renders the empty ticket layout while its record loads',()=>{
 const Module=require('node:module'),path=require('node:path'),resolve=Module._resolveFilename;
 const css=require.extensions['.css'];
 Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.resolve(name.slice(2)):name,...args)};
 require.extensions['.css']=()=>{};
 try{
  const {PosTicketRecord}=require('../src/components/pos-ticket-record.tsx');
  const html=renderToStaticMarkup(React.createElement(PosTicketRecord,{ticketId:'loading-ticket',onClose:()=>{}}));
  for(const label of ['Loading POS Ticket','Ticket sections','Dog','Service / item','Offer Today','Schedule / Leave Open','Payment'])assert.ok(html.includes(label),label);
  assert.match(html,/class="gp-floating-window[^"]+gp-pos-loading"/);
  assert.doesNotMatch(html,/\$0\.00|Opening ticket…/);
 }finally{Module._resolveFilename=resolve;if(css)require.extensions['.css']=css;else delete require.extensions['.css']}
});
