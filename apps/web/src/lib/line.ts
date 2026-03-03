/**
 * LINE Messaging API Notification
 *
 * Sends sync reports via LINE Official Account push message.
 *
 * Setup:
 *   1. Create LINE Official Account: https://manager.line.biz
 *   2. Enable Messaging API in LINE Developers Console
 *   3. Issue Channel Access Token (long-lived)
 *   4. Get your LINE User ID (from LINE Developers → Basic settings)
 *   5. Set env vars: LINE_CHANNEL_ACCESS_TOKEN + LINE_USER_ID
 *
 * Free tier: 200 push messages/month (per OA)
 */

import type { SyncResult } from "./sync-engine";

const LINE_API = "https://api.line.me/v2/bot/message/push";
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_USER_ID = process.env.LINE_USER_ID;

/**
 * Send sync results as LINE push messages.
 */
export async function sendLineNotification(
  results: SyncResult[],
): Promise<void> {
  if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_USER_ID) {
    console.log(
      "[line] LINE_CHANNEL_ACCESS_TOKEN or LINE_USER_ID not set, skipping",
    );
    return;
  }

  for (const result of results) {
    const text = formatSyncResultForLine(result);
    try {
      const res = await fetch(LINE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: LINE_USER_ID,
          messages: [{ type: "text", text }],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`[line] Push failed: ${res.status} ${body}`);
      }
    } catch (err) {
      console.error("[line] Failed to send notification:", err);
    }
  }
}

function formatSyncResultForLine(result: SyncResult): string {
  if (result.error) {
    return [
      "⚠️ LiveSoul Sync Error",
      `🔑 ${result.credentialLabel}`,
      `❌ ${result.error}`,
    ].join("\n");
  }

  const lines: string[] = [
    "📊 LiveSoul Daily Report",
    `🔑 ${result.credentialLabel}`,
  ];

  // D-1
  if (result.d1.newRecords > 0 || result.d1.updatedRecords > 0) {
    lines.push(`📅 ${result.d1.date}`);
    lines.push(`🆕 New: ${result.d1.newRecords}`);
    if (result.d1.updatedRecords > 0)
      lines.push(`🔄 Updated: ${result.d1.updatedRecords}`);
    if (result.d1.statusChanges > 0)
      lines.push(`📝 Status changes: ${result.d1.statusChanges}`);
  } else {
    lines.push(`📅 ${result.d1.date}`);
    lines.push("📭 ไม่มี conversion ใหม่");
  }

  // Historical
  if (result.historical.daysChecked > 0) {
    lines.push("");
    lines.push("🔄 Historical Updates");
    lines.push(`Days: ${result.historical.daysChecked}`);
    lines.push(`Changes: ${result.historical.statusChanges}`);
  }

  // Summary
  if (result.summary) {
    const s = result.summary;
    lines.push("");
    lines.push(`📈 Summary ${s.reportDate}`);
    lines.push(`🛒 ${s.totalConversions} conversions`);
    lines.push(`📦 ${s.totalOrders} orders (${s.totalItems} items)`);
    lines.push(`💰 ฿${s.totalCommission.toFixed(2)}`);
    lines.push(
      `✅${s.completedOrders} ⏳${s.pendingOrders} ❌${s.cancelledOrders}`,
    );
    if (s.topItemName) lines.push(`🏆 ${s.topItemName}`);
    if (s.topShopName) lines.push(`🏪 ${s.topShopName}`);
  }

  return lines.join("\n");
}
