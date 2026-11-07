"use client";
import { useEffect, useState } from 'react';
import { employeeFetch } from '../lib/employee-fetch';

export function PlatformBrandSettings() {
  const [owner, setOwner] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const session = await employeeFetch('/api/employee/session', { signal: controller.signal }).then(response => response.json());
      if (session.employee?.role !== 'PLATFORM_OWNER' || controller.signal.aborted) return;
      setOwner(true);
      const brand = await employeeFetch('/api/platform-brand', { signal: controller.signal }).then(response => response.json());
      if (!controller.signal.aborted) setName(brand.name || '');
    }
    void load().catch(() => {});
    return () => controller.abort();
  }, []);
  if (!owner) return null;
  return <form className="gp-settings-card" onSubmit={async e => {
    e.preventDefault();
    setBusy(true);
    try {
      const response = await employeeFetch('/api/platform-brand', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setName(result.name);
      setMessage('Product name saved.');
      window.dispatchEvent(new CustomEvent('groompro:brand-changed', { detail: { name: result.name } }));
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }}>
    <h2>Product name</h2>
    <label>Displayed name<input required maxLength={60} value={name} onChange={e => setName(e.target.value)}/></label>
    <button type="submit" className="gp-btn primary" disabled={busy}>Save name</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
