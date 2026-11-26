"use client";
import {useEffect,useState} from 'react';
import {EmployeeActivity} from './employee-activity';
import {ActionPin} from './action-pin';
import {requestEmployeePin} from '../lib/employee-fetch';
import {SubscriptionSettings} from './subscription-settings';
import {PlatformControls} from './platform-controls';
import type {SiteRole} from '../lib/site-deployment';

export function SiteWorkspace({role,children}:{role:SiteRole;children:React.ReactNode}){
 const [employee,setEmployee]=useState<any>(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[tab,setTab]=useState('Businesses & Plans');
 const title=role==='admin'?'Master Administration':role==='development'?'Development':'Staging';
 useEffect(()=>{let live=true;async function load(){try{const r=await fetch('/api/setup/context',{cache:'no-store'}),context=await r.json();if(!r.ok||context.setupRequired)throw Error(context.error||'This separate workspace needs its initial business and owner setup before sign-in.');const s=await fetch('/api/employee/session',{cache:'no-store'}),data=await s.json();if(live){setEmployee(data.employee||null);setReady(true);}}catch(e){if(live)setError((e as Error).message);}}void load();return()=>{live=false}},[]);
 const allowed=employee&&(role==='staging'||['PLATFORM_OWNER','DEVELOPER'].includes(employee.role));
 return <>{role==='admin'&&<EmployeeActivity employee={employee} scope="platform-administration" onExpired={()=>setEmployee(null)} onEmployeeChange={setEmployee}/>}<div className="gp-site-banner"><strong>GroomPro · {title}</strong><span>{role==='admin'?'Platform controls affect the selected business.':'Separate testing workspace · Automatic sending is disabled.'}</span>{allowed&&role==='admin'&&<><a href="/workspace">Open Business Workspace</a><button className="gp-btn" onClick={async()=>{const r=await fetch('/api/employee/session',{method:'DELETE'});if(r.ok)setEmployee(null);}}>Sign Out</button></>}</div>{!allowed?<main className="gp-site-gate"><h1>{title}</h1><p>{role==='staging'?'Sign in with your testing employee PIN.':'Sign in with your Platform Owner or Developer PIN.'}</p>{error?<p role="alert">{error}</p>:<button className="gp-btn primary" disabled={!ready} onClick={()=>void requestEmployeePin('SIGN_IN')}>{ready?'Sign In':'Preparing Sign-In…'}</button>}{employee&&!allowed&&<p role="alert">This employee does not have access to {title}.</p>}<ActionPin onSignedIn={setEmployee}/></main>:role==='admin'?<main className="gp-site-admin"><h1>Master Administration</h1><nav aria-label="Administration Sections">{['Businesses & Plans','Features & Permissions'].map(name=><button className="gp-btn" aria-pressed={tab===name} key={name} onClick={()=>setTab(name)}>{name}</button>)}</nav>{tab==='Businesses & Plans'?<SubscriptionSettings/>:<PlatformControls/>}<ActionPin onSignedIn={setEmployee}/></main>:children}</>;
}
