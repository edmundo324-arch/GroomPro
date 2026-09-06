"use client";

import { useEffect, useState } from "react";

type CustomerProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  vipStatus: string | null;
  loyaltyPoints: number;
  balanceCents: number;
  notes: string | null;
  phones: { id: string; label: string; number: string; isPrimary: boolean; smsEnabled: boolean; callEnabled: boolean }[];
  pets: { id: string; name: string; breed: string | null; vaccinations: { id: string; name: string; expiresAt: string }[] }[];
  tickets: { id: string; orderNumber: string; scheduledStart: string; status: string; lines: { description: string; totalCents: number }[]; payments: { amountCents: number; type: string }[] }[];
  communications: { id: string; channel: string; direction: string; body: string; createdAt: string }[];
};

export function CustomerProfile({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [tab, setTab] = useState("Details");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/customers/${customerId}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Customer could not be loaded.")))
      .then((data) => active && setCustomer(data.customer))
      .catch(() => active && setCustomer(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customerId]);

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="gp-floating-window" role="dialog" aria-modal="true">
      <div className="gp-floating-head">
        <div>
          <div className="gp-floating-title">{loading ? "Customer Profile" : customer ? `${customer.firstName} ${customer.lastName}` : "Customer"}</div>
          {!loading && customer && <div className="gp-floating-subtitle">{customer.vipStatus ? `VIP · ${customer.vipStatus}` : "Customer profile"}</div>}
        </div>
        <button className="gp-btn" onClick={onClose}>Close</button>
      </div>
      {loading && <div className="gp-profile-empty">Loading customer profile…</div>}
      {!loading && !customer && <div className="gp-profile-empty">Customer could not be loaded.</div>}
      {customer && <>
        <div className="gp-profile-summary">
          <div><span className="gp-label">Balance</span><strong>{money(customer.balanceCents)}</strong></div>
          <div><span className="gp-label">Loyalty</span><strong>{customer.loyaltyPoints.toLocaleString()} pts</strong></div>
          <div><span className="gp-label">Notification</span><strong>{customer.phones.find(p => p.isPrimary)?.number || "Not set"}</strong></div>
        </div>
        <div className="gp-profile-tabs">
          {["Details", "Phone Numbers", "Pets", "Account", "Communication History", "Purchase History"].map((item) => <button key={item} className={tab === item ? "selected" : ""} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        <div className="gp-profile-body">
          {tab === "Details" && <div className="gp-profile-grid"><div><span className="gp-label">Name</span>{customer.firstName} {customer.lastName}</div><div><span className="gp-label">Email</span>{customer.email || "Not set"}</div><div className="gp-profile-wide"><span className="gp-label">Notes</span>{customer.notes || "No customer notes yet."}</div></div>}
          {tab === "Phone Numbers" && <div className="gp-list">{customer.phones.length ? customer.phones.map(p => <div className="gp-list-row" key={p.id}><strong>{p.number}</strong><span>{p.label}{p.isPrimary ? " · Notification" : ""}</span><span>{p.smsEnabled ? "SMS" : ""}{p.callEnabled ? " · Calls" : ""}</span></div>) : <div className="gp-profile-empty">No phone numbers recorded.</div>}</div>}
          {tab === "Pets" && <div className="gp-list">{customer.pets.length ? customer.pets.map(p => <div className="gp-list-row" key={p.id}><div><strong>{p.name}</strong><span>{p.breed || "Breed not set"}</span></div><span>{p.vaccinations.length} vaccination record{p.vaccinations.length === 1 ? "" : "s"}</span></div>) : <div className="gp-profile-empty">No pets recorded.</div>}</div>}
          {tab === "Account" && <div className="gp-profile-grid"><div><span className="gp-label">VIP Status</span>{customer.vipStatus || "Not enrolled"}</div><div><span className="gp-label">Loyalty Points</span>{customer.loyaltyPoints.toLocaleString()}</div><div><span className="gp-label">Account Balance</span>{money(customer.balanceCents)}</div></div>}
          {tab === "Communication History" && <div className="gp-list">{customer.communications.length ? customer.communications.map(c => <div className="gp-list-row" key={c.id}><div><strong>{c.channel} · {c.direction}</strong><span>{new Date(c.createdAt).toLocaleString()}</span></div><span>{c.body}</span></div>) : <div className="gp-profile-empty">No communications recorded.</div>}</div>}
          {tab === "Purchase History" && <div className="gp-list">{customer.tickets.length ? customer.tickets.map(t => <div className="gp-list-row" key={t.id}><div><strong>Order #{t.orderNumber}</strong><span>{new Date(t.scheduledStart).toLocaleString()} · {t.status}</span></div><span>{t.lines.map(l => l.description).join(", ") || "No line items"}</span></div>) : <div className="gp-profile-empty">No purchase history recorded.</div>}</div>}
        </div>
        <div className="gp-profile-footer"><button className="gp-btn">View Ledger</button><button className="gp-btn">New Appointment</button><button className="gp-btn primary">Create Ticket</button></div>
      </>}
    </div>
  );
}
