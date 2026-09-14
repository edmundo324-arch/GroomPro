"use client";
import {useEffect,useState} from "react";
import {ModuleWorkspace} from "./module-workspaces";
export function ModuleWorkspaceBridge(){const[m,setM]=useState("");useEffect(()=>{const f=()=>setM(document.querySelector(".gp-module.active")?.textContent?.trim()||"");f();const o=new MutationObserver(f);o.observe(document.body,{subtree:true,attributes:true,attributeFilter:["class"]});return()=>o.disconnect()},[]);if(!["Pets","Messaging","Inventory","Reports"].includes(m))return null;const nav=(n:string)=>[...document.querySelectorAll<HTMLButtonElement>(".gp-module")].find(x=>x.textContent?.trim()===n)?.click();return <ModuleWorkspace module={m as any} onOpenCustomer={()=>nav("Customers")} onNewTicket={()=>nav("Tickets")}/>}
