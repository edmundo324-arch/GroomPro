"use client";
import { useEffect, useState } from 'react';
import { employeeFetch } from '../lib/employee-fetch';

export function ReferralRewardSettings() {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    employeeFetch('/api/referral-settings', { signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      if (!controller.signal.aborted) setAmount((result.amountCents / 100).toFixed(2));
    }).catch(() => { if (!controller.signal.aborted) setMessage('Referral credit settings could not load.'); });
    return () => controller.abort();
  }, []);
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const response = await employeeFetch('/api/referral-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: Math.round(Number(amount) * 100) }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setAmount((result.amountCents / 100).toFixed(2));
      setMessage('Referral credit saved.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="gp-settings-card" onSubmit={event => { event.preventDefault(); void save(); }}>
    <h3 data-settings-target="customer-referral-credit" tabIndex={-1}>Customer referral credit</h3>
    <p>At checkout for the new customer’s first paid groom, each customer receives this account credit once. The factory amount is $10.00 each. Use $0.00 to turn off the credit.</p>
    <label>Credit per customer ($)<input type="number" min="0" max="1000" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)}/></label>
    <button type="submit" className="gp-btn primary" disabled={busy}>Save referral credit</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
