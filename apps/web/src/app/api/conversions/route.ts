import { NextResponse } from "next/server";
import { getShopeeClient } from "@/lib/shopee";
// ⚠️ Always import from @/lib/tz — never use bare dayjs — see tz.ts for why
import { bkkDayBoundary } from "@/lib/tz";
import { HEADER_APP_ID, HEADER_SECRET } from "@/lib/credentials";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Default: last 7 Bangkok calendar days
  const todayEnd = bkkDayBoundary(0).end;
  const sevenDaysAgoStart = bkkDayBoundary(-6).start;

  const purchaseTimeStart = Number(
    searchParams.get("purchaseTimeStart") ?? sevenDaysAgoStart,
  );
  const purchaseTimeEnd = Number(
    searchParams.get("purchaseTimeEnd") ?? todayEnd,
  );
  const limit = Number(searchParams.get("limit") ?? 500);

  try {
    const appId = request.headers.get(HEADER_APP_ID)?.trim();
    const secret = request.headers.get(HEADER_SECRET)?.trim();
    const client = getShopeeClient(
      appId && secret ? { appId, secret } : undefined,
    );

    const allNodes = await client.getAllConversionReports({
      purchaseTimeStart,
      purchaseTimeEnd,
      limit,
    });

    // Calculate summary
    let totalCommission = 0;
    let totalOrders = 0;
    let totalItems = 0;
    let pendingOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;

    for (const conv of allNodes) {
      totalCommission += parseFloat(conv.totalCommission || "0");
      if (conv.orders) {
        for (const order of conv.orders) {
          totalOrders++;
          if (order.orderStatus === "PENDING") pendingOrders++;
          if (order.orderStatus === "COMPLETED") completedOrders++;
          if (order.orderStatus === "CANCELLED") cancelledOrders++;
          if (order.items) {
            totalItems += order.items.length;
          }
        }
      }
    }

    return NextResponse.json({
      summary: {
        totalConversions: allNodes.length,
        totalOrders,
        totalItems,
        totalCommission: totalCommission.toFixed(2),
        pendingOrders,
        completedOrders,
        cancelledOrders,
      },
      conversions: allNodes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
