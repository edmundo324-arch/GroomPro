"use client";
import { useEffect, useState } from 'react';
import { offlineStatus, prepareOffline, reviewOffline, syncOffline } from '../lib/offline-device';
import type { OfflineCommand } from '../lib/offline-actions';

export function OfflineIndicator({ scope, employeeId }: { scope: string; employeeId?: string }) {
  const [online, setOnline] = useState(true);
  const [state, setState] = useState({ ready: false, pending: [] as OfflineCommand[], archived: [] as OfflineCommand[], lastSaved: 0, signInRequired: false });
  const [shellReady, setShellReady] = useState(false);
  const [review, setReview] = useState(false);
  useEffect(() => {
    if (!employeeId || !scope) return;
    const [tenantId, locationId] = scope.split(':');
    if (!tenantId || !locationId) return;
    const update = () => {
      setOnline(navigator.onLine);
      void offlineStatus().then(setState).catch(() => {});
    };
    const connect = () => {
      update();
      void prepareOffline({ tenantId, locationId, employeeId });
    };
    connect();
    window.addEventListener('online', connect);
    window.addEventListener('offline', update);
    window.addEventListener('groompro:offline-changed', update);
    const retry = window.setInterval(() => {
      if (navigator.onLine) void syncOffline();
    }, 20000);
    const resume = () => { if (navigator.onLine && document.visibilityState === 'visible') void syncOffline(); };
    document.addEventListener('visibilitychange', resume);
    const refresh = window.setInterval(connect, 10 * 60 * 1000);
    const shellPrepared = (event: MessageEvent) => { if (event.data?.type === 'shell-ready') setShellReady(true); };
    navigator.serviceWorker?.addEventListener('message', shellPrepared);
    if ('caches' in window) void caches.match('/__groompro_offline_shell').then(response => setShellReady(Boolean(response))).catch(() => {});
    if ('serviceWorker' in navigator && navigator.onLine) {
      void navigator.serviceWorker.register('/groompro-offline-worker.js').then(() => navigator.serviceWorker.ready).then(worker => {
        const assets = [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[rel="stylesheet"]')].map(node => 'src' in node ? node.src : node.href);
        assets.push(...performance.getEntriesByType('resource').map(entry => entry.name));
        worker.active?.postMessage({ type: 'prepare-shell', assets });
      }).catch(() => {});
    }
    return () => {
      clearInterval(retry);
      clearInterval(refresh);
      document.removeEventListener('visibilitychange', resume);
      navigator.serviceWorker?.removeEventListener('message', shellPrepared);
      window.removeEventListener('online', connect);
      window.removeEventListener('offline', update);
      window.removeEventListener('groompro:offline-changed', update);
    };
  }, [scope, employeeId]);
  if (!employeeId) return null;
  const pending = state.pending.length;
  const issue = state.pending.find(command => command.issue);
  return <div className="gp-offline-indicator">
    <button type="button" className="gp-btn" onClick={() => setReview(value => !value)} aria-expanded={review}>
      {issue ? 'Review offline changes' : state.signInRequired ? 'Sign in to sync' : pending ? pending + ' saved here · sync pending' : !online ? 'Working offline' : state.ready && shellReady ? 'Ready offline' : 'Preparing offline'}
    </button>
    {review && <section aria-label="Offline changes" className="gp-floating-window" style={{ position: 'fixed', top: '4rem', right: '1rem', zIndex: 31, width: 'min(32rem, 92vw)', padding: '1rem', maxHeight: '75dvh', overflow: 'auto' }}>
      <h2>Offline changes</h2>
      <p>{pending ? 'These changes are saved on this device until GoDaddy confirms them.' : state.ready ? 'The local records are ready.' : 'Keep GroomPro open online while this device prepares.'}</p>
      {state.signInRequired && <p>Sign in as the employee who saved these changes to resume syncing.</p>}
      {issue && <>
        <p role="alert">{issue.issue}</p>
        <details><summary>Saved change</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(JSON.parse(issue.body || '{}'), null, 2)}</pre></details>
        {issue.cloud != null && <details><summary>Current GoDaddy record</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(issue.cloud, null, 2)}</pre></details>}
        <div className="gp-actions">
          {issue.cloud != null && <button className="gp-btn" onClick={() => void reviewOffline(issue.id, 'device')}>Use my changes</button>}
          {issue.warning && <button className="gp-btn" onClick={() => void reviewOffline(issue.id, 'warning')}>Accept warning and sync</button>}
          <button className="gp-btn" onClick={() => void reviewOffline(issue.id, 'retry')}>Try again</button>
          <button className="gp-btn" onClick={() => void reviewOffline(issue.id, 'cloud')}>{issue.cloud == null ? 'Set change aside' : 'Keep GoDaddy version'}</button>
        </div>
      </>}
      {state.archived.length > 0 && <details><summary>Changes set aside on this device ({state.archived.length})</summary>
        {state.archived.map(command => <details key={command.id}><summary>{new Date(command.createdAt).toLocaleString()} · {command.issue}</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(JSON.parse(command.body || '{}'), null, 2)}</pre>
        </details>)}
      </details>}
      {!issue && pending > 0 && <button className="gp-btn" disabled={!online} onClick={() => void syncOffline()}>Sync now</button>}
    </section>}
  </div>;
}
