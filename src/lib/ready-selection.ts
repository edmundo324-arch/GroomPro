// Keep the current view until the latest requested record is ready. Late loads
// may be retained, but must never steal focus from a newer selection or a close.
export function readySelection<T>() {
  let requested:T|undefined;
  const ready=new Set<T>();
  return {
    select(key:T){requested=key;return ready.has(key)},
    resolve(key:T){ready.add(key);return requested===key},
    cancel(){requested=undefined},
    clear(){requested=undefined;ready.clear()},
  };
}
