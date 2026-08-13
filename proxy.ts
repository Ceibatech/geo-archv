import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-constants";

const protectedPrefixes = ["/inventaire", "/admin", "/dashboard", "/rapports", "/supervision", "/exports"];

export function proxy(request: NextRequest) {
  const isProtected = protectedPrefixes.some(
    (prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/inventaire/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/rapports/:path*",
    "/supervision/:path*",
    "/exports/:path*",
  ],
};
