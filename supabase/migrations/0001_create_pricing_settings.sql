-- 0001_create_pricing_settings.sql
-- CheckHero Gas Line Quoter — pricing configuration store.
--
-- Design: APPEND-ONLY / versioned. Every "Save settings" inserts a NEW row; the
-- app reads the most recent one (order by created_at desc limit 1). This means
-- an old rate set is never overwritten or lost, and you get a free audit trail
-- of every pricing change (who changed it, when).
--
-- The whole config is stored as a single `config` jsonb blob, mirroring the
-- shape the app already keeps in memory (per-DN copper rates, labour, appliance
-- connection costs, extras, company details). The service layer reads/writes it
-- as one object — see src/lib/services/pricing.js.

create table if not exists public.pricing_settings (
  id          uuid primary key default gen_random_uuid(),
  config      jsonb       not null,
  updated_by  uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Fast "give me the latest config" lookup.
create index if not exists pricing_settings_created_at_idx
  on public.pricing_settings (created_at desc);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Pricing (incl. margins) is sensitive internal data — authenticated staff only.
-- Append-only: staff may read all versions and insert new ones; no update/delete
-- (history is immutable). Lock down further by role later if needed.
alter table public.pricing_settings enable row level security;

drop policy if exists pricing_settings_read on public.pricing_settings;
create policy pricing_settings_read
  on public.pricing_settings for select
  to authenticated
  using (true);

drop policy if exists pricing_settings_insert on public.pricing_settings;
create policy pricing_settings_insert
  on public.pricing_settings for insert
  to authenticated
  with check (updated_by = auth.uid());

-- Table-level GRANTs: RLS decides WHICH rows; grants decide table access at all.
-- Only authenticated — anon (logged-out) gets nothing.
grant usage on schema public to authenticated;
grant select, insert on public.pricing_settings to authenticated;
