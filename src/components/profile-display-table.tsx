"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { employeeFetch } from '../lib/employee-fetch';
import type { ProfileColumn } from '../lib/profile-display-fields';

export function ProfileDisplayPreferences({ endpoint, title, fields, options, onChange }: {
  endpoint: string; title: string; fields: string[]; options: ProfileColumn[];
  onChange: (fields: string[], options: ProfileColumn[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    employeeFetch(endpoint, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error('Display preferences could not load.');
      const result = await response.json();
      if (!controller.signal.aborted && result.fields) onChange(result.fields, result.options || options);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [endpoint]);

  const selected = draft || fields;
  const current = selected.flatMap(key => options.filter(column => column.key === key));
  const available = options.filter(column => !selected.includes(column.key));
  const move = (index: number, offset: number) => {
    const next = [...selected];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setDraft(next);
  };
  async function save() {
    setBusy(true);
    setError('');
    try {
      const response = await employeeFetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: selected }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Display preferences could not save.');
      onChange(result.fields, result.options || options);
      setDraft(undefined);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <details className="gp-profile-display-settings"><summary>{title}</summary>
    <fieldset disabled={busy}>
      <legend>Visible fields in display order</legend>
      <ol>{current.map((column, index) => <li key={column.key}>
        <label><input type="checkbox" checked onChange={() => setDraft(selected.filter(key => key !== column.key))}/>{column.label}</label>
        <button type="button" className="gp-btn" aria-label={'Move ' + column.label + ' earlier'} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
        <button type="button" className="gp-btn" aria-label={'Move ' + column.label + ' later'} disabled={index === current.length - 1} onClick={() => move(index, 1)}>↓</button>
      </li>)}</ol>
      <details><summary>Add fields</summary><div className="gp-profile-available-fields">{available.map(column => <label key={column.key}>
        <input type="checkbox" checked={false} onChange={() => setDraft([...selected, column.key])}/>{column.label}
      </label>)}</div></details>
      {draft && <div className="gp-actions"><button type="button" className="gp-btn primary" onClick={() => void save()}>Save display fields</button>
        <button type="button" className="gp-btn" onClick={() => setDraft(undefined)}>Cancel</button></div>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </details>;
}

export function ProfileDisplayTable<T extends { id: string }>({ label, rows, fields, options, name, render, onOpen, busy }: {
  label: string; rows: T[]; fields: string[]; options: ProfileColumn[]; name: (row: T) => string;
  render: (row: T, column: ProfileColumn) => ReactNode; onOpen: (row: T) => void; busy?: boolean;
}) {
  const columns = (fields.length ? fields : ['name']).map(key => options.find(column => column.key === key) || { key, label: key });
  const opener = columns.find(column => column.key === 'name') || columns[0];
  return <div className="gp-search-results gp-customer-table gp-profile-table">
    <table aria-label={label} aria-busy={busy}>
      <thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} onClick={() => onOpen(row)}>
        {columns.map(column => <td key={column.key} data-field={column.key} data-label={column.label}>
          {column === opener ? <button type="button" className="gp-customer-row-link" aria-label={'View ' + name(row)}>{render(row, column)}</button> : render(row, column)}
        </td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function profileScalar(value: any, column: ProfileColumn): string {
  if (value == null || value === '') return '—';
  if (column.key.endsWith('Cents')) return '$' + (Number(value) / 100).toFixed(2);
  if (column.key === 'weightLbs') return value + ' lb';
  if (column.key.endsWith('Pct')) return value + '%';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (column.type === 'DateTime') return new Date(value).toLocaleDateString();
  if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? profileScalar(item, column) : String(item)).join(', ') || '—';
  if (typeof value === 'object') return Object.entries(value).filter(([, entry]) => entry != null && entry !== false)
    .map(([key, entry]) => entry === true ? key : key + ': ' + profileScalar(entry, { key, label: key })).join(', ') || '—';
  return String(value);
}
