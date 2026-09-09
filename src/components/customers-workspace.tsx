"use client";
import { useEffect, useState } from "react";
import { CustomerProfile } from "@/src/components/customer-profile";
import { CustomerCreateWindow } from "@/src/components/customer-create-window";

type CustomerResult = { id: string; firstName: string; lastName: string; email: string | null; phones: { number: string; isPrimary: boolean }[]; pets: { name: string }[] };

export function CustomersWorkspace({ onCreateTicket }: { onCreateTicket: (customerId: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const d = r.ok ? await r.json() : { customers: [] };
        setResults(d.customers || []);
      } catch { /* cancelled search */ }
      finally { setSearching(false); }
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  return <>
    <section className="gp-calendar">
      <div className="gp-calendar-head" style={{ padding: 24 }}>
        <div><h1 className="gp-title">Customers</h1><p className="gp-subtitle">Find a client by phone, name, email, or pet name.</p></div>
        <div className="gp-actions"><button className="gp-btn primary" onClick={() => setShowCreate(true)}>+ New Customer</button></div>
      </div>
      <div style={{ padding: "0 24px 24px" }}>
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Phone, customer name, email, or pet" className="gp-search-input" />
        {query.trim().length < 2 ? <div className="gp-search-empty">Start typing to search existing customers.</div> : searching ? <div className="gp-search-empty">Searching customers…</div> : results.length ? <div className="gp-search-results">{results.map(c => <button className="gp-customer-result" key={c.id} onClick={() => setSelectedId(c.id)}><div><strong>{c.firstName} {c.lastName}</strong><span>{c.phones.find(p => p.isPrimary)?.number || c.email || "Contact not set"}</span></div><div><span>{c.pets.map(p => p.name).join(", ") || "No pets"}</span><b>Open</b></div></button>)}</div> : <div className="gp-search-empty">No matching customers found.</div>}
      </div>
    </section>
    {selectedId && <CustomerProfile customerId={selectedId} onClose={() => setSelectedId(null)} onNewAppointment={onCreateTicket} onCreateTicket={onCreateTicket} />}
    {showCreate && <CustomerCreateWindow onClose={() => setShowCreate(false)} onCreated={id => { setShowCreate(false); setSelectedId(id); }} onOpenExisting={id => { setShowCreate(false); setSelectedId(id); }} />}
  </>;
}
