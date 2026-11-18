const test=require('node:test'),assert=require('node:assert/strict');require('./load-ts.cjs');
const {moduleFields}=require('../src/lib/module-field-index.ts');
const {settingsBreadcrumb}=require('../src/lib/settings-search.ts');
const {fieldPurposes}=require('../src/lib/field-purpose.ts');
test('indexed Settings fields use existing navigation paths and human labels',()=>{
 for(const entry of moduleFields.filter(e=>e.settingsPath))assert.equal(entry.path,settingsBreadcrumb({path:entry.settingsPath})+' → '+entry.name);
 assert.ok(moduleFields.some(e=>e.module==='Inventory'&&e.name==='Products'));
 assert.ok(!moduleFields.some(e=>e.module==='Inventory'&&e.name==='Grooming field'));
 assert.ok(moduleFields.some(e=>e.module==='Products'&&e.name==='Stock quantity'));
});
test('new bulk assignment and import hints describe the actual workflow',()=>{
 assert.match(fieldPurposes['Destination shop'],/appointments do not move/);
 assert.match(fieldPurposes['Shop receiving imported customers'],/Existing customer assignments remain unchanged/);
});
