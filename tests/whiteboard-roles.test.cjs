require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {bathTeamRoles,boardAssignmentRoles}=require('../src/lib/whiteboard-roles.ts');
test('bath team combines only the tenant-selected roles',()=>{assert.deepEqual(bathTeamRoles({}),['BATH']);assert.deepEqual(bathTeamRoles({prepWithBather:true}),['PREP','BATH']);assert.deepEqual(bathTeamRoles({dryWithBather:true}),['BATH','DRY']);assert.deepEqual(bathTeamRoles({prepWithBather:true,dryWithBather:true}),['PREP','BATH','DRY']);assert.deepEqual(boardAssignmentRoles('GROOM',{prepWithBather:true,dryWithBather:true}),['GROOM']);});
