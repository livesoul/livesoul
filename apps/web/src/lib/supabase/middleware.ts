/**
 * Supabase Middleware — Session Refresh
 *
 * Refreshes the Supabase auth token on every request. Without this,
 * the session would expire after 1 hour and the user would be logged out.
 *
 * Also handles redirect logic:
 * - Unauthenticated users visiting protected pages → /login
 * - Authenticated users visiting /login → /
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not remove this — it refreshes the session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthCallback = request.nextUrl.pathname === "/auth/callback";
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  // Allow API routes and auth callback to pass through
  if (isApiRoute || isAuthCallback) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to /login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated users on /login: let the login page handle the logic
  // (it checks for existing credentials and redirects or shows setup form)

  return supabaseResponse;
}
