/**
 * Supabase Browser Client
 *
 * Use this in Client Components ("use client").
 * Creates a singleton browser client that shares the same session across
 * all components on the page.
 */

import { createBrowserClient } from "@supabase/ssr";

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Set them in .env.local or Vercel environment variables.",
    );
  }

  cachedClient = createBrowserClient(url, key);
  return cachedClient;
}
