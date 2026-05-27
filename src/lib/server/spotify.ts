let tokenCache: { accessToken: string; expiresAt: number } | null = null;

function required(name: "SPOTIFY_CLIENT_ID" | "SPOTIFY_CLIENT_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function getSpotifyAccessToken() {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 15_000) return tokenCache.accessToken;

  const clientId = required("SPOTIFY_CLIENT_ID");
  const clientSecret = required("SPOTIFY_CLIENT_SECRET");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Spotify token request failed (${response.status}): ${detail}`);
  }

  const json = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: now + Math.max(30, json.expires_in - 30) * 1000,
  };
  return tokenCache.accessToken;
}

export function parseSpotifyTrackId(input: string) {
  const value = input.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!url.hostname.includes("spotify.com")) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("track");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return "";
  } catch {
    return /^[A-Za-z0-9]{22}$/.test(value) ? value : "";
  }
}

export type SpotifyTrackSummary = {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  releaseDate: string;
  listenLink: string;
  platform: "Spotify";
  isrc: string;
};

export function mapSpotifyTrack(track: Record<string, unknown>): SpotifyTrackSummary {
  const artists = ((track.artists as Array<{ name?: string }> | undefined) ?? []).map((a) => a?.name || "").filter(Boolean);
  const album = (track.album as { name?: string; release_date?: string; images?: Array<{ url?: string }> } | undefined) ?? {};
  const externalIds = (track.external_ids as { isrc?: string } | undefined) ?? {};
  return {
    trackId: String(track.id ?? ""),
    title: String(track.name ?? ""),
    artist: artists.join(", "),
    album: String(album.name ?? ""),
    artwork: String(album.images?.[0]?.url ?? ""),
    releaseDate: String(album.release_date ?? ""),
    listenLink: String((track.external_urls as { spotify?: string } | undefined)?.spotify ?? ""),
    platform: "Spotify",
    isrc: String(externalIds.isrc ?? ""),
  };
}
