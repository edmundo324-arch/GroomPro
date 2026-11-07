const maximumStops = 18;

// Index 0 is the start, the final index is the finish, and the matrix is directed.
export function shortestDrivingOrder(distances: number[][]) {
  const count = distances.length - 2;
  if (count < 1) return [];
  if (count > maximumStops) throw Error('The shortest drive can be calculated for up to 18 distinct stops per day.');
  const full = (1 << count) - 1;
  const cost = new Float64Array((full + 1) * count).fill(Infinity);
  const previous = new Int8Array(cost.length).fill(-1);
  for (let stop = 0; stop < count; stop++) cost[(1 << stop) * count + stop] = distances[0][stop + 1];
  for (let visited = 1; visited < full; visited++) {
    for (let last = 0; last < count; last++) {
      const current = cost[visited * count + last];
      if (!Number.isFinite(current)) continue;
      for (let next = 0; next < count; next++) {
        if (visited & (1 << next)) continue;
        const index = (visited | (1 << next)) * count + next;
        const distance = current + distances[last + 1][next + 1];
        if (distance < cost[index]) {
          cost[index] = distance;
          previous[index] = last;
        }
      }
    }
  }
  let best = Infinity;
  let last = -1;
  for (let stop = 0; stop < count; stop++) {
    const distance = cost[full * count + stop] + distances[stop + 1][count + 1];
    if (distance < best) { best = distance; last = stop; }
  }
  if (last < 0) throw Error('A driving route could not reach every stop. Check the addresses.');
  const order: number[] = [];
  for (let visited = full; last >= 0;) {
    order.unshift(last);
    const next = previous[visited * count + last];
    visited ^= 1 << last;
    last = next;
  }
  return order;
}

export async function orderDrivingStops(start: string, end: string, stops: string[], key: string, signal?: AbortSignal) {
  if (stops.length < 2) return stops;
  if (stops.length > maximumStops) throw Error('The shortest drive can be calculated for up to 18 distinct stops per day.');
  const points = [start, ...stops, end].map(address => ({ waypoint: { address } }));
  const result = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'originIndex,destinationIndex,status,condition,distanceMeters' },
    body: JSON.stringify({ origins: points.slice(0, -1), destinations: points.slice(1), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' }),
  });
  if (!result.ok) throw Error('Driving distances could not load. Check the Routes API setup and addresses.');
  const matrix = points.map(() => points.map(() => Infinity));
  for (const row of await result.json()) {
    const from = row.originIndex ?? 0;
    const to = (row.destinationIndex ?? 0) + 1;
    if (matrix[from] && to < points.length && row.condition === 'ROUTE_EXISTS') matrix[from][to] = Number(row.distanceMeters ?? 0);
  }
  return shortestDrivingOrder(matrix).map(index => stops[index]);
}
