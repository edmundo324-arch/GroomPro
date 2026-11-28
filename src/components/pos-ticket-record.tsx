"use client";
import {FloatingEditorWindow} from './floating-editor-window';
import {PickupCall} from "./pickup-call";
import {PickupMessage} from "./pickup-message";
import {PetPhotoEditor} from './pet-photo-editor';
import {PetPicture} from './pet-picture';
import {SearchableSelect} from "./searchable-select";
import {matchesCatalogSearch} from '../lib/catalog-search';
import {TicketConfirmationRequest} from './ticket-confirmation-request';
import {TicketFollowUps} from './ticket-follow-ups';
import {ticketStatusLabel} from '../lib/ticket-status-label';
import {ticketDaycareLabel} from '../lib/ticket-daycare';
import {CustomerDeposit,ApplyCustomerCredit} from './customer-deposit';
import {TicketVoid} from './ticket-void';
import {TicketRefunds} from './ticket-refunds';
import {TicketReferralRewards} from './ticket-referral-rewards';
import {TicketPromotions} from './ticket-promotions';
import {GroomingProgress} from './grooming-progress';
import {vipConversationHint} from '../lib/human-communication';
import {DismissButton} from './dismiss-button';
import {lineSchedule,lineTimeKey,scheduleBounds} from '../lib/pet-scheduling';
import {removePackageLine,PackageRemovalChoice} from '../lib/package-removal';
import {packageKey} from '../lib/package-display';
import {bookedPetIds,petPackageToggle} from '../lib/appointment-pets';
import {TicketTopLayout,TicketBottomLayout,TicketTabs,usePhoneTicket} from './pos-layout-controls';
import {InlineItemValue} from './inline-item-value';
import {appointmentStyle,petServiceType,serviceTypes} from '../lib/calendar-presentation';
import {ticketWorkspace} from '../lib/pos-layout';
import {defaultTicketTax,automaticTicketTax} from '../lib/dog-ticket-summary';
import {PlannedPackage,plannedKey} from '../lib/planned-package-rules';
import {CurrencyInput} from "./currency-input";
import {PosCustomerTitle,PosHeaderMenu,PosTicketLabel,PosVisitStamps} from './pos-ticket-header';
import {VisitHistory} from './visit-history';
import {AppointmentHistory} from './appointment-history';
import {groomingSummary} from '../lib/grooming-notes-rules';
import {HelpPopup} from './help-popup';
import {GroomingNotes} from './grooming-notes';
import {employeeName} from "../lib/employee-name";
import {calendarSelection} from '../lib/pos-calendar-selection';
import {PosPetStrip} from "./pos-pet-strip";
import {CustomerIdentification} from "./customer-identification";
import {ReportCard} from "./report-card";
import {singlePetBookingLines} from '../lib/single-pet-booking';
import {expandPackage} from '../lib/package-lines';
import {groomingEligibility} from '../lib/breed-classification';
import {packageForPet} from '../lib/pet-package';
import {TicketPrepaid} from './ticket-prepaid';
import {TicketGiftCards} from './ticket-gift-cards';
import {PosWindowFrame,PosFullSizeButton} from './pos-window-frame';
import {PromotingServices} from './promoting-services';
import {appointmentPart} from '../lib/appointment-input';
import {ticketItemPet,offerTodayLine,setDraftOffer} from '../lib/service-promotion';
import {PosItems} from './pos-items';
import {useAppointmentStaff} from './use-appointment-staff';
import {CustomerProfile} from './customer-profile';
import {MembershipEnrollment} from './catalog-workspace';
import {localToInstant,wallTime} from "../lib/operating-hours";
import {employeeFetch as authorizedRequest} from "../lib/employee-fetch";
import {TicketTips} from './ticket-tips';
import { useEffect, useRef, useState } from "react";
type Employee={id:string;firstName:string;lastName:string;role:string};
type Account={balanceCents:number;creditCents:number;loyaltyPoints:number};
type Reward={id:string;name:string;description:string|null;rewardType:string;pointsCost:number;discountCents:number|null;secret:boolean};
type TicketDetail={createdAt?:string;pickupAt?:string|null;pickupCompletedAt?:string|null;daycareStatus?:string;id:string;orderNumber:number;status:string;scheduledStart:string|null;notes:string|null;checkedInAt?:string|null;arrivalPriority?:number|null;customer:{id:string;firstName:string;lastName:string;email:string|null;phones:{number:string;isPrimary:boolean}[]};pets:{pet:{name:string;breed:string|null};vipAvailability:string|null}[];lines:{description:string;quantity:number;unitPriceCents?:number;totalCents?:number;discountCents?:number;pet:{name:string}|null;role?:string}[];assignments:{role:string;user:{firstName:string;lastName:string}}[];scheduleHistory:{changeType:string;previousStart:string|null;newStart:string;changedAt:string;actor:{firstName:string;lastName:string}|null}[]};
type Checkout={subtotalCents:number;tipCents:number;salesTaxCents:number;totalCents:number;paidCents:number;dueCents:number;account?:Account};
const statuses=["OPEN","CONFIRMED","CHECKED_IN","IN_PROGRESS","READY","NO_SHOW","CLOSED","CANCELLED"];
const money=(c:number)=>`$${(c/100).toFixed(2)}`;
function localInput(date:Date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}T${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`}
export function PosTicketRecord({ticketId:initialTicketId,onClose,date,initialCustomerId,initialEmployeeId,onSaved,onScheduled,active=true,preferredPanel="Items",onPanelChange}:{preferredPanel?:string;onPanelChange?:(panel:string)=>void;active?:boolean;ticketId?:string;onClose:()=>void;date?:Date;initialEmployeeId?:string;initialCustomerId?:string|null;onSaved?:(id:string)=>void;onScheduled?:(date:string)=>void}){
 const[showPrepaid,setShowPrepaid]=useState(false);
 const[showGiftCards,setShowGiftCards]=useState(false),[giftCardCode,setGiftCardCode]=useState('');
 const[showTips,setShowTips]=useState(false);
 const[photoPet,setPhotoPet]=useState<any>(null);
 const[statusPicker,setStatusPicker]=useState(false);
 const[upcoming,setUpcoming]=useState<any[]>([]),[upcomingError,setUpcomingError]=useState(''),[nearbyWarning,setNearbyWarning]=useState(false);
 const[slotAsset,setSlotAsset]=useState<{id:string;name:string}|null|undefined>(),[rebookAsset,setRebookAsset]=useState<{id:string;name:string}|null>(null);
 const calendarWorkflow=useRef('Items'),customerChoiceVersion=useRef(0),manualItemsVersion=useRef(0);
 const [bookingSeed,setBookingSeed]=useState<{customerId:string;choice:number;itemVersion:number;pet:any;history:any[]}|null>(null);
 const phone=usePhoneTicket(),[phoneDetails,setPhoneDetails]=useState(false),[phonePayment,setPhonePayment]=useState(false),[phoneActions,setPhoneActions]=useState(false);
 const taxManual=useRef(false),tipManual=useRef(false),paymentManual=useRef(false),editedStart=useRef({date:false,time:false}),restoredTax=useRef(false),plannedWrites=useRef(new Map<string,Promise<unknown>>()),failedPlans=useRef(new Map<string,PlannedPackage>());

 const slotVersion=useRef(0),pendingSelection=useRef(false);
 const[pendingSlotEmployee,setPendingSlotEmployee]=useState<string|undefined>();
 const upcomingSequence=useRef(0),completedRebooks=useRef(new Set<string>());
 async function loadUpcoming(){const customerId=ticket?.customer?.id;if(!customerId)return;const sequence=++upcomingSequence.current;try{const r=await employeeFetch('/api/tickets/upcoming?customerId='+encodeURIComponent(customerId)),d=await r.json();if(!r.ok)throw Error(d.error);if(sequence===upcomingSequence.current){setUpcoming(d.tickets||[]);setUpcomingError('')}}catch(e){if(sequence===upcomingSequence.current)setUpcomingError((e as Error).message)}}
 function navigateDate(value:string){if(active&&/^\d{4}-\d{2}-\d{2}T/.test(value))window.dispatchEvent(new CustomEvent('groompro:calendar-date',{detail:{date:value.slice(0,10)}}))}
 function proposeRebook(value:string){calendarWorkflow.current='Rebook';setRebookStart(value);setConfirmWarning(false);setNearbyWarning(false);navigateDate(value)}
 const[recordReady,setRecordReady]=useState(false),[readError,setReadError]=useState('');
 const arrivalBeforeLoad=useRef<number|null|undefined>(undefined);
 const arrivalEdit=useRef<{ticketId:string;value:number|null}|null>(null);
 const[ticketId,setTicketId]=useState(initialTicketId||'');
 const activeActions=useRef(new Set<string>()),revision=useRef(0),loadSequence=useRef(0),checkoutSequence=useRef(0),mounted=useRef(true);
 const [pendingKeys,setPendingKeys]=useState<string[]>([]),[replayRevision,setReplayRevision]=useState(0);
 function beginAction(key:string){if(activeActions.current.has(key)||savedId.current&&!ticket.id)return false;activeActions.current.add(key);revision.current++;setPendingKeys([...activeActions.current]);return true}
 function endAction(key:string){activeActions.current.delete(key);if(mounted.current)setPendingKeys([...activeActions.current])}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const writes=useRef(0),failedEdits=useRef(new Map<string,any>()),editVersions=useRef(new Map<string,number>());
 async function employeeFetch(url:string,init?:RequestInit){const write=!['GET','HEAD'].includes((init?.method||'GET').toUpperCase());if(write)writes.current++;try{return await authorizedRequest(url,init)}finally{if(write)writes.current--}}
 const [uncertainPayment,setUncertainPayment]=useState('');
 const wasActive=useRef(active);useEffect(()=>{if(active&&!wasActive.current&&savedId.current){void Promise.all([load(savedId.current),loadCheckout(savedId.current)])}wasActive.current=active},[active]);
 const moveRequest=useRef<Promise<string>|null>(null);
 const reserving=useRef<Promise<any>|null>(null);
 const persistence=useRef<Promise<unknown>>(Promise.resolve());
 const pendingAction=useRef<{kind:string;details:any;confirmConflict:boolean}|null>(null);
 const [draft,setDraft]=useState<any>(null);const draftRef=useRef<any>(null),draftKey=useRef(crypto.randomUUID()),draftReady=useRef(false);
 const deferredEdits=useRef<(()=>Promise<unknown>)[]>([]),handlers=useRef<any>({}),creating=useRef(false);
 const savedId=useRef(initialTicketId||''),operationRunning=useRef(false),operationKeys=useRef(new Map<string,string>());
 function adoptTicket(id:string){savedId.current=id;setTicketId(id);draftRef.current=null;setDraft(null)}
 const [staffLocationId,setStaffLocationId]=useState('');
 const[catalog,setCatalog]=useState<any>({services:[],products:[],packages:[],plans:[]}),[employees,setEmployees]=useState<any[]>([]),[hoursReady,setHoursReady]=useState(false),[customerQuery,setCustomerQuery]=useState(''),[customerResults,setCustomerResults]=useState<any[]>([]),[choosingCustomer,setChoosingCustomer]=useState(!initialCustomerId&&!initialTicketId),[ownerView,setOwnerView]=useState<{id:string;petId?:string}|null>(null),[pendingOwner,setPendingOwner]=useState<any>(null),[replacementPet,setReplacementPet]=useState(''),[customerPets,setCustomerPets]=useState<any[]>([]),[bookingWarning,setBookingWarning]=useState(false);
 const[itemPetId,setItemPetId]=useState('');
 const catalogRequest=useRef(0),catalogActive=useRef(active);
 useEffect(()=>{if(!active){catalogActive.current=false;return}const refresh=()=>{const version=++catalogRequest.current;employeeFetch('/api/catalog').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Service choices could not refresh.');if(mounted.current&&version===catalogRequest.current)setCatalog(d)}).catch(e=>{if(mounted.current&&version===catalogRequest.current)setError(e.message)})};const changed=(event:Event)=>{if((event as CustomEvent).detail?.url?.startsWith('/api/catalog'))refresh()};if(!catalogActive.current)refresh();catalogActive.current=true;window.addEventListener('groompro:data-changed',changed);return()=>window.removeEventListener('groompro:data-changed',changed)},[active]);
 const[presentationOptions,setPresentationOptions]=useState<any>({customStatuses:[],customServiceTypes:[]});
 const[warnVet,setWarnVet]=useState(false);
 const workspace=ticketWorkspace(presentationOptions.posLayout),layout=phone?workspace.phone:workspace.desktop;
 useEffect(()=>{const preview=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.module!=='POS Ticket')return;if(d.clear){employeeFetch('/api/workflow-settings').then(r=>r.json()).then(w=>setPresentationOptions(w.settings||{})).catch(()=>{});}else if(d.ticket)setPresentationOptions((v:any)=>({...v,posLayout:{...v.posLayout,...d.ticket}}))};window.addEventListener('groompro:module-appearance-preview',preview);return()=>window.removeEventListener('groompro:module-appearance-preview',preview)},[]);
 const[packageDeletePrompt,setPackageDeletePrompt]=useState<{description:string;resolve:(value:PackageRemovalChoice|null)=>void}|null>(null);const packagePrompt=useRef(packageDeletePrompt);packagePrompt.current=packageDeletePrompt;
 useEffect(()=>{if(!active&&packagePrompt.current){packagePrompt.current.resolve(null);setPackageDeletePrompt(null)}},[active]);useEffect(()=>()=>{packagePrompt.current?.resolve(null)},[]);
 function packageDeletionChoice(line:any):Promise<PackageRemovalChoice|null>{if(!packageKey(line))return Promise.resolve('KEEP_DISCOUNT');if(workspace.packageRemovalPolicy!=='ASK')return Promise.resolve(workspace.packageRemovalPolicy);if(packagePrompt.current)return Promise.resolve(null);return new Promise(resolve=>setPackageDeletePrompt({description:line.description,resolve}));}
 function displayLineTimes(){try{return Object.fromEntries(Object.entries(lineSchedule({...ticket,scheduledStart:ticket?.scheduledStart||(newStart?localToInstant(newStart,timezone).toISOString():null)})).map(([id,start])=>[id,wallTime(new Date(start),timezone).slice(11,16)]))}catch{return {}}}
 async function setLineStart(line:any,time:string){if(!/^\d{2}:\d{2}$/.test(time))return;const date=(newStart||wallTime(new Date(ticket.scheduledStart),timezone)).slice(0,10),start=localToInstant(date+'T'+time,timezone).toISOString();if(!savedId.current){const times=lineSchedule({...ticket,scheduledStart:ticket.scheduledStart||localToInstant(newStart,timezone).toISOString()});times[lineTimeKey(line)]=start;const bounds=scheduleBounds(ticket,times);setTicket((t:any)=>({...t,lineStarts:times,...bounds}));setNewStart(wallTime(new Date(bounds.scheduledStart),timezone));return;}const id=savedId.current,headerAtRequest=newStart;try{const r=await employeeFetch('/api/tickets/line-times',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:id,lineId:line.id,scheduledStart:start})}),d=await r.json();if(!r.ok)throw Error(d.error);if(savedId.current===id)setTicket((t:any)=>({...t,lineStarts:d.lineStarts,scheduledStart:d.scheduledStart,durationMin:d.durationMin}));setNewStart(current=>current===headerAtRequest?wallTime(new Date(d.scheduledStart),timezone):current);onSaved?.(id)}catch(e){setError((e as Error).message)}}
 const configWasActive=useRef(active);useEffect(()=>{if(!active){configWasActive.current=false;return}const refresh=()=>employeeFetch('/api/workflow-settings').then(r=>r.json()).then(d=>{if(d.settings)setPresentationOptions(d.settings)}).catch(()=>{});if(!configWasActive.current)void refresh();configWasActive.current=true;window.addEventListener('groompro:appearance-changed',refresh);return()=>window.removeEventListener('groompro:appearance-changed',refresh)},[active]);

 const packageQueues=useRef(new Map<string,Promise<void>>()),packageIntents=useRef(new Map<string,boolean>());const[,renderPackageIntent]=useState(0);
 const[packagePet,setPackagePet]=useState<any>(null),[packageQuery,setPackageQuery]=useState('');
 const defaultTiming=useRef(''),timingChosen=useRef(false);
 useEffect(()=>{const changed=(event:Event)=>{if(!(event as CustomEvent).detail?.url?.startsWith('/api/workflow-settings'))return;employeeFetch('/api/workflow-settings').then(r=>r.json()).then(d=>{if(d.settings)setPresentationOptions(d.settings);const mode=d.businessSettings?.timingMode;if(!mode)return;defaultTiming.current=mode;timingChosen.current=false;setTicket((t:any)=>t&&!['CLOSED','CANCELLED','NO_SHOW'].includes(t.status)?{...t,timingMode:mode}:t);if(savedId.current)void load(savedId.current)}).catch(()=>{})};window.addEventListener('groompro:data-changed',changed);return()=>window.removeEventListener('groompro:data-changed',changed)},[]);
 const emptyTicket=()=>({timingMode:defaultTiming.current||'SEQUENTIAL',id:'',status:'OPEN',customer:{id:'',firstName:'',lastName:'',phones:[]},pets:[],lines:[],assignments:[],scheduleHistory:[],notes:'',scheduledStart:null});
 const [reportCardPrompt,setReportCardPrompt]=useState('');
 const[panel,setPanel]=useState(preferredPanel);
 useEffect(()=>{if(active)setPanel(preferredPanel)},[active]);
 useEffect(()=>{calendarWorkflow.current=panel},[panel]);
 const[timezone,setTimezone]=useState("America/Chicago");
 const[showFollowUps,setShowFollowUps]=useState(false);
 const[showVoid,setShowVoid]=useState(false);
 const[ticket,setTicket]=useState<any>(emptyTicket()),[account,setAccount]=useState<Account>({balanceCents:0,creditCents:0,loyaltyPoints:0}),[rewards,setRewards]=useState<Reward[]>([]),[cardOnFile,setCardOnFile]=useState(false),[error,setErrorState]=useState(""),[moving,setMoving]=useState(false),[statusSaving,setStatusSaving]=useState(false),[rebooking,setRebooking]=useState(false),[rebookStart,setRebookStart]=useState(""),[rebookGroomerId,setRebookGroomerId]=useState(""),[groomers,setGroomers]=useState<Employee[]>([]),[groomerId,setGroomerId]=useState(initialEmployeeId||""),[confirmWarning,setConfirmWarning]=useState(false),[newStart,setNewStart]=useState(()=>{const d=new Date(date||new Date());if(!initialEmployeeId)d.setHours(9,0,0,0);return localInput(d)}),[checkout,setCheckout]=useState<Checkout|null>(null),[tip,setTip]=useState("0"),[tax,setTax]=useState("0"),[paymentType,setPaymentType]=useState("CASH"),[paymentAmount,setPaymentAmount]=useState(""),[paying,setPaying]=useState(false),[closing,setClosing]=useState(false),[accountType,setAccountType]=useState("CREDIT"),[accountAmount,setAccountAmount]=useState(""),[accountReason,setAccountReason]=useState(""),[adjusting,setAdjusting]=useState(false),[noShowing,setNoShowing]=useState(false),[redeeming,setRedeeming]=useState("");
 const accountCustomerId=useRef(ticket.customer.id);accountCustomerId.current=ticket.customer.id;
 const[standingNotes,setStandingNotes]=useState<{customerId:string;customer:string;pets:Record<string,string>}>({customerId:'',customer:'',pets:{}});
 const[noteSummaries,setNoteSummaries]=useState<Record<string,any>>({});
 useEffect(()=>{let stale=false;if(!ticket.customer.id)return;const refresh=()=>employeeFetch('/api/grooming-notes?customerId='+encodeURIComponent(ticket.customer.id)+'&ticketId='+encodeURIComponent(ticketId)).then(r=>r.json()).then(d=>{if(stale||d.error)return;setStandingNotes({customerId:ticket.customer.id,customer:d.customer?.notes||'',pets:Object.fromEntries((d.pets||[]).map((p:any)=>[p.id,p.notes||'']))});setNoteSummaries(ticketId?Object.fromEntries(d.records.filter((n:any)=>n.ticketId===ticketId).map((n:any)=>[n.petId,n.instructions])):d.defaults)}).catch(()=>{});void refresh();window.addEventListener('groompro:grooming-notes-changed',refresh);return()=>{stale=true;window.removeEventListener('groompro:grooming-notes-changed',refresh)}},[ticket.customer.id,ticketId]);
 const [inventoryWarnings,setInventoryWarnings]=useState<string[]>([]);
 function setError(message:string){setErrorState(message);if(message&&message!=='Error'&&!/^(Error: )?Action cancelled\.$/.test(message))window.dispatchEvent(new CustomEvent('groompro:save-error',{detail:{message}}))}
 useEffect(()=>{if(panel!=='Rebook'||!active)return;void loadUpcoming();const changed=()=>void loadUpcoming();window.addEventListener('groompro:ticket-changed',changed);return()=>{upcomingSequence.current++;window.removeEventListener('groompro:ticket-changed',changed)}},[panel,active,ticket?.customer?.id]);
 useEffect(()=>{if(!active)return;const select=(event:Event)=>{const {date,resource}=(event as CustomEvent).detail;const selection=calendarSelection(calendarWorkflow.current,new Date(date),resource);if(selection.workflow==='rebook'){proposeRebook(selection.value);setRebookGroomerId(selection.employeeId);setRebookAsset(selection.asset)}else{if(['CLOSED','CANCELLED','NO_SHOW'].includes(ticket.status))return;slotVersion.current++;pendingSelection.current=true;setNewStart(selection.value);navigateDate(selection.value);setSlotAsset(selection.asset);if(!ticket.checkedInAt){setGroomerId(selection.employeeId);setPendingSlotEmployee(selection.employeeId)}}};window.addEventListener('groompro:calendar-slot',select);return()=>window.removeEventListener('groompro:calendar-slot',select)},[active,panel,ticket.checkedInAt,ticket.status]);
 async function ensureDraft(){if(draftRef.current)return draftRef.current;if(!reserving.current)reserving.current=(async()=>{const r=await employeeFetch('/api/pos-drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestKey:draftKey.current})});const d=await r.json();if(!r.ok)throw Error(d.error);draftRef.current=d.draft;setDraft(d.draft);draftReady.current=true;setTicket((t:any)=>({...t,createdAt:d.draft.createdAt}));return d.draft;})().finally(()=>{reserving.current=null});return reserving.current;}
 useEffect(()=>{const moved=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.ticketId!==savedId.current||!detail?.calendarMove)return;void load(savedId.current);if(detail.scheduledStart)setNewStart(wallTime(new Date(detail.scheduledStart),timezone))};window.addEventListener('groompro:ticket-changed',moved);return()=>window.removeEventListener('groompro:ticket-changed',moved)},[ticketId,timezone]);
 const syncVisit=useRef<()=>Promise<boolean>>(async()=>true),visitScope=useRef({tenantId:ticket.tenantId,locationId:ticket.locationId});visitScope.current={tenantId:ticket.tenantId,locationId:ticket.locationId};
 syncVisit.current=async()=>{
  if(writes.current||operationRunning.current)return false;
  const id=savedId.current,version=revision.current;if(!id)return true;
  try{
   const r=await employeeFetch(`/api/tickets/${id}`),d=await r.json();
   if(!r.ok||!mounted.current||savedId.current!==id)return true;
   if(version!==revision.current||writes.current||operationRunning.current)return false;
   // Sync only visit stamps: do not replace unsaved items, notes, or tip edits.
   setTicket((current:any)=>current.id===id?{...current,...Object.fromEntries(['status','displayStatus','checkedInAt','pickupAt','pickupCompletedAt'].filter(key=>key in d.ticket).map(key=>[key,d.ticket[key]])),...(arrivalEdit.current?.ticketId===id?{}:{arrivalPriority:d.ticket.arrivalPriority,arrivalPriorityPending:Boolean(d.ticket.arrivalPriorityPending)})}:current);
  }catch{ /* Keep entered work available when the connection is interrupted. */ }
  return true;
 };
 useEffect(()=>{
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  const refresh=async()=>{if(stopped)return;if(!await syncVisit.current()&&!stopped)timer=setTimeout(()=>void refresh(),100)};
  const changed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail&&(!detail.offlineSync||detail.ticketId!==savedId.current||detail.locationId&&detail.locationId!==visitScope.current.locationId||detail.tenantId&&visitScope.current.tenantId&&detail.tenantId!==visitScope.current.tenantId))return;clearTimeout(timer);void refresh()};
  window.addEventListener('groompro:ticket-changed',changed);
  return()=>{stopped=true;clearTimeout(timer);window.removeEventListener('groompro:ticket-changed',changed)};
 },[ticketId]);
 async function load(id=ticketId){if(!id||writes.current)return;const version=revision.current,sequence=++loadSequence.current;try{const r=await employeeFetch(`/api/tickets/${id}`),d=await r.json();if(!r.ok)throw new Error(d.error||"Ticket could not be loaded.");if(!mounted.current||version!==revision.current||writes.current||sequence!==loadSequence.current)return;setReadError('');setTicket((current:any)=>({...d.ticket,...(!current.id&&arrivalBeforeLoad.current!==undefined?{arrivalPriority:arrivalBeforeLoad.current}:{}),lines:d.ticket.lines.map((line:any)=>({...line,...(failedEdits.current.get(line.id)||{})}))}));if(!pendingSelection.current)setGroomerId(d.ticket.assignments.find((a:any)=>a.role==='GROOMER')?.user.id||'');setCustomerPets(d.ticket.customer.pets||d.ticket.pets.map((p:any)=>p.pet));setTimezone(d.ticket.location?.timezone||"America/Chicago");setAccount(d.account||{balanceCents:0,creditCents:0,loyaltyPoints:0});setRewards(d.rewards||[]);setCardOnFile((d.paymentMethods||[]).length>0);if(d.ticket.scheduledStart){const x=new Date(d.ticket.scheduledStart);setNewStart(current=>{
 const incoming=wallTime(x,d.ticket.location?.timezone||"America/Chicago");
 if(ticket.id||pendingSelection.current)return current;
 const date=editedStart.current.date?current.split('T')[0]:incoming.slice(0,10);
 const time=editedStart.current.time?current.split('T')[1]:incoming.slice(11,16);
 return date+'T'+time;
 });setRebookStart(current=>current||wallTime(x,d.ticket.location?.timezone||"America/Chicago"))}}catch(e){if(mounted.current&&sequence===loadSequence.current)setReadError(e instanceof Error?e.message:"Ticket could not be loaded.")}}
 async function loadGroomers(){try{const r=await employeeFetch("/api/employees");if(r.ok){const d=await r.json();setGroomers((d.employees||[]).filter((e:any)=>e.active&&["GROOMER","MASTER_GROOMER","BACK"].includes(e.role)))}}catch{}}
 const catalogReload=useRef<()=>Promise<void>>(async()=>{});
 catalogReload.current=async()=>{await Promise.all([load(savedId.current),loadCheckout(savedId.current,true)])};
 useEffect(()=>{
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  const refresh=async()=>{
   if(stopped)return;
   // A catalog refresh must not discard an employee's pending or failed edit.
   if(writes.current||operationRunning.current||activeActions.current.size||plannedWrites.current.size||failedPlans.current.size||failedEdits.current.size||packageQueues.current.size||packageIntents.current.size){timer=setTimeout(()=>void refresh(),500);return;}
   const version=revision.current;await catalogReload.current();
   if(!stopped&&version!==revision.current)timer=setTimeout(()=>void refresh(),500);
  };
  const changed=(event:Event)=>{if(!(event as CustomEvent).detail?.ticketIds?.includes(savedId.current))return;clearTimeout(timer);void refresh()};
  window.addEventListener('groompro:catalog-synced',changed);
  return()=>{stopped=true;clearTimeout(timer);window.removeEventListener('groompro:catalog-synced',changed)};
 },[ticketId]);
 const [receiptEmail,setReceiptEmail]=useState<{url:string;email:string;revision:string;requestId:string}|null>(null),[receiptEmailBusy,setReceiptEmailBusy]=useState(false),[receiptEmailNotice,setReceiptEmailNotice]=useState('');
 async function prepareReceiptEmail(){
  if(!ticketId)return;
  const url='/api/tickets/receipt?ticketId='+encodeURIComponent(ticketId)+'&locationId='+encodeURIComponent(ticket.locationId||ticket.location?.id||'');
  try{const r=await employeeFetch(url),d=await r.json();if(!r.ok)throw Error(d.error);if(!d.email)throw Error('Add the customer’s email address in Customer Profile → Details, then try again.');setReceiptEmailNotice('');setReceiptEmail({url,email:d.email,revision:d.revision,requestId:crypto.randomUUID()});}catch(e){setError((e as Error).message);}
 }
 async function emailReceipt(){
  if(!receiptEmail||receiptEmailBusy)return;setReceiptEmailBusy(true);
  try{const r=await employeeFetch(receiptEmail.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:receiptEmail.requestId,revision:receiptEmail.revision})}),d=await r.json();if(!r.ok)throw Error(d.error);setReceiptEmailNotice(d.message);setReceiptEmail(null);}catch(e){setReceiptEmailNotice((e as Error).message);}finally{setReceiptEmailBusy(false);}
 }
 async function openReceipt(){
  if(!ticketId)return;
  const preview=window.open('','_blank');if(!preview){setError('Allow a new browser tab to open the invoice or receipt.');return;}preview.opener=null;
  try{const response=await employeeFetch('/api/tickets/receipt?ticketId='+encodeURIComponent(ticketId)+'&locationId='+encodeURIComponent(ticket.locationId||ticket.location?.id||'')),result=await response.json();if(!response.ok)throw Error(result.error||'The receipt could not be opened.');if(!preview.closed){preview.document.open();preview.document.write(result.html);preview.document.close();}}
  catch(error){preview.close();setError((error as Error).message);}
 }
 async function loadCheckout(id=ticketId,refreshPaymentAmount=false){if(!id||writes.current)return;const version=revision.current,sequence=++checkoutSequence.current;try{const r=await employeeFetch(`/api/tickets/checkout?ticketId=${id}`);if(r.ok){const d=await r.json();if(!mounted.current||version!==revision.current||writes.current||sequence!==checkoutSequence.current)return;setCheckout(d);setAccount(d.account||account);if(!checkout){if(!tipManual.current)setTip(String(d.tipCents||0));if(!taxManual.current)setTax(String(d.salesTaxCents||0));}if(!paymentManual.current&&(d.dueCents>0||refreshPaymentAmount))setPaymentAmount(current=>refreshPaymentAmount?String(Math.max(0,d.dueCents)):current||String(d.dueCents))}}catch{}}
 useEffect(()=>{let alive=true;async function initialize(){const existingRead=initialTicketId?Promise.all([load(initialTicketId),loadCheckout(initialTicketId)]):Promise.resolve();try{const r=await employeeFetch(initialTicketId?`/api/pos-drafts?id=${initialTicketId}`:'/api/pos-drafts',initialTicketId?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestKey:draftKey.current})});const d=await r.json();if(!r.ok)throw Error(d.error);if(!alive)return;const row=d.draft||d.drafts?.[0];if(row){draftRef.current=row;setDraft(row);setTicketId('');savedId.current='';const p=row.payload||{};setTicket({...emptyTicket(),...(p.ticket||{}),lines:(p.ticket?.lines||[]).map((l:any)=>({...l,clientKey:l.clientKey||crypto.randomUUID()})),timingMode:defaultTiming.current||p.ticket?.timingMode||'SEQUENTIAL',createdAt:row.createdAt});if(p.newStart&&!editedStart.current.date&&!editedStart.current.time&&!pendingSelection.current)setNewStart(p.newStart);if(p.groomerId)setGroomerId(p.groomerId);if(p.tax!==undefined&&!taxManual.current){setTax(p.tax);restoredTax.current=true;}if(p.tip&&!tipManual.current)setTip(p.tip);if(p.customerPets)setCustomerPets(p.customerPets);if(p.ticket?.customer?.id){
 const id=encodeURIComponent(p.ticket.customer.id);
 const choice=customerChoiceVersion.current;
 const stillCurrent=()=>alive&&customerChoiceVersion.current===choice;
 void employeeFetch('/api/customers/account?customerId='+id).then(r=>r.ok?r.json():Promise.reject()).then(data=>{if(stillCurrent()&&data.customer)setAccount(data.customer)}).catch(()=>{if(stillCurrent())setReadError('Customer account could not be loaded.')});
 void employeeFetch('/api/customers/rewards?customerId='+id).then(r=>r.ok?r.json():Promise.reject()).then(data=>{if(stillCurrent())setRewards(data.catalog||[])}).catch(()=>{if(stillCurrent())setReadError('Customer rewards could not be loaded.')});
 }setChoosingCustomer(!p.ticket?.customer?.id);draftReady.current=true;setRecordReady(true);if(initialCustomerId&&!p.ticket?.customer?.id){const c=await employeeFetch(`/api/customers/${initialCustomerId}`).then(r=>r.json());await chooseCustomer(c.customer);}}await existingRead;if(alive)setRecordReady(true)}catch(e){if(alive){setReadError((e as Error).message);setRecordReady(true)}}}void initialize();return()=>{alive=false}},[]);
 useEffect(()=>{if(ticket.customer.id)setPhoneDetails(false)},[ticket.customer.id]);
 useEffect(()=>{if(hoursReady&&automaticTicketTax(ticket.status,workspace.automaticNewTicketTax,taxManual.current))setTax(String(defaultTicketTax(ticket.lines,workspace.taxRatePct,catalog)))},[ticket.lines,ticket.status,hoursReady,workspace.taxRatePct,workspace.automaticNewTicketTax,catalog]);
 async function planPackage(assignment:PlannedPackage){
  const key=plannedKey(assignment);setTicket((t:any)=>({...t,plannedAssignments:[...(t.plannedAssignments||[]).filter((p:PlannedPackage)=>assignment.packageKey?plannedKey(p)!==key:p.petId!==assignment.petId),assignment]}));
  if(!savedId.current)return;const id=savedId.current;revision.current++;
  const previous=plannedWrites.current.get(key)||Promise.resolve();const task=previous.catch(()=>{}).then(async()=>{const r=await employeeFetch('/api/tickets/planned-packages',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:id,assignment})}),d=await r.json();if(!r.ok)throw Error(d.error);failedPlans.current.delete(key);onSaved?.(id)});plannedWrites.current.set(key,task);
  try{await task}catch(e){failedPlans.current.set(key,assignment);setError('Planned employee was not saved: '+(e as Error).message)}finally{if(plannedWrites.current.get(key)===task)plannedWrites.current.delete(key)}
 }
 const appointmentStaff=useAppointmentStaff(newStart.slice(0,10),ticket?.locationId||staffLocationId,active&&hoursReady);
 async function persistDraft(){if(operationRunning.current||!draftReady.current||!draftRef.current||!ticket)return;const body=JSON.stringify({id:draftRef.current.id,payload:{ticket,newStart,groomerId,slotAsset,tip,tax,customerPets}});const pending=persistence.current.catch(()=>{}).then(async()=>{const r=await employeeFetch('/api/pos-drafts',{method:'PUT',headers:{'Content-Type':'application/json'},body});if(!r.ok)throw Error((await r.json()).error||'Draft could not be preserved.');});persistence.current=pending;return pending;}
 useEffect(()=>{const timer=setTimeout(()=>void persistDraft().catch(e=>setError(e.message)),400);return()=>clearTimeout(timer)},[ticket,newStart,groomerId,slotAsset,tip,tax,customerPets,draft]);
 async function closeWindow(){pendingAction.current=null;const save=persistDraft();onClose();try{await save}catch(e){window.dispatchEvent(new CustomEvent('groompro:save-error',{detail:{message:(e as Error).message}}))}}
 useEffect(()=>{Promise.all([employeeFetch('/api/catalog'),employeeFetch('/api/employees'),employeeFetch('/api/operating-hours'),employeeFetch('/api/workflow-settings')]).then(async rs=>{const [c,e,h,w]=await Promise.all(rs.map(r=>r.json()));if(rs.some(r=>!r.ok))throw Error('Ticket options could not load.');setPresentationOptions(w.settings||{});if(catalogRequest.current===0)setCatalog(c);setWarnVet(!!w.settings?.warnMissingVeterinarian);setEmployees(e.employees||[]);setStaffLocationId(h.locationId||'');setGroomers((e.employees||[]).filter((x:any)=>x.active&&(["GROOMER","MASTER_GROOMER","BACK"].includes(x.role)||x.id===initialEmployeeId)));if(!initialTicketId)setTimezone(h.timezone);defaultTiming.current=w.settings?.timingMode||'SEQUENTIAL';if(!savedId.current&&!timingChosen.current)setTicket((t:any)=>({...t,timingMode:defaultTiming.current}));setHoursReady(true)}).catch(e=>setError(e.message));},[]);
 useEffect(()=>{if(!choosingCustomer){setCustomerResults([]);return}const c=new AbortController();const timer=setTimeout(()=>employeeFetch(`/api/customers/search?q=${encodeURIComponent(customerQuery)}&limit=50`,{signal:c.signal}).then(r=>r.json()).then(d=>setCustomerResults(d.customers||[])).catch(()=>{}),200);return()=>{clearTimeout(timer);c.abort()}},[customerQuery,choosingCustomer]);

 async function chooseCustomer(c:any){
  if(creating.current){deferredEdits.current.push(()=>handlers.current.chooseCustomer(c));return}
  if(!c)return;
  const choice=++customerChoiceVersion.current,itemVersion=manualItemsVersion.current;
  setBookingSeed(null);
  setPackagePet(null);
  const pets=(c.pets||[]).filter((pet:any)=>pet.active!==false);
  if(savedId.current){setPendingOwner(c);setReplacementPet(pets[0]?.id||'');return}
  setTicket((t:any)=>({...t,customer:c,pets:pets.map((pet:any)=>({pet})),lines:t.lines.map((l:any)=>({...l,petId:l.type==='PRODUCT'?undefined:pets[0]?.id}))}));
  setCustomerPets(pets);
  setChoosingCustomer(false);
  setCustomerQuery('');
  const profile=Array.isArray(c.tickets)?Promise.resolve(c):employeeFetch('/api/customers/'+encodeURIComponent(c.id))
   .then(response=>response.ok?response.json().then(data=>data.customer):null);
  void profile.then(customer=>{
   if(!mounted.current||customerChoiceVersion.current!==choice||customer?.id!==c.id)return;
   setCustomerPets(customer.pets||[]);
   const activePets=(customer.pets||[]).filter((pet:any)=>pet.active!==false);
   if(activePets.length===1){
    const history=customer.tickets||[];
    setBookingSeed({customerId:c.id,choice,itemVersion,pet:activePets[0],history:customer.lastServiceVisit?[...history,customer.lastServiceVisit]:history});
   }
  }).catch(()=>{});
  try{
   const [a,r]=await Promise.all([employeeFetch(`/api/customers/account?customerId=${c.id}`).then(r=>r.json()),employeeFetch(`/api/customers/rewards?customerId=${c.id}`).then(r=>r.json())]);
   if(customerChoiceVersion.current!==choice)return;
   setAccount(a.customer||{balanceCents:0,creditCents:0,loyaltyPoints:0});
   setRewards(r.catalog||[]);
  }catch{if(customerChoiceVersion.current===choice)setError('Customer account could not load.')}
 }
 useEffect(()=>{
  if(!bookingSeed||!hoursReady||!catalog.breeds)return;
  const {customerId,choice,itemVersion,pet,history}=bookingSeed;
  if(savedId.current||operationRunning.current||customerChoiceVersion.current!==choice||manualItemsVersion.current!==itemVersion||ticket.lines.length){setBookingSeed(null);return}
  if(ticket.customer.id!==customerId)return;
  setBookingSeed(null);
  try{
   const lines=singlePetBookingLines(pet,history,catalog).map(line=>({...line,clientKey:crypto.randomUUID()}));
   if(lines.length)setTicket((current:any)=>current.customer.id===customerId&&!current.lines.length?{...current,pets:[{pet}],lines}:current);
  }catch(e){setError((e as Error).message)}
 },[bookingSeed,hoursReady,catalog,ticket.customer.id,ticket.lines.length]);
 async function changeCustomer(){revision.current++;setError('');try{const r=await employeeFetch('/api/tickets/customer',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId,customerId:pendingOwner.id,petId:replacementPet})}),d=await r.json();if(!r.ok)throw Error(d.error);setPendingOwner(null);setChoosingCustomer(false);onSaved?.(ticketId);await Promise.all([load(),loadCheckout()])}catch(e){setError(e instanceof Error?e.message:'Customer could not change.')}finally{}}
 function currentTax(){return automaticTicketTax(ticket.status,workspace.automaticNewTicketTax,taxManual.current)?defaultTicketTax(ticket.lines||[],workspace.taxRatePct,catalog):Number(tax)||0}
 function draftPayload(confirmConflict=false){return {petServiceTypes:ticket.petServiceTypes,lineStartPositions:ticket.lines.map((l:any,sortOrder:number)=>({sortOrder,start:ticket.lineStarts?.[lineTimeKey(l)]})).filter((v:any)=>v.start),plannedAssignments:(ticket.plannedAssignments||[]).filter((p:any)=>bookedPetIds(ticket.lines).includes(p.petId)),groomingNotesDraft:ticket.groomingNotesDraft,draftId:draftRef.current?.id,bookingAssetId:slotAsset===undefined?ticket.bookingAssetId||null:slotAsset?.id||null,tipCents:Number(tip)||0,salesTaxCents:currentTax(),timingMode:ticket.timingMode,customerId:ticket.customer.id,petIds:bookedPetIds(ticket.lines),lines:ticket.lines,scheduledStart:newStart?localToInstant(newStart,timezone).toISOString():undefined,notes:ticket.notes,groomerId:groomerId||undefined,arrivalPriority:ticket.arrivalPriority||undefined,confirmRecentWarning:confirmConflict}}
 async function operate(kind:string,details:any={},confirmConflict=false){
  if(operationRunning.current||savedId.current&&!ticket.id)return null;
  if(!savedId.current&&!draftRef.current){try{await ensureDraft()}catch(e){setError((e as Error).message);return null}}
  if(!savedId.current&&(!hoursReady||!ticket.customer.id||(!ticket.lines.length&&kind!=='ENROLL'&&kind!=='GIFT_CARD'&&kind!=='PREPAID_PURCHASE'))){pendingAction.current={kind,details,confirmConflict};if(!ticket.customer.id){setChoosingCustomer(true);requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('[placeholder="Search customer or pet"]')?.focus())}else{setPanel('Items');requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('[aria-label="Search items"]')?.focus())}return null}
  pendingAction.current=null;
  const previousFocus=document.activeElement as HTMLElement|null;
  operationRunning.current=true;creating.current=!savedId.current;revision.current++;setError('');
  let submittedKey='',confirmedResponse=false;
  try{
   await persistence.current.catch(()=>{});
   const intent={kind,...(savedId.current?{ticketId:savedId.current}:{draft:draftPayload(confirmConflict)}),details};
   const signature=JSON.stringify(intent);let requestKey=operationKeys.current.get(signature);if(!requestKey){requestKey=crypto.randomUUID();operationKeys.current.set(signature,requestKey)}
   submittedKey=requestKey;
   const r=await employeeFetch('/api/pos-operation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...intent,requestKey})}),d=await r.json();
   confirmedResponse=r.status<500&&!d.operationPending;
   if(d.savedTicketId){adoptTicket(d.savedTicketId)}
   if(!r.ok){if(d.requiresConfirmation){if(kind==='REBOOK'){setNearbyWarning(true);setConfirmWarning(false);return null;}else setBookingWarning(true);}if(d.savedTicketId){await load(d.savedTicketId);await loadCheckout(d.savedTicketId)}throw Error(d.error||d.warning||'Ticket action could not complete.')}
   setBookingWarning(false);operationKeys.current.delete(signature);if(kind==='CLOSE'){setInventoryWarnings(d.inventoryWarnings||[]);if(d.giftCards?.length)setShowGiftCards(true);if(d.prepaidPurchases?.length)setShowPrepaid(true);}
   if(kind==='REBOOK'){window.dispatchEvent(new CustomEvent('groompro:ticket-changed',{detail:{ticketId:d.ticket?.id}}));return d;}
   const id=d.ticket?.id||d.savedTicketId||savedId.current;adoptTicket(id);if(kind==='STATUS'&&d.ticket)setTicket((current:any)=>current.id===id?{...current,arrivalPriorityPending:Boolean(d.ticket.arrivalPriorityPending),...Object.fromEntries(['status','displayStatus','checkedInAt','arrivalPriority','pickupAt','pickupCompletedAt'].filter(key=>key in d.ticket).map(key=>[key,d.ticket[key]]))}:current);onSaved?.(id);
   if(details.returnToCalendar){finishSchedule();void Promise.all([load(id),loadCheckout(id)]);return d;}
   await Promise.all([load(id),loadCheckout(id)]);if(details.openPanel)setPanel(details.openPanel);return d;
  }catch(e){if(['PAYMENT','GIFT_CARD','PREPAID_PURCHASE','PREPAID_APPLY','PREPAID_REMOVE'].includes(kind)&&submittedKey&&!confirmedResponse&&!/Action cancelled/.test(String(e)))setUncertainPayment(submittedKey);setError(e instanceof Error?e.message:'Ticket action could not complete.');return null}
  finally{operationRunning.current=false;creating.current=false;setReplayRevision(v=>v+1);if(!savedId.current)for(const apply of deferredEdits.current.splice(0))await apply();requestAnimationFrame(()=>{if(previousFocus?.isConnected)previousFocus.focus()})}
 }
 useEffect(()=>{const action=pendingAction.current;if(action&&hoursReady&&ticket?.customer.id){if(ticket.lines.length||action.kind==='ENROLL'||action.kind==='GIFT_CARD'||action.kind==='PREPAID_PURCHASE')void operate(action.kind,action.details,action.confirmConflict);else{setPanel('Items');requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('[aria-label="Search items"]')?.focus())}}},[ticket,hoursReady]);
 function finishSchedule(){onScheduled?.(newStart.slice(0,10));onClose()}
 async function saveTicket(confirmConflict=false){
  if(savedId.current){if(moveRequest.current){finishSchedule();return savedId.current}if(operationRunning.current){finishSchedule();return savedId.current}if(pendingSlotEmployee===undefined&&slotAsset===undefined&&ticket.scheduledStart&&newStart===wallTime(new Date(ticket.scheduledStart),timezone)){finishSchedule();return savedId.current}const id=await move();if(id)finishSchedule();return id}
  const d=await operate('SAVE',{returnToCalendar:true},confirmConflict);return d?.ticket?.id||'';
 }

 async function toggleOfferToday(item:any,requested?:boolean){
  manualItemsVersion.current++;
 const present=requested??!offerTodayLine(ticket.lines,item.id,item.petId);
 if(creating.current){deferredEdits.current.push(()=>handlers.current.toggleOfferToday(item,present));return}
 if(terminal)return;
 const key=`offer:${item.id}:${item.petId}`;if(!beginAction(key))return;
 try{
  if(!ticketId){setTicket((t:any)=>({...t,lines:setDraftOffer(t.lines,item,present).map((l:any)=>l.clientKey?l:{...l,clientKey:crypto.randomUUID()})}));return}
  const r=await employeeFetch('/api/ticket-lines',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item,ticketId,offerToday:true,present})}),d=await r.json();
  if(!r.ok)throw Error(d.error||'Offer Today could not update.');
  await Promise.all([load(),loadCheckout()]);onSaved?.(ticketId);
 }catch(error){setError(error instanceof Error?error.message:'Offer Today could not update.')}finally{endAction(key)}
 }
 async function removePetItems(petId:string){
  manualItemsVersion.current++;
 if(creating.current){deferredEdits.current.push(()=>handlers.current.removePetItems(petId));return}if(terminal)return;
 if(!savedId.current){setTicket((t:any)=>({...t,lines:t.lines.filter((l:any)=>(l.petId||l.pet?.id)!==petId)}));return}
 const id=savedId.current,ids=ticket.lines.filter((l:any)=>(l.petId||l.pet?.id)===petId).map((l:any)=>l.id),key='pet-items:'+petId;if(!ids.length||!beginAction(key))return;
 try{const r=await employeeFetch('/api/ticket-lines?'+new URLSearchParams({ticketId:id,petId}),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({lineIds:ids})}),d=await r.json();if(!r.ok)throw Error(d.error);const removed=new Set(d.removedLineIds);if(savedId.current===id)setTicket((t:any)=>({...t,lines:t.lines.filter((l:any)=>!removed.has(l.id))}));await Promise.all([load(id),loadCheckout(id)]);onSaved?.(id)}catch(e){setError((e as Error).message)}finally{endAction(key)}
 }
 async function itemAction(action:'add'|'edit'|'remove',value:any,index=0){
  manualItemsVersion.current++;
 const removalLine=action==='remove'?(value?.line||ticket.lines[index]):null;let removalChoice:PackageRemovalChoice|null=null;if(action==='remove'){if(!removalLine||terminal)return false;removalChoice=await packageDeletionChoice(removalLine);if(!removalChoice)return false;}
 if(creating.current){deferredEdits.current.push(()=>handlers.current.itemAction(action,value,index));return}
 if(action==='add'&&value.type==='PACKAGE'){const pet=customerPets.find(p=>p.id===value.petId),pkg=catalog.packages.find((p:any)=>p.id===value.id);if(pet&&pkg)await addPetPackage(pet,pkg);return}
 if(!ticketId){try{const prices=Object.fromEntries((catalog.services||[]).map((service:any)=>[service.id,service.priceCents]));if(action==='remove')removePackageLine(ticket.lines,removalLine,removalChoice||'KEEP_DISCOUNT',prices);setTicket((t:any)=>({...t,lines:action==='add'?[...t.lines,{...value,clientKey:crypto.randomUUID()}]:action==='remove'?removePackageLine(t.lines,removalLine,removalChoice||'KEEP_DISCOUNT',prices):t.lines.map((l:any,i:number)=>i===index?{...l,...value,totalCents:Math.max(0,(l.unitPriceCents||0)*(value.quantity??l.quantity)-(l.discountCents||0))}:l)}));return true}catch(e){setError((e as Error).message);return false}}
 const line=removalLine||ticket.lines[index];const editVersion=revision.current+1;if(action==='edit'){editVersions.current.set(line.id,editVersion);failedEdits.current.set(line.id,{...failedEdits.current.get(line.id),...value})}const actionKey=action==='edit'?null:`line:${action}:${action==='add'?value?.id:line?.id}:${value?.petId||''}`;if(actionKey&&!beginAction(actionKey))return;revision.current++;if(action==='edit')setTicket((t:any)=>({...t,lines:t.lines.map((l:any)=>l.id===line.id?{...l,...value}:l)}));setError('');try{const url=action==='remove'?`/api/ticket-lines?lineId=${line.id}&ticketId=${ticketId}`:'/api/ticket-lines';const r=await employeeFetch(url,{method:action==='add'?'POST':action==='edit'?'PATCH':'DELETE',headers:{'Content-Type':'application/json'},...{body:JSON.stringify(action==='remove'?{packageRemovalChoice:removalChoice}:action==='add'?{...value,ticketId}:{...value,lineId:line.id,ticketId})}}),d=await r.json();if(!r.ok)throw Error(d.error);if(action==='edit'){const pending={...failedEdits.current.get(line.id)};for(const key of Object.keys(value))if(pending[key]===value[key])delete pending[key];if(Object.keys(pending).length)failedEdits.current.set(line.id,pending);else failedEdits.current.delete(line.id);}await Promise.all([load(),loadCheckout()]);onSaved?.(ticketId);return true}catch(e){setError(e instanceof Error?e.message:'Items could not update.');return false}finally{if(actionKey)endAction(actionKey)}}
 async function addPetPackage(pet:any,pkg:any){
  manualItemsVersion.current++;
 if(creating.current){deferredEdits.current.push(()=>handlers.current.addPetPackage(pet,pkg));return}if(terminal)return;
 const key=`package:${pet.id}:${pkg.id}`,alreadyAdded=ticket.lines.some((l:any)=>l.petId===pet.id&&l.packageId===pkg.id),present=!(packageIntents.current.get(key)??alreadyAdded),eligibility=present?groomingEligibility(pet,pkg,catalog.breeds):{status:'eligible',reason:''};
 if(present&&eligibility.status!=='eligible'){setError(pkg.name+': '+eligibility.reason);return}setPanel('Items');setPackagePet(null);setError('');
 if(!savedId.current){try{const added=present?expandPackage(pkg,catalog.services,pet.id).map((l:any)=>({...l,clientKey:crypto.randomUUID()})):[];setTicket((t:any)=>({...t,pets:t.pets.some((p:any)=>p.pet.id===pet.id)?t.pets:[...t.pets,{pet}],lines:present?[...t.lines,...added]:t.lines.filter((l:any)=>!(l.petId===pet.id&&l.packageId===pkg.id))}))}catch(e){setError(String(e))}return}
 const id=savedId.current,previous=packageQueues.current.get(key);if(!previous&&!beginAction(key))return;packageIntents.current.set(key,present);revision.current++;renderPackageIntent(v=>v+1);
 const task=(previous||Promise.resolve()).catch(()=>{}).then(async()=>{const r=await employeeFetch('/api/tickets/package',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:id,petId:pet.id,packageId:pkg.id,present})}),d=await r.json();if(!r.ok)throw Error(d.error);onSaved?.(id);await Promise.all([load(id),loadCheckout(id)])});packageQueues.current.set(key,task);
 try{await task}catch(e){setError(String(e))}finally{if(packageQueues.current.get(key)===task){packageQueues.current.delete(key);packageIntents.current.delete(key);endAction(key);renderPackageIntent(v=>v+1)}}
 }
 function clickPet(petId:string){if(terminal)return;manualItemsVersion.current++;const pet=customerPets.find(p=>p.id===petId)||ticket.pets.find((p:any)=>p.pet.id===petId)?.pet;if(!pet||pet.active===false)return;const target=petPackageToggle(pet,ticket.lines,catalog.packages||[],catalog.breeds);if(target){void addPetPackage(pet,target.pkg);return}setPanel('Items');setPackagePet(pet);setPackageQuery('')}
 async function overridePetServiceType(petId:string,serviceType:string){
  const key='pet-service:'+petId;
  const update=(current:any)=>{
   const petServiceTypes={...current.petServiceTypes};
   if(serviceType)petServiceTypes[petId]=serviceType;else delete petServiceTypes[petId];
   return {...current,petServiceTypes};
  };
  if(!ticketId){setTicket(update);return;}
  if(!beginAction(key))return;
  try{
   const r=await employeeFetch('/api/tickets/presentation',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId,petId,serviceType})});
   const result=await r.json();
   if(!r.ok)throw Error(result.error||'Could not change service type.');
   setTicket(update);
   onSaved?.(ticketId);
  }catch(e){setError((e as Error).message)}finally{endAction(key)}
 }
 async function markVipConversation(petId:string,recorded:boolean){
  const key='vip-conversation:'+petId;
  if(!beginAction(key))return;
  try{
   const response=await employeeFetch('/api/pets/vip-conversation',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({petId,customerId:ticket.customer.id,recorded})});
   const {pet,error}=await response.json();
   if(!response.ok)throw Error(error||'Could not update the VIP conversation.');
   setCustomerPets(pets=>pets.map(current=>current.id===pet.id?{...current,...pet}:current));
  }catch(error){setError((error as Error).message)}finally{endAction(key)}
 }
 async function closeOwner(){setOwnerView(null);if(ticketId){await load();return}if(ticket.customer.id){const r=await employeeFetch(`/api/customers/${ticket.customer.id}`),d=await r.json();if(r.ok){setCustomerPets(d.customer.pets.filter((p:any)=>p.active!==false));setTicket((t:any)=>({...t,customer:d.customer,pets:t.pets.map((p:any)=>({pet:d.customer.pets.find((v:any)=>v.id===p.pet.id)||p.pet}))}))}}}

 async function setTiming(value:string){timingChosen.current=true;if(creating.current){deferredEdits.current.push(()=>handlers.current.setTiming(value));return}if(!ticketId){setTicket({...ticket,timingMode:value,lineStarts:{}});return}revision.current++;try{const r=await employeeFetch('/api/tickets/timing',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId,timingMode:value})}),d=await r.json();if(!r.ok)throw Error(d.error);onSaved?.(ticketId);await load()}catch(e){setError(String(e))}finally{}}
 async function move(){
  if(savedId.current&&!ticket.id)return;
  if(moveRequest.current)return moveRequest.current;
  if(!newStart){document.querySelector<HTMLInputElement>('[aria-label="Appointment date"]')?.focus();return ''}
  if(!savedId.current){await persistDraft();return ''}
  const id=savedId.current,start=newStart,selectedVersion=slotVersion.current;
  setMoving(true);setError('');
  const request=(async()=>{try{
   const scheduledStart=localToInstant(start,timezone).toISOString();
   const r=await employeeFetch('/api/tickets',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:id,scheduledStart,...(slotAsset!==undefined?{bookingAssetId:slotAsset?.id||null}:{}),...(pendingSlotEmployee!==undefined?{groomerId:pendingSlotEmployee||null}:{})})}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Appointment could not be moved.');
   setTicket((current:any)=>current.id===id?{...current,scheduledStart}:current);
   if(selectedVersion===slotVersion.current){pendingSelection.current=false;setPendingSlotEmployee(undefined);setSlotAsset(undefined)}onSaved?.(id);return id;
  }catch(e){const message=e instanceof Error?e.message:'Appointment could not be moved.';setError(message);return ''}
  finally{moveRequest.current=null;setMoving(false)}})();
  moveRequest.current=request;return request;
 }

 async function changeStatus(next:string,action?:string){if(!ticket||(!action&&next===ticket.status&&!(next==='CHECKED_IN'&&(!ticket.checkedInAt||!ticket.arrivalPriority))))return;setStatusSaving(true);try{await operate('STATUS',{status:next,action})}finally{setStatusSaving(false)}}
 async function saveArrival(){const edit=arrivalEdit.current;if(!edit||edit.ticketId!==ticketId)return;arrivalEdit.current=null;revision.current++;const pending=persistence.current.catch(()=>{}).then(async()=>{const r=await employeeFetch('/api/whiteboard',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:edit.ticketId,action:'PRIORITY',value:edit.value})});const d=await r.json();if(!r.ok)throw Error(d.error);onSaved?.(edit.ticketId)});persistence.current=pending;try{await pending}catch(e){setError((e as Error).message);await load()}}
 function selectTicketStatus(next:string){
  if(next==='CLOSED')return void closeTicket();
  if(next==='NO_SHOW')return void processNoShow();
  if(next==='CHECKED_IN'&&ticket.pickupAt)return void changeStatus(next,'UNDO_READY');
  if(next==='CONFIRMED'&&ticket.checkedInAt)return void changeStatus(next,'UNDO_CHECK_IN');
  void changeStatus(next);
 }
 function chooseWeeks(weeks:number){const d=ticket?.scheduledStart?new Date(wallTime(new Date(ticket.scheduledStart),timezone)):new Date(newStart||(wallTime(new Date(),timezone).slice(0,10)+"T09:00"));d.setDate(d.getDate()+weeks*7);proposeRebook(localInput(d))}
 async function rebook(){if(!rebookStart||!ticket)return;const signature=JSON.stringify([ticket.customer.id,rebookStart,rebookGroomerId,rebookAsset?.id]);if(completedRebooks.current.has(signature))return;if(!beginAction('rebook'))return;setRebooking(true);try{const d=await operate('REBOOK',{scheduledStart:localToInstant(rebookStart,timezone).toISOString(),groomerId:rebookGroomerId||null,bookingAssetId:rebookAsset?.id||null,confirmRecentWarning:confirmWarning});if(d){completedRebooks.current.add(signature);setConfirmWarning(false);setNearbyWarning(false);await loadUpcoming()}}finally{endAction('rebook');setRebooking(false)}}
 async function recordPayment(){if(uncertainPayment)return;if(!beginAction('payment'))return;setPaying(true);try{const d=await operate('PAYMENT',{paymentType,giftCardCode,amountCents:Math.round(Number(paymentAmount)),tipCents:Math.max(0,Math.round(Number(tip))),salesTaxCents:currentTax()});if(d){setPaymentAmount(String(d.dueCents||''));await loadCheckout(savedId.current)}}finally{endAction('payment');setPaying(false)}}
 async function closeTicket(){if(!beginAction('payment'))return;setClosing(true);try{const d=await operate('CLOSE',{tipCents:Number(tip)||0,salesTaxCents:currentTax()});if(d){await loadCheckout(savedId.current);try{const r=await employeeFetch('/api/tickets/customer-report-card?ticketId='+encodeURIComponent(savedId.current)),card=await r.json();if(!r.ok)throw Error(card.error);setReportCardPrompt(card.closingMode==='ASK'?'Would you like to send the customer’s report card by text, email, or both?':!card.saved?'Ticket closed. Save a customer report card to make it available for automatic sending.':'')}catch{setReportCardPrompt('Ticket closed. Open Report Card to review its delivery options.')}}}finally{endAction('payment');setClosing(false)}}
 async function processNoShow(){if(!beginAction('payment'))return;setNoShowing(true);try{await operate('NO_SHOW')}finally{endAction('payment');setNoShowing(false)}}
 async function adjustAccount(){const cents=Math.round(Number(accountAmount));if(!cents||!accountReason.trim())return;if(!beginAction('account'))return;setAdjusting(true);setError("");try{const r=await employeeFetch("/api/customers/account",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customerId:ticket?.customer.id,entryType:accountType,amountCents:cents,reason:accountReason})}),d=await r.json();if(!r.ok)throw new Error(d.error||"Account adjustment failed.");setAccount(d.customer);setAccountAmount("");setAccountReason("");await Promise.all([load(),loadCheckout()])}catch(e){setError(e instanceof Error?e.message:"Account adjustment failed.")}finally{endAction('account');setAdjusting(false)}}
 async function redeemReward(reward:Reward){setRedeeming(reward.id);try{await operate('REDEEM',{customerId:ticket.customer.id,rewardId:reward.id})}finally{setRedeeming('')}}



 async function verifyPayment(){try{const r=await employeeFetch(`/api/pos-operation?requestKey=${encodeURIComponent(uncertainPayment)}`),d=await r.json();if(!r.ok)throw Error(d.error);if(d.status!=='DONE'){setError('Payment is not yet confirmed. Check again before taking another payment.');return}for(const [signature,key] of operationKeys.current)if(key===uncertainPayment)operationKeys.current.delete(signature);setUncertainPayment('');if(d.responseStatus>=400)setError(d.response?.error||'Payment was not accepted.');else setError('');await Promise.all([load(),loadCheckout()]);onSaved?.(savedId.current)}catch(e){setError((e as Error).message)}}
 const draftSubtotal=(ticket?.lines||[]).reduce((n:number,l:any)=>n+(l.totalCents||0),0);
 const totals=checkout?{...checkout,totalCents:checkout.totalCents-checkout.tipCents-checkout.salesTaxCents+currentTax()+Number(tip||0),dueCents:checkout.dueCents-checkout.tipCents-checkout.salesTaxCents+currentTax()+Number(tip||0)}:{subtotalCents:draftSubtotal,totalCents:draftSubtotal+currentTax()+Number(tip||0),paidCents:0,dueCents:draftSubtotal+currentTax()+Number(tip||0)};
 const stamp=(value?:string|null)=>value?new Date(value).toLocaleString(undefined,{timeZone:timezone,month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"—";
 async function includePet(p:any,included:boolean){if(creating.current){deferredEdits.current.push(()=>handlers.current.includePet(p,included));return}if(!ticketId){setTicket({...ticket,pets:included?[...ticket.pets,{pet:p}]:ticket.pets.filter((v:any)=>v.pet.id!==p.id),lines:included?ticket.lines:ticket.lines.filter((l:any)=>l.petId!==p.id)});return}revision.current++;try{const r=await employeeFetch('/api/tickets/pets',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId,petId:p.id,included})});if(!r.ok)throw Error((await r.json()).error);onSaved?.(ticketId);await load()}catch(e){setError((e as Error).message)}finally{}}
 async function assignGroomer(id:string){if(creating.current){deferredEdits.current.push(()=>handlers.current.assignGroomer(id));return}setGroomerId(id);if(!ticketId){setGroomerId(id);return}if(pendingSelection.current||(ticket.scheduledStart&&newStart!==wallTime(new Date(ticket.scheduledStart),timezone))){pendingSelection.current=true;slotVersion.current++;setPendingSlotEmployee(id);return}revision.current++;try{const r=await employeeFetch('/api/tickets/groomer',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId,userId:id||null})});const d=await r.json();if(!r.ok)throw Error(d.error);onSaved?.(ticketId)}catch(e){setError((e as Error).message)}finally{}}
 useEffect(()=>{if(ticket.id&&ticket.id===savedId.current&&!creating.current){for(const apply of deferredEdits.current.splice(0))void apply()}},[ticket,replayRevision]);
 handlers.current={removePetItems,toggleOfferToday,itemAction,assignGroomer,setTiming,includePet,chooseCustomer,addPetPackage};
 const loading=ticketId?!ticket.id:!recordReady;
 const shownPanel=panel;
 function openPanel(name:string){
  setPhonePayment(false);setPhoneActions(false);setPanel(name);onPanelChange?.(name);
  if(name==='Report Card'&&!savedId.current)void operate('SAVE',{openPanel:name});
 }
 const balanceLinks=<>
 <button className="gp-pos-account-link" data-customer-name={!loading?[ticket.customer.firstName,ticket.customer.lastName].filter(Boolean).join(' '):undefined} type="button" data-balance={!loading&&account.balanceCents!==0?'owed':undefined} onClick={()=>openPanel('Account & Rewards')}><strong>Owes</strong> {!loading&&money(account.balanceCents)}{!loading&&account.balanceCents!==0&&<> <span aria-hidden="true">!</span></>}</button>
 <button className="gp-pos-account-link" data-customer-name={!loading?[ticket.customer.firstName,ticket.customer.lastName].filter(Boolean).join(' '):undefined} type="button" data-balance={!loading&&account.creditCents!==0?'credit':undefined} onClick={()=>openPanel('Account & Rewards')}><strong>Credit</strong> {!loading&&money(account.creditCents)}{!loading&&account.creditCents!==0&&<> <span aria-hidden="true">?</span></>}</button>
 </>;
 const ticketTabsControl=<TicketTabs tabs={layout.tabs} panel={shownPanel} onChange={openPanel}/>;
 const terminal=!!ticket&&["CLOSED","CANCELLED","NO_SHOW"].includes(ticket.status);
 const showDetails=()=>{setPhoneDetails(v=>!v);setPhonePayment(false);setPhoneActions(false)};
 const canRecordCall=!!ticket.id&&ticket.status==='READY'&&!!ticket.pickupAt&&!ticket.pickupCompletedAt&&!ticket.pickupCalledAt;
 const [invitationNotice,setInvitationNotice]=useState('');
 const [showPickupMessage,setShowPickupMessage]=useState<'PICKUP'|'CUSTOMER'|null>(null);
 const [showPickupCall,setShowPickupCall]=useState(false);
 async function calendarInvite(send:boolean){try{const r=await employeeFetch('/api/tickets/calendar-invitation'+(send?'':'?ticketId='+encodeURIComponent(ticketId)),send?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId})}:undefined);if(!r.ok)throw Error((await r.json()).error);if(send){setInvitationNotice((await r.json()).message);return;}const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='appointment.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(e){setError((e as Error).message)}}
 async function recordPickupCall(){
  const key='pickup-call',calledAt=new Date().toISOString();
  if(!canRecordCall||!beginAction(key))return;
  try{
   const r=await employeeFetch('/api/tickets/visit-history',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId,calledAt})}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Pickup call could not be recorded.');
   setTicket((current:any)=>current.id===ticketId?{...current,pickupCalledAt:d.pickupCalledAt}:current);
  }catch(e){setError((e as Error).message)}finally{endAction(key)}
 }
 const arrivalControl=<label data-related-path="Settings → Calendar & Workflow → Appointment Appearance → Appointment Details → Arrival Order" data-help="Shows this appointment’s arrival order for the day. Change the number here when staff need to correct the order; it does not change the booked time." className="gp-pos-arrival" style={{fontSize:layout.fontSize,position:"relative"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 5h12M9 12h12M9 19h12M3 3v5M2 12h3l-3 4h3M2 19h3"/></svg>Order <input type="number" min={1} style={{fontSize:"2em",width:"3ch",minWidth:48,fontWeight:700}} aria-label="Arrival priority" disabled={terminal} value={ticket.arrivalPriority||""} onChange={e=>{
 const arrivalPriority=Number(e.target.value)||null;
 arrivalEdit.current={ticketId,value:arrivalPriority};
 if(ticketId&&!ticket.id)arrivalBeforeLoad.current=arrivalPriority;
 else revision.current++;
 setTicket((current:any)=>({...current,arrivalPriority}));
 }} onBlur={()=>{if(ticket.id)void saveArrival()}}/>{ticket.arrivalPriorityPending&&!ticket.arrivalPriority&&<button type="button" aria-label="Review Pending Check-In" onClick={()=>window.dispatchEvent(new Event('groompro:review-offline'))} style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",width:48,fontSize:10,lineHeight:"12px",whiteSpace:"normal",textAlign:"center",padding:0,border:0,cursor:"pointer"}} title="The check-in is saved on this device. GroomPro will assign its order when it syncs. If it stays pending, open Review Offline Changes."><small role="status">Waiting to Sync</small></button>}</label>;
 return <>{photoPet&&<PetPhotoEditor pet={photoPet} onClose={()=>setPhotoPet(null)} onSaved={pet=>{setCustomerPets(current=>current.map(p=>p.id===pet.id?{...p,...pet}:p));setPhotoPet((current:any)=>current?.id===pet.id?{...current,...pet}:current)}}/>}{showPickupCall&&<PickupCall ticketId={ticketId} locationId={ticket.locationId} onClose={()=>setShowPickupCall(false)} onSaved={()=>{void load();window.dispatchEvent(new CustomEvent("groompro:data-changed",{detail:{url:"/api/ticket"}}));setShowPickupCall(false)}}/>}{showPickupMessage&&<PickupMessage purpose={showPickupMessage} locationId={ticket.locationId} ticketId={ticketId} onClose={()=>setShowPickupMessage(null)} onSaved={()=>{void load();window.dispatchEvent(new CustomEvent("groompro:data-changed",{detail:{url:"/api/ticket"}}))}}/>}<PosWindowFrame active={active} className={(phone?"gp-pos-phone ":"gp-pos-desktop ")+(phonePayment?"gp-phone-payment-open ":"")+(phoneActions?"gp-phone-actions-open ":"")} style={{fontSize:layout.fontSize,...Object.fromEntries(layout.footer.map((id,i)=>["--gp-footer-"+id+"-order",i]))} as any}>
 <div className="gp-floating-head gp-ticket-titlebar" style={!loading&&workspace.colorTicketHeader&&ticketId&&presentationOptions.statusStyles?appointmentStyle(ticket,presentationOptions):undefined}>
  <div className="gp-floating-title"><PosTicketLabel compact={phone} number={loading?undefined:ticket.orderNumber||draft?.orderNumber}/></div>
  <PosCustomerTitle name={!loading&&ticket.customer.id?[ticket.customer.firstName,ticket.customer.lastName].filter(Boolean).join(' '):''} disabled={terminal} onEdit={()=>setOwnerView({id:ticket.customer.id})} onReplace={()=>{setPendingOwner(null);setCustomerQuery('');setChoosingCustomer(v=>!v)}}/>
  <PosVisitStamps onCheckedIn={!loading&&!terminal&&(!ticket.checkedInAt||!ticket.arrivalPriority)&&!statusSaving?()=>selectTicketStatus("CHECKED_IN"):undefined} onTexted={!loading&&ticket.id?()=>setShowPickupMessage(ticket.status==="READY"&&!ticket.pickupCompletedAt?"PICKUP":"CUSTOMER"):undefined} onCompleted={!loading&&!terminal&&ticket.status!=="READY"&&!statusSaving&&!pendingKeys.includes("payment")?()=>selectTicketStatus("READY"):undefined} onCalled={ticket.id?()=>setShowPickupCall(true):undefined} arrival={arrivalControl} checkedIn={ticket.checkedInAt} completed={ticket.pickupAt} called={ticket.pickupCalledAt} texted={ticket.pickupTextedAt} timezone={timezone} contactNeeded={ticket.status==='READY'&&!!ticket.pickupAt&&!ticket.pickupCompletedAt&&!ticket.readyContacted&&!ticket.pickupCalledAt}/>
  <div className="gp-pos-window-actions"><PosFullSizeButton/><PosHeaderMenu onFollowUps={ticketId?()=>setShowFollowUps(true):undefined} onVoid={ticketId?()=>setShowVoid(true):undefined} onPrepaid={()=>setShowPrepaid(true)} onGiftCards={()=>setShowGiftCards(true)} onEmailReceipt={ticketId?()=>void prepareReceiptEmail():undefined} onReceipt={ticketId?()=>void openReceipt():undefined} onCalendar={ticketId?(send)=>void calendarInvite(send):undefined} details={phoneDetails} onDetails={phone?showDetails:undefined} onCall={canRecordCall?()=>void recordPickupCall():undefined} callPending={pendingKeys.includes('pickup-call')}/><DismissButton label="Dismiss POS Ticket" onClick={()=>void closeWindow()}/></div>
 </div>
 <TicketConfirmationRequest ticketId={ticketId||''} visitStatus={ticket.status} scheduledStart={ticket.scheduledStart} onEditCustomer={id=>setOwnerView({id})}/>
 {receiptEmail&&<section aria-label="Email invoice or receipt" className="gp-settings-card"><strong>Email saved invoice or receipt</strong><p>Send this copy to {receiptEmail.email}. Unsaved ticket changes are not included.</p><button type="button" className="gp-btn primary" disabled={receiptEmailBusy} onClick={()=>void emailReceipt()}>Send email</button><button type="button" className="gp-btn" disabled={receiptEmailBusy} onClick={()=>setReceiptEmail(null)}>Cancel</button></section>}
 {receiptEmailNotice&&<p role="status">{receiptEmailNotice}<button type="button" onClick={()=>setReceiptEmailNotice('')}>Dismiss</button></p>}
 {!!inventoryWarnings.length&&<div role="status" className="gp-form-error"><strong>Ticket closed. Inventory needs attention.</strong>{inventoryWarnings.map((warning,i)=><p key={i}>{warning}</p>)}<button type="button" onClick={()=>setInventoryWarnings([])}>Dismiss</button></div>}
 {readError&&<div role="alert" className="gp-form-error">{readError}</div>}
 {loading&&recordReady&&ticketId&&<button type="button" className="gp-btn" onClick={()=>void load()}>Retry ticket</button>}
 {invitationNotice&&<p role="status">{invitationNotice}<button type="button" onClick={()=>setInvitationNotice('')}>Dismiss</button></p>}{error&&<div>{failedPlans.current.size>0&&<button type="button" className="gp-btn" onClick={()=>{for(const assignment of failedPlans.current.values())void planPackage(assignment)}}>Retry planned employee changes</button>}{uncertainPayment&&<button onClick={()=>void verifyPayment()}>Check payment status</button>}{failedEdits.current.size>0&&<button onClick={()=>{for(const [id,patch] of failedEdits.current){const i=ticket.lines.findIndex((l:any)=>l.id===id);if(i>=0)void itemAction('edit',patch,i)}}}>Retry unsaved edits</button>}</div>}
 {ticket&&<>
 <div className="gp-phone-ticket-summary gp-phone-only"><span>{loading?'— · — · —':<>{newStart?new Date(newStart).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}):'Choose date'} · {newStart?new Date(newStart).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'Choose time'} · {ticketStatusLabel(ticket)}</>}</span></div>
 {phone&&<div className="gp-pos-account-strip">{balanceLinks}<span><span className="gp-field-caption">Daycare:</span> {loading?'':ticketDaycareLabel(ticket,catalog.services)}</span><span><span className="gp-field-caption">Rewards:</span> {loading?"":account.loyaltyPoints+" pts"}</span><strong>{loading?'Card on File:':cardOnFile?'Card on File':'No Card on File'}</strong></div>}
 <header className="gp-pos-header gp-pos-compact-header" data-details-open={phoneDetails}>
 <div className="gp-phone-only"><PosFullSizeButton/></div>
 <div style={{display:"flex",gap:8,alignItems:"center",minWidth:0}}><div style={{flex:1,minWidth:0}}><TicketTopLayout layout={layout} textFirst controls={{date:<label data-help={"Choose the appointment’s calendar date. Moving it to another date can affect cancellation fees and rebooking discounts."}>Date<input className="gp-search-input" aria-label="Appointment date" type="date" value={loading&&!editedStart.current.date?"":newStart.split('T')[0]} onFocus={()=>{calendarWorkflow.current="Items"}} onChange={e=>{calendarWorkflow.current="Items";editedStart.current.date=true;const value=appointmentPart(newStart,'date',e.target.value);setNewStart(value);navigateDate(value)}}/></label>,
time:<label data-help={"Choose when the appointment starts. A time change on the same date keeps the approved rebooking discount."}>Time<input className="gp-search-input" aria-label="Appointment time" type="time" step={60} value={loading&&!editedStart.current.time?"":newStart.split('T')[1]||''} onFocus={()=>{calendarWorkflow.current="Items"}} onChange={e=>{calendarWorkflow.current="Items";editedStart.current.time=true;const value=appointmentPart(newStart,'time',e.target.value);setNewStart(value);navigateDate(value)}}/></label>,
timing:<label data-related-path="Settings → Calendar & Workflow → Booking Rules → Default Appointment Timing" data-help="Choose Same Time when services overlap. Choose Add Up Time when they run one after another. This choice applies to this ticket.">Timing <select disabled={terminal} value={loading?"":ticket.timingMode||"SEQUENTIAL"} onChange={e=>setTiming(e.target.value)}>{loading&&<option value=""/>}<option value="SEQUENTIAL">Add Up Time</option><option value="CONCURRENT">Same Time</option></select></label>,
move:<><button className="gp-btn primary" disabled={moving} onClick={()=>void move()}>{moving?"Moving…":"Move"}</button><HelpPopup label="Move">Every move is recorded in POS Ticket → History with the employee responsible.</HelpPopup></>,
status:<div style={{display:"flex",alignItems:"center",gap:4}}><button type="button" className="gp-btn" disabled={statusSaving||terminal||pendingKeys.includes("payment")} onClick={()=>setStatusPicker(true)}>Status</button><span>{loading?"":ticketStatusLabel(ticket)}</span><HelpPopup label="Customer confirmation">{loading?'Customer confirmation appears here once the appointment is available.':ticket.customerAttendance?.confirmedAt?'Customer confirmed attendance on '+new Date(ticket.customerAttendance.confirmedAt).toLocaleString(undefined,{timeZone:timezone})+'.':'No customer attendance confirmation is recorded for this date and time.'} Accepted means the shop accepted the booking. Confirmed means the customer said they are coming. Recording Confirmed stops further confirmation requests; any reminders the customer chose stay in place.</HelpPopup></div>,
asset:(slotAsset?.name||(slotAsset===undefined?ticket.bookingAssetName:""))?<small data-help="This resource is reserved for the appointment, such as a self-service wash station. Moving the appointment keeps its resource booking subject to availability."><span className="gp-field-caption">Booking Asset:</span> {slotAsset?.name||ticket.bookingAssetName}</small>:null,
arrival:null,
balance:phone?null:<div className="gp-pos-inline">{balanceLinks}</div>,
account:phone?null:<div className="gp-pos-account-strip"><span><span className="gp-field-caption">Daycare:</span> {loading?'':ticketDaycareLabel(ticket,catalog.services)}</span><span><span className="gp-field-caption">Rewards:</span> {loading?"":account.loyaltyPoints+" pts"}</span><strong>{loading?'Card on File:':cardOnFile?'Card on File':'No Card on File'}</strong></div>,
}}/></div><div aria-label="Pet Pictures" style={{marginLeft:'auto',display:'flex',gap:6,maxWidth:'30%',overflowX:'auto'}}>{customerPets.filter(p=>p.active!==false).map(p=><button type="button" key={p.id} aria-label={'Edit Photos for '+p.name} title={'Click or Right-Click to Edit '+p.name+'’s Photos'} onClick={()=>setPhotoPet(p)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setPhotoPet(p)}} style={{width:54,minWidth:54,height:54,border:'1px dashed #94a9b9',borderRadius:6,textAlign:'center',fontSize:10,overflow:'hidden',background:'#f0f7fa',padding:0,cursor:'pointer'}}><PetPicture currentProfile petId={p.id} pictureUrl={p.pictureUrl} name={p.name} style={{width:52,height:35,objectFit:'cover'}}/><div>{p.name}</div></button>)}</div></div></header>
 {!loading&&choosingCustomer&&<section className="gp-pos-customer-search" role="dialog" aria-label={ticket.customer.id?"Replace customer":"Choose customer"}><div className="gp-pos-picker-title"><strong>{ticket.customer.id?"Replace customer":"Choose customer"}</strong><DismissButton label="Dismiss customer picker" onClick={()=>{setChoosingCustomer(false);setPendingOwner(null)}}/></div><input aria-label="Search customer" placeholder="Search customer or pet" value={customerQuery} onChange={e=>setCustomerQuery(e.target.value)}/>{customerResults.map(c=><button className="gp-customer-result" key={c.id} onClick={()=>chooseCustomer(c)}><CustomerIdentification customer={c} fields={["name","email","phones","pets"]}/></button>)}{pendingOwner&&<div><p>Move this ticket and its service lines to {pendingOwner.firstName} {pendingOwner.lastName}, for:</p><select aria-label="New owner dog" value={replacementPet} onChange={e=>setReplacementPet(e.target.value)}>{pendingOwner.pets.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button disabled={!replacementPet} onClick={changeCustomer}>Apply customer</button></div>}</section>}
 <span data-customer-id={ticket.customer.id} /><PosPetStrip onPhoto={setPhotoPet} customerNotes={standingNotes.customerId===ticket.customer.id?standingNotes.customer:''} permanentNotes={standingNotes.customerId===ticket.customer.id?standingNotes.pets:{}} notesPopup={active} tapNotesPopup={phone} indicators={workspace.petIndicators} pets={customerPets.filter(p=>p.active!==false)} includedIds={ticket.pets.map((v:any)=>v.pet.id)} packageIds={customerPets.filter(p=>{const target=petPackageToggle(p,ticket.lines,catalog.packages||[],catalog.breeds);if(!target)return false;return packageIntents.current.get(`package:${p.id}:${target.pkg.id}`)??!target.present}).map(p=>p.id)} disabled={terminal} warnVet={warnVet} summaries={Object.fromEntries(customerPets.map((p:any)=>[p.id,groomingSummary(ticket.groomingNotesDraft?.[p.id]?.instructions||noteSummaries[p.id])]))} onInclude={(p,included)=>void includePet(p,included)} onPackage={clickPet} onNotes={()=>setPanel("Notes")}/>
 <div className="gp-ticket-workbar">
 {!phone&&ticketTabsControl}
 <PromotingServices blank={loading} services={catalog.services||[]} pets={customerPets} petId={ticketItemPet(customerPets.filter(p=>p.active!==false),itemPetId)} onPetChange={setItemPetId} lines={ticket.lines} onToggle={item=>void toggleOfferToday(item)} disabled={terminal} pending={pendingKeys}/>
 {phone&&ticketTabsControl}
 </div>
 <main className="gp-pos-body">
 {shownPanel==="Items"&&packagePet&&<FloatingEditorWindow windowKey="pos-package-picker" title={"Choose a Package for "+packagePet.name} initialSize={{width:600,height:480}} onClose={()=>setPackagePet(null)} style={{zIndex:2000}}><p>Matching packages appear first. Type to search all packages; choices that do not fit remain unavailable. Record missing measurements in the pet profile.</p>{!packageQuery.trim()&&!catalog.packages.some((p:any)=>p.active&&groomingEligibility(packagePet,p,catalog.breeds).status==='eligible')&&<p role="status">No eligible package is available yet. Update this dog’s measurements, or type to review the available packages.</p>}<input aria-label="Search pet packages" placeholder="Search packages" value={packageQuery} onChange={e=>setPackageQuery(e.target.value)}/>{catalog.packages.filter((p:any)=>p.active&&(packageQuery.trim()||groomingEligibility(packagePet,p,catalog.breeds).status==='eligible')&&matchesCatalogSearch(p,packageQuery)).map((p:any)=><button className="gp-btn" key={p.id} style={{display:"block",width:"100%",padding:12,textAlign:"left",whiteSpace:"normal",borderBottom:"1px solid #cbd9e5",background:"#f0f7fa"}} disabled={terminal||groomingEligibility(packagePet,p,catalog.breeds).status!=="eligible"} onClick={()=>addPetPackage(packagePet,p)}>{p.name} · {money(p.priceCents)} {groomingEligibility(packagePet,p,catalog.breeds).reason}{p.description&&<small style={{display:"block"}}>{p.description}</small>}</button>)}<button className="gp-btn" onClick={()=>setOwnerView({id:packagePet.customerId||ticket.customerId,petId:packagePet.id})}>Update pet measurements</button><button className="gp-btn" onClick={()=>setPackagePet(null)}>Cancel</button></FloatingEditorWindow>}
 {shownPanel==="Items"&&<PosItems promotionLines={ticket.promotionDisplay||[]} serviceTypeControl={petId=><InlineItemValue label="Service type" value={petServiceType(ticket,petId)||'Service type'} disabled={terminal||pendingKeys.includes('pet-service:'+petId)}><select aria-label="Service type for this dog" value={ticket.petServiceTypes?.[petId]||''} onChange={e=>void overridePetServiceType(petId,e.target.value)}><option value="">From booked services</option>{[...new Set([...serviceTypes.filter(type=>type!=='NEW'),...(presentationOptions.customServiceTypes||[])])].map(type=><option key={type}>{type}</option>)}</select></InlineItemValue>} startTimes={displayLineTimes()} onStart={ticket.timingMode==='SEQUENTIAL'?setLineStart:undefined} onRemovePet={petId=>void removePetItems(petId)} removingPets={pendingKeys.filter(k=>k.startsWith('pet-items:')).map(k=>k.slice(10))} salesTaxCents={currentTax()} plannedAssignments={ticket.plannedAssignments||[]} plannedFallback={ticket.plannedAssignments?.length?'':ticket.assignments?.find((a:any)=>a.role==='PLANNED_GROOMER')?.user?.id||groomerId} individualAssignments={workspace.individualPackageAssignments} planningDisabled={!appointmentStaff.ready} scheduledEmployeeIds={appointmentStaff.ids} staffNotice={!appointmentStaff.ready?<small role={appointmentStaff.error?'alert':'status'}>{appointmentStaff.error||'Loading employees scheduled for this day...'}{appointmentStaff.error&&<button type="button" className="gp-btn" onClick={appointmentStaff.retry}>Retry Schedules</button>}</small>:undefined} onPlan={a=>void planPackage(a)} selectedPet={ticketItemPet(customerPets.filter(p=>p.active!==false),itemPetId)} lines={ticket.lines} pets={customerPets.filter(p=>p.active!==false)} employees={employees} catalog={catalog} disabled={terminal} onAdd={item=>void itemAction('add',item)} onEdit={(i,patch)=>void itemAction('edit',patch,i)} onRemove={(i,line)=>itemAction('remove',{line},i)} onPet={clickPet}/>}
 {shownPanel==="VIP Memberships"&&ticket.customer.id&&<section className="gp-pos-panel"><h3>VIP sales conversations</h3>{customerPets.filter(p=>p.active!==false).map(p=><label key={p.id} className="gp-vip-conversation-row" data-help-name="VIP sales conversations" data-help-path="POS Ticket → VIP Memberships → VIP sales conversations" data-help={vipConversationHint(p,new Date(),timezone)}><input type="checkbox" checked={Boolean(p.careFlags?.vipConversationAt)} disabled={pendingKeys.includes('vip-conversation:'+p.id)} onChange={e=>void markVipConversation(p.id,e.target.checked)}/>{p.name}</label>)}</section>}
 {shownPanel==="VIP Memberships"&&(ticket.customer.id?<MembershipEnrollment key={ticket.customer.id} plans={catalog.plans.filter((p:any)=>p.active)} initialCustomerId={ticket.customer.id} ticketId={ticketId||undefined} enroll={async body=>{const result=await operate('ENROLL',body);if(!result)throw Error('Enrollment did not complete. Review the ticket message.');return result}} onEnrolled={async id=>{adoptTicket(id);await Promise.all([load(id),loadCheckout(id)])}}/>:<p>Choose a customer to enroll a dog.</p>)}
 {shownPanel==="Rebook"&&<div className="gp-pos-panel">{ticket.status!=="CANCELLED"&&ticket.status!=="NO_SHOW"&&<div className="gp-field" style={{marginTop:0,paddingTop:0}}><div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"0 0 6px"}}>{Array.from({length:12},(_,i)=>i+1).map(w=><button key={w} type="button" className="gp-btn" onClick={()=>chooseWeeks(w)}>{w} {w===1?"week":"weeks"}</button>)}</div><div className="gp-responsive-form-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,alignItems:"start"}}><div><label className="gp-label" htmlFor={`rebook-date-${ticketId}`}>New Date / Time</label><input className="gp-search-input" onFocus={()=>{calendarWorkflow.current="Rebook"}} id={`rebook-date-${ticketId}`} type="datetime-local" value={rebookStart} onChange={e=>proposeRebook(e.target.value)}/><AppointmentHistory tickets={upcoming} pets={customerPets} currentId={ticketId}/>{upcomingError&&<p role="status">{upcomingError} <button onClick={()=>void loadUpcoming()}>Retry</button></p>}</div><div><span className="gp-label">Assign a Groomer</span>{rebookAsset&&<small>Booking asset: {rebookAsset.name}</small>}<select aria-label="Rebooking groomer" className="gp-search-input" value={rebookGroomerId} onChange={e=>setRebookGroomerId(e.target.value)}><option value="">Assign later</option>{[...groomers,...employees.filter(e=>e.active&&e.id===rebookGroomerId&&!groomers.some(g=>g.id===e.id))].map(e=><option key={e.id} value={e.id}>{employeeName(e)}</option>)}</select></div><button className="gp-btn primary" disabled={rebooking||!rebookStart} onClick={rebook}>{rebooking?"Rebooking…":"REBOOK"}</button></div></div>}</div>}
 {showFollowUps&&ticketId&&<TicketFollowUps ticketId={ticketId} onClose={()=>setShowFollowUps(false)}/>}
 {showVoid&&ticketId&&<TicketVoid ticketId={ticketId} onClose={()=>setShowVoid(false)} onVoided={async()=>{await Promise.all([load(ticketId),loadCheckout(ticketId)]);onSaved?.(ticketId)}}/>}
 {shownPanel==="Account & Rewards"&&<div className="gp-pos-panel"><CustomerDeposit key={ticket.customer.id} customerId={ticket.customer.id} onRecorded={async()=>{const version=customerChoiceVersion.current;const r=await employeeFetch('/api/customers/account?customerId='+encodeURIComponent(ticket.customer.id)),d=await r.json();if(!r.ok)throw Error(d.error);if(mounted.current&&version===customerChoiceVersion.current&&accountCustomerId.current===ticket.customer.id)setAccount(d)}}/><ApplyCustomerCredit key={ticketId} ticketId={ticketId||''} availableCents={account.creditCents} disabled={terminal||!!uncertainPayment} onApplied={async()=>{await Promise.all([load(ticketId),loadCheckout(ticketId)])}}/>{ticket.status==='CLOSED'&&<TicketRefunds ticketId={ticketId||''} onRecorded={async()=>{await Promise.all([load(ticketId),loadCheckout(ticketId)])}}/>}<TicketReferralRewards ticketId={ticketId||''} lines={ticket.lines} canChange={!terminal&&!uncertainPayment} onApplied={async()=>{await Promise.all([load(ticketId),loadCheckout(ticketId)])}}/><TicketPromotions lines={ticket.lines} ticketId={ticketId||''} canChange={!terminal&&!uncertainPayment} onApplied={async()=>{await Promise.all([load(ticketId),loadCheckout(ticketId)])}}/>
 <div className="gp-field" style={{marginTop:18,paddingTop:16,borderTop:"1px solid #ddd"}}><span className="gp-label">Manager Account Adjustment</span><div className="gp-responsive-form-grid" style={{display:"grid",gridTemplateColumns:"140px 140px 1fr auto",gap:8,alignItems:"start"}}><select className="gp-search-input" value={accountType} onChange={e=>setAccountType(e.target.value)}><option value="CREDIT">Customer Credit</option><option value="OWED">Amount Owed</option></select><CurrencyInput className="gp-search-input" placeholder="Amount ($)" value={accountAmount} onValueChange={setAccountAmount}/><input className="gp-search-input" placeholder="Reason" value={accountReason} onChange={e=>setAccountReason(e.target.value)}/><button className="gp-btn" disabled={adjusting} onClick={adjustAccount}>ADJUST</button></div></div>
 {rewards.length>0&&<div className="gp-field" style={{marginTop:18,paddingTop:16,borderTop:"1px solid #ddd"}}><span className="gp-label">Secret Rewards — Sales Team</span><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>{rewards.map(r=><button key={r.id} className="gp-btn" disabled={account.loyaltyPoints<r.pointsCost||!!redeeming} onClick={()=>redeemReward(r)}>{redeeming===r.id?"Redeeming…":`${r.name} — ${r.pointsCost} pts`}</button>)}</div></div>}</div>}
 {!!reportCardPrompt&&<div role="status">{reportCardPrompt} <button type="button" className="gp-btn" onClick={()=>{setPanel('Report Card');setReportCardPrompt('')}}>Review report card</button><button type="button" className="gp-btn" onClick={()=>setReportCardPrompt('')}>Not now</button></div>}
 {shownPanel==="Report Card"&&(ticketId?<ReportCard ticketId={ticketId}/>:null)}
 {shownPanel==="History"&&<div className="gp-pos-panel"><VisitHistory key={ticketId||"draft"} id={ticketId} date={newStart.slice(0,10)} timezone={timezone} current={([['Checked in',ticket.checkedInAt],['Ready for pickup',ticket.pickupAt],['Pickup completed',ticket.pickupCompletedAt]] as const).flatMap(([label,at])=>at?[{label,at}]:[])}/><h3>Ticket History</h3>{(ticket.createdAt||draft?.createdAt)&&<p>Created <time dateTime={ticket.createdAt||draft?.createdAt}>{stamp(ticket.createdAt||draft?.createdAt)}</time></p>}<div className="gp-list">{ticket.scheduleHistory.map((h:any,i:number)=><div className="gp-list-row" key={`${h.changedAt}-${i}`}><div><strong>{h.changeType}</strong><span>{h.actor?employeeName(h.actor):"GroomPro System"}</span></div><div><span>{h.previousStart?`${new Date(h.previousStart).toLocaleString()} → `:""}{new Date(h.newStart).toLocaleString()}</span></div></div>)}</div></div>}
 {shownPanel==="Notes"&&<div className="gp-pos-panel"><GroomingNotes customerId={ticket.customer.id} ticketId={ticketId} petIds={bookedPetIds(ticket.lines)} draftNotes={ticket.groomingNotesDraft||{}} onDraftChange={ticketId?undefined:v=>setTicket((t:any)=>({...t,groomingNotesDraft:v}))}/><h3>Ticket notes</h3>{ticketId?<p>{ticket.notes||"No notes on this ticket."}</p>:<textarea aria-label="Ticket notes" value={ticket.notes||""} onChange={e=>setTicket({...ticket,notes:e.target.value})}/>}{ticketId&&<GroomingProgress key={ticketId} ticketId={ticketId}/>}</div>}
 </main><div className="gp-phone-ticket-actions gp-phone-only"><span>Total {loading?"":money(totals.totalCents)} · Due {loading?"":money(totals.dueCents)}</span><div><button type="button" className="gp-btn primary" onClick={()=>void saveTicket()}>Schedule / Leave Open</button><button type="button" className="gp-btn" aria-expanded={phonePayment} onClick={()=>{setPhonePayment(v=>!v);setPhoneActions(false);setPhoneDetails(false)}}>{phonePayment?'Back to ticket':'Payment / Checkout'}</button><button type="button" className="gp-btn" aria-label="Other ticket actions" aria-expanded={phoneActions} onClick={()=>{setPhoneActions(v=>!v);setPhonePayment(false);setPhoneDetails(false)}}>⋯</button></div></div><TicketBottomLayout layout={layout} controls={{
 save:<button className="gp-btn primary" onClick={()=>void saveTicket()}>Schedule / Leave Open</button>,
 noShow:<div><button className="gp-btn" disabled={terminal||noShowing||pendingKeys.includes("payment")||!!uncertainPayment} onClick={processNoShow}>MARK NO-SHOW — PROCESS FEE</button><small style={{display:"block",marginTop:3}}>{cardOnFile?"Customer Credit is used first. Charging any remainder requires a connected card processor.":"Customer Credit is used first. With no card on file, any remaining fee is added to Balance Owed."}</small></div>,
 subtotal:<label><span className="gp-field-caption">Subtotal</span> <span>{loading?"":money(totals.subtotalCents)}</span></label>,
 tax:<label>Sales Tax ($)<CurrencyInput value={loading&&!taxManual.current?"":String(currentTax())} onValueChange={v=>{taxManual.current=true;setTax(v)}}/></label>,
 tip:<div><label>Tip ($)<CurrencyInput selectOnEntry value={loading&&!tipManual.current?"":tip} onValueChange={value=>{tipManual.current=true;setTip(value)}}/></label><button className="gp-btn" disabled={!ticketId} onClick={()=>setShowTips(true)}>Split Tip</button></div>,
 summary:<div className="gp-ticket-money-summary"><span><span className="gp-field-caption">Total</span> {loading?"":money(totals.totalCents)}</span><span><span className="gp-field-caption">Paid</span> {loading?"":money(totals.paidCents)}</span><span><span className="gp-field-caption">Due</span> {loading?"":money(totals.dueCents)}</span></div>,
 paymentType:<div><label>Payment Type<select disabled={terminal||totals.dueCents<=0||paying||!!uncertainPayment} value={loading?"":paymentType} onChange={e=>setPaymentType(e.target.value)}>{loading&&<option value=""/>}{['CASH','VISA','MASTERCARD','AMEX','DISCOVER','DEBIT','GIFT_CARD','OTHER'].map(type=><option key={type}>{type}</option>)}</select></label>{paymentType==="GIFT_CARD"&&<label>Gift card code<input value={giftCardCode} disabled={paying||!!uncertainPayment} onChange={e=>setGiftCardCode(e.target.value)} data-help="Enter the card code to use its remaining balance. If the card does not cover the ticket, record its available amount and use another payment for the rest."/></label>}</div>,
 amount:<label>Amount ($)<CurrencyInput disabled={terminal||totals.dueCents<=0||paying||!!uncertainPayment} value={loading&&!paymentManual.current?"":paymentAmount} onValueChange={value=>{paymentManual.current=true;setPaymentAmount(value)}}/></label>,
 recordPayment:<button className="gp-btn primary" disabled={terminal||totals.dueCents<=0||paying||pendingKeys.includes("payment")||!!uncertainPayment} onClick={recordPayment}>RECORD PAYMENT</button>,
 checkout:<button className="gp-btn primary" disabled={terminal||closing||pendingKeys.includes("payment")||!!uncertainPayment||totals.dueCents!==0} onClick={closeTicket}>CHECK OUT / CLOSE</button>
 }}/>

 </>}
 </PosWindowFrame>{packageDeletePrompt&&active&&<div className="gp-package-removal-backdrop"><section role="dialog" aria-modal="true" aria-label="Remove package service" className="gp-package-removal-dialog" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();packageDeletePrompt.resolve(null);setPackageDeletePrompt(null)}}}><h3>Remove package service?</h3><p>{packageDeletePrompt.description}</p><p>Keep the remaining discounted prices, or switch the remaining services to their regular prices.</p><div>{([{value:'KEEP_DISCOUNT',label:'Keep Discount'},{value:'REMOVE_DISCOUNT',label:'Remove Discount'},{value:null,label:'Cancel'}] as const).map(option=><button autoFocus={option.value===null} type="button" className="gp-btn" key={option.label} onClick={()=>{packageDeletePrompt.resolve(option.value);setPackageDeletePrompt(null)}}>{option.label}</button>)}</div></section></div>}{showPrepaid&&<TicketPrepaid ticketId={ticketId} pets={ticket.customer.pets||[]} lines={ticket.lines||[]} canChange={!terminal&&!uncertainPayment} onClose={()=>setShowPrepaid(false)} onAction={async(kind,details)=>{if(uncertainPayment)return false;if(!ticket.customer.id)setShowPrepaid(false);const result=await operate(kind,details);if(result){await Promise.all([load(savedId.current),loadCheckout(savedId.current)]);return true}return false}}/>}{showGiftCards&&<TicketGiftCards ticketId={ticketId} canSell={!terminal&&!uncertainPayment} onClose={()=>setShowGiftCards(false)} onSell={async amountCents=>{if(uncertainPayment)return false;if(!ticket.customer.id)setShowGiftCards(false);const result=await operate('GIFT_CARD',{amountCents});if(result){await loadCheckout(savedId.current);return true}return false}}/>}{statusPicker&&<FloatingEditorWindow windowKey="pos-status" title="Status" initialSize={{width:360,height:420}} onClose={()=>setStatusPicker(false)} style={{zIndex:2000}}><SearchableSelect defaultOpen style={{width:`calc(${Math.max(...statuses.concat(presentationOptions.customStatuses||[]).map(s=>s.length))}ch + 3em)`}} aria-label="Ticket status" value={loading?"":ticket.displayStatus||ticket.status} disabled={statusSaving||terminal||pendingKeys.includes("payment")} onChange={e=>{setStatusPicker(false);selectTicketStatus(e.target.value)}}>{loading&&<option value=""/>}{[...statuses,...(presentationOptions.customStatuses||[])].map(s=><option key={s} value={s}>{s==='OPEN'?'Accepted':s.replaceAll("_"," ")}</option>)}</SearchableSelect></FloatingEditorWindow>}{showTips&&ticketId&&<TicketTips onTipChange={cents=>{tipManual.current=true;setTip(String(cents))}} initialTipCents={Number(tip)||0} ticketId={ticketId} locationId={ticket.locationId||ticket.location?.id||""} onClose={()=>setShowTips(false)} onSaved={async savedTip=>{tipManual.current=false;setTip(String(savedTip));await Promise.all([load(ticketId),loadCheckout(ticketId)])}}/>}{ownerView&&<CustomerProfile customerId={ownerView.id} initialPetId={ownerView.petId} onClose={()=>void closeOwner()}/>}</>}

