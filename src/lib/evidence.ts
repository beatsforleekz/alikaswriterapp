export type EvidenceAsset = { id?: string; song_id: string; type: string; url?: string | null };
export type EvidenceSong = { id: string; title?: string | null; bounce_link?: string | null; lyrics_link?: string | null };
export type EvidenceSplit = { song_id: string; percentage?: number | null };
export type EvidenceAction = { session_id?: string | null; song_id?: string | null; status?: string | null };

export function normalizeEvidenceType(raw: string) {
  const t = String(raw || "").toLowerCase().trim();
  if (["lyrics", "lyric", "song lyrics", "song_lyrics"].includes(t)) return "lyrics";
  if (["bounce", "bounce in", "bounce_in"].includes(t)) return "bounce";
  return t;
}

export function evidenceTypeLabel(raw: string) {
  const n = normalizeEvidenceType(raw);
  if (n === "bounce") return "Bounce";
  if (n === "lyrics") return "Lyrics";
  if (n === "voice_note") return "Voice Note";
  if (n === "acapella") return "Acapella";
  if (n === "google_doc") return "Google Doc";
  if (n === "dropbox") return "Dropbox";
  if (n === "message_evidence") return "Email/Pitch Trail";
  if (n === "screenshots") return "Screenshots";
  if (n === "apple_note") return "Apple Note";
  if (n === "other") return "Other";
  return raw;
}

export function songHasBounce(song: EvidenceSong, assets: EvidenceAsset[]) {
  return Boolean(song.bounce_link) || assets.some((a) => String(a.song_id) === String(song.id) && normalizeEvidenceType(a.type) === "bounce" && Boolean(a.url));
}

export function songHasLyrics(song: EvidenceSong, assets: EvidenceAsset[]) {
  return Boolean(song.lyrics_link) || assets.some((a) => String(a.song_id) === String(song.id) && normalizeEvidenceType(a.type) === "lyrics" && Boolean(a.url));
}

export function summarizeMissingEvidence(songs: EvidenceSong[], assets: EvidenceAsset[]) {
  const total = songs.length;
  const missingBounce = songs.filter((s) => !songHasBounce(s, assets)).length;
  const missingLyrics = songs.filter((s) => !songHasLyrics(s, assets)).length;
  return { total, missingBounce, missingLyrics };
}

export function songReadiness(song: EvidenceSong, assets: EvidenceAsset[], songSplits: EvidenceSplit[], songActions: EvidenceAction[]) {
  const openStatuses = new Set(["open", "in progress", "pending", "todo"]);
  const hasOpenFollowUp = songActions.some((a) => openStatuses.has(String(a.status || "").toLowerCase().trim()));
  if (!songHasBounce(song, assets)) return "Needs Bounce" as const;
  if (!songHasLyrics(song, assets)) return "Needs Lyrics" as const;
  if (songSplits.length === 0) return "Needs Writers/Splits" as const;
  if (hasOpenFollowUp) return "Needs Follow-up" as const;
  return "Ready to Pitch" as const;
}
