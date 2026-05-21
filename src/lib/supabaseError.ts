export function logSupabaseError(context: string, err: unknown) {
  const error = err as { message?: string; details?: string; hint?: string; code?: string } | null;
  console.error(context, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    raw: err,
  });
}

export function supabaseUserMessage(prefix: string, err: unknown) {
  const error = err as { message?: string; code?: string } | null;
  return `${prefix}: ${error?.message || error?.code || "unknown error"}`;
}
