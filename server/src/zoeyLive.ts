// Live AI answers for AskZoey. Off unless ZOEY_LIVE_AI=1 and ZOEY_LIVE_AI_APPROVED
// are both set (see README.md): it must not run for real residents until the
// AWS BAA is signed and the clinician has reviewed the prompt and replies.
//
// The provider sits behind ChatModel so it can be swapped. Amazon Bedrock is
// the default because the server is meant to run on AWS and AWS's BAA covers
// Bedrock. Nothing anyone wrote is logged here: only whether a reply was used.
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import type Anthropic from '@anthropic-ai/sdk';
import { checkLiveReply, cleanRequest, LiveRequest } from '../../src/zoey/liveRules';
import { screen } from '../../src/zoey/safety';
import { systemPrompt } from './zoeyPrompt';

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

export type ChatModel = {
  name: string;
  reply(system: string, turns: ChatTurn[]): Promise<string>;
};

// Model id on Bedrock; change BEDROCK_MODEL_ID to pick another Claude model.
export const DEFAULT_BEDROCK_MODEL = 'anthropic.claude-opus-5-5';

export function bedrockModel(opts: { region: string; modelId?: string }): ChatModel {
  // AWS credentials come from the server's IAM role (or the usual AWS env vars).
  const client = new AnthropicBedrockMantle({ awsRegion: opts.region, maxRetries: 1, timeout: 7000 });
  const model = opts.modelId || DEFAULT_BEDROCK_MODEL;
  return {
    name: `bedrock:${model}`,
    async reply(system, turns) {
      const res = await client.messages.create({
        model,
        max_tokens: 1024,
        // Short, chatty replies: low effort keeps them quick and cheap.
        output_config: { effort: 'low' },
        system,
        messages: turns.map((t): Anthropic.MessageParam => ({ role: t.role, content: t.text })),
      });
      if (res.stop_reason === 'refusal') return '';
      return res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    },
  };
}

export type LiveResult = { text: string | null; reason: 'ok' | 'off' | 'safety' | 'model error' | 'rejected' | 'busy' };

// The conversation as the model sees it: user first, roles alternating.
export function toTurns(req: LiveRequest): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const t of [...req.history, { from: 'me' as const, text: req.message }]) {
    const role = t.from === 'me' ? 'user' : 'assistant';
    const last = turns[turns.length - 1];
    if (last?.role === role) last.text += `\n${t.text}`;
    else turns.push({ role, text: t.text });
  }
  while (turns[0]?.role === 'assistant') turns.shift();
  return turns;
}

export async function liveAnswer(model: ChatModel | null, raw: LiveRequest): Promise<LiveResult> {
  if (!model) return { text: null, reason: 'off' };
  const req = cleanRequest(raw);
  // The phone already did this; an older app or a bug must still not reach the model.
  if (!req.message || [req.message, ...req.history.filter((t) => t.from === 'me').map((t) => t.text)].some((t) => screen(t).kind !== 'none'))
    return { text: null, reason: 'safety' };
  let out: string;
  try {
    out = (await model.reply(systemPrompt(req.context), toTurns(req))).trim();
  } catch {
    return { text: null, reason: 'model error' };
  }
  return checkLiveReply(out).ok ? { text: out, reason: 'ok' } : { text: null, reason: 'rejected' };
}

// A simple cap per phone so a stuck app or a loop can't run up the bill.
export class RateLimit {
  private hits = new Map<string, number[]>();
  constructor(private perHour: number) {}
  take(id: string, now = Date.now()) {
    const recent = (this.hits.get(id) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= this.perHour) return (this.hits.set(id, recent), false);
    recent.push(now);
    this.hits.set(id, recent);
    return true;
  }
}

// Reads the switch from the environment. Both settings are needed: the second
// records who approved turning it on (BAA signed, clinician review done).
export function liveModelFromEnv(env: NodeJS.ProcessEnv): { model: ChatModel | null; note: string } {
  if (env.ZOEY_LIVE_AI !== '1') return { model: null, note: 'Zoey live AI is off (authored answers only).' };
  if (!env.ZOEY_LIVE_AI_APPROVED?.trim())
    return { model: null, note: 'ZOEY_LIVE_AI=1 but ZOEY_LIVE_AI_APPROVED is empty: live AI stays off until the BAA and clinician review are recorded.' };
  const provider = env.ZOEY_PROVIDER ?? 'bedrock';
  if (provider !== 'bedrock') return { model: null, note: `Unknown ZOEY_PROVIDER "${provider}": live AI stays off.` };
  const region = env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
  if (!region) return { model: null, note: 'AWS_REGION not set: Zoey live AI stays off.' };
  const model = bedrockModel({ region, modelId: env.BEDROCK_MODEL_ID });
  return { model, note: `Zoey live AI is ON (${model.name}). Approved: ${env.ZOEY_LIVE_AI_APPROVED.trim()}` };
}
