"use client";
import {useEffect,useRef,useState} from 'react';

export function usePinSignIn(open:boolean,onSignedIn:(employee:any)=>void){
 const [pin,setPin]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const callback=useRef(onSignedIn),current=useRef(pin),visible=useRef(open),inFlight=useRef(false);
 callback.current=onSignedIn;current.current=pin;visible.current=open;
 useEffect(()=>{if(open){setPin('');setError('')}},[open]);
 async function submit(automatic=false){
  const value=current.current;if(inFlight.current)return;
  if(!/^\d{3,10}$/.test(value)){if(!automatic)setError('Enter your 3 to 10 digit PIN.');return}
  inFlight.current=true;setBusy(true);if(!automatic)setError('');
  try{
   const response=await fetch('/api/employee/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:value,automatic})});
   const result=await response.json();
   if(current.current!==value||!visible.current)return;
   if(result.pending)return;
   if(!response.ok){if(!automatic||response.status===429)setError(result.error||'PIN not recognized.');return}
   if(result.employee){setPin('');setError('');callback.current(result.employee)}
  }catch{if(!automatic)setError('Sign-in could not complete. Try again.')}
  finally{inFlight.current=false;setBusy(false)}
 }
 useEffect(()=>{if(!open||pin.length<3)return;const timer=setTimeout(()=>void submit(true),650);return()=>clearTimeout(timer)},[open,pin]);
 return {pin,setPin,error,setError,busy,submit};
}
