"use client";
import { useEffect, useState } from 'react';
import { employeeFetch } from '../lib/employee-fetch';

type Stop = { appearance?: React.CSSProperties; id: string; day: string; orderNumber: number; scheduledStart: string; customer: string; pets: string[]; address: string };
type MapData = { appointments: Stop[]; timezone: string; all: boolean; canSeeAll: boolean; shop: string; origin: string; destination: string; optimize: boolean; embedKey: string; routesConfigured: boolean };
const dayLabel = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function directions(points: string[]) {
  const params = new URLSearchParams({ api: '1', destination: points.at(-1)!, travelmode: 'driving' });
  if (points.length > 1) params.set('origin', points[0]);
  if (points.length > 2) params.set('waypoints', points.slice(1, -1).join('|'));
  return 'https://www.google.com/maps/dir/?' + params;
}
function sections(points: string[], legs: number) {
  return Array.from({ length: Math.max(1, Math.ceil((points.length - 1) / legs)) }, (_, index) => points.slice(index * legs, index * legs + legs + 1));
}
function embed(key: string, points: string[]) {
  if (!key || !points.length) return '';
  const path = points.length === 1 ? 'place' : 'directions';
  const params = new URLSearchParams(path === 'place' ? { key, q: points[0] } : {
    key, origin: points[0], destination: points.at(-1)!, mode: 'driving',
    ...(points.length > 2 ? { waypoints: points.slice(1, -1).join('|') } : {}),
  });
  return 'https://www.google.com/maps/embed/v1/' + path + '?' + params;
}

export function CalendarMap({ date, throughDate = date, onOpen }: { date: string; throughDate?: string; onOpen: (id: string) => void }) {
  const [from, setFrom] = useState(date), [through, setThrough] = useState(throughDate), [day, setDay] = useState(date);
  const [scope, setScope] = useState(''), [revision, reload] = useState(0);
  const [data, setData] = useState<MapData>();
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<string[]>(), [routeError, setRouteError] = useState(''), [section, setSection] = useState(0);
  const [addresses, setAddresses] = useState<{origin: string; destination: string}>();
  const [saving, setSaving] = useState(false), [addressError, setAddressError] = useState('');

  useEffect(() => { setFrom(date); setThrough(throughDate); setDay(date); }, [date, throughDate]);
  useEffect(() => {
    if (!from || !through || through < from) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    employeeFetch('/api/calendar/map?' + new URLSearchParams({ from, through, scope }), { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error || 'Map appointments could not load.');
        if (controller.signal.aborted) return;
        setData(result);
        setDay(previous => result.appointments.some((visit: Stop) => visit.day === previous) ? previous : result.appointments[0]?.day || from);
      })
      .catch(error => { if (!controller.signal.aborted) { setError(error.message); setData(undefined); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [from, through, scope, revision]);

  const visits = data?.appointments.filter(stop => stop.day === day) || [];
  const scheduled = [...new Set(visits.map(stop => stop.address).filter(Boolean))];
  const stopCount = scheduled.length;
  const stopKey = JSON.stringify(scheduled);
  useEffect(() => {
    setOrder(undefined);
    setRouteError('');
    setSection(0);
    if (!data?.optimize || stopCount < 2 || loading) return;
    if (!data.routesConfigured) { setRouteError('Driving-distance ordering needs the Google Routes API key.'); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ date: day, route: '1', scope: data.all ? 'all' : 'mine' });
    employeeFetch('/api/calendar/map?' + params, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error || 'Driving distances could not load.');
        if (!controller.signal.aborted) setOrder(result.stops);
      })
      .catch(error => { if (!controller.signal.aborted) setRouteError(error.message); });
    return () => controller.abort();
  }, [day, stopKey, stopCount, loading, data?.all, data?.optimize, data?.routesConfigured, data?.origin, data?.destination]);

  async function saveAddresses(next: { origin: string; destination: string }) {
    setSaving(true);
    setAddressError('');
    try {
      const response = await employeeFetch('/api/calendar/map', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (!response.ok) throw Error((await response.json()).error || 'Route addresses could not save.');
      setAddresses(undefined);
      reload(value => value + 1);
    } catch (error) { setAddressError((error as Error).message); }
    finally { setSaving(false); }
  }

  const numbered = !data?.optimize || stopCount < 2 || Boolean(order);
  const stopNumbers = new Map((order || scheduled).map((address, index) => [address, index + 1]));
  const sorted = numbered ? [...visits].sort((a, b) => (stopNumbers.get(a.address) || Infinity) - (stopNumbers.get(b.address) || Infinity)) : visits;
  const points = data ? [data.origin, ...(order || scheduled), data.destination].filter(Boolean) : [];
  const mapSections = sections(points, 21);
  const days = [...new Set(data?.appointments.map(stop => stop.day) || [])];
  const mapUrl = embed(data?.embedKey || '', mapSections[section] || mapSections[0]);

  return <section className="gp-calendar-map" aria-label="Appointment map" aria-busy={loading}>
    <div className="gp-map-controls">
      <label>From <input type="date" value={from} onChange={event => { setFrom(event.target.value); if (event.target.value > through) setThrough(event.target.value); }}/></label>
      <label>Through <input type="date" min={from} value={through} onChange={event => setThrough(event.target.value)}/></label>
      <button type="button" className="gp-btn" aria-pressed={!data?.all} onClick={() => setScope('mine')}>My appointments</button>
      {data?.canSeeAll && <button type="button" className="gp-btn" aria-pressed={data.all} onClick={() => setScope('all')}>All appointments</button>}
    </div>
    {loading && <p role="status">Loading appointments…</p>}
    {error && <p role="alert">{error}</p>}
    {data && <>
      <div className="gp-map-controls">
        <span><strong>Start</strong> {data.origin || 'Shop address missing'}</span>
        <span><strong>End</strong> {data.destination || 'Shop address missing'}</span>
        <button type="button" className="gp-btn" aria-expanded={!!addresses} onClick={() => { setAddressError(''); setAddresses(addresses ? undefined : { origin: data.origin, destination: data.destination }); }}>Edit route addresses</button>
      </div>
      {addresses && <form className="gp-map-addresses" onSubmit={event => { event.preventDefault(); void saveAddresses(addresses); }}>
        <label>Starting address<input value={addresses.origin} maxLength={240} placeholder={data.shop || 'Shop address'} onChange={event => setAddresses({ ...addresses, origin: event.target.value })}/></label>
        <label>Ending address<input value={addresses.destination} maxLength={240} placeholder={data.shop || 'Shop address'} onChange={event => setAddresses({ ...addresses, destination: event.target.value })}/></label>
        <div className="gp-actions"><button type="submit" className="gp-btn primary" disabled={saving}>Save addresses</button><button type="button" className="gp-btn" disabled={saving} onClick={() => void saveAddresses({ origin: '', destination: '' })}>Use shop for both</button><button type="button" className="gp-btn" onClick={() => setAddresses(undefined)}>Cancel</button></div>
        {addressError && <p role="alert">{addressError}</p>}
      </form>}
      {days.length > 1 && <label className="gp-map-day">Map date <select value={day} onChange={event => setDay(event.target.value)}>{days.map(value => <option key={value} value={value}>{dayLabel(value)}</option>)}</select></label>}
      {mapSections.length > 1 && <label className="gp-map-day">Map section <select value={section} onChange={event => setSection(Number(event.target.value))}>{mapSections.map((_, index) => <option key={index} value={index}>Section {index + 1}</option>)}</select></label>}
      {!numbered && !routeError && <p role="status">Finding the shortest drive…</p>}
      {routeError && <p role="alert">{routeError} Appointments are shown by booked time.</p>}
      {!data.embedKey && <p>To show the map here, configure the Google Maps Embed key.</p>}
      {mapUrl && <iframe className="gp-route-map" title={'Driving map for ' + dayLabel(day)} src={mapUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>}
      <div className="gp-actions">{sections(points, 4).filter(value => value.length > 1).map((value, index, all) => <a key={index} className="gp-btn" href={directions(value)} target="_blank" rel="noreferrer">{all.length === 1 ? 'Open route in Google Maps' : 'Open route section ' + (index + 1)}</a>)}</div>
      {!visits.length && <p>No appointments for this date range.</p>}
      {sorted.map(stop => <div key={stop.id + ':' + stop.day} className="gp-map-stop gp-colored-ticket" style={stop.appearance}>
        <div>{numbered && stop.address && <strong>Stop {stopNumbers.get(stop.address)} · </strong>}<time dateTime={stop.scheduledStart}>{new Date(stop.scheduledStart).toLocaleTimeString(undefined, { timeZone: data.timezone, hour: 'numeric', minute: '2-digit' })}</time></div>
        <div><strong>{stop.customer}</strong>{stop.pets.length > 0 && <div>{stop.pets.join(', ')}</div>}<div>{stop.address || 'Customer address missing'}</div></div>
        <div className="gp-actions"><button type="button" className="gp-btn" onClick={() => onOpen(stop.id)}>Open #{stop.orderNumber}</button>{stop.address && <a className="gp-btn" href={directions([data.origin, stop.address].filter(Boolean))} target="_blank" rel="noreferrer">Directions</a>}</div>
      </div>)}
    </>}
  </section>;
}
