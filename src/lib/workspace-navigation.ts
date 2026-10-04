"use client";
export function openPosTicket(ticketId?:string,customerId?:string){window.dispatchEvent(new CustomEvent('groompro:open-ticket',{detail:{ticketId,customerId}}))}
