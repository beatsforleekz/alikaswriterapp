import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken, mapSpotifyTrack, parseSpotifyTrackId } from "@/lib/server/spotify";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") || req.nextUrl.searchParams.get("id") || "";
  const trackId = parseSpotifyTrackId(raw);
  if (!trackId) return NextResponse.json({ error: "Invalid Spotify track URL or ID" }, { status: 400 });

  try {
    const token = await getSpotifyAccessToken();
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `Spotify track lookup failed (${res.status})`, detail }, { status: 502 });
    }
    const json = (await res.json()) as Record<string, unknown>;
    return NextResponse.json({ item: mapSpotifyTrack(json) });
  } catch (error) {
    return NextResponse.json({ error: "Spotify lookup unavailable", detail: String(error) }, { status: 500 });
  }
}
