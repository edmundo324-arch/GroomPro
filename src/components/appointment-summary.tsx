import {Fragment} from 'react';
import {appointmentDisplay,appointmentDetailValue} from '../lib/appointment-display';
import './appointment-summary.css';

export function AppointmentSummary({ticket,settings,hideServices=false}:{ticket:any;settings?:any;hideServices?:boolean}){
 const rows=new Map<number,{key:string;value:string;bold:boolean}[]>();
 for(const field of appointmentDisplay(settings).fields){
  if(hideServices&&field.key==='package')continue;
  const value=appointmentDetailValue(ticket,field.key);if(!value)continue;
  rows.set(field.row,[...(rows.get(field.row)||[]),{key:field.key,value,bold:field.bold}]);
 }
 return <span className="gp-appointment-summary">{rows.size?[...rows].map(([row,fields])=><span className="gp-appointment-summary-row" key={row}>{fields.map((field,index)=><Fragment key={field.key}>{index>0?' · ':null}{field.bold?<b className="gp-appointment-detail" data-appointment-field={field.key}>{field.value}</b>:<span className="gp-appointment-detail" data-appointment-field={field.key}>{field.value}</span>}</Fragment>)}</span>):<span className="gp-appointment-summary-row">Appointment{ticket.orderNumber!=null?' #'+ticket.orderNumber:''}</span>}</span>;
}
