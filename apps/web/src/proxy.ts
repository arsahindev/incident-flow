import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { sessionCookieName } from "./lib/auth-constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // This endpoint authenticates through the API and must return JSON 401, not login HTML.
  if (pathname === "/api/realtime/token") return NextResponse.next();

  const hasSession = request.cookies.has(sessionCookieName);
  const isPublicPath =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/invite/");

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
