import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Alerts, IncomingEvent, Staff } from './alerts';
import { bearer, personFor, staffFor } from './auth';
import { Sql } from './db';
import { routingSummary } from './team';
import { LanguageModel, phrase } from './zoey';

export type Deps = { sql: Sql; alerts: Alerts; model: LanguageModel | null; logger?: boolean };

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
    screen: { enum: ['ask', 'checkin', 'checkinout', 'myhome'] },
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

export function buildApp({ sql, alerts, model, logger = false }: Deps) {
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

  // Which staff roles are set up and which reports reach each one.
  app.get('/v1/console/routing', { preHandler: staff }, async () => routingSummary(sql));

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

  return app;
}
