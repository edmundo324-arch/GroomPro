"use client";
import {HelpPopup} from './help-popup';
import type {SalesRow} from '../lib/report-sales-breakdowns';
const money=(value:number)=>'$'+((value||0)/100).toFixed(2);
export function SalesBreakdownReport({current,previous,compare,loaded}:{current?:any;previous?:any;compare:boolean;loaded:boolean}){
 const days:SalesRow[]=current?.days||[],max=Math.max(1,...days.map(d=>Math.abs(d.amountCents)));
 return <section aria-label="Sales breakdowns"><h2>Sales breakdowns<HelpPopup label="Sales breakdowns">These are different views of the same closed-ticket sales. Do not add product, package and employee totals together. Tax, tips and collected prior balances are excluded.</HelpPopup></h2>
 <p>Saved line amounts after discounts, by original closing date. Package sales sum their component lines once. Employee sales use the employee recorded on each line; no employee is guessed from the appointment.</p>
 <p><strong>Closed-ticket sales excluding prior balances:</strong> {current?money(current.netLineSalesCents):''}</p>
 {loaded&&!current&&<p>This saved report predates sales breakdowns. Open these dates online to include them.</p>}
 {(['products','packages','employees'] as const).map(key=>{const rows:SalesRow[]=current?.[key]||[],prior:SalesRow[]=previous?.[key]||[],ids=[...new Set([...rows,...prior].map(r=>r.id))];return <section key={key}><h3>{key==='products'?'Product sales':key==='packages'?'Package sales':'Employee sales'}</h3>{key==='employees'&&<p>Includes permitted employee assignments and Unassigned items. Unassigned means no employee was selected on the sold item—not a missing sale.</p>}<div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>{key==='employees'?'Employee':'Name'}</th><th>Sales</th>{key==='products'&&<th>Units</th>}<th>Tickets</th>{compare&&<th>Previous sales</th>}</tr></thead><tbody>{ids.map(id=>{const a=rows.find(r=>r.id===id),b=prior.find(r=>r.id===id);return <tr key={id}><td>{(a||b)!.name}</td><td>{money(a?.amountCents||0)}</td>{key==='products'&&<td>{a?.quantity||0}</td>}<td>{a?.tickets||0}</td>{compare&&<td>{money(b?.amountCents||0)}</td>}</tr>})}</tbody></table></div>{loaded&&current&&!ids.length&&<p>No recorded sales in this breakdown.</p>}</section>})}
 <h3>Daily closed-ticket sales</h3><p>Dates use the shop’s time zone. Days without closed tickets are omitted.</p>
 <div style={{display:'grid',gap:6}}>{days.map(day=><div key={day.id} style={{display:'grid',gridTemplateColumns:'100px minmax(80px,1fr) 100px',alignItems:'center',gap:8}}><span>{day.name}</span><div aria-hidden="true" style={{background:'#edf3f7',height:18}}><div style={{width:Math.abs(day.amountCents)/max*100+'%',height:'100%',background:day.amountCents<0?'#a43838':'#356685'}}/></div><strong>{money(day.amountCents)}</strong></div>)}</div>
 </section>;
}
