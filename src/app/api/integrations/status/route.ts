import { NextResponse } from "next/server";

export async function GET() {
  const supabaseReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const spotifyReady = Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
  return NextResponse.json({
    supabase: supabaseReady ? "connected" : "missing_env",
    spotify: spotifyReady ? "connected" : "missing_env",
    googleCalendar: "embed_only",
    dropbox: "future",
    googleDrive: "future",
  });
}
