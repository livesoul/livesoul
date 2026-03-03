# Timezone Guide — Asia/Bangkok (UTC+7)

## ทำไมถึงสำคัญ

Shopee Affiliate API เก็บ timestamp ทุกตัวในรูป **Unix seconds (UTC)** แต่ตีความ filter range อย่าง `purchaseTimeStart` / `purchaseTimeEnd` ในบริบทของ **เวลาไทย (Asia/Bangkok, UTC+7)**

> From Shopee docs:  
> _"Shopee is using local time in UTC+ time format for each local region to store the data."_

หมายความว่า ถ้าต้องการดึงออเดอร์ "วันที่ 2 มีนาคม" ต้องส่ง timestamp ที่ตรงกับ **00:00:00 เวลาไทย** ≠ 00:00:00 UTC

| จุดเวลา              | UTC                     | Bangkok (UTC+7)         |
| -------------------- | ----------------------- | ----------------------- |
| เที่ยงคืนไทย 2 มี.ค. | 2026-03-01 **17:00:00** | 2026-03-02 **00:00:00** |
| Unix                 | `1772298000`            | (แสดงผล)                |

ถ้าใช้ `new Date()` หรือ `dayjs()` แบบ bare บน Server ที่ run ใน UTC จะได้ midnight UTC ซึ่งเลื่อนไป **+7 ชั่วโมง** → ข้อมูลหาย

---

## กฎที่ต้องทำตาม

### 1. Import จาก `@/lib/tz` เสมอ

```typescript
// ✅ ถูก
import { bkk, SHOPEE_TZ, dayjs } from "@/lib/tz";

// ❌ ผิด — bare dayjs ไม่มี timezone plugin
import dayjs from "dayjs";
```

### 2. ใช้ `bkk()` แทน `dayjs()` ทุกที่

```typescript
// ✅ ถูก — anchor ไว้ที่ Bangkok
const startOfToday = bkk().startOf("day").unix();
const endOfToday = bkk().endOf("day").unix();

// ❌ ผิด — ใช้ system timezone ของ runtime
const startOfToday = dayjs().startOf("day").unix();
```

### 3. แสดงผล timestamp จาก API ด้วย `bkk()`

```typescript
// ✅ ถูก — แสดงเวลาไทยเสมอ ไม่ว่า server/browser ตั้ง TZ ไว้เป็นอะไร
const display = bkk(conv.purchaseTime * 1000).format("DD MMM YYYY HH:mm");

// ❌ ผิด — ขึ้นกับ system timezone
const display = new Date(conv.purchaseTime * 1000).toLocaleString();
```

### 4. DatePicker ต้องส่ง value ที่เป็น Bangkok tz

```typescript
// ✅ ถูก — initial state เป็น Bangkok tz
const [range, setRange] = useState([
  bkk().subtract(7, "day").startOf("day"),
  bkk(),
]);

// ✅ ถูก — fetchData แปลง tz ก่อนเสมอ
const start = bkk(range[0]).startOf("day").unix();
const end = bkk(range[1]).endOf("day").unix();
```

### 5. Server-side ใช้ `bkkDayBoundary()` สำหรับ default

```typescript
import { bkkDayBoundary } from "@/lib/tz";

// วันนี้ (Bangkok)
const { start, end } = bkkDayBoundary(0);

// 7 วันที่แล้ว → วันนี้
const weekStart = bkkDayBoundary(-6).start;
const weekEnd = bkkDayBoundary(0).end;
```

---

## สรุป Utility ใน `apps/web/src/lib/tz.ts`

| Export                   | ใช้ที่                 | หน้าที่                                                           |
| ------------------------ | ---------------------- | ----------------------------------------------------------------- |
| `bkk(date?)`             | client + server        | สร้าง dayjs instance ที่ lock อยู่ใน Asia/Bangkok                 |
| `SHOPEE_TZ`              | ทุกที่                 | string `"Asia/Bangkok"`                                           |
| `bkkDayBoundary(offset)` | server-side API routes | คำนวณ start/end Unix ของ Bangkok calendar day โดยไม่ต้องใช้ dayjs |
| `dayjs`                  | ทุกที่                 | re-export dayjs ที่ extend แล้ว (utc + timezone plugins)          |

---

## ทดสอบว่า TZ ถูกต้อง

```bash
# ควรได้ 17:00:00 UTC สำหรับ midnight Bangkok วันใดก็ตาม
node -e "
const { bkkDayBoundary } = require('./apps/web/src/lib/tz');
const { start } = bkkDayBoundary(0);
console.log('Bangkok midnight (UTC):', new Date(start * 1000).toISOString());
console.log('Bangkok midnight (BKK):', new Date((start + 7*3600) * 1000).toISOString().replace('Z', '+07:00'));
"
```

---

## ข้อผิดพลาดที่พบบ่อย

| อาการ                               | สาเหตุ                                             | วิธีแก้                                |
| ----------------------------------- | -------------------------------------------------- | -------------------------------------- |
| API คืน 0 results ทั้งที่มีข้อมูล   | `startOf("day")` ใช้ UTC → เริ่มต้น 07:00 น. ไทย   | ใช้ `bkk().startOf("day")`             |
| เวลา purchaseTime แสดงผิด 7 ชั่วโมง | `new Date(ts*1000).toLocaleString()` บน UTC server | ใช้ `bkk(ts*1000).format(...)`         |
| Date range picker ตัดข้อมูลหาย      | `dateRange[0].startOf("day")` ไม่มี tz             | ใช้ `bkk(dateRange[0]).startOf("day")` |
