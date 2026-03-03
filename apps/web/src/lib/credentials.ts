/**
 * Client-side credential store
 *
 * Credentials (App ID + Secret) are stored in localStorage only — they are
 * NEVER embedded in the build, pushed to Git, or sent to any external service
 * other than the Shopee Affiliate API itself (via the Next.js API route on
 * localhost).
 *
 * Flow:
 *   1. User visits /login, enters App ID + Secret
 *   2. Credentials are validated against Shopee API
 *   3. On success, stored in localStorage under CREDS_KEY
 *   4. Every API fetch call includes the credentials as custom headers
 *   5. Next.js API routes read from those headers (never from env vars)
 *   6. User can clear credentials (logout) at any time
 */

const CREDS_KEY = "livesoul_shopee_creds";

export interface Credentials {
  appId: string;
  secret: string;
}

/** Custom header names — must match what API routes read */
export const HEADER_APP_ID = "x-shopee-app-id";
export const HEADER_SECRET = "x-shopee-secret";

/** Save credentials to localStorage */
export function saveCredentials(creds: Credentials): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

/** Load credentials from localStorage. Returns null if not found. */
export function loadCredentials(): Credentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Credentials;
    if (!parsed.appId || !parsed.secret) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remove credentials from localStorage (logout) */
export function clearCredentials(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CREDS_KEY);
}

/** Build fetch headers that include the stored credentials */
export function credentialHeaders(creds: Credentials): HeadersInit {
  return {
    [HEADER_APP_ID]: creds.appId,
    [HEADER_SECRET]: creds.secret,
  };
}
