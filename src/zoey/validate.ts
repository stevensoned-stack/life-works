// Kept apart from ask.ts so the server can share it without the app's UI code.
import { regionNumbers } from '../data/resources';

// Output rules from build plan section 04, for any reply not taken verbatim
// from the library. A reply that fails is replaced with authored text.
const BLOCKED = [
  // clinical labels and assessment
  /\byou (have|might have|may have|probably have|sound like you have|are|seem) (a |an )?(\w+ )?(disorder|condition|depression|depressed|anxiety|bipolar|ptsd|addiction|alcoholic|addict|illness|disease)\b/i,
  /\b(diagnos\w*|disorder|symptom\w*|bipolar|ptsd|schizo\w*|psychosis|clinical depression)\b/i,
  // medication direction
  /\b(take|stop taking|increase|decrease|skip|double|cut) (your|the|a|more|less)\b.*\b(med\w*|pill\w*|dose\w*)\b/i,
  /\b\d+\s?mg\b/i,
  // claiming to be a professional
  /\b(i am|i'm|as) (a|your) (therapist|counsell?or|doctor|nurse|psychologist|psychiatrist)\b/i,
];

export function validateReply(text: string, allowedNumbers: string[] = ['988', '911', '211', '741741', ...regionNumbers()]) {
  const reasons: string[] = BLOCKED.filter((r) => r.test(text)).map((r) => `blocked: ${r.source}`);
  // Only numbers the app already knows may appear; a model must not invent a hotline.
  const numbers = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{3,}\b/g) ?? [];
  for (const n of numbers) {
    const digits = n.replace(/\D/g, '');
    const isYear = /^(19|20)\d\d$/.test(digits);
    if (!isYear && !allowedNumbers.includes(digits)) reasons.push(`unknown number: ${n}`);
  }
  return { ok: reasons.length === 0, reasons };
}
