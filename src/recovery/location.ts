import * as Location from 'expo-location';

// One reading, taken only when the person taps Check in, Check out or "Save
// this spot". There is no background location and no tracking (build plan
// sec. 10): the caller turns the reading into here/away and drops it.

export type Reading = { lat: number; lng: number; accuracyM: number };

export type ReadingResult = { ok: true; reading: Reading } | { ok: false; reason: 'denied' | 'unavailable' };

const TIMEOUT_MS = 12000;

export async function readHere(): Promise<ReadingResult> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    const granted = perm.granted || (perm.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
    if (!granted) return { ok: false, reason: 'denied' };
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (!pos) return { ok: false, reason: 'unavailable' };
    return { ok: true, reading: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy ?? 0 } };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function askLocationPermission() {
  try {
    return (await Location.requestForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
