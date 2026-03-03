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

export async function POST(request: Request) {
  try {
    // Auth check — user must be logged in
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Accept optional credentialId from body
    let credentialId: string | undefined;
    try {
      const body = await request.json();
      credentialId = body.credentialId;
    } catch {
      // no body or invalid JSON — that’s fine, we’ll use first credential
    }

    // Get credential
    let query = supabase
      .from("shopee_credentials")
      .select("id")
      .eq("user_id", user.id);

    if (credentialId) {
      query = query.eq("id", credentialId);
    } else {
      query = query.order("created_at", { ascending: true }).limit(1);
    }

    const { data: cred } = await query.single();

    if (!cred) {
      return NextResponse.json(
        {
          error:
            "ไม่พบ Shopee credentials กรุณาเพิ่ม credentials ที่หน้า Login",
        },
        { status: 400 },
      );
    }

    console.log(
      `[manual-sync] User ${user.id} triggered sync for credential ${cred.id}`,
    );
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
