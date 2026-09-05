import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { verifySessionToken } from "@/lib/auth/jwt";

/** Routes reachable without a session. */
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
  "/manifest.json",
  "/sw.js",
  // Service worker bunu kurulum sirasinda onbellege alir. Yonlendirilirse
  // cache.addAll reddeder ve SW kurulumu tamamen basarisiz olur.
  "/offline.html",
  "/favicon.ico",
  "/robots.txt",
  // Enforces its own auth (CRON_SECRET header or a valid session).
  "/api/cron/gold",
]);

const PUBLIC_PREFIXES = ["/_next", "/icons", "/images"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Verifies the session signature, not just the presence of a cookie.
 * Uses Web Crypto (see lib/auth/jwt.ts) because the Edge runtime cannot load
 * the `jsonwebtoken` package.
 *
 * Next.js 16 renamed the `middleware` convention to `proxy`; the behaviour is
 * unchanged. Kept in src/proxy.ts, next to the app directory.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  let session = null;
  try {
    session = await verifySessionToken(token);
  } catch {
    session = null; // misconfigured JWT_SECRET: fail closed
  }

  if (session) return NextResponse.next();

  // APIs get a 401 instead of an HTML redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Oturum bulunamadı veya süresi dolmuş" },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  const response = NextResponse.redirect(loginUrl);
  // Clear an invalid or expired cookie so the browser stops sending it.
  if (token) response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
