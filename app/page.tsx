"use client";

import { useEffect, useMemo, useState } from "react";
import { AppointmentWindow } from "@/src/components/appointment-window";
import { CustomerCreateWindow } from "@/src/components/customer-create-window";
import { CustomerProfile } from "@/src/components/customer-profile";

const modules = ["Calendar", "Customers", "Pets", "Tickets", "Whiteboard", "Messaging", "Inventory", "Reports"];
const times = Array.from({ length: 9 }, (_, i) => `${i + 8}:00`);
type Employee = { id: string; firstName: string; lastName: string; role: string; active?: boolean };
type Ticket = { id: string; orderNumber: number; scheduledStart: string | null; durationMin: number; status: string; customer: { firstName: string; lastName: string }; pets: { pet: { name: string; breed: string | null } }[]; lines: { description: string; totalCents: number }[]; assignments: { user: { id: string; firstName: string; lastName: string; role: string }; role: string }[] };
type CustomerResult = { id: string; firstName: string; lastName: string; email: string | null; phones: { number: string; isPrimary: boolean }[]; pets: { name: string }[] };

function dateLabel(date: Date) { return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }

export default function Home() {
  const [activeModule, setActiveModule] = useState("Calendar");
  const [view, setView] = useState("Day");
  const [workingOnly, setWorkingOnly] = useState(true);
  const [date, setDate] = useState(() => new Date("2026-09-07T12:00:00"));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [showAppointment, setShowAppointment] = useState(false);
  const [showCustomerCreate, setShowCustomerCreate] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showSwitch, setShowSwitch] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [employee, setEmployee] = useState<Employee | null>(null);

  async function loadCalendar() {
    setCalendarLoading(true); setCalendarError("");
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + (view === "Week" ? 7 : 1));
    try {
      const [ticketResponse, employeeResponse] = await Promise.all([fetch(`/api/calendar?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`), fetch("/api/employees")]);
      if (!ticketResponse.ok) throw new Error("Calendar data could not be loaded.");
      const ticketData = await ticketResponse.json(); const employeeData = employeeResponse.ok ? await employeeResponse.json() : { employees: [] };
      setTickets(ticketData.tickets || []); setEmployees(employeeData.employees || []);
    } catch (e) { setCalendarError((e as Error).message); } finally { setCalendarLoading(false); }
  }

  useEffect(() => { fetch("/api/employee/session").then(r => r.ok ? r.json() : { employee: null }).then(d => setEmployee(d.employee || null)).catch(() => undefined); }, []);
  useEffect(() => { loadCalendar(); }, [date, view]);
  useEffect(() => {
    const q = customerQuery.trim();
    if (q.length < 2 || selectedCustomerId) { setCustomerResults([]); setSearching(false); return; }
    const controller = new AbortController(); const timer = window.setTimeout(async () => { setSearching(true); try { const r = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, { signal: controller.signal }); const d = r.ok ? await r.json() : { customers: [] }; setCustomerResults(d.customers || []); } catch { } finally { setSearching(false); } }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [customerQuery, selectedCustomerId]);

  const visibleEmployees = useMemo(() => workingOnly ? employees.filter(e => e.active !== false) : employees, [employees, workingOnly]);
  function moveDay(amount: number) { const next = new Date(date); next.setDate(next.getDate() + amount); setDate(next); }
  function closeSearch() { setShowCustomerSearch(false); setCustomerQuery(""); setCustomerResults([]); }
  function openCustomer(customerId: string) { setSelectedCustomerId(customerId); setShowCustomerCreate(false); }
  async function enterPin() { if (pin.length < 4 || pin.length > 10) return; setPinError(""); try { const r = await fetch("/api/employee/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) }); const d = await r.json(); if (!r.ok) { setPinError(d.error || "Employee PIN was not recognized."); return; } setEmployee(d.employee); setPin(""); setShowSwitch(false); } catch { setPinError("Employee sign-in could not be completed."); } }
  async function switchEmployee() { await fetch("/api/employee/session", { method: "DELETE" }).catch(() => undefined); setEmployee(null); setShowSwitch(true); }

  return <div className="gp-shell">
    <header className="gp-topbar"><div className="gp-brand">GroomPro Suite</div><nav className="gp-module-nav" aria-label="Main modules">{modules.map(m => <button key={m} className={`gp-module ${activeModule === m ? "active" : ""}`} onClick={() => setActiveModule(m)}>{m}</button>)}</nav><div className="gp-employee"><span className="gp-status-dot"/><span>{employee ? `${employee.firstName} ${employee.lastName}` : "Ready"}</span><button className="gp-switch" onClick={() => employee ? switchEmployee() : setShowSwitch(true)}>{employee ? "Switch" : "Employee PIN"}</button></div></header>
    <main className="gp-main">
      {activeModule === "Calendar" ? <>
        <div className="gp-calendar-head"><div><h1 className="gp-title">Calendar</h1><p className="gp-subtitle">Primary workspace · {dateLabel(date)}</p></div><div className="gp-actions"><button className="gp-btn" onClick={() => setWorkingOnly(!workingOnly)}>{workingOnly ? "Working Employees" : "All Employees"}</button><button className="gp-btn" onClick={() => setShowCustomerSearch(true)}>Find Customer</button><button className="gp-btn" onClick={() => setShowCustomerCreate(true)}>+ New Customer</button><button className="gp-btn primary" onClick={() => setShowAppointment(true)}>+ New Appointment</button></div></div>
        <section className="gp-calendar"><div className="gp-calendar-toolbar"><button className="gp-btn" onClick={() => moveDay(-1)}>‹</button><button className="gp-btn" onClick={() => setDate(new Date())}>Today</button><button className="gp-btn" onClick={() => moveDay(1)}>›</button><span className="gp-date">{dateLabel(date)}</span><div className="gp-view-toggle">{["Day", "Week"].map(v => <button key={v} className={view === v ? "selected" : ""} onClick={() => setView(v)}>{v}</button>)}</div></div>
          {calendarLoading && <div className="gp-search-empty">Loading appointments…</div>}
          {calendarError && <div className="gp-form-error">{calendarError}</div>}
          <div style={{ overflowX: "auto" }}><div className="gp-calendar-grid"><div className="gp-time-head"/>{visibleEmployees.map(e => <div className="gp-resource-head" key={e.id}>{e.firstName} {e.lastName}</div>)}
            {times.map((time, rowIndex) => <div key={time} style={{ display: "contents" }}><div className="gp-time">{new Date(`2000-01-01T${time}:00`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>{visibleEmployees.map(e => { const ticket = tickets.find(t => { if (!t.scheduledStart) return false; const d = new Date(t.scheduledStart); return d.getHours() === rowIndex + 8 && d.getMinutes() < 30 && t.assignments.some(a => a.user.id === e.id); }); return <div className="gp-slot" key={`${time}-${e.id}`}>{ticket && <div className={`gp-appointment ${ticket.status === "CONFIRMED" ? "confirmed" : ""}`}><div className="name">{ticket.pets[0]?.pet.name || "Appointment"}</div><div className="meta">#{ticket.orderNumber} · {ticket.customer.firstName} {ticket.customer.lastName}</div><div className="meta">{ticket.lines[0]?.description || "Service"}</div></div>}</div>; })}</div>)}
          </div></div>
        </section><p className="gp-workspace-note">Calendar stays open while customer and ticket work opens as floating windows.</p>
      </> : <section className="gp-calendar" style={{ padding: 24 }}><h1 className="gp-title">{activeModule}</h1><p className="gp-subtitle">This workspace is being built into GroomPro.</p></section>}
    </main>

    {showAppointment && <AppointmentWindow date={date} onClose={() => setShowAppointment(false)} onSaved={() => { setShowAppointment(false); loadCalendar(); }} />}
    {showCustomerCreate && <CustomerCreateWindow onClose={() => setShowCustomerCreate(false)} onCreated={openCustomer} onOpenExisting={openCustomer} />}
    {showCustomerSearch && <div className="gp-modal-backdrop" role="dialog" aria-modal="true"><div className="gp-search-window"><div className="gp-floating-head"><div><div className="gp-floating-title">Customer Search</div><div className="gp-floating-subtitle">Search by phone, customer name, email, or pet name.</div></div><button className="gp-btn" onClick={closeSearch}>Close</button></div><input autoFocus value={customerQuery} onChange={e => { setCustomerQuery(e.target.value); setSelectedCustomerId(null); }} placeholder="Phone, name, email, or pet" className="gp-search-input" />{customerQuery.trim().length < 2 ? <div className="gp-search-empty">Start typing to search existing customers.</div> : searching ? <div className="gp-search-empty">Searching customers…</div> : customerResults.length ? <div className="gp-search-results">{customerResults.map(c => <button className="gp-customer-result" key={c.id} onClick={() => { closeSearch(); setSelectedCustomerId(c.id); }}><div><strong>{c.firstName} {c.lastName}</strong><span>{c.phones.find(p => p.isPrimary)?.number || c.email || "Contact not set"}</span></div><div><span>{c.pets.map(p => p.name).join(", ") || "No pets"}</span><b>Open</b></div></button>)}</div> : <div className="gp-search-empty">No matching customers found.</div>}</div></div>}
    {selectedCustomerId && <CustomerProfile customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />}
    {showSwitch && <div className="gp-modal-backdrop" role="dialog" aria-modal="true"><div className="gp-pin-window"><h2 style={{ marginTop: 0 }}>Employee Switch</h2><p className="gp-floating-subtitle">Enter the employee PIN for an accountable action.</p><input autoFocus inputMode="numeric" type="password" maxLength={10} value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setPinError(""); }} onKeyDown={e => e.key === "Enter" && enterPin()} placeholder="4–10 digit PIN" className="gp-search-input" />{pinError && <div className="gp-form-error">{pinError}</div>}<div className="gp-modal-actions"><button className="gp-btn" onClick={() => setShowSwitch(false)}>Cancel</button><button className="gp-btn primary" disabled={pin.length < 4} onClick={enterPin}>Enter</button></div></div></div>}
  </div>;
}
