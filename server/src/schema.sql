-- Life Works server schema (build plan sec. 07, first slice: people, staff,
-- alerts and the records around them). Statements are separated by "-- ;" lines.

create table if not exists staff (
  id text primary key,
  name text not null,
  phone text not null,                 -- E.164, e.g. +15095550100
  role text not null check (role in ('counselor', 'supervisor')),
  on_call boolean not null default false,
  token_hash text unique not null,     -- sha256 of the sign-in token; the token itself is never stored
  created_at timestamptz not null default now()
);
-- ;
create table if not exists person (
  id text primary key,
  display_name text not null,          -- first name only; it appears in text alerts
  counselor_id text not null references staff(id),
  device_token_hash text unique not null,
  created_at timestamptz not null default now()
);
-- ;
-- One row per safety event the person chose to share. Evidence is what the
-- phone recorded and never changes after it arrives. Only tier (which can only
-- rise) and the acknowledge / resolve / re-route columns move.
create table if not exists alert (
  id bigserial primary key,
  person_id text not null references person(id),
  client_id text not null,             -- the phone's event id; makes resending safe
  tier smallint not null check (tier between 1 and 3),
  first_tier smallint not null,
  kind text not null,
  variant text,
  trigger text not null,               -- the words that set it off
  screen text not null,
  raised_at timestamptz not null,      -- when it happened on the phone
  received_at timestamptz not null default now(),
  evidence jsonb not null,             -- message, context turns, what was shown
  routed_to text[] not null,           -- staff ids texted on arrival
  acknowledged_at timestamptz,
  acknowledged_by text references staff(id),
  rerouted_at timestamptz,
  rerouted_to text[],
  resolved_at timestamptz,
  resolved_by text references staff(id),
  resolution text,
  unique (person_id, client_id)
);
-- ;
create index if not exists alert_open on alert (resolved_at, tier desc, raised_at desc);
-- ;
-- What the person tapped after the alert (called 988, texted Maya, ...).
create table if not exists alert_action (
  alert_id bigint not null references alert(id),
  label text not null,
  at timestamptz not null,
  primary key (alert_id, label, at)
);
-- ;
-- Every text the server tried to send and how it went (sec. 06: "notifications
-- sent and their delivery status"). Bodies are content-free by design.
create table if not exists notification (
  id bigserial primary key,
  alert_id bigint not null references alert(id),
  staff_id text not null references staff(id),
  reason text not null check (reason in ('raised', 'tier_raised', 'rerouted')),
  channel text not null,
  body text not null,
  status text not null check (status in ('logged', 'sent', 'failed')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
-- ;
-- Who looked at which alerts and when (sec. 07 disclosure accounting).
create table if not exists access_log (
  id bigserial primary key,
  staff_id text not null references staff(id),
  action text not null,
  alert_ids bigint[] not null,
  at timestamptz not null default now()
);
-- ;
-- The database itself refuses to rewrite evidence or delete records, so an
-- application bug can't quietly change what happened.
create or replace function lifeworks_guard_alert() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'alerts are append-only';
  end if;
  if new.evidence is distinct from old.evidence or new.trigger is distinct from old.trigger
     or new.raised_at is distinct from old.raised_at or new.person_id is distinct from old.person_id
     or new.client_id is distinct from old.client_id or new.first_tier is distinct from old.first_tier
     or new.routed_to is distinct from old.routed_to then
    raise exception 'alert evidence cannot be changed';
  end if;
  if new.tier < old.tier then
    raise exception 'alert tier can only rise';
  end if;
  if (old.acknowledged_at is not null and new.acknowledged_at is distinct from old.acknowledged_at)
     or (old.resolved_at is not null and (new.resolved_at is distinct from old.resolved_at
                                          or new.resolution is distinct from old.resolution))
     or (old.rerouted_at is not null and new.rerouted_at is distinct from old.rerouted_at) then
    raise exception 'acknowledgment, resolution and re-route are recorded once';
  end if;
  return new;
end $$;
-- ;
drop trigger if exists alert_guard on alert;
-- ;
create trigger alert_guard before update or delete on alert
  for each row execute function lifeworks_guard_alert();
-- ;
create or replace function lifeworks_no_change() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;
-- ;
drop trigger if exists alert_action_guard on alert_action;
-- ;
create trigger alert_action_guard before update or delete on alert_action
  for each row execute function lifeworks_no_change();
-- ;
drop trigger if exists access_log_guard on access_log;
-- ;
create trigger access_log_guard before update or delete on access_log
  for each row execute function lifeworks_no_change();
-- ;
-- Chat (build plan sec. 03: "Direct human messaging with LifeCircle members and
-- assigned staff. Consent-scoped, retained, auditable."). One conversation per
-- person and LifeCircle member. kind 'counselor' is the person's assigned
-- counselor, who reads and replies on the review page; client_id is always
-- 'coordinator' for it. kind 'sms' is anyone else (sponsor, sister), who gets
-- the messages as texts and answers by text. Staff never see 'sms' conversations.
create table if not exists conversation (
  id bigserial primary key,
  person_id text not null references person(id),
  client_id text not null,             -- the phone's LifeCircle id ('coordinator' for the counselor)
  kind text not null check (kind in ('counselor', 'sms')),
  name text not null,
  phone text,                          -- E.164, for 'sms'
  created_at timestamptz not null default now(),
  unique (person_id, client_id)
);
-- ;
create index if not exists conversation_phone on conversation (phone);
-- ;
-- direction: 'out' is from the person, 'in' is to them (staff reply or a text back).
create table if not exists message (
  id bigserial primary key,
  conversation_id bigint not null references conversation(id),
  client_id text,                      -- the phone's message id; makes resending safe
  direction text not null check (direction in ('out', 'in')),
  author text not null,                -- 'person', a staff id, or 'sms'
  body text not null,
  flag text,                           -- safety screen result on the person's messages, e.g. 'crisis/psychiatric'
  to_phone text,                       -- the number an 'sms' message was texted to
  sent_at timestamptz not null,
  received_at timestamptz not null default now(),
  delivery text not null check (delivery in ('stored', 'logged', 'sent', 'failed')),
  provider_id text,
  error text,
  read_at timestamptz,
  unique (conversation_id, client_id)
);
-- ;
create index if not exists message_conversation on message (conversation_id, id);
-- ;
-- Messages are retained as written: nobody can edit or delete one. Only delivery
-- status and the first read time are filled in later.
create or replace function lifeworks_guard_message() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'messages are append-only';
  end if;
  if new.body is distinct from old.body or new.direction is distinct from old.direction
     or new.author is distinct from old.author or new.conversation_id is distinct from old.conversation_id
     or new.client_id is distinct from old.client_id or new.sent_at is distinct from old.sent_at
     or new.flag is distinct from old.flag or new.to_phone is distinct from old.to_phone then
    raise exception 'messages cannot be changed';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'read time is recorded once';
  end if;
  return new;
end $$;
-- ;
drop trigger if exists message_guard on message;
-- ;
create trigger message_guard before update or delete on message
  for each row execute function lifeworks_guard_message();
-- ;
-- Staff reading a conversation is logged like reading an alert.
alter table access_log add column if not exists person_id text;
