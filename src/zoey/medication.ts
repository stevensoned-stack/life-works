// Kept apart from ask.ts so learn.ts can use it without importing the router.
import { normalize } from './safety';

// Questions about medicines, doses or side effects always go to a prescriber.
// Naloxone is left out on purpose: the overdose answer covers where to get it.
export const MEDICATION_WORDS = [
  'medication', 'medications', 'medicine', 'meds', 'med', 'pill', 'pills', 'dose', 'doses', 'dosage', 'mg',
  'prescription', 'prescribed', 'prescriber', 'side effect', 'side effects', 'refill',
  'suboxone', 'subutex', 'sublocade', 'buprenorphine', 'methadone', 'naltrexone', 'vivitrol', 'antabuse',
  'disulfiram', 'acamprosate', 'campral', 'antidepressant', 'antidepressants', 'zoloft', 'sertraline', 'prozac',
  'fluoxetine', 'lexapro', 'wellbutrin', 'seroquel', 'gabapentin', 'xanax', 'klonopin', 'ativan', 'adderall',
  'trazodone', 'lithium', 'abilify', 'benzo', 'benzos', 'valium', 'ambien', 'percocet', 'oxycodone', 'oxycontin',
  'vicodin', 'hydrocodone', 'tramadol', 'tylenol', 'acetaminophen', 'advil', 'ibuprofen', 'aspirin', 'tablet', 'tablets',
];

export function isMedicationQuestion(text: string) {
  const n = normalize(text);
  return MEDICATION_WORDS.some((w) => n.includes(` ${w} `));
}
