"use client";
import { useEffect, useState } from 'react';
import { employeeFetch } from '../lib/employee-fetch';
import { calendarPreferencePolicy } from '../lib/calendar-preferences';
import { employeeName } from '../lib/employee-name';

export function CalendarPreferenceSettings({ value, onChange }: { value: any; onChange: (value: any) => void }) {
  const policy = calendarPreferencePolicy(value?.calendarPreferences);
  const [employees, setEmployees] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ EMPLOYEE?: any[]; SERVICE?: any[] }>({});
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const endpoints = ['/api/employees', '/api/booking-assets', '/api/categories'];
        const [staff, resources, names] = await Promise.all(endpoints.map(async endpoint => {
          const response = await employeeFetch(endpoint);
          if (!response.ok) throw Error('Calendar settings could not load their choices.');
          return response.json();
        }));
        if (active) { setEmployees(staff.employees || []); setAssets(resources.assets || []); setCategories(names); }
      } catch (error) { if (active) setError((error as Error).message); }
    }
    void load();
    return () => { active = false; };
  }, []);
  const resources = [{ id: 'unassigned', name: 'Unassigned / Other Appointments' },
    ...employees.filter(employee => employee.active).map(employee => ({ id: employee.id, name: employeeName(employee) })),
    ...assets.filter(asset => asset.active).map(asset => ({ id: asset.id, name: asset.name }))];
  const saved = value?.calendarResourceOrder || [];
  const order = [...new Set<string>([...saved, ...resources.map(resource => resource.id)])];
  const visibleOrder = order.filter(id => resources.some(resource => resource.id === id));
  function move(id: string, offset: number) {
    const next = [...order];
    const position = next.indexOf(id), other = next.indexOf(visibleOrder[visibleOrder.indexOf(id) + offset]);
    if (position < 0 || other < 0) return;
    [next[position], next[other]] = [next[other], next[position]];
    onChange({ ...value, calendarResourceOrder: next });
  }
  function rule(index: number, patch: object) {
    onChange({ ...value, calendarPreferences: { ...policy, rules: policy.rules.map((item, i) => i === index ? { ...item, ...patch } : item) } });
  }
  return <fieldset className="gp-workflow-section">
    <legend>Calendar lanes and device settings</legend>
    {error && <p role="alert">{error}</p>}
    <label><input type="checkbox" checked={policy.remember} onChange={e => onChange({ ...value, calendarPreferences: { ...policy, remember: e.target.checked } })}/> Remember each employee’s Calendar width on each device</label>
    <p>New phones and tablets use 100 px. New PCs use Fit all. A matching rule sets the starting width and can turn remembering off for that group.</p>
    {policy.rules.map((item, index) => {
      const names = item.category === 'jobTitle' ? employees.map(employee => employee.jobTitle) :
        categories[item.category === 'employee' ? 'EMPLOYEE' : 'SERVICE']?.filter(category => category.active).map(category => category.name);
      return <div className="gp-actions" key={index}>
        <select aria-label="Calendar rule group" value={item.category} onChange={e => rule(index, { category: e.target.value, name: 'Choose a group' })}>
          <option value="jobTitle">Job title</option><option value="employee">Employee category</option><option value="service">Service category</option>
        </select>
        <select aria-label="Calendar rule group name" value={item.name} onChange={e => rule(index, { name: e.target.value })}>
          {[...new Set<string>([item.name, ...(names || []).filter(Boolean)])].map(name => <option key={name}>{name}</option>)}
        </select>
        <select aria-label="Calendar rule device" value={item.device} onChange={e => rule(index, { device: e.target.value })}>
          <option value="all">All devices</option><option value="phone">Phone</option><option value="tablet">Tablet</option><option value="pc">PC</option>
        </select>
        <select aria-label="Calendar rule width" value={item.width} onChange={e => rule(index, { width: e.target.value })}>
          <option value="">Device default</option><option value="fit">Fit all</option><option value="100">100 px</option><option value="160">160 px</option><option value="220">220 px</option>
        </select>
        <label><input type="checkbox" checked={item.remember} onChange={e => rule(index, { remember: e.target.checked })}/> Remember</label>
        <button type="button" className="gp-btn" onClick={() => onChange({ ...value, calendarPreferences: { ...policy, rules: policy.rules.filter((_, i) => i !== index) } })}>Remove rule</button>
      </div>;
    })}
    <button type="button" className="gp-btn" onClick={() => onChange({ ...value, calendarPreferences: { ...policy, rules: [...policy.rules, { category: 'jobTitle', name: 'Choose a group', device: 'all', remember: true, width: '' }] } })}>Add group rule</button>
    <details><summary>Calendar lane order</summary>
      {visibleOrder.map((id, index) => <div key={id} className="gp-actions">
        <span>{resources.find(resource => resource.id === id)?.name}</span>
        <button type="button" className="gp-btn" disabled={!index} onClick={() => move(id, -1)}>Earlier</button>
        <button type="button" className="gp-btn" disabled={index === visibleOrder.length - 1} onClick={() => move(id, 1)}>Later</button>
      </div>)}
      <button type="button" className="gp-btn" onClick={() => onChange({ ...value, calendarResourceOrder: [] })}>Restore factory order</button>
    </details>
  </fieldset>;
}
