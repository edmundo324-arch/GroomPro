type FormValues = Record<string, unknown>;

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const isGroup = (value: unknown): value is FormValues =>
 typeof value === 'object' && value !== null && !Array.isArray(value);

export function reconcileForm<T extends FormValues>(baseline: T, draft: T, incoming: T, useIncoming = false) {
 let conflict = false;
 function merge(saved: unknown, entered: unknown, fresh: unknown): unknown {
  if (same(entered, saved)) return fresh;
  if (same(fresh, saved) || same(entered, fresh)) return entered;
  if (isGroup(saved) && isGroup(entered) && isGroup(fresh)) {
   return Object.fromEntries(Object.keys(fresh).map(key => [key, merge(saved[key], entered[key], fresh[key])]));
  }
  conflict = true;
  return useIncoming ? fresh : entered;
 }
 const values = merge(baseline, draft, incoming) as T;
 return {values, conflict};
}