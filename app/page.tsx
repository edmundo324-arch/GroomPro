"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerProfile } from "@/src/components/customer-profile";

const modules = ["Calendar", "Customers", "Pets", "Tickets", "Whiteboard", "Messaging", "Inventory", "Reports"];
const times = Array.from({ length: 9 }, (_, index) => index + 8);

type CustomerResult = { id: string; firstName: string; lastName: string; email: string | null; phones: { number: string; isPrimary: boolean }[]; pets: { name: string }[] };
type Employee = { id: string; firstName: string; lastName: string; role: string };
type CalendarTicket = {
  id: string;
  orderNumber: number;
  scheduledStart: string;
  durationMin: number;
  status: string;
  customer: { id: string; firstName: string; lastName: string };
  pets: { pet: { id: string; name: string; breed: string | null } }[];
  lines: { id: string; lineType: string; description: string; totalCents: number }[];
  assignments: { id: string; role: string; user: { id: string; firstName: string; lastName: string; role: string } }[];
};

function localDayBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
}

function formatShortDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:00 ${suffix}`;
}

export default function Home() {
  const [activeModule, setActiveModule] = useState("Calendar");
  const [view, setView] = useState("Day");
  const [workingOnly, setWorkingOnly] = useState(true);
  const [calendarDate, setCalendarDate] = useState(() => new Date(2026, 8, 7));
  const [calendarTickets, setCalendarTickets] = useState<CalendarTicket[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showSwitch, setShowSwitch] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [employee, setEmployee] = useState<Employee | null>(null);

  const employees = useMemo(() => {
    const map = new Map<string, Employee>();
    calendarTickets.forEach(ticket => ticket.assignments.forEach(assignment => {
      map.set(assignment.user.id, assignment.user);
    }));
    if (employee) map.set(employee.id, employee);
    return Array.from(map.values()).sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
  }, [calendarTickets, employee]);

  useEffect(() => {
    fetch("/api/employee/session").then(r => r.ok ? r.json() : { employee: null }).then(data => setEmployee(data.employee || null)).catch(() => setEmployee(null));
  }, []);

  useEffect(() => {
    if (activeModule !== "Calendar") return;
    const { start, end } = localDayBounds(calendarDate);
    const controller = new AbortController();
    setCalendarLoading(true);
    setCalendarError("");
    fetch(`/api/calendar?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Calendar could not be loaded.");
        return data;
      })
      .then(data => setCalendarTickets(data.tickets || []))
      .catch(error => { if (error.name !== "AbortError") { setCalendarTickets([]); setCalendarError(error.message); } })
      .finally(() => setCalendarLoading(false));
    return () => controller.abort();
  }, [activeModule, calendarDate]);

  useEffect(() => {
    const query = customerQuery.trim();
    if (query.length < 2) { setCustomerResults([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        setCustomerResults(data.customers || []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setCustomerResults([]);
      } finally { setSearching(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [customerQuery]);

  function closeCustomerSearch() { setShowCustomerSearch(false); setCustomerQuery(""); setCustomerResults([]); }
  function selectCustomer(id: string) { closeCustomerSearch(); setSelectedCustomerId(id); }
  function moveDay(offset: number) { setCalendarDate(current => { const next = new Date(current); next.setDate(next.getDate() + offset); return next; }); }
  function goToday() { setCalendarDate(new Date()); }

  async function enterPin() {
    if (pin.length < 4 || pin.length > 10) return;
    setPinError("");
    try {
      const response = await fetch("/api/employee/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      const data = await response.json();
      if (!response.ok) { setPinError(data.error || "Employee PIN was not recognized."); return; }
      setEmployee(data.employee); setPin(""); setShowSwitch(false);
    } catch { setPinError("Employee sign-in could not be completed."); }
  }

  async function switchEmployee() {
    await fetch("/api/employee/session", { method: "DELETE" }).catch(() => undefined);
    setEmployee(null); setPinError(""); setShowSwitch(true);
  }

  function ticketEmployee(ticket: CalendarTicket) {
    const groomer = ticket.assignments.find(a => a.role === "GROOMER" || a.user.role === "GROOMER" || a.user.role === "MASTER_GROOMER");
    return groomer?.user.id || ticket.assignments[0]?.user.id || "unassigned";
  }

  function ticketService(ticket: CalendarTicket) {
    return ticket.lines.filter(line => line.lineType === "SERVICE").map(line => line.description).join(", ") || "Appointment";
  }

  function ticketPet(ticket: CalendarTicket) {
    const pet = ticket.pets[0]?.pet;
    return pet ? `${pet.name}${pet.breed ? ` · ${pet.breed}` : ""}` : "Pet not assigned";
  }

  function ticketMinutes(ticket: CalendarTicket) {
    const date = new Date(ticket.scheduledStart);
    return date.getHours() * 60 + date.getMinutes();
  }

  return (
    <div className="gp-shell">
      <header className="gp-topbar">
        <div className="gp-brand">GroomPro Suite</div>
        <nav className="gp-module-nav" aria-label="Main modules">{modules.map(module => <button key={module} className={`gp-module ${activeModule === module ? "active" : ""}`} onClick={() => setActiveModule(module)}>{module}</button>)}</nav>
        <div className="gp-employee"><span className="gp-status-dot" /><span>{employee ? `${employee.firstName} ${employee.lastName}` : "Ready"}</span><button className="gp-switch" onClick={() => employee ? switchEmployee() : setShowSwitch(true)}>{employee ? "Switch" : "Employee PIN"}</button></div>
      </header>

      <main className="gp-main">
        {activeModule === "Calendar" ? <>
          <div className="gp-calendar-head"><div><h1 className="gp-title">Calendar</h1><p className="gp-subtitle">Primary workspace · {formatDay(calendarDate)}</p></div><div className="gp-actions"><button className="gp-btn" onClick={() => setWorkingOnly(!workingOnly)}>{workingOnly ? "Working Employees" : "All Employees"}</button><button className="gp-btn" onClick={() => setShowCustomerSearch(true)}>Find Customer</button><button className="gp-btn primary">+ New Appointment</button></div></div>
          <section className="gp-calendar">
            <div className="gp-calendar-toolbar"><button className="gp-btn" onClick={() => moveDay(-1)} aria-label="Previous day">‹</button><button className="gp-btn" onClick={goToday}>Today</button><button className="gp-btn" onClick={() => moveDay(1)} aria-label="Next day">›</button><span className="gp-date">{formatShortDay(calendarDate)}</span><div className="gp-view-toggle">{["Day", "Week"].map(item => <button key={item} className={view === item ? "selected" : ""} onClick={() => setView(item)}>{item}</button>)}</div></div>
            {calendarLoading && <div className="gp-search-empty">Loading appointments…</div>}
            {calendarError && <div className="gp-search-empty">{calendarError}</div>}
            {!calendarLoading && !calendarError && <div style={{ overflowX: "auto" }}><div className="gp-calendar-grid" style={{ gridTemplateColumns: `76px repeat(${Math.max(employees.length, 1)}, minmax(150px, 1fr))` }}><div className="gp-time-head" />{employees.length ? employees.map(user => <div className="gp-resource-head" key={user.id}>{user.firstName} {user.lastName}</div>) : <div className="gp-resource-head">No employees assigned</div>}{times.map(hour => <div key={hour} style={{ display: "contents" }}><div className="gp-time">{hourLabel(hour)}</div>{employees.length ? employees.map(user => { const ticket = calendarTickets.find(item => ticketEmployee(item) === user.id && Math.floor(ticketMinutes(item) / 60) === hour); return <div className="gp-slot" key={`${hour}-${user.id}`}>{ticket && <div className={`gp-appointment ${ticketService(ticket).toLowerCase().includes("full wash") ? "fullwash" : ""} ${ticket.status === "CONFIRMED" ? "confirmed" : ""}`}><div className="name">{ticket.pets[0]?.pet.name || ticket.customer.firstName} · #{ticket.orderNumber}</div><div className="meta">{ticketPet(ticket)}</div><div className="meta">{ticketService(ticket)}</div></div>}</div>; }) : <div className="gp-slot" />}</div>)}</div></div>}
          </section>
          <p className="gp-workspace-note">Less clicking is more productive: Calendar stays open while customer, ticket, messaging and other work can open as floating windows.</p>
        </> : <section className="gp-calendar" style={{ padding: 24 }}><h1 className="gp-title">{activeModule}</h1><p className="gp-subtitle">This workspace is being built into the GroomPro application shell.</p><button className="gp-btn" style={{ marginTop: 16 }} onClick={() => setActiveModule("Calendar")}>Return to Calendar</button></section>}
      </main>

      {showCustomerSearch && <div className="gp-modal-backdrop" role="dialog" aria-modal="true"><div className="gp-search-window"><div className="gp-floating-head"><div><div className="gp-floating-title">Customer Search</div><div className="gp-floating-subtitle">Search by phone, customer name, email, or pet name.</div></div><button className="gp-btn" onClick={closeCustomerSearch}>Close</button></div><input autoFocus value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} placeholder="Phone, name, email, or pet" className="gp-search-input" />{customerQuery.trim().length < 2 ? <div className="gp-search-empty">Start typing to search existing customers.</div> : searching ? <div className="gp-search-empty">Searching customers…</div> : customerResults.length ? <div className="gp-search-results">{customerResults.map(customer => <button className="gp-customer-result" key={customer.id} onClick={() => selectCustomer(customer.id)}><div><strong>{customer.firstName} {customer.lastName}</strong><span>{customer.phones.find(p => p.isPrimary)?.number || customer.phones[0]?.number || customer.email || "Contact not set"}</span></div><div><span>{customer.pets.length ? customer.pets.map(p => p.name).join(", ") : "No pets"}</span><b>Open</b></div></button>)}</div> : <div className="gp-search-empty">No matching customers found.</div>}</div></div>}
      {selectedCustomerId && <CustomerProfile customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />}
      {showSwitch && <div className="gp-modal-backdrop" role="dialog" aria-modal="true"><div className="gp-pin-window"><h2 style={{ marginTop: 0 }}>Employee Switch</h2><p className="gp-floating-subtitle">Enter the employee PIN for an accountable action.</p><input autoFocus aria-label="Employee PIN" inputMode="numeric" type="password" maxLength={10} value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setPinError(""); }} onKeyDown={e => e.key === "Enter" && enterPin()} placeholder="4–10 digit PIN" className="gp-search-input" />{pinError && <div style={{ color: "#a12622", fontSize: 13, marginTop: 8 }}>{pinError}</div>}<div className="gp-modal-actions"><button className="gp-btn" onClick={() => { setShowSwitch(false); setPin(""); setPinError(""); }}>Cancel</button><button className="gp-btn primary" disabled={pin.length < 4} onClick={enterPin}>Enter</button></div></div></div>}
    </div>
  );
}
