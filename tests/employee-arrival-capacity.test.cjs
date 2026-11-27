require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {createEmployeeArrivalCapacity,ticketArrivalReservations,loadEmployeeArrivalCapacity,ticketArrivalLimitError,readTicketArrivalReservations}=require('../src/lib/employee-arrival-capacity.ts');
const at=value=>Date.parse('2026-12-01T'+value+':00Z');
const row=(ticketId,start='08:30',extra={})=>({ticketId,employeeId:'kandance',locationId:'shop',start:at(start),end:at('12:00'),...extra});
const configured=(reservations,maximum=2,interval=30)=>createEmployeeArrivalCapacity(new Map([['kandance',{maxAppointments:maximum,intervalMinutes:interval}]]),reservations);

test('two family arrivals every thirty minutes allow ongoing grooming and reject a third arrival',()=>{
 const capacity=configured([row('maria'),row('john')]);
 assert.equal(capacity.allows(row('sam','09:00')),true);
 assert.equal(capacity.allows(row('sam','08:30')),false);
 assert.match(capacity.reason(row('sam','08:30')),/^Employee arrival limit reached:.*2 family appointments every 30 minutes/);
 assert.equal(capacity.allows(row('sam','09:00'),[row('lee','09:00')]),true);
 assert.equal(capacity.allows(row('sam','09:00'),[row('lee','09:00'),row('fran','09:00')]),false);
});

test('dogs and service assignments from one family consume only one employee arrival',()=>{
 const capacity=configured([row('maria'),row('maria'),row('john')]);
 assert.equal(capacity.reservations.length,2);
 assert.equal(capacity.allows(row('maria')),true,'editing the existing family does not count it again');
 assert.equal(capacity.allows(row('third')),false);
 assert.equal(configured([]).allows(row('third'),[row('maria'),row('maria')]),true,'proposals for two dogs count as one family');
});

test('rolling limits check earlier and later arrivals, with exact interval boundaries available',()=>{
 assert.equal(configured([row('later','09:00')],1).allows(row('new','08:45')),false);
 assert.equal(configured([row('later','09:00')],1).allows(row('new','08:30')),true);
 assert.equal(configured([row('earlier','08:30')],1).allows(row('new','09:00')),true);
 assert.equal(configured([row('earlier','08:30')],1,15).allows(row('new','08:45')),true);
 assert.equal(configured([row('earlier','08:30')],1,45).allows(row('new','09:00')),false);
 assert.equal(configured([row('a','08:30'),row('b','08:30')],1).allows(row('new','09:30')),true,'old overcrowding elsewhere must not block a later allowance');
});

test('another location remains unavailable throughout overlapping work even when arrivals are permitted',()=>{
 const away=row('other-shop','08:30',{locationId:'other'});
 assert.equal(configured([away]).allows(row('new','09:00')),false);
 assert.match(configured([away]).reason(row('new','09:00')),/another location/);
 const unset=createEmployeeArrivalCapacity(new Map(),[away]);
 assert.equal(unset.configured('kandance'),false);
 assert.equal(unset.allows(row('new','09:00')),false);
 assert.equal(createEmployeeArrivalCapacity(new Map(),[row('other')]).allows(row('new')),true,'unset same-shop policy is delegated to existing caller behavior');
});

const ticket=(id='family')=>({id,tenantId:'tenant',locationId:'shop',status:'OPEN',scheduledStart:new Date(at('08:30')),durationMin:180,timingMode:'SEQUENTIAL',assignments:[],lines:[
 {id:id+'-gizmo',petId:'gizmo',lineType:'SERVICE',role:'GROOM',quantity:1,durationMin:90,packageId:'gr'},
 {id:id+'-bella',petId:'bella',lineType:'SERVICE',role:'GROOM',quantity:1,durationMin:90,packageId:'gr'}
]});
const plans=[{petId:'gizmo',userId:'kandance'},{petId:'bella',userId:'kandance'}];
test('per-dog planned packages share the family drop-off; actual staff and legacy bookings are included',()=>{
 const family=ticket(),reservations=ticketArrivalReservations(family,plans);
 assert.deepEqual(reservations,[{ticketId:'family',employeeId:'kandance',locationId:'shop',start:at('08:30'),end:at('11:30')}]);
 family.lines[0].assignedUserId='anton';
 assert.deepEqual(ticketArrivalReservations(family,plans).map(r=>r.employeeId).sort(),['anton','kandance']);
 family.assignments=[{role:'PLANNED_GROOMER',userId:'legacy'}];
 assert.deepEqual(ticketArrivalReservations(family).map(r=>r.employeeId).sort(),['anton','legacy']);
 assert.equal(ticketArrivalReservations({...family,scheduledStart:null}).length,0);
});

function databaseFixture(){
 const events=[],tickets=[ticket('existing'),ticket('current')],rows=[{settingKey:'EMPLOYEE_ARRIVAL_LIMIT:kandance',value:{maxAppointments:1,intervalMinutes:30}},...tickets.map(t=>({settingKey:'TICKET_PLANNED_PACKAGES:'+t.id,value:{items:plans}}))];
 const client={
  $queryRaw:async(strings,...values)=>{const sql=strings.join('?');events.push({sql,values});return sql.includes('FROM Ticket')?tickets.map(t=>({id:t.id})):[]},
  tenantSetting:{findMany:async({where})=>{assert.equal(where.tenantId,'tenant');return rows.filter(row=>where.settingKey.in.includes(row.settingKey))}},
  ticket:{findMany:async({where})=>{assert.equal(where.tenantId,'tenant');return tickets.filter(t=>where.id.in.includes(t.id))},findFirst:async({where})=>{assert.equal(where.tenantId,'tenant');return tickets.find(t=>t.id===where.id)}},
 };
 return {client,events,tickets,rows};
}
test('loader locks the tenant first, reads only relevant tickets and excludes the edited family',async()=>{
 const f=databaseFixture();
 const capacity=await loadEmployeeArrivalCapacity(f.client,'tenant',['kandance'],new Date(at('08:30')),new Date(at('09:00')),{lock:true,excludeTicketId:'current'});
 assert.match(f.events[0].sql,/FROM Tenant.*FOR UPDATE/);
 assert.equal(f.events[0].values[0],'tenant');
 assert.match(f.events[1].sql,/tenantId=.*scheduledStart.*DATE_ADD/s);
 assert.equal(capacity.reservations.length,1);
 assert.equal(capacity.reservations[0].ticketId,'existing');
 assert.equal(capacity.allows(row('current')),false);
});

test('post-write guard checks configured employee capacity while leaving unset policies unchanged',async()=>{
 const f=databaseFixture();
 assert.match(await ticketArrivalLimitError(f.client,'tenant','current'),/^Employee arrival limit reached:/);
 f.rows[0].value=null;
 assert.equal(await ticketArrivalLimitError(f.client,'tenant','current'),null);
});

test('closing early does not free an arrival allowance, while cancelled and no-show families are excluded',async()=>{
 const f=databaseFixture();f.tickets[0].status='CLOSED';f.tickets[0].closedAt=new Date(at('08:40'));
 const capacity=await loadEmployeeArrivalCapacity(f.client,'tenant',['kandance'],new Date(at('08:45')),new Date(at('09:15')),{excludeTicketId:'current'});
 assert.equal(capacity.allows(row('new','08:45')),false);
 assert.equal(capacity.reservations[0].end,at('08:40'));
 assert.equal(ticketArrivalReservations({...f.tickets[0],closedAt:null},plans)[0].end,at('08:30'),'completed legacy work without a closing time does not occupy another location');
 assert.equal(configured(ticketArrivalReservations({...f.tickets[0],closedAt:null,locationId:'other'},plans)).allows(row('new','08:15')),true,'zero occupied duration must not block a crossing work interval');
 assert.equal(await ticketArrivalLimitError(f.client,'tenant','existing'),null,'closed history cannot be rejected or reassigned by the write guard');
 for(const status of ['CANCELLED','NO_SHOW'])assert.deepEqual(ticketArrivalReservations({...ticket(),status},plans),[]);
});

test('unchanged family arrivals survive a lowered limit when another dog is unassigned, but moved arrivals are checked',async()=>{
 const f=databaseFixture(),before=await readTicketArrivalReservations(f.client,'tenant','current');
 const currentPlans=f.rows.find(row=>row.settingKey==='TICKET_PLANNED_PACKAGES:current');
 currentPlans.value={items:[{petId:'gizmo',userId:'kandance'},{petId:'bella',userId:null}]};
 assert.equal(await ticketArrivalLimitError(f.client,'tenant','current',before),null,'removing another dog’s assignment must not reject the existing family arrival');
 f.tickets[1].scheduledStart=new Date(at('08:45'));
 assert.match(await ticketArrivalLimitError(f.client,'tenant','current',before),/^Employee arrival limit reached:/,'a changed drop-off still needs a free arrival allowance');
 f.tickets[1].scheduledStart=new Date(at('09:30'));
 assert.equal(await ticketArrivalLimitError(f.client,'tenant','current',before),null);
});

test('unchanged arrivals with extended work skip arrival quota but still check other-location conflicts',async()=>{
 const f=databaseFixture();
 f.rows.find(row=>row.settingKey==='TICKET_PLANNED_PACKAGES:current').value={items:[{petId:'gizmo',userId:'kandance'},{petId:'bella',userId:null}]};
 const before=await readTicketArrivalReservations(f.client,'tenant','current');
 f.tickets[0].locationId='other';f.tickets[0].scheduledStart=new Date(at('11:00'));
 assert.equal(await ticketArrivalLimitError(f.client,'tenant','current',before),null);
 f.tickets[1].lines[0].durationMin=180;
 assert.match(await ticketArrivalLimitError(f.client,'tenant','current',before),/another location/);
});
