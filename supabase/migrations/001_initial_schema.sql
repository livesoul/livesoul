-- =============================================
-- LiveSoul Affiliate — Initial Database Schema
-- =============================================
-- Run this in the Supabase SQL Editor after creating your project.

-- Enable pgcrypto for gen_random_uuid() (usually already enabled)
create extension if not exists pgcrypto;

-- ─── Shopee Credentials ──────────────────────────────────────────────────────
-- Stores encrypted Shopee API credentials per user.
-- Each user can have multiple credential sets (labelled).

create table public.shopee_credentials (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null default 'default',
  app_id      text not null,
  secret      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, label)
);

-- ─── Conversion Cache ────────────────────────────────────────────────────────
-- Synced from Shopee Affiliate API. Keeps history beyond the 30-day API limit.

create table public.conversions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  credential_id     uuid not null references public.shopee_credentials(id) on delete cascade,
  conversion_id     bigint not null,
  purchase_time     timestamptz not null,
  total_commission  numeric(12, 2) not null default 0,
  buyer_type        text,
  device            text,
  order_id          text not null,
  order_status      text not null,
  item_id           bigint,
  item_name         text,
  item_price        numeric(12, 2),
  qty               int default 1,
  shop_id           bigint,
  shop_name         text,
  image_url         text,
  item_commission   numeric(12, 2) default 0,
  raw_data          jsonb,
  synced_at         timestamptz not null default now(),
  unique(credential_id, conversion_id, order_id, item_id)
);

-- ─── Sync Logs ───────────────────────────────────────────────────────────────

create table public.sync_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  credential_id   uuid references public.shopee_credentials(id) on delete set null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  records_added   int not null default 0,
  error           text
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Every table is protected: users can only access their own rows.

alter table public.shopee_credentials enable row level security;
alter table public.conversions         enable row level security;
alter table public.sync_logs           enable row level security;

-- shopee_credentials policies
create policy "Users can view own credentials"
  on public.shopee_credentials for select
  using (auth.uid() = user_id);

create policy "Users can insert own credentials"
  on public.shopee_credentials for insert
  with check (auth.uid() = user_id);

create policy "Users can update own credentials"
  on public.shopee_credentials for update
  using (auth.uid() = user_id);

create policy "Users can delete own credentials"
  on public.shopee_credentials for delete
  using (auth.uid() = user_id);

-- conversions policies
create policy "Users can view own conversions"
  on public.conversions for select
  using (auth.uid() = user_id);

create policy "Users can insert own conversions"
  on public.conversions for insert
  with check (auth.uid() = user_id);

-- sync_logs policies
create policy "Users can view own sync logs"
  on public.sync_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own sync logs"
  on public.sync_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sync logs"
  on public.sync_logs for update
  using (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_conversions_user_time
  on public.conversions (user_id, purchase_time desc);

create index idx_conversions_credential
  on public.conversions (credential_id, synced_at desc);

create index idx_sync_logs_user
  on public.sync_logs (user_id, started_at desc);

-- ─── Updated At Trigger ─────────────────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_shopee_credentials_updated
  before update on public.shopee_credentials
  for each row execute procedure public.handle_updated_at();
