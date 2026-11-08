"use client";
import { useEffect, useState } from 'react';
import { employeeFetch } from '../lib/employee-fetch';
import { zonedParts } from '../lib/operating-hours';

type VisitEvent = { label: string; at: string };
export function VisitHistory({ id, timezone, date, current }: { id?: string; timezone: string; date: string; current: VisitEvent[] }) {
  const [events, setEvents] = useState<VisitEvent[]>([]);
  const [error, setError] = useState('');
  const refreshKey = current.map(item => item.at).join(',');
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setError('');
    employeeFetch('/api/tickets/visit-history?id=' + encodeURIComponent(id), { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw Error('Previous visit changes could not load.');
        const result = await response.json();
        if (!controller.signal.aborted) setEvents(result.events || []);
      }).catch(() => { if (!controller.signal.aborted) setError('Previous visit changes could not load.'); });
    return () => controller.abort();
  }, [id, refreshKey]);
  const history = [...events, ...current.filter(item => !events.some(event => event.label === item.label && Math.abs(+new Date(item.at) - +new Date(event.at)) < 5000))]
    .sort((a, b) => +new Date(a.at) - +new Date(b.at));
  return <section aria-label="This visit">
    <h3>This Visit</h3>
    {error && <p role="status">{error}</p>}
    {!history.length && <p>No visit activity recorded.</p>}
    {history.map(({ label, at }, index) => {
      const time = new Date(at);
      const sameDay = zonedParts(time, timezone).date === date;
      return <div key={index}>{label} <time dateTime={at}>{time.toLocaleString(undefined, { timeZone: timezone, ...(sameDay ? {} : { month: 'short', day: 'numeric', year: 'numeric' }), hour: 'numeric', minute: '2-digit' })}</time></div>;
    })}
  </section>;
}
