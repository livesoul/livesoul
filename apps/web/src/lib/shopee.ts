import { ShopeeAffiliateClient } from "@livesoul/shopee-api";
import type { Credentials } from "@/lib/credentials";

/**
 * Create a Shopee Affiliate API client from explicit credentials.
 *
 * Credentials come from the client (stored in localStorage) and are forwarded
 * to the server via custom HTTP headers — they are NEVER baked into the build.
 */
export function getShopeeClient(creds?: Credentials): ShopeeAffiliateClient {
  const appId = creds?.appId ?? process.env.SHOPEE_APP_ID;
  const secret = creds?.secret ?? process.env.SHOPEE_SECRET;

  if (!appId || !secret) {
    throw new Error(
      "No credentials provided. " +
        "Either pass credentials via headers or set SHOPEE_APP_ID / SHOPEE_SECRET.",
    );
  }

  return new ShopeeAffiliateClient({ appId, secret });
}
