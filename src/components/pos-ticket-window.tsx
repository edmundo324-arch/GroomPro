"use client";
import {useState} from 'react';
import {PosTicketDraft} from './pos-ticket-draft';
import {PosTicketRecord} from './pos-ticket-record';

// One public entry point for new appointments, sales, and existing tickets.
// Saving promotes the draft in place; it never sends the employee back to a list.
export function PosTicketWindow({ticketId,date,initialCustomerId,onClose,onSaved}:{ticketId?:string;date?:Date;initialCustomerId?:string|null;onClose:()=>void;onSaved?:(ticketId:string)=>void}){
 const[savedId,setSavedId]=useState(ticketId);
 const[draftDate]=useState(()=>date||new Date());
 if(savedId)return <PosTicketRecord key={savedId} ticketId={savedId} onClose={onClose}/>;
 return <PosTicketDraft date={draftDate} initialCustomerId={initialCustomerId} onClose={onClose} onSaved={id=>{setSavedId(id);onSaved?.(id)}}/>;
}
