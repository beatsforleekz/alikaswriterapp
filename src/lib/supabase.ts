import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Future auth/RLS work: keep this explicit so env misconfig fails clearly in dev.
  console.warn("Supabase env vars are missing: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const fallbackUrl = "https://placeholder.supabase.co";
const fallbackAnon = "placeholder-anon-key";

export const supabase = createClient(url || fallbackUrl, anon || fallbackAnon);
