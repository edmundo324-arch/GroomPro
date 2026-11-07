"use client";
import {DismissButton} from './dismiss-button';
import {useEffect,useRef,useState} from 'react';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export function InstallGroomPro(){
 const dialog=useRef<HTMLDialogElement>(null);
 const[prompt,setPrompt]=useState<InstallPrompt|null>(null),[installed,setInstalled]=useState(false),[help,setHelp]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{if(help)dialog.current?.showModal();else dialog.current?.close()},[help]);
 useEffect(()=>{const display=window.matchMedia('(display-mode: standalone)'),check=()=>setInstalled(display.matches||(navigator as any).standalone===true),available=(e:Event)=>{e.preventDefault();setPrompt(e as InstallPrompt)},done=()=>{setInstalled(true);setPrompt(null);setHelp(false)};check();display.addEventListener('change',check);window.addEventListener('beforeinstallprompt',available);window.addEventListener('appinstalled',done);return()=>{display.removeEventListener('change',check);window.removeEventListener('beforeinstallprompt',available);window.removeEventListener('appinstalled',done)}},[]);
 if(installed)return null;
 return <><button type="button" className="gp-btn" disabled={busy} onClick={async()=>{if(!prompt){setHelp(true);return}setBusy(true);try{await prompt.prompt();await prompt.userChoice;setPrompt(null)}catch{setHelp(true)}finally{setBusy(false)}}}>Install GroomPro</button><dialog ref={dialog} aria-labelledby="gp-install-title" className="gp-install-dialog gp-package-removal-dialog" onCancel={()=>setHelp(false)}><h2 id="gp-install-title">Install GroomPro</h2><p>In Chrome or Edge, open the browser menu and choose Install app or Install GroomPro. On iPhone or iPad, open GroomPro in Safari, tap Share, then Add to Home Screen and enable Open as Web App if shown.</p><p>Open GroomPro from its new icon. Installation needs a supported browser and a secure site; a shared preview may require opening the direct site first. Open GroomPro online once to prepare this device for offline work.</p><DismissButton label="Dismiss install instructions" autoFocus onClick={()=>setHelp(false)}/></dialog></>;
}
