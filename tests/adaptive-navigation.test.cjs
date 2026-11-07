require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {AppNavigation}=require('../src/components/app-navigation.tsx'),{visibleModules}=require('../src/lib/module-navigation.ts');
test('adaptive menu preserves allowed modules with configured features and an accessible current selection',()=>{const allowed=visibleModules(['Calendar','Customers','Pets','Tickets','Whiteboard','Services','Settings'],[{code:'CALENDAR',enabled:true},{code:'CUSTOMERS',enabled:true}]);const html=renderToStaticMarkup(React.createElement(AppNavigation,{modules:allowed,active:'Calendar',onSelect:()=>{}}));for(const name of allowed)assert.ok(html.includes('>'+name+'</button>'));assert.match(html,/aria-label="Open GroomPro menu"/);assert.match(html,/aria-expanded="false"/);assert.match(html,/aria-current="page"/);assert.match(html,/aria-label="GroomPro modules"/);});

test('phone shortcuts fit in one row while Requests and the module links remain in More',()=>{
 const html=renderToStaticMarkup(React.createElement(AppNavigation,{modules:['Calendar','Tickets','Customers','Pets','Messaging'],active:'Calendar',onSelect:()=>{},onCalendarView:()=>{},onRequests:()=>{}}));
 const shortcuts=html.match(/<nav class="gp-mobile-top"[^>]*>(.*?)<\/nav>/)?.[1]||'';
 for(const name of ['Map','Day','Week','Tickets'])assert.ok(shortcuts.includes('>'+name+'</button>'));
 assert.match(shortcuts,/aria-label="More modules"/);
 assert.doesNotMatch(html,/gp-mobile-bottom/);
 const menu=html.match(/<nav id="groompro-module-menu"[^>]*>(.*?)<\/nav>/)?.[1]||'';
 for(const name of ['Customers','Pets','Messaging','Request'])assert.ok(menu.includes('>'+name+'</button>'));
});
