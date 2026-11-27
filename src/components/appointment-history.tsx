"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {employeeFetch} from '../lib/employee-fetch';
import {appointmentStyle} from '../lib/calendar-presentation';
import {AppointmentSummary} from './appointment-summary';
import {CalendarHover} from './calendar-hover';
import {useAppointmentPreview} from './use-appointment-preview';

export function AppointmentHistory({tickets,pets,currentId}:{tickets:any[];pets:any[];currentId:string}){
 const[pet,setPet]=useState(''),[settings,setSettings]=useState<any>({});
 const preview=useAppointmentPreview(settings);
 useEffect(()=>{let alive=true;const load=()=>employeeFetch('/api/workflow-settings').then(r=>r.json()).then(d=>{if(alive)setSettings(d.settings||{})}).catch(()=>{});void load();window.addEventListener('groompro:appearance-changed',load);return()=>{alive=false;window.removeEventListener('groompro:appearance-changed',load)}},[]);
 return <div><nav aria-label="Filter appointment history by pet"><button className="gp-btn" aria-pressed={!pet} onClick={()=>setPet('')}>All Pets</button>{pets.map(p=><button className="gp-btn" key={p.id} aria-pressed={pet===p.id} onClick={()=>setPet(p.id)}>{p.name}</button>)}</nav>{[true,false].map(future=>{
  const list=tickets.filter(t=>t.id!==currentId&&(!pet||t.pets?.some((p:any)=>p.petId===pet||p.pet?.id===pet))&&(+new Date(t.scheduledStart)>=Date.now())===future).sort((a,b)=>(+new Date(a.scheduledStart)-+new Date(b.scheduledStart))*((future?settings.historyUpcomingSort!=='DESC':settings.historyPreviousSort==='ASC')?1:-1));
  return <section key={String(future)}><h4>{future?'Upcoming Appointments':'Previous Appointments'}</h4>{list.map(t=><button key={t.id} className={"gp-history-appointment gp-appointment-view"+(preview.hover?.ticket.id===t.id?" gp-calendar-ticket-highlight":"")} style={appointmentStyle(t,settings)} onMouseEnter={e=>preview.show(t,e.currentTarget)} onMouseLeave={preview.hide} onFocus={e=>preview.show(t,e.currentTarget)} onBlur={preview.hide} onClick={()=>{preview.hide();window.dispatchEvent(new CustomEvent('groompro:open-ticket',{detail:{ticketId:t.id}}))}}><small>{new Date(t.scheduledStart).toLocaleDateString(undefined,t.appointmentTimezone?{timeZone:t.appointmentTimezone}:undefined)}</small><AppointmentSummary ticket={t} settings={settings} hideServices={settings.historyPresentation==='COMPACT'}/></button>)}{!list.length&&<p>No {future?'upcoming':'previous'} appointments.</p>}</section>;
 })}{preview.hover&&createPortal(<CalendarHover hover={preview.hover} fields={settings.hoverFields||[]} labels={settings.hoverLabels} arrivalPosition={settings.hoverArrivalPosition} details={preview.details}/>,document.body)}</div>;
}