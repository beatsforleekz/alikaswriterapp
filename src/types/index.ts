export const SONG_STATUSES = [
  "Started",
  "Written",
  "Bounce In",
  "Assets Filed",
  "Pitched",
  "On Hold",
  "Cut",
  "Approved",
  "Released",
  "Disputed",
  "Registered",
  "Complete",
] as const;

export type SongStatus = (typeof SONG_STATUSES)[number];
export type EvidenceStrength = "Weak" | "Partial" | "Strong" | "Complete";

export interface Session {
  id: string;
  date: string;
  title: string;
  location: string;
  source: "calendar" | "calendar_import" | "manual";
  calendar_event_id?: string;
  attendeeWriterIds: string[];
  songIds: string[];
  archive_reviewed?: boolean;
  archive_review_notes?: string;
  evidence_strength?: EvidenceStrength;
}

export interface SongWork {
  id: string;
  title: string;
  sessionId: string;
  status: SongStatus;
  writerIds: string[];
  bounceLink?: string;
  lyricsLink?: string;
  notes?: string;
}

export interface Writer {
  id: string;
  name: string;
  pro?: string;
  publisher?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface SongWriterSplit {
  id: string;
  songId: string;
  writerId: string;
  percentage?: number;
  role?: string;
}

export interface AssetLink {
  id: string;
  songId: string;
  type:
    | "bounce"
    | "lyrics"
    | "voice_note"
    | "google_doc"
    | "apple_note"
    | "instrumental"
    | "acapella"
    | "dropbox"
    | "message_evidence"
    | "screenshots"
    | "session_file"
    | "other";
  url?: string;
  reference?: string;
}

export interface PitchRecord {
  id: string;
  songId: string;
  isPitched: boolean;
  onHold: boolean;
  details?: string;
}

export interface CutRecord {
  id: string;
  songId: string;
  artist?: string;
  releaseTitle?: string;
  releaseDate?: string;
  label?: string;
  distributor?: string;
  isrc?: string;
  dspLinks?: string[];
  chartStreamNotes?: string;
  disputeStatus?: string;
  registrationStatus?: string;
  royaltyAdminNotes?: string;
}

export interface ContractRecord {
  id: string;
  songId: string;
  hasContract: boolean;
  splitConfirmed: boolean;
  pointsNotes?: string;
  masterDealNotes?: string;
}

export interface ActionItem {
  id: string;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
  sessionId?: string;
  songId?: string;
  task: string;
  status: "Open" | "In Progress" | "Done";
  notes?: string;
}
