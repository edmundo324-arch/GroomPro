export const ticketTabs=['Items','Rebook','Notes','VIP Memberships','Account & Rewards','Report Card','History'];
export const ticketControls={date:'Date',time:'Time',status:'Status',service:'Service type',timing:'Timing',move:'Move',checkin:'Checked in',ready:'Ready for pickup',pickup:'Pickup completed',arrival:'Arrival order',asset:'Booking resource',customer:'Customer name',editCustomer:'Edit customer',changeCustomer:'Change customer',customerId:'Customer ID',balance:'Balance / credit',account:'Account information'};
export const ticketBottomControls={save:'Schedule / Leave Open',noShow:'No-show action',subtotal:'Subtotal',tax:'Sales tax',tip:'Tip',summary:'Total / Paid / Due',paymentType:'Payment type',amount:'Payment amount',recordPayment:'Record Payment',checkout:'Check Out / Close'};
export const defaultBottomRows=[['save','noShow'],['subtotal','tax','tip','summary'],['paymentType','amount','recordPayment','checkout']];
export type TicketControl=keyof typeof ticketControls;
export type TicketDeviceLayout={rows:TicketControl[][];tabs:string[];footer:string[];bottomRows:string[][];fontSize:number};
export const defaultTicketLayout=():TicketDeviceLayout=>({rows:[['date','time','service','timing','move','status'],['checkin','ready','pickup','arrival','asset'],['customer','editCustomer','changeCustomer','customerId','balance','account']],tabs:[...ticketTabs],footer:['general','totals','payment'],bottomRows:defaultBottomRows.map(r=>[...r]),fontSize:12});
export function ticketLayout(value:any):TicketDeviceLayout{
 const defaults=defaultTicketLayout(),seen=new Set<string>(),keys=Object.keys(ticketControls);
 const rows=defaults.rows.map((fallback,i)=>(Array.isArray(value?.rows?.[i])?value.rows[i]:fallback).filter((k:any)=>keys.includes(k)&&!seen.has(k)&&!!seen.add(k)) as TicketControl[]);
 for(const k of keys)if(!seen.has(k)){const i=defaults.rows.findIndex(row=>row.includes(k as TicketControl));rows[i].push(k as TicketControl)}
 const ordered=(v:any,all:string[])=>[...new Set<string>([...(Array.isArray(v)?v.filter(k=>all.includes(k)):[]),...all])];
 const bottomSeen=new Set<string>();const bottomRows=defaultBottomRows.map((fallback,i)=>(Array.isArray(value?.bottomRows?.[i])?value.bottomRows[i]:fallback).filter((k:any)=>Object.hasOwn(ticketBottomControls,k)&&!bottomSeen.has(k)&&!!bottomSeen.add(k)));for(const k of Object.keys(ticketBottomControls))if(!bottomSeen.has(k))bottomRows[defaultBottomRows.findIndex(r=>r.includes(k))].push(k);
 return {rows,bottomRows,tabs:ordered(value?.tabs,ticketTabs),footer:ordered(value?.footer,defaults.footer),fontSize:Math.max(11,Math.min(18,Number(value?.fontSize)||12))};
}
export function ticketWorkspace(value:any){return {desktop:ticketLayout(value?.desktop),phone:ticketLayout(value?.phone),individualPackageAssignments:value?.individualPackageAssignments===true,taxRatePct:Number.isFinite(value?.taxRatePct)?Math.max(0,Math.min(100,value.taxRatePct)):8.25,automaticNewTicketTax:value?.automaticNewTicketTax!==false,sidebarVisible:value?.sidebarVisible!==false,sidebarItems:[...new Set<string>([...(Array.isArray(value?.sidebarItems)?value.sidebarItems.filter((s:string)=>['calendar','filters','search','whiteboard'].includes(s)):['calendar','filters','search','whiteboard'])])]};}
export function relocateControl(layout:TicketDeviceLayout,id:TicketControl,row:number,index:number){const next=layout.rows.map(r=>r.filter(k=>k!==id));next[Math.max(0,Math.min(2,row))].splice(index,0,id);return ticketLayout({...layout,rows:next})}


export function relocateBottom(layout:TicketDeviceLayout,id:string,row:number,index:number){const rows=layout.bottomRows.map(r=>r.filter(k=>k!==id));rows[Math.max(0,Math.min(2,row))].splice(index,0,id);return ticketLayout({...layout,bottomRows:rows})}
