import { NextRequest, NextResponse } from "next/server";
import { createAppLockToken, getAppLockCookieName, getAppPassword, getAppSessionSecret } from "@/lib/appLock";

export async function POST(req: NextRequest) {
  const configuredPassword = getAppPassword();
  if (!configuredPassword) {
    return NextResponse.json({ ok: true, unlocked: true });
  }

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const submittedPassword = String(body?.password || "");

  if (!submittedPassword || submittedPassword !== configuredPassword) {
    return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
  }

  const token = await createAppLockToken(configuredPassword, getAppSessionSecret());
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getAppLockCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
