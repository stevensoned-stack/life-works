import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Alerts, IncomingEvent, Staff } from './alerts';
import { bearer, personFor, staffFor } from './auth';
import { Sql } from './db';
import { Messages, OutgoingMessage } from './messages';
import { validTwilioSignature } from './sms';
import { LanguageModel, phrase } from './zoey';

export type Deps = {
  sql: Sql;
  alerts: Alerts;
  messages: Messages;
  model: LanguageModel | null;
  // Set when Twilio is: texts back from LifeCircle members are accepted only
  // with a valid Twilio signature for this public URL.
  twilio?: { authToken: string; inboundUrl: string } | null;
  logger?: boolean;
};

const turn = {
  type: 'object',
  required: ['from', 'text', 'at'],
  properties: { from: { enum: ['zoey', 'me'] }, text: { type: 'string', maxLength: 4000 }, at: { type: 'string', maxLength: 40 } },
};

const eventSchema = {
  type: 'object',
  required: ['id', 'at', 'screen', 'tier', 'kind', 'matched', 'message', 'context', 'shown', 'taken'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 64 },
    at: { type: 'string', format: 'date-time' },
    screen: { enum: ['ask', 'checkin', 'checkinout', 'chat'] },
    tier: { enum: [1, 2, 3] },
    kind: { enum: ['crisis', 'urgent', 'check'] },
    variant: { type: 'string', maxLength: 40 },
    matched: { type: 'string', maxLength: 400 },
    message: { type: 'string', maxLength: 4000 },
    context: { type: 'array', maxItems: 20, items: turn },
    shown: { type: 'string', maxLength: 400 },
    taken: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        required: ['label', 'at'],
        properties: { label: { type: 'string', maxLength: 120 }, at: { type: 'string', format: 'date-time' } },
      },
    },
  },
};

const messageSchema = {
  type: 'object',
  required: ['id', 'at', 'body', 'to'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 64 },
    at: { type: 'string', format: 'date-time' },
    body: { type: 'string', minLength: 1, maxLength: 2000 },
    to: {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'string', minLength: 1, maxLength: 64 },
        name: { type: 'string', minLength: 1, maxLength: 120 },
        phone: { type: 'string', maxLength: 32 },
      },
    },
  },
};

export function buildApp({ sql, alerts, messages, model, twilio = null, logger = false }: Deps) {
  const app = Fastify({
    bodyLimit: 64 * 1024,
    // Request bodies are never logged (they hold what people wrote), and tokens are redacted.
    logger: logger ? { redact: ['req.headers.authorization'] } : false,
  });

  const device = async (req: FastifyRequest, reply: FastifyReply) => {
    const id = await personFor(sql, bearer(req.headers.authorization));
    if (!id) return reply.code(401).send({ error: 'unauthorized' });
    (req as FastifyRequest & { personId: string }).personId = id;
  };
  const staff = async (req: FastifyRequest, reply: FastifyReply) => {
    const s = await staffFor(sql, bearer(req.headers.authorization));
    if (!s) return reply.code(401).send({ error: 'unauthorized' });
    (req as FastifyRequest & { staff: Staff }).staff = s;
  };
  const personOf = (req: FastifyRequest) => (req as FastifyRequest & { personId: string }).personId;
  const staffOf = (req: FastifyRequest) => (req as FastifyRequest & { staff: Staff }).staff;

  app.get('/health', async () => ({ ok: true }));

  // ---- From the phone ----

  app.post<{ Body: IncomingEvent }>('/v1/alerts', { preHandler: device, schema: { body: eventSchema } }, async (req) => {
    const r = await alerts.receive(personOf(req), req.body);
    // The phone learns only that the alert arrived and how many people were texted.
    return { id: r.id, created: r.created, notified: r.notified.length };
  });

  app.post<{ Body: OutgoingMessage }>('/v1/messages', { preHandler: device, schema: { body: messageSchema } }, async (req, reply) => {
    const r = await messages.send(personOf(req), req.body);
    if ('error' in r) return reply.code(400).send({ error: 'phone number cannot be texted' });
    return r;
  });

  app.get<{ Querystring: { after?: string } }>('/v1/messages', { preHandler: device }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { messages: await messages.forPerson(personOf(req), req.query.after) };
  });

  app.post<{ Body: { authored: string; recent: IncomingEvent['context']; tier: 0 | 1 | 2 | 3 } }>(
    '/v1/zoey/phrase',
    {
      preHandler: device,
      schema: {
        body: {
          type: 'object',
          required: ['authored', 'recent', 'tier'],
          properties: {
            authored: { type: 'string', minLength: 1, maxLength: 4000 },
            recent: { type: 'array', maxItems: 20, items: turn },
            tier: { enum: [0, 1, 2, 3] },
          },
        },
      },
    },
    async (req) => phrase(model, req.body),
  );

  // ---- Counselor review ----

  const page = readFileSync(join(__dirname, 'console.html'), 'utf8');
  app.get('/console', async (_req, reply) =>
    reply
      .type('text/html; charset=utf-8')
      .header('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'")
      .header('X-Frame-Options', 'DENY')
      .header('Referrer-Policy', 'no-referrer')
      .header('Cache-Control', 'no-store')
      .send(page),
  );

  app.get('/v1/console/me', { preHandler: staff }, async (req) => {
    const s = staffOf(req);
    return { id: s.id, name: s.name, role: s.role };
  });

  app.get<{ Querystring: { status?: 'open' | 'all' } }>('/v1/console/alerts', { preHandler: staff }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { alerts: await alerts.list(staffOf(req), { open: req.query.status !== 'all' }) };
  });

  app.post<{ Params: { id: string } }>('/v1/console/alerts/:id/acknowledge', { preHandler: staff }, async (req, reply) => {
    const ok = await alerts.acknowledge(staffOf(req), req.params.id);
    return ok ? { ok } : reply.code(409).send({ error: 'not found or already acknowledged' });
  });

  app.post<{ Params: { id: string }; Body: { note: string } }>(
    '/v1/console/alerts/:id/resolve',
    {
      preHandler: staff,
      schema: { body: { type: 'object', required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 2000 } } } },
    },
    async (req, reply) => {
      const ok = await alerts.resolve(staffOf(req), req.params.id, req.body.note.trim());
      return ok ? { ok } : reply.code(409).send({ error: 'not found or already resolved' });
    },
  );

  app.get('/v1/console/conversations', { preHandler: staff }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { conversations: await messages.conversations(staffOf(req)) };
  });

  app.get<{ Params: { person: string } }>('/v1/console/conversations/:person', { preHandler: staff }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const thread = await messages.thread(staffOf(req), req.params.person);
    return thread ? { messages: thread } : reply.code(404).send({ error: 'not found' });
  });

  app.post<{ Params: { person: string }; Body: { body: string } }>(
    '/v1/console/conversations/:person',
    {
      preHandler: staff,
      schema: { body: { type: 'object', required: ['body'], properties: { body: { type: 'string', minLength: 1, maxLength: 2000 } } } },
    },
    async (req, reply) => {
      const id = await messages.reply(staffOf(req), req.params.person, req.body.body.trim());
      return id ? { id } : reply.code(404).send({ error: 'not found' });
    },
  );

  // ---- Texts back from LifeCircle members (Twilio webhook) ----

  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) =>
    done(null, Object.fromEntries(new URLSearchParams(String(body)))),
  );

  app.post<{ Body: Record<string, string> }>('/v1/sms/inbound', async (req, reply) => {
    const sig = req.headers['x-twilio-signature'];
    if (!twilio || !validTwilioSignature(twilio.authToken, twilio.inboundUrl, req.body ?? {}, typeof sig === 'string' ? sig : undefined))
      return reply.code(403).send({ error: 'forbidden' });
    await messages.receiveSms(req.body.From ?? '', req.body.Body ?? '', req.body.MessageSid);
    // An empty reply: nothing is texted back automatically.
    return reply.type('text/xml').send('<Response></Response>');
  });

  return app;
}
