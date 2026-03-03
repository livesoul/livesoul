/**
 * Cloud-backed Shopee Credentials API
 *
 * Routes:
 *   GET    /api/credentials          — list all credentials for current user
 *   POST   /api/credentials          — save (upsert) a credential
 *   DELETE /api/credentials?id=xxx   — delete a credential
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ShopeeAffiliateClient } from "@livesoul/shopee-api";

export const dynamic = "force-dynamic";

/** List all Shopee credentials for the authenticated user */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("shopee_credentials")
    .select("id, label, app_id, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ credentials: data });
}

/** Validate & save (upsert) a Shopee credential */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    appId?: string;
    secret?: string;
    label?: string;
  };

  const appId = body.appId?.trim();
  const secret = body.secret?.trim();
  const label = body.label?.trim() || "default";

  if (!appId || !secret) {
    return NextResponse.json(
      { ok: false, error: "Missing App ID or Secret" },
      { status: 400 },
    );
  }

  // Validate credentials against Shopee API
  try {
    const client = new ShopeeAffiliateClient({ appId, secret });
    await client.getShopeeOffers({ limit: 1 });
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

  // Upsert credential (unique on user_id + label)
  const { data, error } = await supabase
    .from("shopee_credentials")
    .upsert(
      {
        user_id: user.id,
        label,
        app_id: appId,
        secret,
      },
      { onConflict: "user_id,label" },
    )
    .select("id, label, app_id, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, credential: data });
}

/** Delete a Shopee credential */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing credential id" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("shopee_credentials")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
