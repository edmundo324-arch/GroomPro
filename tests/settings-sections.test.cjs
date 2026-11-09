require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {settingsPlace,settingsPlaceKey}=require('../src/lib/settings-place.ts');const {SettingsSections}=require('../src/components/settings-sections.tsx');const {RetainedSection,useModuleVisible}=require('../src/components/module-view.tsx');
test('settings restores the selected section, scroll and expanded groups without storing form values',()=>{const value={selected:'popup',panels:{popup:{top:240,left:18,open:{0:true,1:false},secret:'not-a-ui-preference'},foreign:{top:9}}};const result=settingsPlace(value,['appearance','popup'],'appearance');assert.deepEqual(result,{selected:'popup',panels:{popup:{top:240,left:18,open:{0:true,1:false}}}});assert.equal(value.panels.popup.secret,'not-a-ui-preference');});
test('invalid or unavailable sections and offsets fall back safely',()=>{const result=settingsPlace({selected:'admin',panels:{popup:{top:Infinity,left:-5,open:{0:true,1:'yes',bad:true}}}},['popup'],'popup');assert.deepEqual(result,{selected:'popup',panels:{popup:{top:0,left:0,open:{0:true}}}});assert.equal(settingsPlace(null,['popup'],'missing').selected,'popup');});
test('UI preference storage is separate for business, location, employee and settings task',()=>{const keys=[settingsPlaceKey('tenant-a:location-a:employee-a','settings'),settingsPlaceKey('tenant-b:location-a:employee-a','settings'),settingsPlaceKey('tenant-a:location-b:employee-a','settings'),settingsPlaceKey('tenant-a:location-a:employee-b','settings'),settingsPlaceKey('tenant-a:location-a:employee-a','workflow-BUSINESS')];assert.equal(new Set(keys).size,keys.length);assert.equal(settingsPlaceKey('','settings'),'');});
test('task navigation renders accessible tabs and selector but mounts only the initial task',()=>{let otherRendered=0;function Other(){otherRendered++;return React.createElement('input',{defaultValue:'Other task'})}const html=renderToStaticMarkup(React.createElement(SettingsSections,{id:'test',label:'Settings section',initial:'popup',sections:[{id:'appearance',label:'Appointment appearance',content:React.createElement(Other)},{id:'popup',label:'Popup content',content:React.createElement('input',{defaultValue:'Retained search'})}]}));assert.equal(otherRendered,0);assert.match(html,/role="tablist"/);assert.match(html,/aria-label="Settings section"/);assert.match(html,/role="tabpanel"/);assert.match(html,/value="Retained search"/);assert.doesNotMatch(html,/value="Other task"/);assert.match(html,/aria-selected="true"/);});
test('retained visited content stays mounted with refresh visibility off while an unvisited task stays unloaded',()=>{let count=0;function Probe(){count++;return React.createElement('span',null,useModuleVisible()?'visible':'retained')}const retained=renderToStaticMarkup(React.createElement(RetainedSection,{active:false,visited:true},React.createElement(Probe)));assert.match(retained,/retained/);assert.equal(count,1);const unvisited=renderToStaticMarkup(React.createElement(RetainedSection,{active:false,visited:false},React.createElement(Probe)));assert.equal(unvisited,'');assert.equal(count,1);});

test('popup choice scroll position is retained independently of the preview and outer section',()=>{const result=settingsPlace({selected:'popup',panels:{popup:{top:0,left:0,open:{},nested:{'popup-choices':{top:600,left:0},bad_value:{top:20}}}}},['popup'],'popup');assert.deepEqual(result.panels.popup.nested,{'popup-choices':{top:600,left:0}});assert.equal(result.panels.popup.top,0);});

require.extensions['.css']=()=>{};
test('appointment appearance retains its color, gradient, copy and undo controls alongside one movable preview',()=>{const {AppointmentAppearance}=require('../src/components/appointment-preferences.tsx');const html=renderToStaticMarkup(React.createElement(AppointmentAppearance,{s:{statusStyles:{},customServiceTypes:[],customStatuses:[]},change:()=>{}}));for(const text of ['Use gradient','Color coverage at the start','Color coverage at the end','Copy this appearance','Undo','Additional service types and status labels'])assert.ok(html.includes(text),text);assert.match(html,/data-settings-scroll="appearance-choices"/);assert.match(html,/aria-label="Expand Appointment preview"/);assert.ok(html.indexOf('Copy this appearance')<html.indexOf('aria-label="Move Appointment preview"'));assert.equal((html.match(/class="gp-movable-preview"/g)||[]).length,1);});
test('popup preview keeps its real-data option, sample rendering in a full-size floating popup',()=>{const {PopupPreview}=require('../src/components/appointment-preferences.tsx');const html=renderToStaticMarkup(React.createElement(PopupPreview,{settings:{hoverFields:['pet','pet.weightLbs','pet.vipEligible','package'],hoverLabels:false}}));assert.match(html,/Preview with my business data/);assert.match(html,/gp-full-popup-preview/);assert.match(html,/aria-label="Move Calendar popup preview"/);assert.doesNotMatch(html,/aria-label="Expand Calendar popup preview"/);assert.match(html,/Bella/);assert.match(html,/10 lb/);assert.match(html,/Medium Groom/);});

test('additional-detail order distinguishes grooming notes from permanent pet notes',()=>{const {friendlyHoverLabel}=require('../src/lib/calendar-hover-details.ts');assert.equal(friendlyHoverLabel('notes'),'Grooming notes');assert.equal(friendlyHoverLabel('pet.notes'),'Permanent notes');assert.equal(friendlyHoverLabel('ticket.notes'),'Ticket notes');});

test('Settings search renders and sends import terms to two distinct controls with complete directions',()=>{
 const {findSettings,settingsBreadcrumb}=require('../src/lib/settings-search.ts');
 const {SettingsSearch}=require('../src/components/settings-search.tsx');
 const {CustomerImport}=require('../src/components/customer-import.tsx');
 const upload=findSettings('import customers','ADMIN')[0];
 const prepared=findSettings('demo customer addresses','ADMIN')[0];
 assert.equal(upload.anchor,'import-files');
 assert.equal(prepared.anchor,'prepared-data-scope');
 assert.equal(settingsBreadcrumb(upload),'Settings → Data & integrations → Import & migration → Choose Related Files');
 assert.equal(settingsBreadcrumb(prepared),'Settings → Data & integrations → Import & migration → Prepared data from the local site → Load → Demo customer addresses only → Check prepared data → Load prepared data');
 assert.equal(findSettings('demo customer addresses','FRONT').length,0);
 assert.ok(findSettings('123Pet connection','DEVELOPER').some(entry=>entry.title==='123Pet connection'));
 const search=renderToStaticMarkup(React.createElement(SettingsSearch,{role:'ADMIN'}));
 assert.match(search,/aria-label="Search Settings"/);
 const importer=renderToStaticMarkup(React.createElement(CustomerImport));
 for(const text of ['Prepared data from the local site','Demo customer addresses only','Check prepared data','Choose Related Files','data-settings-target="prepared-data-scope"','data-settings-target="import-files"']){
  assert.ok(importer.includes(text),text);
 }
});

test('Settings search finds operational controls and routes each result to a real Settings section',()=>{
 const {findSettings,settingsSearchEntries,settingsBreadcrumb}=require('../src/lib/settings-search.ts');
 const read=name=>fs.readFileSync('src/components/'+name+'.tsx','utf8');
 const tabs=read('settings')+read('workflow-settings');
 const anchors=['customer-import','pos-layout-settings','reward-settings','referral-reward-settings','platform-brand-settings','platform-access-settings'].map(read).join('\n');
 for(const entry of settingsSearchEntries){
  const labels=settingsBreadcrumb(entry).split(' → ').slice(1,entry.path.length+1);
  entry.path.forEach((id,index)=>assert.ok(tabs.includes("id:'"+id+"',label:'"+labels[index]+"'"),entry.title+' → '+id));
  if(entry.anchor)assert.ok(anchors.includes('data-settings-target="'+entry.anchor+'"'),entry.title);
 }
 const queries={
  'workflow/ticket-layout':['tax','sales taxes','POS header color','remove package discount','planned employee','VIP icon','VIP sales conversation','assign unassigned','called in sick','new POS ticket button','calendar sidebar','three month calendar'],
  'workflow/appearance':['calendar colors','gradient strength','border thickness','copy appearance','manufacturer colors'],
  'workflow/popup':['calendar popup','pet weight'],
  'workflow/profiles':['show inactive pets'],
  'workflow/booking':['default appointment timing','warning days','missing veterinarian','nearby appointment warning'],
  'workflow/calendar-preferences':['100 px','reorder assets','unassigned other','device preferences'],
  'workflow/business-hours-rule':['outside business hours'],
  'workflow/whiteboard':['bather also prepares','bath team'],
  'workflow/authorization':['PIN per protected action','commission qualification'],
  'workflow/billing':['VIP billing'],
  'locations/hours':['holidays','special hours'],
  'locations/sharing':['customer sharing'],
  rewards:['no-show fee','reward points per dollar','first groom credit'],
  'administration/access':['product name','rename GroomPro','turn business modules off'],
  'administration/subscription':['texting and calling'],
  'data/imports':['choose related files','load prepared data','demo customer addresses'],
  'data/123pet':['123Pet connector'],
  categories:['employee categories'],
  'visual-layouts':['customize module layouts']
 };
 for(const [path,terms] of Object.entries(queries))for(const term of terms){
  assert.ok(findSettings(term,'PLATFORM_OWNER').some(entry=>entry.path.join('/')===path),term);
 }
 assert.equal(findSettings('sales taxes','ADMIN')[0].anchor,'pos-sales-tax');
 assert.equal(findSettings('no-show fee','MANAGER')[0].anchor,'no-show-fee');
 assert.equal(findSettings('product name','DEVELOPER').some(entry=>entry.anchor==='product-name'),false);
 assert.equal(findSettings('product name','PLATFORM_OWNER')[0].anchor,'product-name');
});

test('Settings search takes platform staff directly to the Create business form',()=>{
 const {findSettings,settingsBreadcrumb}=require('../src/lib/settings-search.ts');
 const {PlatformAccessSettings}=require('../src/components/platform-access-settings.tsx');
 for(const query of ['create','pilot','business access','control','new tenant','new business']){
  assert.ok(findSettings(query,'PLATFORM_OWNER').some(entry=>entry.anchor==='create-pilot-business'),query);
 }
 const result=findSettings('create business','DEVELOPER')[0];
 assert.equal(result.title,'Create business');
 for(const role of ['PLATFORM_OWNER','DEVELOPER'])for(const query of ['New','new tenant','new business']){
  assert.equal(findSettings(query,role)[0].anchor,'create-pilot-business',query);
 }
 assert.ok(!findSettings('new','ADMIN').some(entry=>entry.anchor==='create-pilot-business'));
 assert.equal(settingsBreadcrumb(result),'Settings → Access & subscription → Subscription → GroomPro platform access controls → Create business');
 assert.equal(findSettings('pilot','ADMIN').length,0);
 const panel=renderToStaticMarkup(React.createElement(PlatformAccessSettings));
 assert.match(panel,/<details[^>]*><summary data-settings-target="platform-business-controls">GroomPro platform access controls<\/summary>.*<details[^>]*><summary data-settings-target="create-pilot-business">Create business<\/summary>/);
 assert.match(panel,/<legend>First location<\/legend>.*<legend>Business owner<\/legend>.*Sign-in PIN/);
});
