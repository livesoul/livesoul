import { NextResponse } from "next/server";
import { ShopeeAffiliateClient } from "@livesoul/shopee-api";
import { HEADER_APP_ID, HEADER_SECRET } from "@/lib/credentials";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const appId = request.headers.get(HEADER_APP_ID)?.trim();
  const secret = request.headers.get(HEADER_SECRET)?.trim();

  if (!appId || !secret) {
    return NextResponse.json(
      { ok: false, error: "Missing App ID or Secret in request headers" },
      { status: 400 },
    );
  }

  try {
    const client = new ShopeeAffiliateClient({ appId, secret });
    await client.getShopeeOffers({ limit: 1 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const friendly = message.includes("10020")
      ? "App ID หรือ Secret ไม่ถูกต้อง (Invalid Credential)"
      : message.includes("10033")
        ? "บัญชีถูกระงับ (Account is frozen)"
        : message.includes("10035")
          ? "ไม่มีสิทธิ์เข้า Open API Platform"
          : message;
    return NextResponse.json({ ok: false, error: friendly }, { status: 401 });
  }
}
