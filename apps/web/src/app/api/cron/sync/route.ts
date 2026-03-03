/**
 * Vercel Cron Job — Auto-Sync Conversion Reports
 *
 * Schedule: 09:00 + 15:00 BKK (02:00 + 08:00 UTC)
 * Vercel free tier allows 2 cron invocations/day — we use both.
 *
 * Security: Vercel automatically sends CRON_SECRET in the
 * Authorization header for cron invocations. We verify it.
 *
 * Flow:
 *   1. Verify CRON_SECRET
 *   2. Run full sync (all credentials)
 *   3. Send Discord notifications
 *   4. Return results
 */

import { NextResponse } from "next/server";
import { runFullSync } from "@/lib/sync-engine";
import { sendDiscordNotification } from "@/lib/discord";
import { sendLineNotification } from "@/lib/line";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — Vercel free tier max

export async function GET(request: Request) {
  // ─── Verify CRON_SECRET ────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron/sync] Starting full sync...");
    const startTime = Date.now();

    // Run sync for all users
    const results = await runFullSync();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[cron/sync] Completed in ${elapsed}s — ${results.length} credential(s) synced`,
    );

    // Send notifications (Discord + LINE, both optional)
    if (results.length > 0) {
      await Promise.allSettled([
        sendDiscordNotification(results),
        sendLineNotification(results),
      ]);
    }

    return NextResponse.json({
      ok: true,
      elapsed: `${elapsed}s`,
      results: results.map((r) => ({
        credential: r.credentialLabel,
        d1: r.d1,
        historical: r.historical,
        hasSummary: !!r.summary,
        error: r.error,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/sync] Fatal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
