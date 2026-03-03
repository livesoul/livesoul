import { NextResponse } from "next/server";
import { ShopeeAffiliateClient } from "@livesoul/shopee-api";
import { createClient } from "@/lib/supabase/server";
// ⚠️ Always import from @/lib/tz — never use bare dayjs — see tz.ts for why
import { bkkDayBoundary } from "@/lib/tz";

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
  const credentialId = searchParams.get("credentialId"); // optional: specific credential

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 },
      );
    }

    // Get credential: specific one or first available
    let query = supabase
      .from("shopee_credentials")
      .select("id, app_id, secret, label")
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
        { status: 401 },
      );
    }

    const client = new ShopeeAffiliateClient({ appId: cred.app_id, secret: cred.secret });
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
      credentialId: cred.id,
      credentialLabel: cred.label,
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
