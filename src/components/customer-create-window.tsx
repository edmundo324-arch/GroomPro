"use client";
import {CustomerEditor} from './customer-editor';
export function CustomerCreateWindow({onClose,onCreated,onOpenExisting}:{onClose:()=>void;onCreated:(id:string)=>void;onOpenExisting:(id:string)=>void}){
 return <div className="gp-floating-window" role="dialog" aria-modal="true" aria-label="New customer"><div className="gp-floating-head"><div className="gp-floating-title">New Customer</div><button className="gp-btn" onClick={onClose}>Close</button></div><div className="gp-profile-body"><CustomerEditor onSaved={c=>onCreated(c.id)} onCancel={onClose} onOpenExisting={onOpenExisting}/><p>Save the customer to add pets to this account.</p></div></div>
}
