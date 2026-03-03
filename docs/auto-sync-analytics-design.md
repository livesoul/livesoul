# Auto-Sync & Analytics Design

## สรุปคำถามที่ต้องตอบก่อนออกแบบ

| คำถาม                            | คำตอบ        | เหตุผล                                                                                                                                |
| -------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **ต้องเก็บประวัติสถานะหรือไม่?** | **ต้องเก็บ** | ถ้าไม่เก็บจะไม่รู้ว่า order_status เปลี่ยนจาก PENDING → COMPLETED หรือ CANCELLED เมื่อไร ไม่สามารถคำนวณ conversion rate ที่แท้จริงได้ |
| **ต้องรู้ rate ยกเลิก/สำเร็จ?**  | **ต้องรู้**  | ข้อมูลสำคัญมาก — ถ้า cancellation rate สูง อาจต้องเปลี่ยนกลยุทธ์สินค้าที่โปรโมท                                                       |
| **ต้องรู้สินค้าขายดี?**          | **ต้องรู้**  | ช่วยตัดสินใจว่าควรโปรโมทสินค้า/ร้าน/หมวดไหน ใช้ aggregate query จาก DB ได้เลย                                                         |

---

## ข้อจำกัดที่ต้องรู้ (Free Tier)

| ทรัพยากร         | Limit                                             | ผล                                                           |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| **Supabase DB**  | 500 MB                                            | ~500K–1M rows ของ conversions (ถ้า raw_data เก็บแบบ compact) |
| **Supabase API** | 500K requests/mo                                  | Cron วันละ 6 รอบ × 30 วัน = 180 req — เหลืออีกมาก            |
| **Vercel Cron**  | วันละ **1 cron job** (2 invocations) บน free tier | ต้องออกแบบให้ 1 cron ทำได้ทุกอย่าง                           |
| **Shopee API**   | 2,000 calls/hr                                    | ไม่เป็นปัญหา — sync D-1 ใช้แค่ 1-5 calls                     |
| **Line Notify**  | ฟรีไม่จำกัด (ปิดให้บริการ มี.ค. 2568!)            | ❌ **ใช้ไม่ได้แล้ว** — ต้องใช้ทางเลือกอื่น                   |

### ทางเลือกแจ้งเตือนแทน Line Notify

| ตัวเลือก                           | ข้อดี                              | ข้อเสีย                                    | Free Tier       |
| ---------------------------------- | ---------------------------------- | ------------------------------------------ | --------------- |
| **Line Messaging API (OA)**        | ส่งตรงถึง Line                     | ต้องสร้าง Official Account, 200 msg/mo ฟรี | 200 push msg/mo |
| **LINE Bot SDK**                   | Rich message, Flex Message         | Setup ซับซ้อนกว่า Notify                   | 200 push msg/mo |
| **Discord Webhook**                | ง่ายมาก, ฟรีไม่จำกัด, ไม่ต้อง auth | ต้องใช้ Discord                            | ✅ ฟรีไม่จำกัด  |
| **Email (Supabase Edge Function)** | มีอยู่แล้วใน Supabase              | จำกัด 3 emails/hr (free)                   | 3/hr            |
| **Telegram Bot**                   | ง่าย, ฟรีไม่จำกัด                  | ต้องใช้ Telegram                           | ✅ ฟรีไม่จำกัด  |

**แนะนำ: Discord Webhook** เป็นตัวหลัก (ฟรี ง่าย ไม่จำกัด) + **Line Messaging API** เป็นตัวเสริมถ้าอยากได้ Line

---

## สถาปัตยกรรม Auto-Sync

```
                    Vercel Cron (1/day free)
                           │
                           ▼
              ┌─────────────────────────┐
              │  /api/cron/sync         │
              │                         │
              │  1. D-1 sync mode       │  ← ดึงข้อมูลเมื่อวาน
              │     └─ ถ้ามีข้อมูล:     │
              │        • บันทึก DB      │
              │        • แจ้งเตือน      │
              │        • หยุด D-1       │
              │                         │
              │  2. Historical update   │  ← อัพเดทสถานะ D-2 ถึง D-30
              │     └─ เฉพาะ PENDING    │
              │        orders เท่านั้น  │
              │                         │
              │  3. Log ผลลัพธ์         │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │       Supabase          │
              │  ┌───────────────────┐  │
              │  │ conversions       │  │  ← upsert ข้อมูลปัจจุบัน
              │  ├───────────────────┤  │
              │  │ status_history    │  │  ← เก็บทุกครั้งที่สถานะเปลี่ยน
              │  ├───────────────────┤  │
              │  │ sync_logs         │  │  ← log แต่ละรอบ
              │  ├───────────────────┤  │
              │  │ daily_summaries   │  │  ← สรุปรายวัน (materialized)
              │  └───────────────────┘  │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  Discord Webhook /      │
              │  Line Messaging API     │
              └─────────────────────────┘
```

### Sync Flow อธิบาย

```
Vercel Cron ทำงาน (ตั้ง 06:00 BKK ทุกวัน)
│
├── Step 1: D-1 Sync
│   ├── ดึง conversion report สำหรับ เมื่อวาน (00:00–23:59 BKK)
│   ├── ถ้ามีข้อมูล:
│   │   ├── Upsert ลง `conversions` table
│   │   ├── เปรียบเทียบ order_status เก่า-ใหม่
│   │   │   └── ถ้าเปลี่ยน → INSERT ลง `status_history`
│   │   ├── แจ้งเตือน Discord/Line (สรุปยอด)
│   │   └── หยุด retry D-1 (ตั้ง flag ใน sync_logs)
│   └── ถ้าไม่มี:
│       └── Log ว่า "no data yet" → Cron รอบถัดไปลองอีก
│
├── Step 2: Historical Status Update
│   ├── ดึง PENDING orders จาก DB ที่เก่ากว่า D-1
│   ├── Query Shopee API ตาม date range ของ pending orders
│   ├── เปรียบเทียบสถานะ:
│   │   └── PENDING → COMPLETED / CANCELLED / UNPAID
│   │       └── INSERT ลง `status_history`
│   └── Update สถานะใหม่ใน `conversions`
│
└── Step 3: Daily Summary (อัพเดท materialized view)
    └── Aggregate ยอดรายวัน → `daily_summaries`
```

---

## Database Schema (Migration V2)

### ตาราง `status_history` — เก็บประวัติการเปลี่ยนสถานะ

```sql
-- เก็บทุกครั้งที่ order_status เปลี่ยน
-- ข้อมูลนี้ใช้คำนวณ: conversion rate, cancel rate, เวลาเฉลี่ยที่ใช้ confirm
create table public.status_history (
  id              uuid primary key default gen_random_uuid(),
  conversion_ref  uuid not null references public.conversions(id) on delete cascade,
  old_status      text,              -- null = first seen
  new_status      text not null,
  changed_at      timestamptz not null default now()
);

alter table public.status_history enable row level security;

-- RLS: ต้อง join กับ conversions เพื่อเช็ค user_id
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
```

### ตาราง `daily_summaries` — สรุปรายวันเพื่อลด query load

```sql
-- Pre-computed daily stats เพื่อประหยัด DB query
-- อัพเดททุกรอบ sync (ไม่ต้อง scan ทั้ง conversions table)
create table public.daily_summaries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  credential_id     uuid not null references public.shopee_credentials(id) on delete cascade,
  report_date       date not null,                       -- วันที่ (BKK timezone)
  total_conversions int not null default 0,
  total_orders      int not null default 0,
  total_items       int not null default 0,
  total_commission  numeric(12, 2) not null default 0,
  pending_orders    int not null default 0,
  completed_orders  int not null default 0,
  cancelled_orders  int not null default 0,
  unpaid_orders     int not null default 0,
  unique_shops      int not null default 0,
  top_item_name     text,                                -- ชื่อสินค้า commission สูงสุด
  top_shop_name     text,                                -- ชื่อร้าน commission สูงสุด
  updated_at        timestamptz not null default now(),
  unique(credential_id, report_date)
);

alter table public.daily_summaries enable row level security;

create policy "Users see own summaries"
  on public.daily_summaries for all
  using (auth.uid() = user_id);

create index idx_daily_summaries_date
  on public.daily_summaries (user_id, report_date desc);
```

### แก้ไข `conversions` — เพิ่ม fields สำหรับ analytics

```sql
-- เพิ่ม columns ที่ยังไม่มีใน schema เดิม (ALTER TABLE)
alter table public.conversions
  add column if not exists category_lv1  text,
  add column if not exists category_lv2  text,
  add column if not exists category_lv3  text,
  add column if not exists complete_time timestamptz,
  add column if not exists click_time    timestamptz,
  add column if not exists refund_amount numeric(12, 2) default 0,
  add column if not exists fraud_status  text;

-- เพิ่ม update policy ที่ยังไม่มี (จำเป็นสำหรับ status update)
create policy "Users can update own conversions"
  on public.conversions for update
  using (auth.uid() = user_id);

-- Index สำหรับ pending orders query
create index idx_conversions_pending
  on public.conversions (user_id, order_status)
  where order_status = 'PENDING';
```

### แก้ไข `sync_logs` — เพิ่ม sync type tracking

```sql
alter table public.sync_logs
  add column if not exists sync_type     text default 'manual',  -- 'manual' | 'cron_d1' | 'cron_history'
  add column if not exists target_date   date,                    -- วันที่ sync
  add column if not exists status_changes int default 0;          -- จำนวนสถานะที่เปลี่ยน
```

---

## ประมาณการใช้ Storage (Free Tier 500 MB)

| ข้อมูล                   | ต่อ row                       | ต่อเดือน (สมมติ 100 orders/วัน) | ต่อปี   |
| ------------------------ | ----------------------------- | ------------------------------- | ------- |
| `conversions`            | ~500 bytes (ไม่เก็บ raw_data) | ~1.5 MB                         | ~18 MB  |
| `conversions` + raw_data | ~2 KB                         | ~6 MB                           | ~72 MB  |
| `status_history`         | ~100 bytes                    | ~0.3 MB (3 changes/order avg)   | ~3.6 MB |
| `daily_summaries`        | ~200 bytes                    | ~6 KB                           | ~72 KB  |
| `sync_logs`              | ~200 bytes                    | ~12 KB (2/day)                  | ~144 KB |

### คำแนะนำ

- **ไม่เก็บ `raw_data` (jsonb)** → ใช้ ~22 MB/ปี — ปลอดภัย 20+ ปีใน free tier
- **เก็บ `raw_data`** → ใช้ ~76 MB/ปี — ยังปลอดภัย ~6 ปี
- **แนะนำ: เก็บ raw_data เฉพาะ 90 วันล่าสุด** แล้ว cleanup เป็น cron job รายเดือน → ใช้แค่ ~40 MB ตลอด

---

## Vercel Cron Configuration

Vercel free tier ได้ **1 cron job** ที่ invocation ได้ **2 ครั้ง/วัน**  
เราออกแบบให้ **1 endpoint ทำทุกอย่าง** เพื่อใช้ quota อย่างคุ้มค่า:

```json
// vercel.json — เพิ่ม cron config
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 23 * * *"
    }
  ]
}
```

> `0 23 * * *` = **06:00 BKK ทุกวัน** (Vercel cron ใช้ UTC, BKK = UTC+7)  
> เหตุผล: Shopee API data ของเมื่อวานมักพร้อมหลัง 04:00-06:00 BKK

### ทำไมถึงเลือกรอบเดียว 06:00 ไม่ใช่ทุกชั่วโมง?

| ตัวเลือก                     | ข้อดี             | ข้อเสีย                                      |
| ---------------------------- | ----------------- | -------------------------------------------- |
| ทุก 1 ชม.                    | เห็นข้อมูลเร็ว    | ❌ เกิน free tier (ได้แค่ 2 invocations/day) |
| ทุก 30 นาที                  | —                 | ❌ เกินมาก                                   |
| **วันละ 1 ครั้ง 06:00**      | ✅ พอดี free tier | ข้อมูลอาจยังไม่พร้อม (retry manual ได้)      |
| วันละ 2 ครั้ง (06:00, 12:00) | Safety net        | ✅ ใช้ 2 invocations พอดี                    |

**แนะนำ: วันละ 2 รอบ** — 06:00 (primary) + 12:00 (fallback ถ้ารอบแรกยังไม่มีข้อมูล)

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 23 * * *"
    },
    {
      "path": "/api/cron/sync",
      "schedule": "0 5 * * *"
    }
  ]
}
```

> ⚠️ ถ้าอัพเป็น Vercel Pro ($20/mo) จะได้ cron ทุก 10 นาทีได้

---

## Notification Message Design

### Discord Webhook (แนะนำ)

```
📊 LiveSoul Affiliate — Daily Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 วันที่: 2 มี.ค. 2569
🛒 Conversions: 15 รายการ
📦 Orders: 12 คำสั่งซื้อ
💰 Commission: ฿1,234.56

📈 สถานะ:
  ✅ Completed: 8
  ⏳ Pending: 3
  ❌ Cancelled: 1

🔄 Status Changes (จากวันก่อนหน้า):
  PENDING → COMPLETED: 5 orders (+฿890.00)
  PENDING → CANCELLED: 2 orders (-฿234.00)

🏆 Top Items:
  1. iPhone 16 Case — ฿456.00
  2. USB-C Cable — ฿234.00
  3. Screen Protector — ฿123.00

🏪 Top Shops:
  1. TechWorld Official — ฿567.00
  2. GadgetStore — ฿345.00
```

### Setup Discord Webhook

```
1. สร้าง Discord server (ฟรี)
2. Settings → Integrations → Webhooks → New Webhook
3. Copy Webhook URL → ใส่ใน env: DISCORD_WEBHOOK_URL
4. Done! ไม่ต้อง auth, ไม่ต้อง bot token
```

---

## Analytics Queries (ทำจาก DB ไม่ต้องเรียก API ซ้ำ)

### Conversion Rate (PENDING → COMPLETED)

```sql
-- จากทุก order ที่เคยเป็น PENDING → กี่ % ที่กลายเป็น COMPLETED
select
  count(*) filter (where order_status = 'COMPLETED') * 100.0 / nullif(count(*), 0)
    as completion_rate,
  count(*) filter (where order_status = 'CANCELLED') * 100.0 / nullif(count(*), 0)
    as cancellation_rate,
  count(*) filter (where order_status = 'UNPAID') * 100.0 / nullif(count(*), 0)
    as unpaid_rate,
  count(*) filter (where order_status = 'PENDING') * 100.0 / nullif(count(*), 0)
    as still_pending_rate
from public.conversions
where user_id = $1
  and purchase_time >= now() - interval '30 days';
```

### Top Items by Commission

```sql
select
  item_name,
  shop_name,
  count(*) as order_count,
  sum(item_commission) as total_commission,
  sum(qty) as total_qty
from public.conversions
where user_id = $1
  and purchase_time >= now() - interval '30 days'
  and order_status != 'CANCELLED'
group by item_name, shop_name
order by total_commission desc
limit 10;
```

### Top Shops by Commission

```sql
select
  shop_name,
  count(distinct order_id) as order_count,
  sum(item_commission) as total_commission,
  count(distinct item_name) as unique_items
from public.conversions
where user_id = $1
  and purchase_time >= now() - interval '30 days'
  and order_status != 'CANCELLED'
group by shop_name
order by total_commission desc
limit 10;
```

### Top Categories

```sql
select
  coalesce(category_lv1, 'ไม่ระบุ') as category,
  count(*) as order_count,
  sum(item_commission) as total_commission
from public.conversions
where user_id = $1
  and purchase_time >= now() - interval '30 days'
  and order_status != 'CANCELLED'
group by category_lv1
order by total_commission desc
limit 10;
```

### Average Time to Complete/Cancel

```sql
-- ใช้ข้อมูลจาก status_history
select
  sh.new_status,
  avg(sh.changed_at - c.purchase_time) as avg_time_to_change,
  count(*) as count
from public.status_history sh
join public.conversions c on c.id = sh.conversion_ref
where c.user_id = $1
  and sh.new_status in ('COMPLETED', 'CANCELLED')
  and sh.old_status = 'PENDING'
group by sh.new_status;
```

---

## Data Retention Policy (ประหยัด Storage)

| ข้อมูล                      | เก็บถาวร  | เก็บชั่วคราว | Cleanup           |
| --------------------------- | --------- | ------------ | ----------------- |
| `conversions` (core fields) | ✅ ตลอดไป | —            | —                 |
| `conversions.raw_data`      | —         | 90 วัน       | Cron ล้างรายเดือน |
| `status_history`            | ✅ ตลอดไป | —            | —                 |
| `daily_summaries`           | ✅ ตลอดไป | —            | —                 |
| `sync_logs`                 | —         | 30 วัน       | Cron ล้างรายเดือน |

```sql
-- Cleanup query (รันเดือนละครั้ง)
-- ล้าง raw_data เก่ากว่า 90 วัน
update public.conversions
  set raw_data = null
  where raw_data is not null
    and synced_at < now() - interval '90 days';

-- ล้าง sync_logs เก่ากว่า 30 วัน
delete from public.sync_logs
  where started_at < now() - interval '30 days';
```

---

## Implementation Priority

| ลำดับ | Task                               | Effort | Impact                           |
| ----- | ---------------------------------- | ------ | -------------------------------- |
| 1     | `status_history` table + migration | เล็ก   | สูง — เก็บประวัติทั้งหมด         |
| 2     | `/api/cron/sync` endpoint          | กลาง   | สูง — auto-fetch ทุกวัน          |
| 3     | Discord Webhook notification       | เล็ก   | สูง — รู้ทันทีเมื่อมี conversion |
| 4     | `daily_summaries` table            | เล็ก   | กลาง — dashboard โหลดเร็ว        |
| 5     | Analytics queries + dashboard UI   | กลาง   | สูง — top items/shops/categories |
| 6     | Vercel Cron config                 | เล็ก   | สูง — automate ทุกอย่าง          |
| 7     | Line Messaging API (เสริม)         | กลาง   | กลาง — ส่งตรงถึง Line            |
| 8     | Data retention cleanup             | เล็ก   | ต่ำ — ไว้ทำทีหลังก็ได้           |

---

_สร้างเมื่อ: มีนาคม 2569_
