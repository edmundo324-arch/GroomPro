"use client";
import { useEffect, useState } from "react";

type Location={id:string;name:string;city?:string|null;state?:string|null};
type PriceItem={id:string;name:string;category?:string|null;basePriceCents:number;adjustmentPct:number;priceOverrideCents:number|null;finalPriceCents:number};

const money=(c:number)=>`$${(c/100).toFixed(2)}`;

export function Settings(){
  const [locations,setLocations]=useState<Location[]>([]);
  const [locationId,setLocationId]=useState("");
  const [mode,setMode]=useState("SHARED");
  const [services,setServices]=useState<PriceItem[]>([]);
  const [packages,setPackages]=useState<PriceItem[]>([]);
  const [type,setType]=useState<"SERVICE"|"PACKAGE">("SERVICE");
  const [percent,setPercent]=useState("10");
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);
    const [lr,sr,pr,mr]=await Promise.all([
      fetch("/api/locations"),
      fetch(`/api/pricing?type=SERVICE${locationId?`&locationId=${encodeURIComponent(locationId)}`:""}`),
      fetch(`/api/pricing?type=PACKAGE${locationId?`&locationId=${encodeURIComponent(locationId)}`:""}`),
      fetch("/api/tenant-settings")
    ]);
    if(lr.ok){const d=await lr.json();setLocations(d.locations||[]);if(!locationId&&d.locations?.[0])setLocationId(d.locations[0].id);}
    if(sr.ok){const d=await sr.json();setServices(d.services||[]);}
    if(pr.ok){const d=await pr.json();setPackages(d.packages||[]);}
    if(mr.ok){const d=await mr.json();setMode(d.customerAccessMode||"SHARED");}
    setLoading(false);
  }
  useEffect(()=>{load()},[locationId]);

  async function saveMode(value:string){
    setMode(value);setMessage("");
    const r=await fetch("/api/tenant-settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({customerAccessMode:value})});
    setMessage(r.ok?"Customer sharing setting saved.":"Could not save setting.");
  }
  async function saveLocationPrice(item:PriceItem, entityType:"SERVICE"|"PACKAGE", mode:"PERCENT_ADJUSTMENT"|"FIXED"|"FOLLOW_BASE", value:string){
    if(!locationId)return;
    const body={locationId,entityId:item.id,entityType,mode,adjustmentPct:mode==="PERCENT_ADJUSTMENT"?Number(value):0,priceOverrideCents:mode==="FIXED"?Math.round(Number(value)*100):null};
    const r=await fetch("/api/location-pricing",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    setMessage(r.ok?"Location pricing saved.":"Could not save pricing.");
    if(r.ok)load();
  }
  async function bulk(){
    const p=Number(percent);if(!Number.isFinite(p)||p<=-100)return;
    const r=await fetch("/api/pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entityType:type,adjustmentPct:p})});
    const d=await r.json();setMessage(r.ok?`${d.changedCount||0} ${type.toLowerCase()} base prices updated.`:(d.error||"Could not update pricing."));
    if(r.ok)load();
  }

  const items=type==="SERVICE"?services:packages;
  return <section className="gp-settings">
    <div className="gp-calendar-head"><div><h1 className="gp-title">Settings</h1><p className="gp-subtitle">Business configuration · locations · pricing</p></div></div>
    {message&&<div className="gp-form-success">{message}</div>}
    <div className="gp-settings-grid">
      <div className="gp-settings-card"><h2>Locations</h2><p>Services and packages are shared by the business. Each location can price them independently.</p>
        {locations.map(l=><button key={l.id} className={`gp-settings-location ${locationId===l.id?"selected":""}`} onClick={()=>setLocationId(l.id)}>{l.name}<span>{[l.city,l.state].filter(Boolean).join(", ")}</span></button>)}
        {!locations.length&&!loading&&<div className="gp-search-empty">Add the first business location through the Locations API.</div>}
      </div>
      <div className="gp-settings-card"><h2>Customer sharing</h2><p>Choose whether customer records are shared across locations.</p>
        {["SHARED","LOCATION_SCOPED","EXPLICIT"].map(v=><label className="gp-radio-row" key={v}><input type="radio" checked={mode===v} onChange={()=>saveMode(v)}/><span><strong>{v==="SHARED"?"Shared across all locations":v==="LOCATION_SCOPED"?"Location scoped":"Explicit location access"}</strong><small>{v==="SHARED"?"Every location can work with the business customer record.":v==="LOCATION_SCOPED"?"Customers default to the location where they belong.":"Access is assigned location by location."}</small></span></label>)}
      </div>
      <div className="gp-settings-card gp-settings-wide"><div className="gp-settings-card-head"><div><h2>Business base pricing</h2><p>Bulk changes update the business base. Existing location percentage adjustments remain intact.</p></div><div className="gp-bulk-controls"><select value={type} onChange={e=>setType(e.target.value as "SERVICE"|"PACKAGE")}><option value="SERVICE">Services</option><option value="PACKAGE">Packages</option></select><input value={percent} onChange={e=>setPercent(e.target.value)} inputMode="decimal"/><span>%</span><button className="gp-btn primary" onClick={bulk}>Apply</button></div></div>
        <div className="gp-pricing-table"><div className="gp-pricing-row header"><span>Name</span><span>Base</span><span>{locationId?"Location price":"Select a location"}</span><span>Location rule</span></div>
        {items.map(item=><div className="gp-pricing-row" key={item.id}><span><strong>{item.name}</strong><small>{item.category||""}</small></span><span>{money(item.basePriceCents)}</span><span>{locationId?money(item.finalPriceCents):"—"}</span><span className="gp-price-actions"><button onClick={()=>saveLocationPrice(item,type,"FOLLOW_BASE","0")}>Base</button><button onClick={()=>saveLocationPrice(item,type,"PERCENT_ADJUSTMENT",String(item.adjustmentPct||0))}>{item.adjustmentPct?`${item.adjustmentPct}%`:"%"}</button><button onClick={()=>saveLocationPrice(item,type,"FIXED",String((item.priceOverrideCents??item.basePriceCents)/100))}>Fixed</button></span></div>)}
        {!items.length&&!loading&&<div className="gp-search-empty">No active {type.toLowerCase()} records yet.</div>}
        </div>
      </div>
    </div>
  </section>;
}
