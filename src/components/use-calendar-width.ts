import { useEffect, useRef, useState } from 'react';
import { calendarDeviceKind, calendarWidth } from '../lib/calendar-preferences';

export function useCalendarWidth(scope: string, policy: unknown) {
  const [width, setWidth] = useState('fit');
  const [kind, setKind] = useState<ReturnType<typeof calendarDeviceKind>>('pc');
  const selection = useRef(0);
  const device = useRef<{ employeeId: string; deviceId: string; deviceKind: string } | null>(null);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    const update = () => setKind(calendarDeviceKind());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const deviceKind = kind;
    const fallback = calendarWidth(null, deviceKind !== 'pc');
    const version = ++selection.current;
    setWidth(fallback);
    device.current = null;
    if (!scope) return;
    const employeeId = scope.split(':').at(-1)!;
    let deviceId: string;
    try {
      const key = 'groompro:calendar-device-id';
      deviceId = localStorage.getItem(key) || crypto.randomUUID();
      localStorage.setItem(key, deviceId);
    } catch { return; }
    const identity = { employeeId, deviceId, deviceKind };
    device.current = identity;
    void (async () => {
      try {
        await writes.current;
        if (controller.signal.aborted) return;
        const response = await fetch('/api/calendar/preferences?' + new URLSearchParams(identity), { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) return;
        const saved = await response.json();
        if (controller.signal.aborted) return;
        if (selection.current === version) {
          let previous = null;
          if (saved.remember && !saved.width && deviceKind === 'pc') {
            try { previous = localStorage.getItem('groompro:calendar-width:' + scope); } catch {}
          }
          setWidth(saved.width || (previous ? calendarWidth(previous, deviceKind !== 'pc') : saved.defaultWidth || fallback));
        }
      } catch { /* Default widths are still usable when a preference cannot load. */ }
    })();
    return () => controller.abort();
  }, [scope, policy, kind]);

  function changeWidth(value: string) {
    selection.current++;
    setWidth(value);
    const identity = device.current;
    if (!identity) return;
    writes.current = writes.current.then(async () => {
      if (device.current !== identity) return;
      const response = await fetch('/api/calendar/preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, width: value })
      });
      if (!response.ok) throw Error('Your Calendar width could not be remembered.');
    }).catch(() => {
      window.dispatchEvent(new CustomEvent('groompro:save-error', { detail: { message: 'Your Calendar width could not be remembered.' } }));
    });
  }
  return [width, changeWidth] as const;
}
