"use client";

import { useState } from "react";

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

export default function Home() {
  const [activeModule, setActiveModule] = useState("Calendar");
  const [view, setView] = useState("Day");
  const [workingOnly, setWorkingOnly] = useState(true);
  const [employee, setEmployee] = useState<string | null>(null);
  const [showSwitch, setShowSwitch] = useState(false);
  const [pin, setPin] = useState("");

  function enterPin() {
    if (pin.length >= 4 && pin.length <= 10) {
      setEmployee("Active Employee");
      setPin("");
      setShowSwitch(false);
    }
  }

  return (
    <div className="gp-shell">
      <header className="gp-topbar">
        <div className="gp-brand">GroomPro Suite</div>
        <nav className="gp-module-nav" aria-label="Main modules">
          {modules.map((module) => <button key={module} className={`gp-module ${activeModule === module ? "active" : ""}`} onClick={() => setActiveModule(module)}>{module}</button>)}
        </nav>
        <div className="gp-employee"><span className="gp-status-dot" /><span>{employee ?? "Ready"}</span><button className="gp-switch" onClick={() => setShowSwitch(true)}>{employee ? "Switch" : "Employee PIN"}</button></div>
      </header>

      <main className="gp-main">
        {activeModule === "Calendar" ? <>
          <div className="gp-calendar-head">
            <div><h1 className="gp-title">Calendar</h1><p className="gp-subtitle">Primary workspace · Monday, September 7, 2026</p></div>
            <div className="gp-actions"><button className="gp-btn" onClick={() => setWorkingOnly(!workingOnly)}>{workingOnly ? "Working Employees" : "All Employees"}</button><button className="gp-btn primary">+ New Appointment</button></div>
          </div>
          <section className="gp-calendar">
            <div className="gp-calendar-toolbar"><button className="gp-btn">‹</button><button className="gp-btn">Today</button><button className="gp-btn">›</button><span className="gp-date">Monday, September 7</span><div className="gp-view-toggle">{["Day", "Week"].map(item => <button key={item} className={view === item ? "selected" : ""} onClick={() => setView(item)}>{item}</button>)}</div></div>
            <div style={{ overflowX: "auto" }}><div className="gp-calendar-grid"><div className="gp-time-head" />{employees.map(name => <div className="gp-resource-head" key={name}>{name}</div>)}
              {times.map((time, rowIndex) => <div key={time} style={{ display: "contents" }}><div className="gp-time">{time}</div>{employees.map((_, employeeIndex) => { const a = appointments.find(x => x.row === rowIndex && x.employee === employeeIndex); return <div className="gp-slot" key={`${time}-${employeeIndex}`}>{a && <div className={`gp-appointment ${a.vip ? "vip" : a.service === "Full Wash" ? "fullwash" : ""} ${a.confirmed ? "confirmed" : ""}`}><div className="name">{a.name} {a.vip ? "★" : ""}</div><div className="meta">{a.breed}</div><div className="meta">{a.service}</div></div>}</div>; })}</div>)}
            </div></div>
          </section>
          <p className="gp-workspace-note">Less clicking is more productive: Calendar stays open while customer, ticket, messaging and other work can open as floating windows.</p>
        </> : <section className="gp-calendar" style={{ padding: 24 }}><h1 className="gp-title">{activeModule}</h1><p className="gp-subtitle">This workspace is being built into the GroomPro application shell.</p><button className="gp-btn" style={{ marginTop: 16 }} onClick={() => setActiveModule("Calendar")}>Return to Calendar</button></section>}
      </main>

      {showSwitch && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.38)", display: "grid", placeItems: "center", zIndex: 10 }}><div style={{ width: 330, background: "white", borderRadius: 10, padding: 22, boxShadow: "0 8px 30px rgba(0,0,0,.25)" }}><h2 style={{ marginTop: 0 }}>Employee Switch</h2><p style={{ color: "#697681", fontSize: 14 }}>Enter the employee PIN for an accountable action.</p><input autoFocus aria-label="Employee PIN" inputMode="numeric" type="password" maxLength={10} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && enterPin()} placeholder="4–10 digit PIN" style={{ width: "100%", padding: 11, border: "1px solid #bdc6cd", borderRadius: 6, marginBottom: 10 }} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button className="gp-btn" onClick={() => { setShowSwitch(false); setPin(""); }}>Cancel</button><button className="gp-btn primary" disabled={pin.length < 4} onClick={enterPin}>Enter</button></div></div></div>}
    </div>
  );
}
