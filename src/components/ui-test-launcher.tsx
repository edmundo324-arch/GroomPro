"use client";
import {useState} from "react";

export function UiTestLauncher(){
  const [open,setOpen]=useState(false);
  if(!open)return <button className="gp-btn primary" onClick={()=>setOpen(true)}>Open UI Test Center</button>;
  return <div className="gp-modal-backdrop" onMouseDown={()=>setOpen(false)}><div className="gp-floating-window" onMouseDown={e=>e.stopPropagation()} style={{left:"50%",right:"auto",transform:"translateX(-50%)",width:"min(900px,calc(100% - 24px))"}}>
    <div className="gp-floating-head"><div><div className="gp-floating-title">GroomPro UI Test Center</div><div className="gp-floating-subtitle">Use the live workspace to test the complete operating flow.</div></div><button className="gp-btn" onClick={()=>setOpen(false)}>Close</button></div>
    <div style={{padding:18,display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
      {[
        ["1","Calendar","Search a customer or pet while typing, hover matching appointments, and open the correct Ticket."],
        ["2","Book Appointment","Create an appointment, select the customer/dog, service, date/time, and scheduled groomer."],
        ["3","Ticket & Family Dogs","Open a ticket, review the dog's history, see family dogs, and add another dog."],
        ["4","Whiteboard","Push a date, check in dogs, assign Prep/Wash, then assign the operational groomer."],
        ["5","Services & Packages","Create/edit services and packages and verify location pricing."],
        ["6","VIP Membership","Start VIP for $1, review benefits, billing settings, and membership lifecycle."],
        ["7","Customer Account","Test balance owed, credit, Secret Rewards, and manager adjustments."],
        ["8","Checkout & Rebook","Apply balances/credit, collect payment, earn rewards, and rebook with the interval incentive."],
      ].map(([n,title,desc])=><div key={n} className="gp-settings-card" style={{padding:15}}><div style={{fontWeight:700}}>{n}. {title}</div><p style={{margin:"5px 0 0"}}>{desc}</p></div>)}
    </div>
    <div className="gp-profile-footer"><button className="gp-btn primary" onClick={()=>setOpen(false)}>Start with Calendar</button></div>
  </div></div>
}
