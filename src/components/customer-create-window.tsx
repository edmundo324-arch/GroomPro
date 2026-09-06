"use client";

import { useState } from "react";

export function CustomerCreateWindow({ onClose, onCreated, onOpenExisting }: { onClose: () => void; onCreated: (customerId: string) => void; onOpenExisting: (customerId: string) => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<{ id: string; firstName: string; lastName: string } | null>(null);

  async function save() {
    setSaving(true); setError(""); setDuplicate(null);
    try {
      const response = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (response.status === 409 && data.customer) { setDuplicate({ id: data.customer.id, firstName: data.customer.firstName, lastName: data.customer.lastName }); return; }
      if (!response.ok) { setError(data.error || "Customer could not be created."); return; }
      onCreated(data.customer.id);
    } catch { setError("Customer could not be created."); } finally { setSaving(false); }
  }

  return <div className="gp-floating-window gp-create-window" role="dialog" aria-modal="true">
    <div className="gp-floating-head"><div><div className="gp-floating-title">New Customer</div><div className="gp-floating-subtitle">Create one customer record for all pets, appointments, and history.</div></div><button className="gp-btn" onClick={onClose}>Close</button></div>
    <div className="gp-profile-body">
      <div className="gp-form-grid"><label className="gp-field"><span className="gp-label">First Name</span><input className="gp-search-input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} autoFocus /></label><label className="gp-field"><span className="gp-label">Last Name</span><input className="gp-search-input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></label></div>
      <div className="gp-form-grid"><label className="gp-field"><span className="gp-label">Phone</span><input className="gp-search-input" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label><label className="gp-field"><span className="gp-label">Email</span><input className="gp-search-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label></div>
      <label className="gp-field"><span className="gp-label">Notes</span><textarea className="gp-search-input" rows={4} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      {duplicate && <div className="gp-duplicate"><strong>Existing customer found</strong><span>{duplicate.firstName} {duplicate.lastName} already matches this information.</span><button className="gp-btn" onClick={() => onOpenExisting(duplicate.id)}>Open Existing Customer</button></div>}
      {error && <div className="gp-form-error">{error}</div>}
    </div>
    <div className="gp-profile-footer"><button className="gp-btn" onClick={onClose}>Cancel</button><button className="gp-btn primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Create Customer"}</button></div>
  </div>;
}
