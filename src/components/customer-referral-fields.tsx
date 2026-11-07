"use client";
import { useEffect, useId, useState } from 'react';
import { employeeFetch } from '../lib/employee-fetch';

export type ReferralFields = { referralSource: string; referredById: string; referredBy: string };
type Candidate = { id: string; firstName: string; lastName: string };
export function CustomerReferralFields({ customerId, value, onChange }: {
  customerId?: string; value: ReferralFields; onChange: (value: ReferralFields) => void;
}) {
  const sourceListId = useId();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Candidate[]>([]);
  useEffect(() => {
    if (query.trim().length < 2) { setMatches([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await employeeFetch('/api/customers/search?' + new URLSearchParams({ q: query }), { signal: controller.signal });
        const result = await response.json();
        if (!controller.signal.aborted) setMatches((result.customers || []).filter((customer: Candidate) => customer.id !== customerId));
      } catch { if (!controller.signal.aborted) setMatches([]); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, customerId]);
  return <div className="gp-customer-referral">
    <label>How did they find us?
      <input list={sourceListId} maxLength={191} value={value.referralSource}
        onChange={event => onChange({ ...value, referralSource: event.target.value,
          ...(event.target.value.toLowerCase() === 'customer referral' ? {} : { referredById: '', referredBy: '' }) })}/>
    </label>
    <datalist id={sourceListId}>{['Customer referral', 'Google', 'Social media', 'Website', 'Walk-in', 'Community event', 'Other'].map(source => <option value={source} key={source}/>)}</datalist>
    {value.referralSource.toLowerCase() === 'customer referral' && (value.referredById ?
      <div className="gp-actions"><span>Referred by <strong>{value.referredBy || 'Selected customer'}</strong></span>
        <button type="button" className="gp-btn" onClick={() => onChange({ ...value, referredById: '', referredBy: '' })}>Change referrer</button></div> :
      <><label>Referring customer<input value={query} placeholder="Search by name or phone" onChange={event => setQuery(event.target.value)}/></label>
        {matches.map(customer => <button type="button" className="gp-btn" key={customer.id} onClick={() => {
          onChange({ referralSource: 'Customer referral', referredById: customer.id, referredBy: customer.firstName + ' ' + customer.lastName });
          setQuery('');
        }}>{customer.firstName} {customer.lastName}</button>)}</>)}
  </div>;
}
