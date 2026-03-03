/**
 * Client-side credential store (hybrid: Cloud + localStorage fallback)
 *
 * Post-Supabase flow:
 *   1. User logs in via Supabase Auth (Google OAuth / Magic Link / email)
 *   2. User enters Shopee credentials on /login step 2
 *   3. Credentials are validated via /api/credentials (POST) and stored
 *      in Supabase DB (RLS-protected per user)
 *   4. localStorage is used as a cache for offline / fast access
 *   5. API routes read credentials from Supabase DB using the user session
 *   6. Logout = Supabase sign-out + clear localStorage
 */

const CREDS_KEY = "livesoul_shopee_creds";

export interface Credentials {
  appId: string;
  secret: string;
}

export interface StoredCredential {
  id: string;
  label: string;
  app_id: string;
  created_at: string;
  updated_at: string;
}

/** Custom header names — kept for backward compat with API routes */
export const HEADER_APP_ID = "x-shopee-app-id";
export const HEADER_SECRET = "x-shopee-secret";

// ─── localStorage cache (offline fallback) ───────────────────────────────────

/** Save credentials to localStorage as a cache */
export function saveCredentials(creds: Credentials): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

/** Load credentials from localStorage cache */
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

/** Remove credentials from localStorage */
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

// ─── Cloud API helpers ───────────────────────────────────────────────────────

/** Save credentials to cloud (Supabase) via API route */
export async function saveCredentialsCloud(
  creds: Credentials,
  label = "default",
): Promise<{ ok: boolean; error?: string; credential?: StoredCredential }> {
  try {
    const res = await fetch("/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId: creds.appId, secret: creds.secret, label }),
    });
    const json = await res.json();
    if (json.ok) {
      // Cache in localStorage too
      saveCredentials(creds);
    }
    return json;
  } catch {
    return { ok: false, error: "Cannot connect to server" };
  }
}

/** Fetch all stored credentials from cloud */
export async function loadCredentialsCloud(): Promise<StoredCredential[]> {
  try {
    const res = await fetch("/api/credentials");
    const json = await res.json();
    return json.credentials ?? [];
  } catch {
    return [];
  }
}

/** Delete a credential from cloud */
export async function deleteCredentialCloud(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/credentials?id=${id}`, { method: "DELETE" });
    return await res.json();
  } catch {
    return { ok: false, error: "Cannot connect to server" };
  }
}
