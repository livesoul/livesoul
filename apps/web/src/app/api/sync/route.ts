/**
 * Manual Sync — triggered from dashboard UI
 *
 * POST /api/sync
 *
 * Requires authenticated Supabase session.
 * Syncs the user's first credential (same logic as cron sync).
 * Sends notifications after sync (Discord + LINE).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runManualSync } from "@/lib/sync-engine";
import { sendDiscordNotification } from "@/lib/discord";
import { sendLineNotification } from "@/lib/line";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    // Auth check — user must be logged in
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's first credential
    const { data: cred } = await supabase
      .from("shopee_credentials")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!cred) {
      return NextResponse.json(
        { error: "No Shopee credentials found. Please set up credentials first." },
        { status: 400 },
      );
    }

    console.log(`[manual-sync] User ${user.id} triggered sync for credential ${cred.id}`);
    const startTime = Date.now();

    const result = await runManualSync(cred.id);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[manual-sync] Completed in ${elapsed}s`);

    // Send notifications
    await Promise.allSettled([
      sendDiscordNotification([result]),
      sendLineNotification([result]),
    ]);

    return NextResponse.json({
      ok: true,
      elapsed: `${elapsed}s`,
      d1: result.d1,
      historical: result.historical,
      hasSummary: !!result.summary,
      error: result.error,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[manual-sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
