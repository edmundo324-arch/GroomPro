require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {employeeName}=require('../src/lib/employee-name.ts');
test('employee display names take priority while preserving a fallback for older records',()=>{assert.equal(employeeName({displayName:' Edmundo ',firstName:'Edmundo',lastName:'Saenz'}),'Edmundo');assert.equal(employeeName({displayName:'',firstName:'Staff',lastName:'Test'}),'Staff Test');assert.equal(employeeName(null),'')});
