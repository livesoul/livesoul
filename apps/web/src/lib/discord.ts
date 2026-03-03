/**
 * Discord Webhook Notification
 *
 * Sends daily sync reports to a Discord channel via webhook.
 * Setup: Discord Server → Settings → Integrations → Webhooks → New Webhook → Copy URL
 */

import type { SyncResult } from "./sync-engine";

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * Send sync results as a formatted Discord message.
 */
export async function sendDiscordNotification(
  results: SyncResult[],
): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) {
    console.log("[discord] DISCORD_WEBHOOK_URL not set, skipping notification");
    return;
  }

  for (const result of results) {
    const message = formatSyncResult(result);
    try {
      const res = await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: message,
          username: "LiveSoul Affiliate",
        }),
      });

      if (!res.ok) {
        console.error(
          `[discord] Webhook failed: ${res.status} ${res.statusText}`,
        );
      }
    } catch (err) {
      console.error("[discord] Failed to send notification:", err);
    }
  }
}

function formatSyncResult(result: SyncResult): string {
  if (result.error) {
    return [
      "⚠️ **LiveSoul Affiliate — Sync Error**",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `🔑 Credential: ${result.credentialLabel}`,
      `❌ Error: ${result.error}`,
    ].join("\n");
  }

  const lines: string[] = [
    "📊 **LiveSoul Affiliate — Daily Report**",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `🔑 Credential: ${result.credentialLabel}`,
  ];

  // D-1 Results
  if (result.d1.newRecords > 0 || result.d1.updatedRecords > 0) {
    lines.push(`📅 วันที่: ${result.d1.date}`);
    lines.push(`🆕 New records: ${result.d1.newRecords}`);
    if (result.d1.updatedRecords > 0) {
      lines.push(`🔄 Updated: ${result.d1.updatedRecords}`);
    }
    if (result.d1.statusChanges > 0) {
      lines.push(`📝 Status changes: ${result.d1.statusChanges}`);
    }
  } else {
    lines.push(`📅 วันที่: ${result.d1.date}`);
    lines.push("📭 ไม่มี conversion ใหม่");
  }

  // Historical update
  if (result.historical.daysChecked > 0) {
    lines.push("");
    lines.push("**🔄 Historical Status Updates**");
    lines.push(`  Days checked: ${result.historical.daysChecked}`);
    lines.push(`  Status changes: ${result.historical.statusChanges}`);
  }

  // Daily summary
  if (result.summary) {
    const s = result.summary;
    lines.push("");
    lines.push(`**📈 Summary for ${s.reportDate}**`);
    lines.push(`  🛒 Conversions: ${s.totalConversions}`);
    lines.push(`  📦 Orders: ${s.totalOrders} (${s.totalItems} items)`);
    lines.push(`  💰 Commission: ฿${s.totalCommission.toFixed(2)}`);
    lines.push("");
    lines.push("  **สถานะ:**");
    lines.push(`  ✅ Completed: ${s.completedOrders}`);
    lines.push(`  ⏳ Pending: ${s.pendingOrders}`);
    lines.push(`  ❌ Cancelled: ${s.cancelledOrders}`);
    if (s.unpaidOrders > 0) {
      lines.push(`  💳 Unpaid: ${s.unpaidOrders}`);
    }
    lines.push(`  🏪 Unique shops: ${s.uniqueShops}`);

    if (s.topItemName) {
      lines.push(`  🏆 Top item: ${s.topItemName}`);
    }
    if (s.topShopName) {
      lines.push(`  🏪 Top shop: ${s.topShopName}`);
    }
  }

  return lines.join("\n");
}
