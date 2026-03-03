# Implementation Plan: Cloud Auth & Storage

## Context

ระบบปัจจุบันเก็บ Shopee API credentials ไว้ใน `localStorage` บนเครื่องผู้ใช้เท่านั้น  
ไม่มี user account ไม่มี cloud storage — เปิดบน browser อื่นหรือเครื่องอื่นต้อง login ใหม่ทุกครั้ง

---

## Recommended Stack: Supabase

### ทำไมถึงเลือก Supabase

| เหตุผล                   | รายละเอียด                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| **Auth ครบในตัว**        | Email/password, Magic Link, Google OAuth, Line OAuth (ผ่าน PKCE) ไม่ต้องเขียน auth logic เอง |
| **PostgreSQL**           | เหมาะกับข้อมูล conversion report ที่เป็น relational, รองรับ query complex ได้                |
| **Row Level Security**   | ข้อมูลแต่ละ user ถูก isolate โดย DB policy ไม่ต้องเขียน middleware เองทุกจุด                 |
| **Next.js SSR รองรับดี** | มี official `@supabase/ssr` package สำหรับ App Router โดยเฉพาะ                               |
| **Free tier ใช้ได้จริง** | 500MB DB, 5GB transfer, 50,000 MAU ฟรี                                                       |
| **Realtime built-in**    | ถ้าอยากทำ live dashboard ในอนาคตทำได้เลย                                                     |

### Alternative ที่ควรรู้จัก

- **Clerk + Neon** — Auth UX ดีมาก (Clerk) + PostgreSQL serverless (Neon) แต่แยก provider ทำให้ setup ซับซ้อนกว่า
- **Firebase** — Firestore (NoSQL) ไม่เหมาะกับ conversion data ที่ต้องการ aggregate query
- **NextAuth.js + PlanetScale** — ถ้าอยากควบคุม auth logic เองทั้งหมด

---

## สถาปัตยกรรมที่เสนอ

```
┌─────────────────────────────────────────────────┐
│                  Next.js 15 App                  │
│  ┌──────────────┐    ┌───────────────────────┐  │
│  │  /login page │    │   /dashboard page     │  │
│  │  (Supabase   │    │   (ดึงข้อมูล Shopee    │  │
│  │   Auth UI)   │    │    + Supabase cache)   │  │
│  └──────┬───────┘    └──────────┬────────────┘  │
│         │                       │               │
│  ┌──────▼───────────────────────▼────────────┐  │
│  │            Next.js API Routes              │  │
│  │   /api/validate  /api/conversions          │  │
│  │   /api/sync      /api/credentials          │  │
│  └──────────────────────┬─────────────────────┘  │
└─────────────────────────│───────────────────────┘
                          │
               ┌──────────▼──────────┐
               │      Supabase       │
               │  ┌───────────────┐  │
               │  │  Auth (users) │  │
               │  ├───────────────┤  │
               │  │  shopee_creds │  │
               │  │  (encrypted)  │  │
               │  ├───────────────┤  │
               │  │  conversions  │  │
               │  │  (cache/sync) │  │
               │  ├───────────────┤  │
               │  │  sync_logs    │  │
               │  └───────────────┘  │
               └─────────────────────┘
```

---

## Database Schema

```sql
-- เข้ารหัส Shopee credentials ต่อ user
create table shopee_credentials (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  label       text not null default 'default',        -- รองรับหลาย account
  app_id      text not null,
  secret      text not null,                          -- encrypt ด้วย pg_crypto
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, label)
);

-- Cache conversion data จาก Shopee API
create table conversions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  credential_id   uuid references shopee_credentials(id) on delete cascade,
  order_id        text not null,
  product_name    text,
  commission      numeric(12, 2),
  status          text,                               -- confirmed / pending / cancelled
  conversion_time timestamptz,
  raw_data        jsonb,                              -- เก็บ full response ไว้ด้วย
  synced_at       timestamptz default now(),
  unique(credential_id, order_id)
);

-- Log การ sync แต่ละครั้ง
create table sync_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  credential_id uuid references shopee_credentials(id),
  started_at    timestamptz default now(),
  finished_at   timestamptz,
  records_added int default 0,
  error         text
);

-- Row Level Security
alter table shopee_credentials enable row level security;
alter table conversions         enable row level security;
alter table sync_logs           enable row level security;

create policy "users see own creds"        on shopee_credentials for all using (auth.uid() = user_id);
create policy "users see own conversions"  on conversions         for all using (auth.uid() = user_id);
create policy "users see own logs"         on sync_logs           for all using (auth.uid() = user_id);
```

---

## Features ที่แนะนำให้ทำ (เรียงตามความสำคัญ)

### Phase 1 — Foundation (สัปดาห์ที่ 1-2)

#### 1.1 User Authentication

- [ ] Email + password sign-up / login
- [ ] Google OAuth ("Continue with Google") — ลด friction มากที่สุด
- [ ] Magic Link login ทาง email (ไม่ต้องจำ password)
- [ ] Session persist ข้ามเครื่อง / browser
- [ ] Auto-redirect ถ้ายัง login อยู่

#### 1.2 Cloud Credentials Storage

- [ ] เมื่อ validate Shopee credentials สำเร็จ → บันทึกลง Supabase แทน localStorage
- [ ] รองรับหลาย Shopee account ต่อ 1 user (labelled)
- [ ] Fallback อ่านจาก localStorage ถ้าไม่มี network (offline ใช้งานได้)

### Phase 2 — Data Sync (สัปดาห์ที่ 3-4)

#### 2.1 Conversion Cache & Sync

- [ ] Sync conversion data จาก Shopee → Supabase ทุกครั้งที่เปิดหน้า dashboard
- [ ] เก็บ history ย้อนหลังได้ไม่จำกัด (ปัจจุบัน Shopee API ให้แค่ 30 วัน)
- [ ] Incremental sync — ดึงเฉพาะข้อมูลใหม่ตั้งแต่ sync ล่าสุด
- [ ] Manual "Refresh" button ยังทำงานได้เหมือนเดิม

#### 2.2 Scheduled Auto-Sync _(Vercel Cron Jobs)_

- [ ] Auto-sync ทุก 6 ชั่วโมง (Vercel Cron — ฟรี tier ได้)
- [ ] Notify ทาง email เมื่อมี confirmed conversion ใหม่
- [ ] `/api/cron/sync` endpoint สำหรับ Vercel Cron trigger

### Phase 3 — UX & Analytics (สัปดาห์ที่ 5-6)

#### 3.1 Enhanced Dashboard

- [ ] กราฟ commission รายวัน / รายสัปดาห์ / รายเดือน (Recharts หรือ antd Charts)
- [ ] ยอดรวม commission แบบ real-time จาก DB (ไม่ต้องเรียก Shopee API ทุกครั้ง)
- [ ] Filter ข้าม date range ได้ไม่จำกัด (ดึงจาก cache)
- [ ] Conversion rate: pending → confirmed

#### 3.2 Export & Share

- [ ] Export CSV / Excel รายงาน conversion
- [ ] Shareable report link (read-only view ที่มี expiry)

#### 3.3 Notifications

- [ ] Line Notify หรือ Email alert เมื่อ commission เกิน threshold
- [ ] Weekly summary email

### Phase 4 — Multi-platform (อนาคต)

#### 4.1 Mobile App (มี `apps/mobile/` อยู่แล้ว)

- [ ] React Native (Expo) share Supabase client กับ web
- [ ] Push notification ผ่าน Expo Notifications

---

## การติดตั้งเบื้องต้น

```bash
# 1. เพิ่ม Supabase packages
pnpm add @supabase/supabase-js @supabase/ssr --filter @livesoul/web

# 2. สร้าง Supabase project ที่ https://supabase.com
#    แล้วเก็บ keys เหล่านี้:
#    NEXT_PUBLIC_SUPABASE_URL=
#    NEXT_PUBLIC_SUPABASE_ANON_KEY=
#    SUPABASE_SERVICE_ROLE_KEY=    (server-side only)

# 3. สร้าง utils/supabase/ ตาม Next.js App Router pattern
apps/web/src/lib/supabase/
  client.ts      # createBrowserClient()
  server.ts      # createServerClient() — ใช้ใน Server Components / API routes
  middleware.ts  # refresh session
```

```typescript
// apps/web/src/middleware.ts  (เพิ่ม Supabase session refresh)
import { updateSession } from "@/lib/supabase/middleware";
export const middleware = updateSession;
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## Cost Estimate (Production)

| บริการ   | Free Tier         | โดยประมาณถ้า scale                |
| -------- | ----------------- | --------------------------------- |
| Supabase | 500MB DB, 50k MAU | $25/mo (Pro)                      |
| Vercel   | Cron 2/day        | $20/mo (Pro) ถ้าต้องการ cron บ่อย |
| **รวม**  | **$0**            | **~$45/mo**                       |

---

## Security Checklist

- [ ] Shopee `secret` ต้องเข้ารหัสก่อนเก็บใน DB (`pgsodium` หรือ application-level AES)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ห้าม expose ใน client — server-side only
- [ ] Rate limit `/api/validate` ป้องกัน brute force
- [ ] Audit log เมื่อ credentials ถูกสร้าง / ลบ

---

_สร้างเมื่อ: มีนาคม 2569 | Stack: Next.js 15 + Supabase + Turborepo monorepo_
