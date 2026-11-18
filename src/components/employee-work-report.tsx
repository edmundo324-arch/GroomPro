"use client";
import {HelpPopup} from './help-popup';
import type {EmployeeReportRow} from '../lib/employee-report';
type WorkReport={rows:EmployeeReportRow[];scope:string;asOf:string;invalidRecords:number;unallocatedTipCents:number};
const hours=(minutes=0)=>(minutes/60).toFixed(2),money=(cents=0)=>'$'+(cents/100).toFixed(2);
export function EmployeeWorkReport({current,previous,compare,loaded,timezone}:{current?:WorkReport;previous?:WorkReport;compare:boolean;loaded:boolean;timezone?:string}){
 const present=current?.rows||[],prior=previous?.rows||[],ids=[...new Set([...present,...prior].map(r=>r.id))];
 return <section><h2>Employee time & earnings<HelpPopup label="Employee time & earnings">Review recorded attendance, saved commissions and assigned tips for this location. Tips added after checkout belong to the ticket’s original closing date. These figures do not calculate wages or show payroll payments.</HelpPopup></h2>
 <p>Shifts count only the time inside these dates at the selected location. Open shifts stop at the report’s snapshot time. Breaks are shown separately; this does not decide whether breaks are paid. Commissions and tips use the ticket’s original closing date, including tips added later.</p>
 {current&&<p>{current.scope==='SELF'?'Showing your recorded work.':'Showing employees available to your account, including inactive employees with recorded work.'} Snapshot: {new Date(current.asOf).toLocaleString(undefined,{timeZone:timezone})}.</p>}
 <div style={{overflowX:'auto'}}><table><thead><tr><th>Employee</th>{['Recorded hours','Break hours','Hours excluding breaks','Open shifts','Recorded commissions','Assigned tips'].map(name=><th key={name}>{name}</th>)}{compare&&<><th>Previous hours excluding breaks</th><th>Previous commissions</th><th>Previous tips</th></>}</tr></thead><tbody>{ids.map(id=>{const a=present.find(r=>r.id===id),b=prior.find(r=>r.id===id);return <tr key={id}><th style={{textAlign:'left'}}>{(a||b)!.name}</th><td>{hours(a?.elapsedMinutes)}</td><td>{hours(a?.breakMinutes)}</td><td>{hours(a?.minutesExcludingBreaks)}</td><td>{a?.openShifts||0}</td><td>{money(a?.commissionCents)}</td><td>{money(a?.tipCents)}</td>{compare&&<><td>{hours(b?.minutesExcludingBreaks)}</td><td>{money(b?.commissionCents)}</td><td>{money(b?.tipCents)}</td></>}</tr>})}</tbody></table></div>
 {loaded&&!current&&<p>This saved report predates employee time and earnings. Open these dates online to include them.</p>}
 {current&&!ids.length&&<p>No recorded time or assigned earnings were found for these dates.</p>}
 {current&&current.unallocatedTipCents!==0&&<p role="status">{current.unallocatedTipCents>0?`${money(current.unallocatedTipCents)} in tips on these closed tickets still needs an employee assignment.`:`Tip assignments exceed the ticket tips by ${money(-current.unallocatedTipCents)}. Review the saved tip assignments.`}</p>}
 {!!current?.invalidRecords&&<p role="status">Some time or tip entries could not be read and were left out. Review the saved records before using this report.</p>}
 </section>;
}
