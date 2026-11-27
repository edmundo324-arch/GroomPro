"use client";
import {appointmentDisplay,appointmentDisplayFields} from '../lib/appointment-display';
import {AppointmentSummary} from './appointment-summary';
import {calendarPopupSample} from '../lib/calendar-popup-sample';
import {appointmentStyle} from '../lib/calendar-presentation';

export function AppointmentDisplayEditor({settings,onChange}:{settings:any;onChange:(settings:any)=>void}){
 const {fields}=appointmentDisplay(settings),selected=new Set(fields.map(field=>field.key));
 const groups=[
  ['Ticket Information',['date','time','ticket.arrivalPriority','ticket.orderNumber','ticket.status','ticket.durationMin','ticket.checkedInAt','ticket.pickupAt','assignments']],
  ['Customer Information',['customer']],
  ['Pet Information',['pet.name','pet.breed','pet.weightLbs','package']],
 ] as const;
 const save=(next:typeof fields)=>onChange({...settings,appointmentDisplay:{fields:next},showCalendarArrivalOrder:next.some(field=>field.key==='ticket.arrivalPriority')});
 const toggle=(key:string,show:boolean)=>save(show?[...fields,{key,row:Math.min(7,Math.max(...fields.map(field=>field.row))+1),bold:key==='ticket.arrivalPriority'}]:fields.filter(field=>field.key!==key));
 const update=(key:string,patch:{row?:number;bold?:boolean})=>save(fields.map(field=>field.key===key?{...field,...patch}:field));
 function move(key:string,direction:number){const index=fields.findIndex(field=>field.key===key),same=fields.filter(field=>field.row===fields[index].row),other=same[same.findIndex(field=>field.key===key)+direction];if(!other)return;const target=fields.findIndex(field=>field.key===other.key),next=fields.slice();[next[index],next[target]]=[next[target],next[index]];save(next);}
 const preview={...calendarPopupSample,status:'CHECKED_IN',pickupAt:null,closedAt:null,previewStage:'CHECKED_IN',presentationServiceType:'GR'};
 return <section className="gp-appointment-details-editor" aria-label="Appointment Details">
  <h3>Appointment Details</h3>
  <p>Choose what appears on appointments and arrange it by line. The same choices are used in Calendar, List and Tickets. Use Popup Content for the hover details.</p>
  <div className="gp-appointment-details-grid">
   <div className="gp-appointment-field-choices">{groups.map(([title,keys])=><fieldset key={title}><legend>{title}</legend>{keys.map(key=><label key={key}><input type="checkbox" aria-label={'Show '+appointmentDisplayFields[key]} checked={selected.has(key)} disabled={fields.length===1&&selected.has(key)} onChange={e=>toggle(key,e.target.checked)}/>{appointmentDisplayFields[key]}</label>)}</fieldset>)}</div>
   <div>
    <h4>Arrange Selected Details</h4>
    <p>Details on the same line appear together. Put Arrival Order beside Scheduled Time and select Bold for both.</p>
    <div className="gp-appointment-arrange" role="list" aria-label="Selected Appointment Details">{Array.from({length:8},(_,row)=>fields.filter(field=>field.row===row).map((field,index,same)=><div role="listitem" className="gp-appointment-field-row" key={field.key}>
     <strong>{appointmentDisplayFields[field.key]}</strong>
     <label>Line<select aria-label={'Line for '+appointmentDisplayFields[field.key]} value={field.row} onChange={e=>update(field.key,{row:Number(e.target.value)})}>{Array.from({length:8},(_,line)=><option key={line} value={line}>{line+1}</option>)}</select></label>
     <label><input type="checkbox" aria-label={'Bold '+appointmentDisplayFields[field.key]} checked={field.bold} onChange={e=>update(field.key,{bold:e.target.checked})}/>Bold</label>
     <span className="gp-appointment-field-move"><button type="button" className="gp-btn" disabled={index===0} aria-label={'Move '+appointmentDisplayFields[field.key]+' Earlier on Line '+(row+1)} onClick={()=>move(field.key,-1)}>←</button><button type="button" className="gp-btn" disabled={index===same.length-1} aria-label={'Move '+appointmentDisplayFields[field.key]+' Later on Line '+(row+1)} onClick={()=>move(field.key,1)}>→</button></span>
    </div>))}</div>
    <h4>Appointment Preview</h4>
    <div className="gp-appointment-details-preview" style={appointmentStyle(preview,settings)}><AppointmentSummary ticket={preview} settings={settings}/></div>
   </div>
  </div>
 </section>;
}
