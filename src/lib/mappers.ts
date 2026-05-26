import { ActionItem, Session, SongWork } from "@/types";

export const mapSession = (r: Record<string, unknown>): Session => ({
  id: String(r.id ?? ""),
  date: String(r.date ?? ""),
  title: String(r.title ?? ""),
  location: String(r.location ?? ""),
  source: (String(r.source ?? "manual") as Session["source"]),
  calendar_event_id: r.calendar_event_id ? String(r.calendar_event_id) : undefined,
  attendeeWriterIds: [],
  songIds: [],
  archive_reviewed: Boolean(r.archive_reviewed),
  archive_review_notes: r.archive_review_notes ? String(r.archive_review_notes) : undefined,
  evidence_strength: r.evidence_strength ? String(r.evidence_strength) as Session["evidence_strength"] : undefined,
  apple_note_exists: Boolean(r.apple_note_exists),
  evidence_strength_override: Boolean(r.evidence_strength_override),
});

export const mapSong = (r: Record<string, unknown>): SongWork => ({
  id: String(r.id ?? ""),
  title: String(r.title ?? ""),
  sessionId: r.session_id ? String(r.session_id) : "",
  status: String(r.status ?? "Started") as SongWork["status"],
  writerIds: [],
  tags: [],
  bounceLink: r.bounce_link ? String(r.bounce_link) : undefined,
  lyricsLink: r.lyrics_link ? String(r.lyrics_link) : undefined,
  audioStoragePath: r.audio_storage_path ? String(r.audio_storage_path) : undefined,
  audioFileName: r.audio_file_name ? String(r.audio_file_name) : undefined,
  audioMimeType: r.audio_mime_type ? String(r.audio_mime_type) : undefined,
  audioUploadedAt: r.audio_uploaded_at ? String(r.audio_uploaded_at) : undefined,
  audioSourceNote: r.audio_source_note ? String(r.audio_source_note) : undefined,
  notes: r.notes ? String(r.notes) : undefined,
});

export const mapAction = (r: Record<string, unknown>): ActionItem => ({
  id: String(r.id ?? ""),
  dueDate: String(r.due_date ?? ""),
  priority: String(r.priority ?? "Medium") as ActionItem["priority"],
  sessionId: r.session_id ? String(r.session_id) : undefined,
  songId: r.song_id ? String(r.song_id) : undefined,
  task: String(r.task ?? ""),
  status: String(r.status ?? "Open") as ActionItem["status"],
  notes: r.notes ? String(r.notes) : undefined,
});
