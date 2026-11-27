"use client";
import {useState} from 'react';
import {isPlatformRole} from '../lib/roles';
import {SubscriptionSettings} from './subscription-settings';
import {PlatformControls} from './platform-controls';

// Both the current site and the separate administration deployment use the
// existing controls and server permissions. No second business editor or session.
export function MasterAdministration({employeeRole,onOpenWorkspace}:{employeeRole?:string;onOpenWorkspace?:()=>void}){
 const [tab,setTab]=useState('Businesses & Plans');
 if(!isPlatformRole(employeeRole))return null;
 return <section className="gp-site-admin" aria-label="Master Administration">
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
   <h1>Master Administration</h1>
   {onOpenWorkspace&&<button type="button" className="gp-btn" onClick={onOpenWorkspace}>Open Business Workspace</button>}
  </div>
  <p>Manage businesses, subscription plans, features and staff access. Open Business switches this site to the business you choose.</p>
  <nav aria-label="Administration Sections">{['Businesses & Plans','Features & Permissions'].map(name=><button type="button" className={'gp-btn'+(tab===name?' primary':'')} aria-pressed={tab===name} key={name} onClick={()=>setTab(name)}>{name}</button>)}</nav>
  {tab==='Businesses & Plans'?<SubscriptionSettings platformAccessFirst/>:<PlatformControls/>}
 </section>;
}
