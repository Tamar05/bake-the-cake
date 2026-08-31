-- Web push notifications — Phase 1: device subscriptions for bakers.
--
-- One row per browser/device a baker has turned notifications on in. The
-- endpoint (the push service's URL for that device) is the primary key, so a
-- device that re-subscribes upserts its row instead of piling up duplicates.
-- Deleting a user cascades away their subscriptions.
--
-- Run this once in the Supabase SQL editor (Database → SQL).

create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- Phase 2 will fan a push out to every relevant baker, looking rows up by owner.
create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- Every legitimate read/write happens server-side with the service-role key,
-- which bypasses RLS. Enable RLS with no policies so the browser's anon /
-- authenticated roles get no direct access to these subscription secrets.
alter table public.push_subscriptions enable row level security;
