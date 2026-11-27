"use client";
import {CatalogSyncChoice,CatalogSyncSummary,type CatalogSyncScope,type CatalogSyncResult} from './catalog-sync-choice';
import {SalesTaxSettings} from './sales-tax-settings';
import {TipDistributionSettings} from './tip-distribution-settings';
import {PayrollSettings} from './payroll-settings';
import {ConversationSettings} from './conversation-settings';
import {MarketingLimitSettings} from './marketing-limit-settings';
import {VoidTicketSettings} from './ticket-void';
import {CustomRuleSettings} from './custom-rule-settings';
import {AppointmentMessageSettings} from './appointment-message-settings';
import {DeviceSettings} from './device-settings';
import {CustomerSharing} from './customer-sharing';
import './settings-workspace.css';
import {TenantExport} from './tenant-export';
import {BusinessLibrary} from './business-library';
import {VisualSettingsEntry} from './visual-layout-studio';
import {SettingsSections} from './settings-sections';
import {SettingsSearch} from './settings-search';
import {Pet123Settings} from "./123pet-settings";
import {StarterLibrary} from './starter-library';
import {SubscriptionSettings} from './subscription-settings';
import {BreedSettings} from './breed-settings';
import {employeeFetch} from "../lib/employee-fetch";
import {CategorySettings} from "./category-settings";
import {WorkflowSettings} from "./workflow-settings";
import { useEffect, useState } from "react";
import {ReferralRewardSettings} from './referral-reward-settings';
import { CustomerImport } from "./customer-import";import { PlatformControls } from "./platform-controls";import { RewardSettings } from "./reward-settings";import { OperatingHoursSettings } from "./operating-hours-settings";import { HeyRosieSettings } from "./heyrosie-settings";
type Location={id:string;name:string;city?:string|null;state?:string|null};type PriceItem={id:string;name:string;category?:string|null;basePriceCents:number;adjustmentPct:number;priceOverrideCents:number|null;finalPriceCents:number};const money=(c:number)=>`$${(c/100).toFixed(2)}`;
export function Settings({role}:{role?:string}){const[locations,setLocations]=useState<Location[]>([]);const[locationId,setLocationId]=useState("");const[mode,setMode]=useState("SHARED");const[services,setServices]=useState<PriceItem[]>([]);const[packages,setPackages]=useState<PriceItem[]>([]);const[type,setType]=useState<"SERVICE"|"PACKAGE">("SERVICE");const[percent,setPercent]=useState("10");const[loading,setLoading]=useState(true);const[message,setMessage]=useState("");const[newLocation,setNewLocation]=useState({name:"",address1:"",city:"",state:"TX",postalCode:""});
const[pricingScope,setPricingScope]=useState<CatalogSyncScope>('NONE'),[pricingSync,setPricingSync]=useState<CatalogSyncResult|null>(null),[pricingBusy,setPricingBusy]=useState(false);
async function load(){setLoading(true);const[lr,sr,pr,mr]=await Promise.all([employeeFetch("/api/locations",{cache:"no-store"}),employeeFetch(`/api/pricing?type=SERVICE${locationId?`&locationId=${encodeURIComponent(locationId)}`:""}`,{cache:"no-store"}),employeeFetch(`/api/pricing?type=PACKAGE${locationId?`&locationId=${encodeURIComponent(locationId)}`:""}`,{cache:"no-store"}),employeeFetch("/api/tenant-settings",{cache:"no-store"})]);if(lr.ok){const d=await lr.json();setLocations(d.locations||[]);if(!locationId&&d.locations?.[0])setLocationId(d.locations[0].id)}if(sr.ok)setServices((await sr.json()).services||[]);if(pr.ok)setPackages((await pr.json()).packages||[]);if(mr.ok)setMode((await mr.json()).customerAccessMode||"SHARED");setLoading(false)}useEffect(()=>{load()},[locationId]);
async function addLocation(){const r=await employeeFetch("/api/locations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(newLocation)}),d=await r.json();if(!r.ok){setMessage(d.error||"Could not add location.");return}setNewLocation({name:"",address1:"",city:"",state:"TX",postalCode:""});setLocationId(d.id);setMessage("Location saved.");await load()}
async function saveMode(value:string){setMode(value);const r=await employeeFetch("/api/tenant-settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({customerAccessMode:value})});setMessage(r.ok?"Customer sharing setting saved.":"Could not save setting.")}
function pricingSaved(data:any,text:string){
 if(data.offlinePending){setMessage(text+' Saved on this device; waiting to sync. Existing appointments have not been updated yet.');setPricingSync(null);return;}
 setMessage(text);setPricingSync(data.sync||null);
 if(data.sync?.ticketIds?.length){window.dispatchEvent(new CustomEvent('groompro:catalog-synced',{detail:{ticketIds:data.sync.ticketIds}}));window.dispatchEvent(new CustomEvent('groompro:data-changed',{detail:{url:'/api/tickets'}}));}
}
async function saveLocationPrice(item:PriceItem,entityType:"SERVICE"|"PACKAGE",mode:"PERCENT_ADJUSTMENT"|"FIXED"|"FOLLOW_BASE",value:string){
 if(!locationId||pricingBusy)return;
 setPricingBusy(true);setPricingSync(null);setMessage('');
 try{
  const response=await employeeFetch("/api/location-pricing",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({locationId,entityId:item.id,entityType,mode,applyTo:pricingScope,adjustmentPct:mode==="PERCENT_ADJUSTMENT"?Number(value):0,priceOverrideCents:mode==="FIXED"?Math.round(Number(value)*100):null})}),data=await response.json();
  if(!response.ok)throw Error(data.error||'Could not save pricing.');
  pricingSaved(data,'Location pricing saved.');setPricingScope('NONE');await load();
 }catch(error){setMessage(error instanceof Error?error.message:'Could not save pricing.')}finally{setPricingBusy(false)}
}
async function bulk(){
 if(pricingBusy)return;
 const adjustment=Number(percent);if(!Number.isFinite(adjustment)||adjustment<=-100){setMessage('Enter a percentage greater than -100.');return;}
 setPricingBusy(true);setPricingSync(null);setMessage('');
 try{
  const response=await employeeFetch("/api/pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entityType:type,adjustmentPct:adjustment,applyTo:pricingScope})}),data=await response.json();
  if(!response.ok)throw Error(data.error||'Could not update pricing.');
  pricingSaved(data,`${data.changedCount||0} ${type.toLowerCase()} base prices updated.`);setPricingScope('NONE');await load();
 }catch(error){setMessage(error instanceof Error?error.message:'Could not update pricing.')}finally{setPricingBusy(false)}
}
const items=type==="SERVICE"?services:packages;return <section className="gp-settings gp-settings-workspace"><div className="gp-calendar-head"><div><h1 className="gp-title">Settings</h1><p className="gp-subtitle">Business configuration · locations · pricing · data</p></div></div>{message&&<div className="gp-form-success">{message}</div>}<SettingsSearch role={role}><SettingsSections id="settings" label="Settings section" initial="workflow" sections={[
 {id:'visual-layouts',label:'Visual module settings',content:<VisualSettingsEntry/>},
 {id:'workflow',label:'Calendar & workflow',content:<><WorkflowSettings/><VoidTicketSettings/></>},
 {id:'locations',label:'Locations & hours',content:<div className="gp-settings-subworkspace">{locations.length>1&&<label className="gp-settings-location-choice">Location<select value={locationId} onChange={event=>setLocationId(event.target.value)}>{locations.map(location=><option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}<SettingsSections id="settings-locations" label="Location settings" sections={[{id:'hours',label:'Operating hours',content:<OperatingHoursSettings locationId={locationId}/>},{id:'locations',label:'Locations',content:<div className="gp-settings-card"><h2>Locations</h2><p>Services and packages are shared by the business. Each location can price them independently.</p>{locations.map(l=><button key={l.id} className={`gp-settings-location ${locationId===l.id?"selected":""}`} onClick={()=>setLocationId(l.id)}>{l.name}<span>{[l.city,l.state].filter(Boolean).join(", ")}</span></button>)}<div style={{display:"grid",gap:6,marginTop:12}}><strong>Add location</strong><input value={newLocation.name} onChange={e=>setNewLocation({...newLocation,name:e.target.value})} placeholder="Location name"/><input value={newLocation.address1} onChange={e=>setNewLocation({...newLocation,address1:e.target.value})} placeholder="Street address"/><div className="gp-responsive-form-grid" style={{display:"grid",gridTemplateColumns:"2fr 70px 1fr",gap:6}}><input value={newLocation.city} onChange={e=>setNewLocation({...newLocation,city:e.target.value})} placeholder="City"/><input value={newLocation.state} onChange={e=>setNewLocation({...newLocation,state:e.target.value.toUpperCase().slice(0,2)})} placeholder="ST"/><input value={newLocation.postalCode} onChange={e=>setNewLocation({...newLocation,postalCode:e.target.value})} placeholder="ZIP"/></div><button className="gp-btn primary" onClick={addLocation}>+ Add Location</button></div></div>},{id:'sharing',label:'Customer sharing',content:<CustomerSharing/>}]}/></div>},
 {id:'pricing',label:'Pricing',content:<div className="gp-settings-card gp-settings-wide"><fieldset disabled={pricingBusy} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="gp-settings-card-head"><div><h2>Business base pricing</h2><p>Bulk changes update the business base. Existing location percentage adjustments remain intact.</p></div><div className="gp-bulk-controls"><select value={type} onChange={e=>setType(e.target.value as "SERVICE"|"PACKAGE")}><option value="SERVICE">Services</option><option value="PACKAGE">Packages</option></select><input value={percent} onChange={e=>setPercent(e.target.value)} inputMode="decimal"/><span>%</span><button className="gp-btn primary" onClick={bulk}>Apply</button></div></div><CatalogSyncChoice value={pricingScope} onChange={setPricingScope}/><p className="gp-subtitle">This choice applies to the next bulk price update or location pricing change below.</p>{pricingSync&&<CatalogSyncSummary result={pricingSync}/>}<div className="gp-pricing-table"><div className="gp-pricing-row header"><span>Name</span><span>Base</span><span>{locationId?"Location price":"Select a location"}</span><span>Location rule</span></div>{items.map(item=><div className="gp-pricing-row" key={item.id}><span><strong>{item.name}</strong><small>{item.category||""}</small></span><span>{money(item.basePriceCents)}</span><span>{locationId?money(item.finalPriceCents):"—"}</span><span className="gp-price-actions"><button onClick={()=>saveLocationPrice(item,type,"FOLLOW_BASE","0")}>Base</button><button onClick={()=>saveLocationPrice(item,type,"PERCENT_ADJUSTMENT",String(item.adjustmentPct||0))}>{item.adjustmentPct?`${item.adjustmentPct}%`:"%"}</button><button onClick={()=>saveLocationPrice(item,type,"FIXED",String((item.priceOverrideCents??item.basePriceCents)/100))}>Fixed</button></span></div>)}{!items.length&&!loading&&<div className="gp-search-empty">No active {type.toLowerCase()} records yet.</div>}</div></fieldset></div>},
 {id:'breeds',label:'Breeds',content:<BreedSettings/>},
 {id:'categories',label:'Service categories',content:<><CategorySettings/><BusinessLibrary kind="grooming-picks"/></>},
 {id:'sales-tax',label:'Sales Tax',content:<SalesTaxSettings/>},
 {id:'tips',label:'Tip Distribution',content:<TipDistributionSettings locationId={locationId}/>},
 {id:'payroll',label:'Payroll',content:<PayrollSettings/>},
 {id:'rewards',label:'Rewards',content:<><ReferralRewardSettings/><RewardSettings/></>},
 {id:'communications',label:'Communications',content:<><AppointmentMessageSettings/><MarketingLimitSettings/><ConversationSettings/><CustomRuleSettings/><BusinessLibrary kind="message-templates"/><HeyRosieSettings/></>},
 {id:'data',label:'Data & integrations',content:<SettingsSections id="settings-data" label="Data and integrations" sections={[{id:'imports',label:'Import & migration',content:<><CustomerImport/><TenantExport/></>},{id:'123pet',label:'123Pet connection',content:<Pet123Settings/>},{id:'library',label:'Starter library',content:<StarterLibrary/>}]}/>},
 {id:'administration',label:'Access & subscription',content:<SettingsSections id="settings-administration" label="Administration" sections={[{id:'access',label:'Platform access',content:<PlatformControls/>},{id:'subscription',label:'Subscription',content:<SubscriptionSettings/>},{id:'devices',label:'Device access',content:<DeviceSettings/>}]}/>}
 ]}/></SettingsSearch></section>}

