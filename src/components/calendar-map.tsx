"use client";
import { useEffect, useState } from 'react';
import { employeeFetch } from '../lib/employee-fetch';

type Stop = { id: string; orderNumber: number; scheduledStart: string; customer: string; pets: string[]; address: string };
function directions(addresses: string[]) {
  const params = new URLSearchParams({ api: '1', destination: addresses.at(-1)!, travelmode: 'driving' });
  if (addresses.length > 1) params.set('waypoints', addresses.slice(0, -1).join('|'));
  return 'https://www.google.com/maps/dir/?' + params;
}

export function CalendarMap({ date, onOpen }: { date: string; onOpen: (id: string) => void }) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [all, setAll] = useState(false);
  const [status, setStatus] = useState('Loading appointments…');
  useEffect(() => {
    const controller = new AbortController();
    setStatus('Loading appointments…');
    setStops([]);
    employeeFetch('/api/calendar/map?date=' + encodeURIComponent(date), { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error || 'Map appointments could not load.');
        if (controller.signal.aborted) return;
        setStops(result.appointments);
        setTimezone(result.timezone);
        setAll(result.all);
        setStatus(result.appointments.length ? '' : 'No appointments for this date.');
      }).catch(error => { if (!controller.signal.aborted) setStatus(error.message); });
    return () => controller.abort();
  }, [date]);
  const addresses = [...new Set(stops.map(stop => stop.address).filter(Boolean))];
  const routes = Array.from({ length: Math.ceil(addresses.length / 4) }, (_, index) => addresses.slice(index * 4, index * 4 + 4));
  return <section className="gp-calendar-map" aria-label="Appointment map">
    <h2>{all ? 'All appointments at this location' : 'My appointments'}</h2>
    {status && <p role="status">{status}</p>}
    <div className="gp-actions">{routes.map((route, index) => <a key={index} className="gp-btn" href={directions(route)} target="_blank" rel="noreferrer">{routes.length === 1 ? 'Map today’s stops' : 'Map stops ' + (index * 4 + 1) + '–' + (index * 4 + route.length)}</a>)}</div>
    {stops.map(stop => <div key={stop.id} className="gp-map-stop">
      <time dateTime={stop.scheduledStart}>{new Date(stop.scheduledStart).toLocaleTimeString(undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' })}</time>
      <div><strong>{stop.customer}</strong>{stop.pets.length > 0 && <div>{stop.pets.join(', ')}</div>}<div>{stop.address || 'Customer address missing'}</div></div>
      <div className="gp-actions">
        <button type="button" className="gp-btn" onClick={() => onOpen(stop.id)}>Open #{stop.orderNumber}</button>
        {stop.address && <a className="gp-btn" href={directions([stop.address])} target="_blank" rel="noreferrer">Directions</a>}
      </div>
    </div>)}
  </section>;
}
