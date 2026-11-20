"use client";
import {HelpPopup} from './help-popup';
const money=(n:number)=>'$'+((n||0)/100).toFixed(2);
export function ReceivablesReport({data,loaded,timezone}:{data?:any;loaded:boolean;timezone?:string}){
 return <section aria-label="Outstanding balances"><h2>Outstanding balances<HelpPopup label="Outstanding balances">Review customer account balances and unpaid saved tickets. These can overlap when an old account balance is added to a ticket, so they are shown separately and must not be added together. This report does not apply credits or collect money.</HelpPopup></h2>
 <p>Current snapshot, independent of the selected sales dates. Accounts include accessible customers across shared locations; open tickets belong to the selected location. Customer account balances are collected with an appointment at checkout. No separate overdue deadline or fee is applied here.</p>
 {loaded&&!data&&<p>This saved report predates outstanding balances. Open it online for a current snapshot.</p>}
 <h3>Customer accounts</h3><p><strong>Balance owed:</strong> {data?money(data.accountBalanceCents):''} · <strong>Customer credit:</strong> {data?money(data.accountCreditCents):''}</p>
 <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Customer</th><th>Balance owed</th><th>Credit</th><th>Next appointment at this location</th></tr></thead><tbody>{(data?.accounts||[]).map((c:any)=><tr key={c.id}><td>{c.name}{c.active===false?' (inactive)':''}</td><td>{money(c.balanceCents)}</td><td>{money(c.creditCents)}</td><td>{c.nextAppointment?`#${c.nextAppointment.orderNumber} · ${new Date(c.nextAppointment.scheduledStart).toLocaleString(undefined,{timeZone:timezone})}`:'No upcoming appointment recorded here'}</td></tr>)}</tbody></table></div>
 {data&&!data.accounts.length&&<p>No account balances or credits in the accessible customer records.</p>}
 <h3>Unpaid saved tickets</h3><p><strong>Ticket balances:</strong> {data?money(data.openTicketDueCents):''}. Includes recorded tax and tips; excludes unsaved changes. Account balance included shows the saved Customer Account Balance line within each ticket total, not an extra amount to add.</p>
 <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Ticket</th><th>Customer</th><th>Status</th><th>Account balance included</th><th>Saved total</th><th>Recorded payments</th><th>Due</th></tr></thead><tbody>{(data?.openTickets||[]).map((t:any)=><tr key={t.id}><td>#{t.orderNumber}</td><td>{t.name}</td><td>{t.status.replaceAll('_',' ')}</td><td>{money(t.carriedBalanceCents)}</td><td>{money(t.totalCents)}</td><td>{money(t.paidCents)}</td><td>{money(t.dueCents)}</td></tr>)}</tbody></table></div>
 {data&&!data.openTickets.length&&<p>No unpaid saved tickets at this location.</p>}
 </section>;
}
