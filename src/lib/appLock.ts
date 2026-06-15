const APP_LOCK_COOKIE = "app_lock";

function encoder() {
  return new TextEncoder();
}

export async function createAppLockToken(password: string, secret: string) {
  const input = encoder().encode(`${password}|${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getAppPassword() {
  return process.env.APP_PASSWORD || "";
}

export function getAppSessionSecret() {
  return process.env.APP_SESSION_SECRET || "alika-writing-app-lock";
}

export function getAppLockCookieName() {
  return APP_LOCK_COOKIE;
}
