"use client";
import { useEffect, useState } from "react";

const roles = ["ADMIN","MANAGER","FLOOR_MANAGER","FRONT","BACK","MASTER_GROOMER","GROOMER","SALES"];
const permissions = ["VIEW","CREATE","EDIT","DELETE","CONFIGURE"];

type Feature = { code:string; name:string; description:string|null; enabled:boolean };

export function PlatformControls() {
  const [features,setFeatures]=useState<Feature[]>([]);
  const [selectedRole,setSelectedRole]=useState("FRONT");
  const [rolePermissions,setRolePermissions]=useState<Record<string,boolean>>({});
  const [settings,setSettings]=useState<Record<string,unknown>>({});
  const [message,setMessage]=useState("");

  async function load(){
    const [fr,pr,sr]=await Promise.all([fetch("/api/features"),fetch("/api/permissions"),fetch("/api/business-settings")]);
    if(fr.ok){const d=await fr.json();setFeatures(d.features||[])}
    if(pr.ok){const d=await pr.json();const next:Record<string,boolean>={};for(const p of d.permissions||[])if(p.role===selectedRole)next[p.permissionCode]=p.enabled;setRolePermissions(next)}
    if(sr.ok){const d=await sr.json();setSettings(d.settings||{})}
  }
  useEffect(()=>{load()},[selectedRole]);

  async function toggleFeature(code:string,enabled:boolean){
    const r=await fetch("/api/features",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({featureCode:code,enabled})});
    setMessage(r.ok?"Feature setting saved.":"Could not save feature setting."); if(r.ok)load();
  }
  async function togglePermission(code:string){
    const enabled=!rolePermissions[code]; setRolePermissions(v=>({...v,[code]:enabled}));
    const r=await fetch("/api/permissions",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({role:selectedRole,permissionCode:code,enabled})});
    setMessage(r.ok?"Role access saved.":"Could not save role access.");
  }
  async function saveSetting(key:string,value:unknown){
    const r=await fetch("/api/business-settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,value})});
    setMessage(r.ok?"Business customization saved.":"Could not save customization.");
  }

  return <div className="gp-settings-grid">
    <div className="gp-settings-card gp-settings-wide"><h2>Features</h2><p>Turn business modules on or off without deleting their data.</p>{features.map(f=><label className="gp-radio-row" key={f.code}><input type="checkbox" checked={f.enabled} onChange={e=>toggleFeature(f.code,e.target.checked)}/><span><strong>{f.name}</strong><small>{f.description||f.code}</small></span></label>)}</div>
    <div className="gp-settings-card gp-settings-wide"><h2>Role access</h2><p>Control what each job title can access. PIN identity stays separate from permissions.</p><select value={selectedRole} onChange={e=>setSelectedRole(e.target.value)}>{roles.map(r=><option key={r}>{r}</option>)}</select><div className="gp-pricing-table">{permissions.map(p=><label className="gp-radio-row" key={p}><input type="checkbox" checked={!!rolePermissions[p]} onChange={()=>togglePermission(p)}/><span><strong>{p}</strong><small>{p === "VIEW" ? "Open and view the module." : `${p.charAt(0)}${p.slice(1).toLowerCase()} records or settings.`}</small></span></label>)}</div></div>
    <div className="gp-settings-card gp-settings-wide"><h2>Business personalization</h2><p>These are business settings, not hard-coded Rubber Doggies rules.</p><div className="gp-pricing-row"><span><strong>Ready color</strong><small>Color used for the Whiteboard Ready state.</small></span><input type="text" value={String(settings.readyColor??"")} placeholder="#DDEEFF" onChange={e=>setSettings(v=>({...v,readyColor:e.target.value}))} onBlur={e=>saveSetting("readyColor",e.target.value)}/></div><div className="gp-pricing-row"><span><strong>VIP available emoji</strong><small>Business-defined Whiteboard designation.</small></span><input value={String(settings.vipAvailableEmoji??"💙")} onChange={e=>setSettings(v=>({...v,vipAvailableEmoji:e.target.value}))} onBlur={e=>saveSetting("vipAvailableEmoji",e.target.value)}/></div><div className="gp-pricing-row"><span><strong>VIP not available emoji</strong><small>Business-defined Whiteboard designation.</small></span><input value={String(settings.vipNotAvailableEmoji??"❌")} onChange={e=>setSettings(v=>({...v,vipNotAvailableEmoji:e.target.value}))} onBlur={e=>saveSetting("vipNotAvailableEmoji",e.target.value)}/></div></div>
    {message&&<div className="gp-form-success">{message}</div>}
  </div>;
}
