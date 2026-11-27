"use client";
import {useState} from 'react';
import {employeeFetch} from '../lib/employee-fetch';
import type {PetPictureUpdate} from './pet-picture';

const endpoint='/api/pets/photos/google';
type Options={petId:string;ticketId?:string;date:string;stage:string;caption:string;useAsProfile:boolean};
export function GooglePetPhotos({options,name,onSaved}:{options:Options;name:string;onSaved:(pet?:PetPictureUpdate)=>void}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[link,setLink]=useState('');
  const [selection,setSelection]=useState<{token:string;profile:boolean}|null>(null);
  const [manager,setManager]=useState(false),[connected,setConnected]=useState(false);
  async function request(path:string,method='GET',body?:object){
    const res=await employeeFetch(endpoint+path,{method,cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    const result=await res.json();
    if(result.saved)onSaved(result.pet);
    if(!res.ok)throw Error((result.saved?result.saved+' saved. ':'')+(result.error||'Reopen the gallery and try again.'));
    return result;
  }
  async function run(action:()=>Promise<void>){
    setBusy(true);setMessage('');
    try{await action();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  async function start(){
    setLink('');
    const account=await request('/account');
    setManager(account.manager);setConnected(account.connected);
    if(!account.configured){setMessage('Google Photos setup is needed for this GroomPro site. You can still choose a photo file.');return;}
    if(!account.connected){
      if(!account.manager){setMessage('Ask a business administrator to connect the Google account used for grooming photos.');return;}
      const {url}=await request('/account','POST');
      setLink(url);setMessage('Connect the business Google account, then return here and choose Add From Google Photos again.');return;
    }
    const result=await request('','POST',{action:'start',...options});
    setSelection({token:result.selection,profile:options.useAsProfile});setLink(result.url);
    setMessage('Choose up to 10 photos in the connected Google account. Once you finish there, save them here for '+name+'.'+(options.useAsProfile?' The first selected photo becomes the profile picture.':''));
  }
  async function finish(cancel=false){
    if(!selection)return;
    const result=await request('','POST',{action:cancel?'cancel':'save',petId:options.petId,selection:selection.token,useAsProfile:selection.profile});
    setLink('');setSelection(null);
    setMessage(cancel?'Selection canceled.':result.saved+' '+(result.saved===1?'photo':'photos')+' saved for '+name+'.');
  }
  return <div style={{gridColumn:'1 / -1'}}>
    {!selection&&<button type="button" className="gp-btn" disabled={busy} onClick={()=>void run(start)}>Add From Google Photos</button>}
    {link&&<p><a href={link} target="_blank" rel="noopener noreferrer">{selection?'Choose Photos in Google Photos':'Connect Business Google Account'}</a></p>}
    {selection&&<><button type="button" className="gp-btn primary" disabled={busy} onClick={()=>void run(()=>finish())}>Save Selected Photos</button> <button type="button" className="gp-btn" disabled={busy} onClick={()=>void run(()=>finish(true))}>Cancel Selection</button></>}
    {connected&&manager&&!selection&&<button type="button" className="gp-btn" disabled={busy} onClick={()=>void run(async()=>{await request('/account','DELETE');setConnected(false);setLink('');setMessage('Google Photos disconnected. Previously saved pictures stay in the gallery.');})}>Disconnect Google Photos</button>}
    {message&&<p role="status">{message}</p>}
  </div>;
}
