import { createHmac, timingSafeEqual } from 'node:crypto';
// Text messages to staff. Until a Twilio account (under a BAA) is set up, the
// server uses LogSender, which records what it would have sent and texts no one.

export type SendResult = { status: 'logged' | 'sent' | 'failed'; providerId?: string; error?: string };

export type SmsSender = {
  channel: string;
  send(to: string, body: string): Promise<SendResult>;
};

// Shows only the last two digits of a number in logs.
export const maskPhone = (phone: string) => phone.replace(/\d(?=\d{2})/g, '•');

export class LogSender implements SmsSender {
  channel = 'log';
  sent: { to: string; body: string }[] = [];
  constructor(private log: (msg: string) => void = console.log) {}
  async send(to: string, body: string): Promise<SendResult> {
    this.sent.push({ to, body });
    // The body names the person, so it stays out of operational logs.
    this.log(`[sms not sent: no provider configured] to ${maskPhone(to)}, ${body.length} chars`);
    return { status: 'logged' };
  }
}

// Twilio's Messages API, called directly so there's no SDK to keep current.
export class TwilioSender implements SmsSender {
  channel = 'twilio';
  constructor(
    private cfg: { accountSid: string; authToken: string; from: string },
    private fetchImpl: typeof fetch = fetch,
  ) {}
  async send(to: string, body: string): Promise<SendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}/Messages.json`;
    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: this.cfg.from, Body: body }).toString(),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok) return { status: 'failed', error: `twilio ${res.status}: ${json.message ?? 'unknown error'}` };
      return { status: 'sent', providerId: json.sid };
    } catch (e) {
      return { status: 'failed', error: (e as Error).message };
    }
  }
}

// Texts back from LifeCircle members arrive as Twilio webhooks. Twilio signs
// each one: base64 HMAC-SHA1 of the full URL followed by every form field,
// sorted by name, keyed with the auth token.
export function twilioSignature(authToken: string, url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return createHmac('sha1', authToken).update(data).digest('base64');
}

export function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string | undefined) {
  if (!signature) return false;
  const want = Buffer.from(twilioSignature(authToken, url, params));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}
