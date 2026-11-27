"use client";
import {DismissButton} from './dismiss-button';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {installChanged,takeInstallPrompt} from '../lib/app-install';
export function InstallGroomPro(){
 const dialog=useRef<HTMLDialogElement>(null);
 const[installed,setInstalled]=useState(false),[help,setHelp]=useState(false),[busy,setBusy]=useState(false),[directLink,setDirectLink]=useState('');
 useEffect(()=>{if(help)dialog.current?.showModal();else dialog.current?.close()},[help]);
 useEffect(()=>{
  const display=window.matchMedia('(display-mode: standalone)');
  const check=()=>{
   const active=display.matches||(navigator as Navigator&{standalone?:boolean}).standalone===true||window.__groomproInstall?.installed===true;
   setInstalled(active);if(active)setHelp(false);
  };
  if(window.self!==window.top)setDirectLink(window.location.href);
  check();display.addEventListener('change',check);window.addEventListener(installChanged,check);
  return()=>{display.removeEventListener('change',check);window.removeEventListener(installChanged,check)};
 },[]);
 if(installed)return null;
 return <><button type="button" className="gp-btn" disabled={busy} onClick={async()=>{
  const prompt=takeInstallPrompt();
  if(!prompt){setHelp(true);return}
  setBusy(true);
  try{await prompt.prompt();await prompt.userChoice}catch{setHelp(true)}finally{setBusy(false)}
 }}>Install GroomPro</button>{help&&createPortal(<dialog ref={dialog} aria-labelledby="gp-install-title" className="gp-install-dialog gp-package-removal-dialog" onCancel={()=>setHelp(false)}>
  <h2 id="gp-install-title">Install GroomPro</h2>
  {directLink&&<p>Open GroomPro in its own browser tab first. <a className="gp-btn" href={directLink} target="_blank" rel="noopener">Open GroomPro Directly</a></p>}
  <p>On your PC, open GroomPro in a regular Chrome or Edge window. Look for the Install icon at the right of the address bar.</p>
  <ul><li><strong>Edge:</strong> Menu (…) → More Tools → Apps → Install This Site as an App.</li><li><strong>Chrome:</strong> Menu (⋮) → Cast, Save, and Share → Install Page as App.</li></ul>
  <p>On iPhone or iPad, use Safari → Share → Add to Home Screen. Enable Open as Web App if shown.</p>
  <p>Your new GroomPro icon opens the same business and uses your usual sign-in. If this preview asks for access again, reopen the shared preview link in the same browser.</p>
  <p>For offline work, sign in while connected and wait for Ready Offline before disconnecting.</p>
  <DismissButton label="Dismiss install instructions" autoFocus onClick={()=>setHelp(false)}/>
 </dialog>,document.body)}</>;
}
