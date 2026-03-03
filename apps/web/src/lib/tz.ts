/**
 * Timezone utility for LiveSoul Affiliate
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * Shopee Affiliate API stores all timestamps (purchaseTime, clickTime,
 * completeTime, etc.) as Unix timestamps, but interprets date-range filters
 * (purchaseTimeStart / purchaseTimeEnd) in the **local region time** of the
 * platform — which for Thailand is **Asia/Bangkok (UTC+7)**.
 *
 * This means:
 *   • "Start of 2 March" in Bangkok = 2026-03-02 00:00:00 +07:00
 *                                   = 2026-03-01 17:00:00 UTC
 *                                   = Unix 1772298000
 *
 *   • Using plain `new Date()` or `dayjs()` without timezone awareness on a
 *     UTC server would treat "start of 2 March" as 2026-03-02 00:00:00 UTC
 *     = Unix 1772323200, which is 7 hours LATE — you'd miss orders that came
 *     in between 00:00 and 07:00 Bangkok time.
 *
 * ─── RULES ───────────────────────────────────────────────────────────────────
 *
 * 1. ALWAYS import `bkk` or `SHOPEE_TZ` from this file instead of bare `dayjs`
 *    when working with Shopee API date/time values.
 *
 * 2. Use `bkk(unixTimestamp * 1000)` to format timestamps from the API.
 *
 * 3. Use `bkk().startOf("day").unix()` to get today's midnight in Bangkok.
 *
 * 4. When passing timestamps to the API, always derive them from `bkk()` so
 *    that day boundaries and range endpoints are correct.
 *
 * 5. Never use `new Date().toLocaleString()` or `Date.now()` for day-boundary
 *    calculations — they depend on the runtime's system timezone (UTC on most
 *    servers / CI environments).
 *
 * ─── EXAMPLES ────────────────────────────────────────────────────────────────
 *
 *   // Today in Bangkok
 *   const today = bkk();
 *
 *   // Start of today in Bangkok → Unix timestamp for API
 *   const startOfToday = bkk().startOf("day").unix();
 *
 *   // Display a Unix timestamp from the API
 *   const display = bkk(conv.purchaseTime * 1000).format("DD MMM YYYY HH:mm");
 *
 *   // Last 7 days range for API
 *   const start = bkk().subtract(7, "day").startOf("day").unix();
 *   const end   = bkk().endOf("day").unix();
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Shopee Affiliate API — Thai region timezone */
export const SHOPEE_TZ = "Asia/Bangkok";

/**
 * Return a dayjs instance anchored to **Asia/Bangkok (UTC+7)**.
 *
 * Accepts the same arguments as `dayjs(...)`:
 *   • `bkk()` — current time in Bangkok
 *   • `bkk(unixMs)` — specific Unix millisecond timestamp
 *   • `bkk("2026-03-02")` — date string (parsed as Bangkok local)
 */
export function bkk(date?: dayjs.ConfigType): dayjs.Dayjs {
  if (date === undefined) {
    return dayjs().tz(SHOPEE_TZ);
  }
  // If already a dayjs object, convert to Bangkok tz
  if (dayjs.isDayjs(date)) {
    return date.tz(SHOPEE_TZ);
  }
  return dayjs(date).tz(SHOPEE_TZ);
}

/**
 * Server-side helper: compute Bangkok day boundaries without needing dayjs.
 * Returns Unix timestamps (seconds) for the start and end of a given
 * Bangkok calendar day offset from today.
 *
 * @param dayOffset  0 = today, -1 = yesterday, -7 = 7 days ago, etc.
 */
export function bkkDayBoundary(dayOffset = 0): {
  start: number;
  end: number;
} {
  const BKK_OFFSET_SECS = 7 * 3600; // UTC+7
  const nowUtcSecs = Math.floor(Date.now() / 1000);
  const bkkNow = nowUtcSecs + BKK_OFFSET_SECS;
  const bkkToday = Math.floor(bkkNow / 86400) * 86400; // midnight Bangkok today in BKK-local secs
  const targetDay = bkkToday + dayOffset * 86400;
  return {
    start: targetDay - BKK_OFFSET_SECS, // → UTC unix
    end: targetDay + 86400 - 1 - BKK_OFFSET_SECS, // → UTC unix (23:59:59)
  };
}

export { dayjs };
