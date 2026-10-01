"use client";
import {useEffect,useState} from "react";
import {BookingAssetEditor,BookingAssetForm} from "./booking-asset-editor";
import {dateKey,shiftDate} from "../lib/schedule-dates";
import {ScheduleBoard,ScheduleRangeContext} from "./schedule-board";
import {employeeFetch} from "../lib/employee-fetch";
import {EmployeeWeek} from "./employee-week";

type Asset={id:string;name:string;category:string;active:boolean;onlineBookingRecipient:boolean;locationId:string;schedules:{id:string;dayOfWeek:number;startTime:string;endTime:string}[]};
export function StaffAvailabilitySettings(){
 const[start,setStart]=useState(()=>{const d=new Date();d.setDate(d.getDate()-d.getDay());return dateKey(d)}),[end,setEnd]=useState(()=>{const d=new Date();d.setDate(d.getDate()-d.getDay()+6);return dateKey(d)});

 const[assetForm,setAssetForm]=useState<Asset|null>(null),[busy,setBusy]=useState(false);
 const[assets,setAssets]=useState<Asset[]>([]),[locations,setLocations]=useState<{id:string;name:string}[]>([]),[tab,setTab]=useState<"employees"|"assets">("employees"),[message,setMessage]=useState("");
 async function load(){try{const[a,l]=await Promise.all([fetch("/api/booking-assets",{cache:"no-store"}),fetch("/api/locations",{cache:"no-store"})]);if(a.ok)setAssets((await a.json()).assets||[]);if(l.ok)setLocations((await l.json()).locations||[])}catch{setMessage("Could not load booking availability.")}}
 useEffect(()=>{void load()},[]);
 async function saveAsset(assetForm:BookingAssetForm){setBusy(true);setMessage('');try{const r=await employeeFetch('/api/booking-assets',{method:assetForm.id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:assetForm.id,name:assetForm.name,category:assetForm.category,locationId:assetForm.locationId,active:assetForm.active,onlineBookingRecipient:assetForm.onlineBookingRecipient})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not save asset.');setAssetForm(null);await load()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 return <ScheduleRangeContext.Provider value={{start,end,setStart,setEnd}}><div className="gp-settings-card gp-settings-wide"><div className="gp-settings-card-head"><div><h2>Staff & Online Booking Availability</h2><p>Manage employees, PINs, recurring work schedules, booking assets, and asset availability.</p></div><div className="gp-bulk-controls"><button className={`gp-btn ${tab==="employees"?"primary":""}`} onClick={()=>setTab("employees")}>Employees</button><button className={`gp-btn ${tab==="assets"?"primary":""}`} onClick={()=>setTab("assets")}>Booking Assets</button></div></div>{message&&<div role="status">{message}</div>}{tab==="employees"?<EmployeeWeek/>:<><button className="gp-btn primary" onClick={()=>setAssetForm({id:'',name:'',category:'',locationId:locations[0]?.id||'',active:true,onlineBookingRecipient:true,schedules:[]})}>+ Add Booking Asset</button>{assetForm&&<BookingAssetEditor key={assetForm.id||'new'} initial={assetForm} locations={locations} busy={busy} onSave={saveAsset} onCancel={()=>setAssetForm(null)}/>}<ScheduleBoard kind="asset" resources={assets.map(a=>({id:a.id,name:a.name,detail:a.category,active:a.active,slots:a.schedules}))} onReload={load} onEdit={id=>setAssetForm(assets.find(a=>a.id===id)!)}/>
</>}</div></ScheduleRangeContext.Provider>
}
