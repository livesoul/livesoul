/**
 * Sync Engine — Auto-fetch conversion reports & track status changes
 *
 * Called by /api/cron/sync (Vercel Cron) twice daily at 09:00 + 15:00 BKK.
 *
 * Flow:
 *   1. For each user's credential set:
 *      a) Sync D-1 (yesterday) — upsert all conversions
 *      b) Sync D-2 to D-30 — re-fetch only days that still have PENDING orders
 *   2. Detect status changes → insert into status_history
 *   3. Update daily_summaries
 *   4. Send Discord notification with report
 */

import { ShopeeAffiliateClient } from "@livesoul/shopee-api";
import type { ConversionReport } from "@livesoul/shopee-api";
import { createClient as createSupabaseAdmin, type SupabaseClient } from "@supabase/supabase-js";
import { bkk, bkkDayBoundary } from "./tz";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

// ─── Types ───────────────────────────────────────────────────────────────────

interface CredentialRecord {
  id: string;
  user_id: string;
  app_id: string;
  secret: string;
  label: string;
}

interface ConversionRow {
  id: string;
  order_id: string;
  order_status: string;
  item_id: number;
  conversion_id: number;
}

export interface SyncResult {
  credentialId: string;
  credentialLabel: string;
  userId: string;
  d1: {
    date: string;
    newRecords: number;
    updatedRecords: number;
    statusChanges: number;
  };
  historical: {
    daysChecked: number;
    statusChanges: number;
  };
  summary: DailySummaryData | null;
  error?: string;
}

interface DailySummaryData {
  reportDate: string;
  totalConversions: number;
  totalOrders: number;
  totalItems: number;
  totalCommission: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  unpaidOrders: number;
  uniqueShops: number;
  topItemName: string | null;
  topShopName: string | null;
}

// ─── Admin Supabase Client (bypasses RLS) ────────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseAdmin(url, serviceKey);
}

// ─── Main Sync ───────────────────────────────────────────────────────────────

/**
 * Run full sync for all users' credentials.
 * Returns results per credential for notification.
 */
export async function runFullSync(): Promise<SyncResult[]> {
  const supabase = getAdminClient();
  const results: SyncResult[] = [];

  // Get all credentials (admin bypasses RLS)
  const { data: credentials, error: credError } = await supabase
    .from("shopee_credentials")
    .select("id, user_id, app_id, secret, label");

  if (credError) {
    throw new Error(`Failed to fetch credentials: ${credError.message}`);
  }

  if (!credentials || credentials.length === 0) {
    return [];
  }

  for (const cred of credentials as CredentialRecord[]) {
    try {
      const result = await syncForCredential(supabase, cred);
      results.push(result);
    } catch (err) {
      results.push({
        credentialId: cred.id,
        credentialLabel: cred.label,
        userId: cred.user_id,
        d1: { date: "", newRecords: 0, updatedRecords: 0, statusChanges: 0 },
        historical: { daysChecked: 0, statusChanges: 0 },
        summary: null,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

// ─── Per-Credential Sync ─────────────────────────────────────────────────────

async function syncForCredential(
  supabase: AdminClient,
  cred: CredentialRecord,
): Promise<SyncResult> {
  const client = new ShopeeAffiliateClient({
    appId: cred.app_id,
    secret: cred.secret,
  });

  const yesterdayBkk = bkk().subtract(1, "day").format("YYYY-MM-DD");

  // Step 1: Sync D-1 (yesterday)
  const d1Result = await syncDay(supabase, client, cred, -1);

  // Step 2: Historical status update — check D-2 to D-30 for PENDING orders
  const historicalResult = await syncHistoricalPending(supabase, client, cred);

  // Step 3: Build daily summary for yesterday
  const summary = await buildDailySummary(supabase, cred, yesterdayBkk);

  // Step 4: Log the sync
  await supabase.from("sync_logs").insert({
    user_id: cred.user_id,
    credential_id: cred.id,
    finished_at: new Date().toISOString(),
    records_added: d1Result.newRecords,
    sync_type: "cron_d1",
    target_date: yesterdayBkk,
    status_changes: d1Result.statusChanges + historicalResult.statusChanges,
  });

  return {
    credentialId: cred.id,
    credentialLabel: cred.label,
    userId: cred.user_id,
    d1: {
      date: yesterdayBkk,
      ...d1Result,
    },
    historical: historicalResult,
    summary,
  };
}

// ─── Sync a Single Day ──────────────────────────────────────────────────────

async function syncDay(
  supabase: AdminClient,
  client: ShopeeAffiliateClient,
  cred: CredentialRecord,
  dayOffset: number,
): Promise<{ newRecords: number; updatedRecords: number; statusChanges: number }> {
  const boundary = bkkDayBoundary(dayOffset);

  // Fetch from Shopee API
  const conversions = await client.getAllConversionReports({
    purchaseTimeStart: boundary.start,
    purchaseTimeEnd: boundary.end,
    limit: 500,
  });

  if (conversions.length === 0) {
    return { newRecords: 0, updatedRecords: 0, statusChanges: 0 };
  }

  return await upsertConversions(supabase, cred, conversions);
}

// ─── Upsert Conversions + Detect Status Changes ────────────────────────────

async function upsertConversions(
  supabase: AdminClient,
  cred: CredentialRecord,
  conversions: ConversionReport[],
): Promise<{ newRecords: number; updatedRecords: number; statusChanges: number }> {
  let newRecords = 0;
  let updatedRecords = 0;
  let statusChanges = 0;

  // Flatten conversions → individual order items
  const rows = flattenConversions(cred, conversions);

  if (rows.length === 0) {
    return { newRecords: 0, updatedRecords: 0, statusChanges: 0 };
  }

  // Get existing records for comparison
  const conversionIds = [...new Set(rows.map((r) => r.conversion_id))];
  const { data: existing } = await supabase
    .from("conversions")
    .select("id, conversion_id, order_id, item_id, order_status")
    .eq("credential_id", cred.id)
    .in("conversion_id", conversionIds);

  const existingMap = new Map<string, ConversionRow>();
  if (existing) {
    for (const row of existing as ConversionRow[]) {
      const key = `${row.conversion_id}:${row.order_id}:${row.item_id}`;
      existingMap.set(key, row);
    }
  }

  // Process each row
  for (const row of rows) {
    const key = `${row.conversion_id}:${row.order_id}:${row.item_id}`;
    const existingRow = existingMap.get(key);

    if (!existingRow) {
      // New record — insert
      const { data: inserted } = await supabase
        .from("conversions")
        .upsert(row, { onConflict: "credential_id,conversion_id,order_id,item_id" })
        .select("id")
        .single();

      newRecords++;

      // Record initial status in status_history
      if (inserted) {
        await supabase.from("status_history").insert({
          conversion_ref: inserted.id,
          old_status: null,
          new_status: row.order_status,
        });
      }
    } else if (existingRow.order_status !== row.order_status) {
      // Status changed — update + record history
      await supabase
        .from("conversions")
        .update({
          order_status: row.order_status,
          complete_time: row.complete_time,
          refund_amount: row.refund_amount,
          fraud_status: row.fraud_status,
          synced_at: new Date().toISOString(),
        })
        .eq("id", existingRow.id);

      await supabase.from("status_history").insert({
        conversion_ref: existingRow.id,
        old_status: existingRow.order_status,
        new_status: row.order_status,
      });

      statusChanges++;
      updatedRecords++;
    }
    // else: same status, no change needed
  }

  return { newRecords, updatedRecords, statusChanges };
}

// ─── Flatten Conversion Reports → DB Rows ───────────────────────────────────

function flattenConversions(
  cred: CredentialRecord,
  conversions: ConversionReport[],
) {
  const rows: Array<Record<string, unknown>> = [];

  for (const conv of conversions) {
    if (!conv.orders) continue;

    for (const order of conv.orders) {
      if (!order.items) continue;

      for (const item of order.items) {
        rows.push({
          user_id: cred.user_id,
          credential_id: cred.id,
          conversion_id: conv.conversionId,
          purchase_time: new Date(conv.purchaseTime * 1000).toISOString(),
          click_time: conv.clickTime
            ? new Date(conv.clickTime * 1000).toISOString()
            : null,
          total_commission: parseFloat(conv.totalCommission || "0"),
          buyer_type: conv.buyerType,
          device: conv.device,
          order_id: order.orderId,
          order_status: order.orderStatus,
          item_id: item.itemId,
          item_name: item.itemName,
          item_price: parseFloat(item.itemPrice || "0"),
          qty: item.qty,
          shop_id: item.shopId,
          shop_name: item.shopName,
          image_url: item.imageUrl,
          item_commission: parseFloat(item.itemTotalCommission || "0"),
          category_lv1: item.globalCategoryLv1Name || null,
          category_lv2: item.globalCategoryLv2Name || null,
          category_lv3: item.globalCategoryLv3Name || null,
          complete_time: item.completeTime
            ? new Date(item.completeTime * 1000).toISOString()
            : null,
          refund_amount: parseFloat(item.refundAmount || "0"),
          fraud_status: item.fraudStatus || null,
          synced_at: new Date().toISOString(),
        });
      }
    }
  }

  return rows;
}

// ─── Historical Pending Status Update ────────────────────────────────────────

/**
 * Re-fetch conversions for days D-2..D-30 that still have PENDING orders,
 * and update their statuses.
 */
async function syncHistoricalPending(
  supabase: AdminClient,
  client: ShopeeAffiliateClient,
  cred: CredentialRecord,
): Promise<{ daysChecked: number; statusChanges: number }> {
  // Find distinct purchase dates that still have PENDING orders (D-2 to D-30)
  const thirtyDaysAgo = bkk().subtract(30, "day").startOf("day").toISOString();
  const twoDaysAgo = bkk().subtract(2, "day").endOf("day").toISOString();

  const { data: pendingDates } = await supabase
    .from("conversions")
    .select("purchase_time")
    .eq("credential_id", cred.id)
    .eq("order_status", "PENDING")
    .gte("purchase_time", thirtyDaysAgo)
    .lte("purchase_time", twoDaysAgo);

  if (!pendingDates || pendingDates.length === 0) {
    return { daysChecked: 0, statusChanges: 0 };
  }

  // Get unique BKK dates from pending orders
  const uniqueDates = new Set<string>();
  for (const row of pendingDates) {
    const dateStr = bkk(row.purchase_time).format("YYYY-MM-DD");
    uniqueDates.add(dateStr);
  }

  let totalStatusChanges = 0;
  let daysChecked = 0;

  // Re-fetch each day from Shopee API
  for (const dateStr of uniqueDates) {
    const dayStart = bkk(dateStr).startOf("day").unix();
    const dayEnd = bkk(dateStr).endOf("day").unix();

    try {
      const conversions = await client.getAllConversionReports({
        purchaseTimeStart: dayStart,
        purchaseTimeEnd: dayEnd,
        limit: 500,
      });

      if (conversions.length > 0) {
        const result = await upsertConversions(supabase, cred, conversions);
        totalStatusChanges += result.statusChanges;
      }

      daysChecked++;
    } catch (err) {
      // Log error but continue with other days
      console.error(`[sync] Historical check failed for ${dateStr}:`, err);
    }
  }

  // Log historical sync
  if (daysChecked > 0) {
    await supabase.from("sync_logs").insert({
      user_id: cred.user_id,
      credential_id: cred.id,
      finished_at: new Date().toISOString(),
      records_added: 0,
      sync_type: "cron_history",
      status_changes: totalStatusChanges,
    });
  }

  return { daysChecked, statusChanges: totalStatusChanges };
}

// ─── Build Daily Summary ─────────────────────────────────────────────────────

async function buildDailySummary(
  supabase: AdminClient,
  cred: CredentialRecord,
  dateStr: string,
): Promise<DailySummaryData | null> {
  const dayStart = bkk(dateStr).startOf("day").toISOString();
  const dayEnd = bkk(dateStr).endOf("day").toISOString();

  const { data: conversions } = await supabase
    .from("conversions")
    .select("*")
    .eq("credential_id", cred.id)
    .gte("purchase_time", dayStart)
    .lte("purchase_time", dayEnd);

  if (!conversions || conversions.length === 0) {
    return null;
  }

  // Aggregate stats
  const uniqueConversions = new Set<number>();
  const uniqueOrders = new Set<string>();
  const uniqueShops = new Set<number>();
  let totalCommission = 0;
  let pending = 0;
  let completed = 0;
  let cancelled = 0;
  let unpaid = 0;

  // Track item commissions for top item
  const itemCommissions = new Map<string, number>();
  const shopCommissions = new Map<string, number>();

  for (const row of conversions) {
    uniqueConversions.add(row.conversion_id);
    uniqueOrders.add(row.order_id);
    if (row.shop_id) uniqueShops.add(row.shop_id);

    const itemComm = parseFloat(row.item_commission || "0");
    totalCommission += itemComm;

    switch (row.order_status) {
      case "PENDING": pending++; break;
      case "COMPLETED": completed++; break;
      case "CANCELLED": cancelled++; break;
      case "UNPAID": unpaid++; break;
    }

    if (row.item_name) {
      itemCommissions.set(
        row.item_name,
        (itemCommissions.get(row.item_name) || 0) + itemComm,
      );
    }
    if (row.shop_name) {
      shopCommissions.set(
        row.shop_name,
        (shopCommissions.get(row.shop_name) || 0) + itemComm,
      );
    }
  }

  // Find top item & shop
  let topItemName: string | null = null;
  let topItemComm = 0;
  for (const [name, comm] of itemCommissions) {
    if (comm > topItemComm) {
      topItemName = name;
      topItemComm = comm;
    }
  }

  let topShopName: string | null = null;
  let topShopComm = 0;
  for (const [name, comm] of shopCommissions) {
    if (comm > topShopComm) {
      topShopName = name;
      topShopComm = comm;
    }
  }

  const summaryData: DailySummaryData = {
    reportDate: dateStr,
    totalConversions: uniqueConversions.size,
    totalOrders: uniqueOrders.size,
    totalItems: conversions.length,
    totalCommission,
    pendingOrders: pending,
    completedOrders: completed,
    cancelledOrders: cancelled,
    unpaidOrders: unpaid,
    uniqueShops: uniqueShops.size,
    topItemName,
    topShopName,
  };

  // Upsert daily summary
  await supabase.from("daily_summaries").upsert(
    {
      user_id: cred.user_id,
      credential_id: cred.id,
      report_date: dateStr,
      total_conversions: summaryData.totalConversions,
      total_orders: summaryData.totalOrders,
      total_items: summaryData.totalItems,
      total_commission: summaryData.totalCommission,
      pending_orders: pending,
      completed_orders: completed,
      cancelled_orders: cancelled,
      unpaid_orders: unpaid,
      unique_shops: uniqueShops.size,
      top_item_name: topItemName,
      top_shop_name: topShopName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "credential_id,report_date" },
  );

  return summaryData;
}
