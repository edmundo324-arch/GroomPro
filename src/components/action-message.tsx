"use client";
import {useEffect,useRef,useState} from 'react';
type Message={message:string;complete?:(accepted:boolean)=>void};
export function ActionMessage(){
 const [queue,setQueue]=useState<Message[]>([]);const current=queue[0];const button=useRef<HTMLButtonElement>(null);
 const queueRef=useRef(queue);queueRef.current=queue;
 useEffect(()=>{const clear=()=>{queueRef.current.forEach(x=>x.complete?.(false));setQueue([])};const receive=(event:Event)=>{const item=(event as CustomEvent<Message>).detail;if(!item?.message)return;setQueue(q=>q.some(x=>x.message===item.message&&!item.complete)?q:[...q,item])};window.addEventListener('groompro:clear-messages',clear);window.addEventListener('groompro:save-error',receive);window.addEventListener('groompro:scheduling-warning',receive);return()=>{clear();window.removeEventListener('groompro:clear-messages',clear);window.removeEventListener('groompro:save-error',receive);window.removeEventListener('groompro:scheduling-warning',receive)}},[]);
 useEffect(()=>{if(current)button.current?.focus()},[current]);
 function finish(accepted:boolean){current?.complete?.(accepted);setQueue(q=>q.slice(1))}
 if(!current)return null;
 return <div className="gp-action-message-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="gp-action-message-title" aria-describedby="gp-action-message-text" className="gp-action-message" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();finish(false)}if(e.key==='Tab'){const buttons=Array.from(e.currentTarget.querySelectorAll('button'));if(buttons.length===1){e.preventDefault();buttons[0].focus()}else if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus()}}}}><h2 id="gp-action-message-title">{current.complete?'Scheduling warning':'Unable to complete action'}</h2><p id="gp-action-message-text">{current.message.replace(/^Error:\s*/, '')}</p>{current.complete&&<p>Dismiss to continue with this scheduling exception.</p>}<div>{current.complete&&<button className="gp-btn" onClick={()=>finish(false)}>Go back</button>}<button ref={button} className="gp-btn primary" onClick={()=>finish(true)}>Dismiss</button></div></section></div>
}
