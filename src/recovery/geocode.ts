import * as Location from 'expo-location';
import { Platform } from 'react-native';

// Where a public street address is (a shelter, a food bank), for "closest" answers.
// Uses the phone's own map lookup with the place's address, never the person's
// location. Only real street addresses ("1224 E Trent Ave"); names like "Northside
// church" would land somewhere random. The web preview has no lookup.
export type Spot = { lat: number; lon: number };

const cache = new Map<string, Promise<Spot | null>>();

export const isStreetAddress = (a?: string) => !!a && /^\d+\s+\S+/.test(a.trim());

export function whereIs(address: string, area: string): Promise<Spot | null> {
  if (Platform.OS === 'web' || !isStreetAddress(address)) return Promise.resolve(null);
  const key = `${address}, ${area}`;
  if (!cache.has(key))
    cache.set(
      key,
      Location.geocodeAsync(key)
        .then((r) => (r[0] ? { lat: r[0].latitude, lon: r[0].longitude } : null))
        .catch(() => null),
    );
  return cache.get(key)!;
}
