"use client";

import { useEffect, useState } from "react";

type Customer = { id: string; firstName: string; lastName: string; pets: { id: string; name: string; breed: string | null }[] };
type Service = { id: string; name: string; category: string | null; priceCents: number; durationMin: number };
type Employee = { id: string; firstName: string; lastName: string; role: string };

export function AppointmentWindow({ date, onClose, onSaved }: { date: Date; onClose: () => void; onSaved: () => void }) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [petId, setPetId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [groomerId, setGroomerId] = useState("");
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services").then(r => r.ok ? r.json() : { services: [] }).then(d => setServices(d.services || [])).catch(() => undefined);
    fetch("/api/employees").then(r => r.ok ? r.json() : { employees: [] }).then(d => setEmployees((d.employees || []).filter((e: Employee) => ["GROOMER", "MASTER_GROOMER"].includes(e.role)))).catch(() => undefined);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || customer) { setCustomers([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, { signal: controller.signal }).then(r => r.ok ? r.json() : { customers: [] }).then(d => setCustomers(d.customers || [])).catch(() => undefined), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, customer]);

  function chooseCustomer(value: Customer) { setCustomer(value); setQuery(`${value.firstName} ${value.lastName}`); setCustomers([]); setPetId(value.pets[0]?.id || ""); }

  async function save() {
    if (!customer || !petId || !serviceId || !time) { setError("Customer, pet, service, and time are required."); return; }
    setSaving(true); setError("");
    const start = new Date(date); const [hours, minutes] = time.split(":").map(Number); start.setHours(hours, minutes, 0, 0);
    try {
      const response = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: customer.id, petId, serviceId, scheduledStart: start.toISOString(), groomerId: groomerId || undefined, notes }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Appointment could not be created."); return; }
      onSaved();
    } catch { setError("Appointment could not be created."); } finally { setSaving(false); }
  }

  return <div className="gp-floating-window gp-appointment-window" role="dialog" aria-modal="true">
    <div className="gp-floating-head"><div><div className="gp-floating-title">New Appointment</div><div className="gp-floating-subtitle">{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div></div><button className="gp-btn" onClick={onClose}>Close</button></div>
    <div className="gp-profile-body">
      <label className="gp-field"><span className="gp-label">Customer</span><input autoFocus className="gp-search-input" value={query} onChange={e => { setQuery(e.target.value); setCustomer(null); }} placeholder="Search existing customer" />
        {customers.length > 0 && <div className="gp-search-results">{customers.map(c => <button className="gp-customer-result" key={c.id} onClick={() => chooseCustomer(c)}><strong>{c.firstName} {c.lastName}</strong><span>{c.pets.map(p => p.name).join(", ") || "No pets"}</span></button>)}</div>}
      </label>
      {customer && <label className="gp-field"><span className="gp-label">Pet</span><select className="gp-search-input" value={petId} onChange={e => setPetId(e.target.value)}>{customer.pets.map(p => <option key={p.id} value={p.id}>{p.name}{p.breed ? ` · ${p.breed}` : ""}</option>)}</select></label>}
      <div className="gp-form-grid"><label className="gp-field"><span className="gp-label">Service</span><select className="gp-search-input" value={serviceId} onChange={e => setServiceId(e.target.value)}><option value="">Select service</option>{services.map(s => <option key={s.id} value={s.id}>{s.name} · ${(s.priceCents / 100).toFixed(2)} · {s.durationMin} min</option>)}</select></label><label className="gp-field"><span className="gp-label">Time</span><input className="gp-search-input" type="time" value={time} onChange={e => setTime(e.target.value)} /></label></div>
      <label className="gp-field"><span className="gp-label">Groomer</span><select className="gp-search-input" value={groomerId} onChange={e => setGroomerId(e.target.value)}><option value="">Assign later</option>{employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select></label>
      <label className="gp-field"><span className="gp-label">Notes</span><textarea className="gp-search-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Appointment notes" /></label>
      {error && <div className="gp-form-error">{error}</div>}
    </div>
    <div className="gp-profile-footer"><button className="gp-btn" onClick={onClose}>Cancel</button><button className="gp-btn primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Create Appointment"}</button></div>
  </div>;
}
