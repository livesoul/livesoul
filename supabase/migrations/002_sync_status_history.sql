-- =============================================
-- LiveSoul Affiliate — Migration V2
-- Auto-Sync, Status History & Analytics
-- =============================================

-- ─── Status History ──────────────────────────────────────────────────────────
-- เก็บทุกครั้งที่ order_status เปลี่ยน
-- ใช้คำนวณ: conversion rate, cancel rate, เวลาเฉลี่ยที่ใช้ confirm

create table if not exists public.status_history (
  id              uuid primary key default gen_random_uuid(),
  conversion_ref  uuid not null references public.conversions(id) on delete cascade,
  old_status      text,              -- null = first seen
  new_status      text not null,
  changed_at      timestamptz not null default now()
);

alter table public.status_history enable row level security;

-- RLS: join กับ conversions เพื่อเช็ค user_id
create policy "Users see own status history"
  on public.status_history for select
  using (
    exists (
      select 1 from public.conversions c
      where c.id = conversion_ref and c.user_id = auth.uid()
    )
  );

create policy "Insert own status history"
  on public.status_history for insert
  with check (
    exists (
      select 1 from public.conversions c
      where c.id = conversion_ref and c.user_id = auth.uid()
    )
  );

create index idx_status_history_ref
  on public.status_history (conversion_ref, changed_at desc);

-- ─── Daily Summaries ─────────────────────────────────────────────────────────
-- Pre-computed daily stats เพื่อลด query load บน dashboard

create table if not exists public.daily_summaries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  credential_id     uuid not null references public.shopee_credentials(id) on delete cascade,
  report_date       date not null,
  total_conversions int not null default 0,
  total_orders      int not null default 0,
  total_items       int not null default 0,
  total_commission  numeric(12, 2) not null default 0,
  pending_orders    int not null default 0,
  completed_orders  int not null default 0,
  cancelled_orders  int not null default 0,
  unpaid_orders     int not null default 0,
  unique_shops      int not null default 0,
  top_item_name     text,
  top_shop_name     text,
  updated_at        timestamptz not null default now(),
  unique(credential_id, report_date)
);

alter table public.daily_summaries enable row level security;

create policy "Users see own summaries"
  on public.daily_summaries for select
  using (auth.uid() = user_id);

create policy "Users insert own summaries"
  on public.daily_summaries for insert
  with check (auth.uid() = user_id);

create policy "Users update own summaries"
  on public.daily_summaries for update
  using (auth.uid() = user_id);

create index idx_daily_summaries_date
  on public.daily_summaries (user_id, report_date desc);

-- ─── ALTER conversions — เพิ่ม fields สำหรับ analytics ──────────────────────

alter table public.conversions
  add column if not exists category_lv1  text,
  add column if not exists category_lv2  text,
  add column if not exists category_lv3  text,
  add column if not exists complete_time timestamptz,
  add column if not exists click_time    timestamptz,
  add column if not exists refund_amount numeric(12, 2) default 0,
  add column if not exists fraud_status  text,
  add column if not exists content_hash  text;  -- MD5 hash of mutable fields, skip write if unchanged

-- เพิ่ม update policy ที่ยังไม่มี (สำหรับ status update จาก cron)
create policy "Users can update own conversions"
  on public.conversions for update
  using (auth.uid() = user_id);

-- Index สำหรับ pending orders query (partial index)
create index idx_conversions_pending
  on public.conversions (user_id, order_status)
  where order_status = 'PENDING';

-- ─── ALTER sync_logs — เพิ่ม sync type tracking ─────────────────────────────

alter table public.sync_logs
  add column if not exists sync_type      text default 'manual',  -- 'manual' | 'cron_d1' | 'cron_history'
  add column if not exists target_date    date,
  add column if not exists status_changes int default 0;
