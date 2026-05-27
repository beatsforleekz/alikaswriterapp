import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken, mapSpotifyTrack } from "@/lib/server/spotify";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) return NextResponse.json({ items: [] });

  try {
    const token = await getSpotifyAccessToken();
    const params = new URLSearchParams({ q, type: "track", limit: "8" });
    const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `Spotify search failed (${res.status})`, detail }, { status: 502 });
    }
    const json = (await res.json()) as { tracks?: { items?: Record<string, unknown>[] } };
    const items = (json.tracks?.items ?? []).map(mapSpotifyTrack);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: "Spotify search unavailable", detail: String(error) }, { status: 500 });
  }
}
