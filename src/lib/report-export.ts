import {reconciliationMeasures} from './report-reconciliation';
// Export the same snapshot shown in Reports; never recalculate financial measures.
function cell(value:unknown){const text=String(value??'');return '"'+(/^[\s]*[=+@-]/.test(text)?"'"+text:text).replace(/"/g,'""')+'"';}
export function reportRows(data:any,locationName:string){
 const rows:unknown[][]=[['GroomPro report'],['Location',locationName],['Period begins',data.start],['Period ends (exclusive)',data.end],['Snapshot',data.offlineReport?'Saved offline report':'Report retrieved from server'],['Saved at',data.offlineSavedAt||''],['Scope','Payments and ticket sales: selected location. Memberships and referrals: all accessible customer records.'],['Basis','Payments: payment date. Sales/tips/commissions: closing date. Sales exclude tax and tips.'],['Section','Measure','Selected period','Previous period']];
 const money=(n:number)=>(Number(n||0)/100).toFixed(2);
 for(const [label,key,currency] of [['Appointments','appointments',false],['Projected sales','projectedSalesCents',true],['Payments collected','collectedCents',true],['Closed-ticket sales','closedSalesCents',true],['Tips on closed tickets','tipsCents',true],['VIP memberships started','membershipStarts',false],['VIP memberships ended','membershipEnds',false]] as const){
  rows.push(['Summary',label,currency?money(data[key]):data[key],data.previous?(currency?money(data.previous[key]):data.previous[key]):'']);
 }
 if(data.reconciliation)for(const [label,key] of reconciliationMeasures)rows.push(['Reconciliation',label,money(data.reconciliation[key]),data.previous?.reconciliation?money(data.previous.reconciliation[key]):'']);
 rows.push(['Reconciliation basis','Balance collections: linked account settlements by payment date. Closed lines: closing date. Other payments include tax/tips; unlinked older settlements cannot be identified.']);
 for(const [section,key] of [['Service sales','serviceSales'],['Recorded commissions','commissions']] as const){
  const current:any[]=data[key]||[],previous:any[]=data.previous?.[key]||[],id=(r:any)=>r.id||r.name;
  for(const k of new Set([...current,...previous].map(id))){const a=current.find(r=>id(r)===k),b=previous.find(r=>id(r)===k);rows.push([section,(a||b).name,money(a?.amountCents),data.previous?money(b?.amountCents):'']);if(key==='serviceSales')rows.push([section+' quantity',(a||b).name,a?.quantity||0,data.previous?b?.quantity||0:'']);}
 }
 if(data.salesBreakdowns){
  rows.push(['Sales breakdown basis','Closed saved line totals after discounts; excludes tax, tips and prior balances. Product/package/employee views overlap; do not add them together. Employee rows use recorded permitted assignments only.']);
  rows.push(['Sales breakdown total','Closed sales excluding prior balances',money(data.salesBreakdowns.netLineSalesCents),data.previous?.salesBreakdowns?money(data.previous.salesBreakdowns.netLineSalesCents):'']);
  for(const key of ['products','packages','employees','days']){const a=data.salesBreakdowns[key]||[],b=data.previous?.salesBreakdowns?.[key]||[];for(const id of new Set([...a,...b].map((r:any)=>r.id))){const current=a.find((r:any)=>r.id===id),previous=b.find((r:any)=>r.id===id);rows.push(['Sales — '+key,(current||previous).name,money(current?.amountCents),data.previous?.salesBreakdowns?money(previous?.amountCents):'']);}}
 }
 if(data.appointmentVolume){
  rows.push(['Appointment volume basis','Scheduled date; all statuses including cancelled/no-show. One ticket per total; service/actual employee groups overlap. Current saved status, not historical status.']);
  rows.push(['Appointment volume','All appointments',data.appointmentVolume.total,data.previous?.appointmentVolume?.total??'']);
  for(const key of ['statuses','days','hours','services','employees']){const a=data.appointmentVolume[key]||[],b=data.previous?.appointmentVolume?.[key]||[];for(const id of new Set([...a,...b].map((r:any)=>r.id))){const x=a.find((r:any)=>r.id===id),y=b.find((r:any)=>r.id===id);rows.push(['Appointments — '+key,(x||y).name,x?.count||0,data.previous?.appointmentVolume?y?.count||0:'']);}}
 }
 if(data.cancellations){rows.push(['Cancellations basis','Saved appointment date; selected location; current outcomes. Drafts/unaccepted requests excluded. Fee processing can save Cancelled; fees are not proof of no-show or collection.']);for(const key of ['appointments','cancelled','noShows','cancellationRate','noShowRate','pending','waivers','feesCents'])rows.push(['Cancellations and no-shows',key,key==='feesCents'?money(data.cancellations[key]):data.cancellations[key],data.previous?.cancellations?(key==='feesCents'?money(data.previous.cancellations[key]):data.previous.cancellations[key]):'']);for(const r of data.cancellations.rows)rows.push(['Cancellation ticket',r.orderNumber,r.scheduledStart,r.status,r.pending?'Pending review':'',r.waivers,money(r.feesCents)]);}
 if(data.retention){const r=data.retention;rows.push(['Customer retention basis','Active accessible customers across shared locations. Closed pet-linked GROOM/BATH/PREP/DRY service tickets. Current overdue snapshot, not historical overdue. No completed visits is separate.'],['Retention snapshot',r.asOf],['Overdue weeks',r.weeks],['Visited in selected period',r.visited],['First-time visitors',r.newVisitors],['Returning visitors',r.repeatVisitors],['Currently overdue',r.overdue],['No completed grooming recorded',r.neverVisited]);for(const c of r.rows)rows.push(['Customer retention',c.name,c.lastVisit||'',c.dueDate||'',c.overdue?'Overdue':!c.lastVisit?'No completed grooming recorded':'Within interval',c.nextVisit||'',c.visits]);}
 if(data.receivables){
  rows.push(['Outstanding balances basis','Current snapshot independent of sales dates. Accessible customer accounts and selected-location open tickets can overlap; do not add totals. Credits are not automatically applied.']);
  rows.push(['Outstanding balances snapshot',data.receivables.asOf]);
  for(const c of data.receivables.accounts)rows.push(['Customer account',c.name,'Balance owed',money(c.balanceCents),'Credit',money(c.creditCents)]);
  for(const t of data.receivables.openTickets)rows.push(['Unpaid ticket',t.orderNumber,t.name,t.status,'Saved total',money(t.totalCents),'Paid',money(t.paidCents),'Due',money(t.dueCents)]);
 }
 if(data.employeeWork){
  rows.push(['Employee report basis','Attendance: recorded shift location and selected dates; open shifts through snapshot time. Commissions and tips: original ticket closing date, including later tips. Not wages or payroll payments.']);
  rows.push(['Employee report scope',data.employeeWork.scope],['Employee report snapshot',data.employeeWork.asOf]);
  const current=data.employeeWork.rows||[],previous=data.previous?.employeeWork?.rows||[];
  for(const id of new Set<string>([...current,...previous].map((r:any)=>r.id))){const a=current.find((r:any)=>r.id===id),b=previous.find((r:any)=>r.id===id);for(const [label,key,unit] of [['Recorded hours','elapsedMinutes','hours'],['Break hours','breakMinutes','hours'],['Hours excluding breaks','minutesExcludingBreaks','hours'],['Open shifts','openShifts','count'],['Recorded commissions','commissionCents','money'],['Assigned tips','tipCents','money']]){const format=(v:number)=>unit==='hours'?(Number(v||0)/60).toFixed(2):unit==='money'?money(v):v||0;rows.push(['Employee time & earnings',(a||b).name+' — '+label,format(a?.[key]),data.previous?.employeeWork?format(b?.[key]):'']);}}
  rows.push(['Employee report','Unallocated tips',money(data.employeeWork.unallocatedTipCents),data.previous?.employeeWork?money(data.previous.employeeWork.unallocatedTipCents):'']);
  rows.push(['Employee report','Unreadable entries excluded',data.employeeWork.invalidRecords||0,data.previous?.employeeWork?data.previous.employeeWork.invalidRecords||0:'']);
 }
 for(const [name,count] of Object.entries(data.currentMembershipStatuses||{}))rows.push(['Current VIP membership statuses',name,count,'']);
 for(const name of new Set([...Object.keys(data.referrals||{}),...Object.keys(data.previous?.referrals||{})]))rows.push(['Referral sources',name,data.referrals?.[name]||0,data.previous?data.previous.referrals?.[name]||0:'']);
 return rows;
}
export function reportCsv(data:any,locationName:string){
 return '\uFEFF'+reportRows(data,locationName).map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
