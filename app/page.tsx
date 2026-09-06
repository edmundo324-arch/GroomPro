"use client";

import { useEffect, useState } from "react";
import { CustomerProfile } from "@/src/components/customer-profile";

const modules = ["Calendar", "Customers", "Pets", "Tickets", "Whiteboard", "Messaging", "Inventory", "Reports"];
const employees = ["Abraham", "Groomer 2", "Groomer 3", "Front Desk", "Bathing"];
const times = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM"];
const appointments = [
  { row: 1, name: "Bella", breed: "Golden Retriever", service: "Grooming", employee: 0, vip: true, confirmed: true },
  { row: 2, name: "Max", breed: "Labradoodle", service: "Full Wash", employee: 1, vip: false, confirmed: false },
  { row: 4, name: "Luna", breed: "Shih Tzu", service: "Grooming", employee: 2, vip: false, confirmed: true },
  { row: 5, name: "Cooper", breed: "Cocker Spaniel", service: "Full Wash", employee: 3, vip: true, confirmed: true },
  { row: 6, name: "Daisy", breed: "Poodle", service: "Grooming", employee: 4, vip: false, confirmed: false },
];

type CustomerResult = { id: string; firstName: string; lastName: string; email: string | null; phones: { number: string; isPrimary: boolean }[]; pets: { name: string }[] };

export default function Home() {
  const [activeModule, setActiveModule] = useState("Calendar");
  const [view, setView] = useState("Day");
  const [workingOnly, setWorkingOnly] = useState(true);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showSwitch, setShowSwitch] = useState(false);
  const [pin, setPin] = useState("");
  const [employee, setEmployee] = useState<string | null>(null);

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
  function enterPin() {
    if (pin.length >= 4 && pin.length <= 10) { setEmployee("Authenticated Employee"); setPin(""); setShowSwitch(false); }
  }

  return (
    <div className="gp-shell">
      <header className="gp-topbar">
        <div className="gp-brand">GroomPro Suite</div>
        <nav className="gp-module-nav" aria-label="Main modules">{modules.map((module) => <button key={module} className={`gp-module ${activeModule === module ? "active" : ""}`} onClick={() => setActiveModule(module)}>{module}</button>)}</nav>
        <div className="gp-employee"><span className="gp-status-dot" /><span>{employee ?? "Ready"}</span><button className="gp-switch" onClick={() => setShowSwitch(true)}>{employee ? "Switch" : "Employee PIN"}</button></div>
      </header>

      <main className="gp-main">
        {activeModule === "Calendar" ? <>
          <div className="gp-calendar-head"><div><h1 className="gp-title">Calendar</h1><p className="gp-subtitle">Primary workspace · Monday, September 7, 2026</p></div><div className="gp-actions"><button className="gp-btn" onClick={() => setWorkingOnly(!workingOnly)}>{workingOnly ? "Working Employees" : "All Employees"}</button><button className="gp-btn" onClick={() => setShowCustomerSearch(true)}>Find Customer</button><button className="gp-btn primary">+ New Appointment</button></div></div>
          <section className="gp-calendar"><div className="gp-calendar-toolbar"><button className="gp-btn">‹</button><button className="gp-btn">Today</button><button className="gp-btn">›</button><span className="gp-date">Monday, September 7</span><div className="gp-view-toggle">{["Day", "Week"].map(item => <button key={item} className={view === item ? "selected" : ""} onClick={() => setView(item)}>{item}</button>)}</div></div><div style={{ overflowX: "auto" }}><div className="gp-calendar-grid"><div className="gp-time-head" />{employees.map(name => <div className="gp-resource-head" key={name}>{name}</div>)}{times.map((time, rowIndex) => <div key={time} style={{ display: "contents" }}><div className="gp-time">{time}</div>{employees.map((_, employeeIndex) => { const a = appointments.find(x => x.row === rowIndex && x.employee === employeeIndex); return <div className="gp-slot" key={`${time}-${employeeIndex}`}>{a && <div className={`gp-appointment ${a.vip ? "vip" : a.service === "Full Wash" ? "fullwash" : ""} ${a.confirmed ? "confirmed" : ""}`}><div className="name">{a.name} {a.vip ? "★" : ""}</div><div className="meta">{a.breed}</div><div className="meta">{a.service}</div></div>}</div>; })}</div>)}</div></div></section>
          <p className="gp-workspace-note">Less clicking is more productive: Calendar stays open while customer, ticket, messaging and other work can open as floating windows.</p>
        </> : <section className="gp-calendar" style={{ padding: 24 }}><h1 className="gp-title">{activeModule}</h1><p className="gp-subtitle">This workspace is being built into the GroomPro application shell.</p><button className="gp-btn" style={{ marginTop: 16 }} onClick={() => setActiveModule("Calendar")}>Return to Calendar</button></section>}
      </main>

      {showCustomerSearch && <div className="gp-modal-backdrop" role="dialog" aria-modal="true"><div className="gp-search-window"><div className="gp-floating-head"><div><div className="gp-floating-title">Customer Search</div><div className="gp-floating-subtitle">Search by phone, customer name, email, or pet name.</div></div><button className="gp-btn" onClick={closeCustomerSearch}>Close</button></div><input autoFocus value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} placeholder="Phone, name, email, or pet" className="gp-search-input" />{customerQuery.trim().length < 2 ? <div className="gp-search-empty">Start typing to search existing customers.</div> : searching ? <div className="gp-search-empty">Searching customers…</div> : customerResults.length ? <div className="gp-search-results">{customerResults.map(customer => <button className="gp-customer-result" key={customer.id} onClick={() => selectCustomer(customer.id)}><div><strong>{customer.firstName} {customer.lastName}</strong><span>{customer.phones.find(p => p.isPrimary)?.number || customer.phones[0]?.number || customer.email || "Contact not set"}</span></div><div><span>{customer.pets.length ? customer.pets.map(p => p.name).join(", ") : "No pets"}</span><b>Open</b></div></button>)}</div> : <div className="gp-search-empty">No matching customers found.</div>}</div></div>}
      {selectedCustomerId && <CustomerProfile customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />}

      {showSwitch && <div className="gp-modal-backdrop" role="dialog" aria-modal="true"><div className="gp-pin-window"><h2 style={{ marginTop: 0 }}>Employee Switch</h2><p className="gp-floating-subtitle">Enter the employee PIN for an accountable action.</p><input autoFocus aria-label="Employee PIN" inputMode="numeric" type="password" maxLength={10} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && enterPin()} placeholder="4–10 digit PIN" className="gp-search-input" /><div className="gp-modal-actions"><button className="gp-btn" onClick={() => { setShowSwitch(false); setPin(""); }}>Cancel</button><button className="gp-btn primary" disabled={pin.length < 4} onClick={enterPin}>Enter</button></div></div></div>}
    </div>
  );
}
