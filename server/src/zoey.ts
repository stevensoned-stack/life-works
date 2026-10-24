// The seam for Zoey's language layer (build plan sec. 03, Layer 3). A model may
// reword the authored reply for the person's register, but it has no
// authority: crisis turns never reach it, and anything it writes must pass the
// same validateReply() rules the app uses or the authored text goes out instead.
// No model is wired in yet; that needs a provider under a BAA.
import { CheckInTurn, SafetyTier } from '../../src/data/types';
import { validateReply } from '../../src/zoey/validate';

export type LanguageModel = {
  name: string;
  rephrase(authored: string, recent: CheckInTurn[]): Promise<string>;
};

export type Phrased = {
  text: string;
  llmUsed: boolean; // the model's wording was shown
  validator: { ok: boolean; reasons: string[] } | null; // null when the model wasn't asked
};

export async function phrase(
  model: LanguageModel | null,
  req: { authored: string; recent: CheckInTurn[]; tier: SafetyTier | 0 },
): Promise<Phrased> {
  if (!model || req.tier >= 3) return { text: req.authored, llmUsed: false, validator: null };
  let out: string;
  try {
    out = (await model.rephrase(req.authored, req.recent.slice(-6))).trim();
  } catch {
    return { text: req.authored, llmUsed: false, validator: { ok: false, reasons: ['model error'] } };
  }
  const v = out ? validateReply(out) : { ok: false, reasons: ['empty reply'] };
  return v.ok ? { text: out, llmUsed: true, validator: v } : { text: req.authored, llmUsed: false, validator: v };
}
