import { NextRequest, NextResponse } from "next/server";
import { createAppLockToken, getAppLockCookieName, getAppPassword, getAppSessionSecret } from "@/lib/appLock";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/pitch/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export async function proxy(request: NextRequest) {
  const configuredPassword = getAppPassword();
  if (!configuredPassword || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const expectedToken = await createAppLockToken(configuredPassword, getAppSessionSecret());
  const cookieToken = request.cookies.get(getAppLockCookieName())?.value;
  if (cookieToken === expectedToken) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
