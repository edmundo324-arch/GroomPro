"use client";
import {useEffect,useRef,useState} from 'react';
import {responseObject} from '../lib/response-object';

export function usePinSignIn(open:boolean,onSignedIn:(result:any)=>void, options?:{platformOnly?:boolean;mode?:string;requestHash?:string;onDeviceRequired?:()=>void}){
 const [pin,setPin]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const attempted=useRef('');
 const callback=useRef(onSignedIn),current=useRef(pin),visible=useRef(open),inFlight=useRef(false);
 callback.current=onSignedIn;current.current=pin;visible.current=open;
 useEffect(()=>{if(open){setPin('');setError('');setNotice('');attempted.current=''}},[open]);
 async function submit(automatic=false){
  const value=current.current;if(inFlight.current)return;
  if(!/^\d{3,10}$/.test(value)){if(!automatic)setError('Enter your 3 to 10 digit PIN.');return}
  if(automatic&&attempted.current===value)return;attempted.current=value;
  inFlight.current=true;setBusy(true);setNotice('');if(!automatic)setError('');
  try{
   let response:Response;
   try{response=await fetch('/api/employee/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:value,automatic,...options})})}
   catch{throw Error('GroomPro could not be reached. Check your connection, then press Continue again.')}
   const result=await responseObject(response,'GroomPro did not return a completed sign-in response. Wait a moment, then press Continue again.');
   if(current.current!==value||!visible.current)return;
   if(result.pending){setNotice(result.message||'Press Continue to verify this PIN.');return}
   if(result.deviceVerificationRequired){options?.onDeviceRequired?.();setPin('');return}
   if(!response.ok){setError(result.error||'PIN not recognized.');return}
   if(result.employee)window.dispatchEvent(new CustomEvent('groompro:identity-changed'));
   if(result.employee||result.approval){setPin('');setError('');try{callback.current(result)}catch{setError('Your PIN was accepted, but this screen could not finish opening. Refresh GroomPro to continue.')}}
   else setError('GroomPro did not return a completed sign-in response. Wait a moment, then press Continue again.');
  }catch(error){if(current.current===value&&visible.current)setError(error instanceof Error?error.message:'GroomPro could not be reached. Press Continue to try again.')}
  finally{inFlight.current=false;setBusy(false)}
 }
 useEffect(()=>{if(!open||pin.length<3)return;const timer=setTimeout(()=>void submit(true),650);return()=>clearTimeout(timer)},[open,pin,busy]);
 return {pin,setPin,error,setError,notice,busy,submit};
}
