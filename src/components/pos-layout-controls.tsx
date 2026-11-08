"use client";
import {appointmentStyle} from '../lib/calendar-presentation';
import {petIndicatorSettings} from '../lib/pet-indicators';
import {DismissButton} from './dismiss-button';
import {PosCustomerTitle,PosHeaderMenu,PosTicketLabel,PosVisitStamps} from './pos-ticket-header';
import {PosItems} from './pos-items';
import {PosPetStrip} from './pos-pet-strip';
import {PromotingServices} from './promoting-services';
import {useFittingTabs} from './fitting-tabs';
import {Children,cloneElement,isValidElement,useEffect,useLayoutEffect,useRef,useState,type ReactElement,type ReactNode} from 'react';
import {InlineItemValue} from './inline-item-value';
import {ticketLayout,ticketControls,ticketBottomControls,TicketDeviceLayout} from '../lib/pos-layout';
export function usePhoneTicket(){const [phone,setPhone]=useState(false);useLayoutEffect(()=>{const media=window.matchMedia('(max-width:700px), (pointer:coarse) and (max-width:1000px)'),update=()=>setPhone(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);return phone}

type DetailProps = { children?: ReactNode; type?: string; value?: string | number; disabled?: boolean; 'aria-label'?: string };
function detailEditor(node: ReactNode, label: string): ReactNode {
 if(!isValidElement<DetailProps>(node)||typeof node.type!=='string')return node;
 const {children,type,disabled}=node.props;
 if(node.type==='input'&&['date','time','number','text'].includes(type||'')||node.type==='select'){
  const value=String(node.props.value??'');
  let text=value||'—';
  if(type==='date'&&value)text=new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  if(type==='time'&&value)text=new Date('2000-01-01T'+value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  if(node.type==='select'){
   const option=Children.toArray(children).find(child=>isValidElement<DetailProps>(child)&&String(child.props.value??child.props.children)===value) as ReactElement<DetailProps>|undefined;
   if(typeof option?.props.children==='string')text=option.props.children;
  }
  return <InlineItemValue value={text} label={node.props['aria-label']||label} disabled={disabled}>{node}</InlineItemValue>;
 }
 return children?cloneElement(node,{},Children.map(children,child=>detailEditor(child,label))):node;
}
export function TicketTopLayout({layout,controls,children,onMove,textFirst=false}:{textFirst?:boolean;layout:TicketDeviceLayout;controls:Record<string,React.ReactNode>;children?:React.ReactNode;onMove?:(id:keyof typeof ticketControls,row:number,index:number)=>void}){return <>{layout.rows.map((row,index)=><section className={'gp-ticket-control-row gp-ticket-control-row-'+index} key={index} aria-label={['Appointment details','Visit progress','Customer information'][index]} onDragOver={onMove?e=>e.preventDefault():undefined} onDrop={onMove?e=>{e.preventDefault();const id=e.dataTransfer.getData('application/groompro-ticket-control');if(Object.hasOwn(ticketControls,id))onMove(id as keyof typeof ticketControls,index,row.length)}:undefined}>{row.filter(id=>controls[id]!=null&&controls[id]!==false).map((id,i)=><div key={id} data-pos-control={id} draggable={!!onMove&&id!=='move'} onDragStart={onMove&&id!=='move'?e=>e.dataTransfer.setData('application/groompro-ticket-control',id):undefined} onDragOver={onMove?e=>e.preventDefault():undefined} onDrop={onMove?e=>{e.preventDefault();e.stopPropagation();const item=e.dataTransfer.getData('application/groompro-ticket-control');if(Object.hasOwn(ticketControls,item))onMove(item as keyof typeof ticketControls,index,i)}:undefined}>{textFirst?detailEditor(controls[id],String(ticketControls[id])):controls[id]}</div>)}</section>)}{children}</>}
export function TicketTabs({tabs,panel,onChange}:{tabs:string[];panel:string;onChange:(name:string)=>void}){
 const [more,setMore]=useState(false),toggle=useRef<HTMLButtonElement>(null);
 const {root,measureRow,visible}=useFittingTabs<string,HTMLElement>(tabs,['Items','Rebook','Notes']);
 const hidden=tabs.filter(name=>!visible.includes(name));
 useEffect(()=>{
  if(!more)return;
  const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setMore(false)};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[more,root]);
 useEffect(()=>{if(!hidden.length)setMore(false)},[hidden.length]);
 const button=(name:string)=><button type="button" className="gp-btn" aria-pressed={panel===name} key={name} onClick={()=>{onChange(name);setMore(false)}}>{name}</button>;
 return <nav ref={root} className="gp-pos-tabs gp-ticket-tabs gp-fitting-tabs" aria-label="Ticket sections" onKeyDown={e=>{if(more&&e.key==='Escape'){e.stopPropagation();setMore(false);toggle.current?.focus()}}}>
  <div ref={measureRow} className="gp-tab-measure" aria-hidden="true">
   {tabs.map(name=><button type="button" tabIndex={-1} className="gp-btn" key={name} data-tab-width={name}>{name}</button>)}
   <button type="button" tabIndex={-1} className="gp-btn gp-ticket-tab-more" data-more-width>⋯</button>
  </div>
  {visible.map(button)}
  {!!hidden.length&&<div className="gp-ticket-tab-overflow"><button ref={toggle} type="button" className="gp-btn gp-ticket-tab-more" aria-label="More ticket sections" aria-expanded={more} onClick={()=>setMore(v=>!v)}>⋯</button>{more&&<div className="gp-ticket-tab-menu">{hidden.map(button)}</div>}</div>}
 </nav>;
}
export function TicketBottomLayout({layout,controls,onMove}:{layout:TicketDeviceLayout;controls:Record<string,React.ReactNode>;onMove?:(id:string,row:number,index:number)=>void}){return <footer className="gp-pos-footer">{layout.bottomRows.map((row,i)=><section key={i} className={['gp-pos-footer-general','gp-pos-totals','gp-pos-checkout'][i]} onDragOver={onMove?e=>e.preventDefault():undefined} onDrop={onMove?e=>{e.preventDefault();const id=e.dataTransfer.getData('application/groompro-ticket-bottom');if(Object.hasOwn(ticketBottomControls,id))onMove(id,i,row.length)}:undefined}><h2>{['General','Totals','Payment'][i]}</h2><div className="gp-bottom-control-row">{row.map((id,index)=><div key={id} data-pos-control={id} draggable={!!onMove} onDragStart={onMove?e=>e.dataTransfer.setData('application/groompro-ticket-bottom',id):undefined} onDragOver={onMove?e=>e.preventDefault():undefined} onDrop={onMove?e=>{e.preventDefault();e.stopPropagation();const key=e.dataTransfer.getData('application/groompro-ticket-bottom');if(Object.hasOwn(ticketBottomControls,key))onMove(key,i,index)}:undefined}>{controls[id]}</div>)}</div></section>)}</footer>}

export function TicketLayoutPreview({layout,device='desktop',indicators,colorTicketHeader,onMove,onBottomMove,onTabMove}:{layout:TicketDeviceLayout;device?:'desktop'|'phone';indicators?:ReturnType<typeof petIndicatorSettings>;colorTicketHeader?:boolean;onMove?:(id:keyof typeof ticketControls,row:number,index:number)=>void;onBottomMove?:(id:string,row:number,index:number)=>void;onTabMove?:(id:string,index:number)=>void}){
 const s=ticketLayout(layout),noop=()=>{},[selected,setSelected]=useState('coco'),[panel,setPanel]=useState('Items');
 const pets=[{id:'coco',name:'Coco',vipMember:true,weightLbs:10,breed:'Chihuahua',active:true},{id:'fluffy',name:'Fluffy',vipEligible:true,careFlags:{vipConversationAt:true},weightLbs:12,breed:'Shih Tzu',active:true}];
 const employees=[{id:'alex',firstName:'Alex',lastName:'Smith',active:true,role:'GROOMER'}];
 const lines=pets.flatMap(p=>['PREP','BATH','GROOM'].map((role,i)=>({id:p.id+role,petId:p.id,pet:p,role,packageName:'Example Groom',packageId:'example',packageGroupKey:p.id+':example',description:['Preparation, ears and nails','Bath and conditioning','Haircut and finishing'][i],lineType:'SERVICE',durationMin:[30,30,60][i],quantity:1,unitPriceCents:[2000,2000,4000][i],totalCents:[2000,2000,4000][i],assignedUserId:'alex'})));
 const catalog={services:[{id:'teeth',active:true,name:'Tooth brushing',priceCents:1000,customFields:{promotingServices:true,offerTodayLabel:'Brush teeth'}}],products:[],packages:[]};
 const text=(value:string)=><span>{value}</span>,input=(type:string,value:string)=><input type={type} value={value} onChange={noop}/>,select=(value:string,options:string[])=><select value={value} onChange={noop}>{options.map(v=><option key={v}>{v}</option>)}</select>;
 const controls:Record<string,React.ReactNode>={date:<label>Date {input('date','2026-10-31')}</label>,time:<label>Time {input('time','09:00')}</label>,service:<label>Service type {select('From booked services',['From booked services','Grooming','Full Wash'])}</label>,timing:<label>Timing {select('Same Time',['Same Time','Add Up Time'])}</label>,move:<button className="gp-btn primary" type="button">Move</button>,status:<label>Status {select('OPEN',['OPEN','CONFIRMED','CHECKED IN','IN PROGRESS','READY'])}</label>,checkin:<label><input type="checkbox" onChange={noop}/>Checked in —</label>,ready:<label><input type="checkbox" onChange={noop}/>Ready for pickup —</label>,pickup:<label><input type="checkbox" disabled/>Pickup completed —</label>,arrival:<label>Arrival order {input('number','')}</label>,asset:<label>Booking resource {select('Assign later',['Assign later','Full Wash'])}</label>,customer:<strong>John Smith</strong>,editCustomer:<button type="button" className="gp-btn">Edit customer</button>,changeCustomer:<button type="button" className="gp-btn">Change customer</button>,customerId:<small>Customer ID: example</small>,balance:<div className="gp-pos-inline"><strong>Owes $0.00</strong><strong>Credit $0.00</strong></div>,account:<small>Daycare: Not added · Rewards: 10 pts · No card on file</small>};
 const bottom:Record<string,React.ReactNode>={save:<button type="button" className="gp-btn primary">Schedule / Leave Open</button>,noShow:<button type="button" className="gp-btn">Mark no-show — process fee</button>,subtotal:text('Subtotal $160.00'),tax:<label>Sales Tax ($) {input('number','13.20')}</label>,tip:<label>Tip ($) {input('number','0.00')}</label>,summary:text('Total $173.20 · Paid $0.00 · Due $173.20'),paymentType:<label>Payment Type {select('CASH',['CASH','CARD'])}</label>,amount:<label>Amount ($) {input('number','173.20')}</label>,recordPayment:<button type="button" className="gp-btn primary">Record Payment</button>,checkout:<button type="button" className="gp-btn">Check Out / Close</button>};
 const tabs=<nav className="gp-pos-tabs gp-ticket-tabs" aria-label="Ticket sections">{s.tabs.map((name,i)=><button type="button" key={name} className="gp-btn" aria-pressed={panel===name} draggable={!!onTabMove} onDragStart={e=>e.dataTransfer.setData('application/groompro-ticket-tab',name)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('application/groompro-ticket-tab');if(s.tabs.includes(id))onTabMove?.(id,i)}} onClick={()=>setPanel(name)}>{name}</button>)}</nav>;
 return <div className={'gp-ticket-sample gp-pos-'+device} style={{fontSize:s.fontSize,'--gp-footer-general-order':s.footer.indexOf('general'),'--gp-footer-totals-order':s.footer.indexOf('totals'),'--gp-footer-payment-order':s.footer.indexOf('payment')} as React.CSSProperties} aria-label="Live ticket layout preview"><div className="gp-floating-head gp-ticket-titlebar" style={colorTicketHeader?appointmentStyle({status:"OPEN",presentationServiceType:"GR",lines}):undefined}><div className="gp-floating-title"><PosTicketLabel number={179} compact={device==='phone'}/></div><PosCustomerTitle name="John Smith" onEdit={noop} onReplace={noop}/><PosVisitStamps checkedIn="2026-10-31T14:00:00Z" completed="2026-10-31T15:30:00Z" timezone="America/Chicago" contactNeeded/><div className="gp-pos-window-actions"><button type="button" className="gp-btn">Full Size</button><PosHeaderMenu onDetails={device==="phone"?noop:undefined} onCall={noop}/><DismissButton label="Dismiss POS Ticket"/></div></div><header className="gp-pos-header gp-pos-compact-header" data-details-open={true}><TicketTopLayout layout={s} controls={controls} onMove={onMove} textFirst/></header><PosPetStrip pets={pets} indicators={indicators} includedIds={pets.map(p=>p.id)} packageIds={pets.map(p=>p.id)} disabled={false} warnVet={false} summaries={{coco:'FW · Bath and brush',fluffy:'Grooming · #5 Body · #1 GC Face/TBF · Trim ears · Trim tail'}} onInclude={noop} onPackage={setSelected} onNotes={()=>setPanel('Notes')}/><div className="gp-ticket-workbar">{device==='desktop'&&tabs}<PromotingServices services={catalog.services} pets={pets} petId={selected} onPetChange={setSelected} onToggle={noop} lines={lines} disabled={false} pending={[]}/>{device==='phone'&&tabs}</div><div className="gp-pos-body">{panel==='Items'?<PosItems serviceTypeControl={()=> <button type="button" className="gp-btn">GR</button>} lines={lines} pets={pets} employees={employees} catalog={catalog} disabled={false} selectedPet={selected} salesTaxCents={1320} onAdd={noop} onEdit={noop} onRemove={noop} onRemovePet={noop} onPet={setSelected} onPlan={noop} plannedFallback="alex"/>:<div className="gp-pos-panel"><strong>{panel}</strong><p>Use the actual POS Ticket visual editor to arrange this section with its full current information.</p></div>}</div><TicketBottomLayout layout={s} controls={bottom} onMove={onBottomMove}/></div>;
}
