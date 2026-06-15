"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { supabase } from "@/lib/supabase";
import { mapAction, mapSession, mapSong } from "@/lib/mappers";
import { ActionItem, Session, SongWork } from "@/types";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import { songReadiness } from "@/lib/evidence";

type AssetRef = { song_id: string; type: string; url?: string | null };
type SplitRef = { song_id: string; writer_name: string; percentage?: number | null };
type SongTagRef = { song_id: string; tag_name: string };
type PlaylistRow = { id: string; title: string; recipient_name?: string | null; recipient_company?: string | null; expires_at?: string | null; is_active?: boolean | null };
type PlaylistView = { playlist_id: string; created_at: string };
type PlaylistEvent = { playlist_id: string; event_type: "view" | "play" | "finish" };
type PlaylistResponse = { playlist_id: string; response_type: "interested" | "hold" | "pass" | "feedback"; sender_name?: string | null; created_at: string };
type CutRow = { id: string; song_id: string; artist?: string | null; release_title?: string | null; release_date?: string | null; isrc?: string | null; chart_stream_notes?: string | null; dispute_status?: string | null };

type ReportMeta = {
  date?: string;
  status?: string;
  evidenceStrength?: string;
  reviewed?: string;
  writers?: string[];
  tags?: string[];
  missing?: string[];
  cutStatus?: string;
  pitchReadiness?: string;
  playlistResponseStatus?: string;
};

type ReportRow = {
  id: string;
  title: string;
  date?: string;
  related?: string;
  status?: string;
  evidence?: string;
  missing?: string;
  notes?: string;
  link?: string;
  meta: ReportMeta;
};

type ReportConfig = {
  id: string;
  title: string;
  description: string;
  group: "Catalogue" | "Archive" | "Pitch" | "Cuts";
  columns: Array<{ key: keyof ReportRow; label: string }>;
  rows: ReportRow[];
};

const ACHV_PREFIX = "ACHV1:";

function normalizeEvidenceType(raw: string) {
  const t = raw.toLowerCase().trim();
  if (["lyrics", "lyric", "song lyrics", "song_lyrics"].includes(t)) return "lyrics";
  if (["bounce", "bounce in", "bounce_in"].includes(t)) return "bounce";
  return t;
}

function csvSafe(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

function parseAchievements(raw: string | null | undefined) {
  const input = String(raw || "").trim();
  if (!input) return [] as Array<{ type: string; title?: string; notes?: string; date?: string; evidenceLink?: string }>;
  if (input.startsWith(ACHV_PREFIX)) {
    try {
      const parsed = JSON.parse(input.slice(ACHV_PREFIX.length)) as { achievements?: Array<{ type: string; title?: string; notes?: string; date?: string; evidenceLink?: string }> };
      return Array.isArray(parsed.achievements) ? parsed.achievements : [];
    } catch {
      return [];
    }
  }
  return [{ type: "Legacy Achievement", notes: input }];
}

export default function ReportsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [songs, setSongs] = useState<SongWork[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [assets, setAssets] = useState<AssetRef[]>([]);
  const [splits, setSplits] = useState<SplitRef[]>([]);
  const [tags, setTags] = useState<SongTagRef[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [playlistViews, setPlaylistViews] = useState<PlaylistView[]>([]);
  const [playlistEvents, setPlaylistEvents] = useState<PlaylistEvent[]>([]);
  const [playlistResponses, setPlaylistResponses] = useState<PlaylistResponse[]>([]);
  const [cuts, setCuts] = useState<CutRow[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeReportId, setActiveReportId] = useState("all-songs");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [reviewedFilter, setReviewedFilter] = useState("all");
  const [writerFilter, setWriterFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [missingFilter, setMissingFilter] = useState("all");
  const [cutStatusFilter, setCutStatusFilter] = useState("all");
  const [pitchReadinessFilter, setPitchReadinessFilter] = useState("all");
  const [playlistResponseFilter, setPlaylistResponseFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const [sessionRes, songRes, actionRes, assetRes, splitRes, tagRes, playlistRes, viewRes, eventRes, responseRes, cutRes] = await Promise.all([
        supabase.from("sessions").select("*").order("date", { ascending: false }),
        supabase.from("song_works").select("*").order("created_at", { ascending: false }),
        supabase.from("action_items").select("*").order("due_date", { ascending: true }),
        supabase.from("asset_links").select("song_id,type,url"),
        supabase.from("song_writer_splits").select("song_id,percentage,writers(name)"),
        supabase.from("song_work_tags").select("song_id,song_tags(name)"),
        supabase.from("pitch_playlists").select("id,title,recipient_name,recipient_company,expires_at,is_active").order("created_at", { ascending: false }),
        supabase.from("pitch_playlist_views").select("playlist_id,created_at"),
        supabase.from("pitch_playlist_events").select("playlist_id,event_type"),
        supabase.from("pitch_playlist_responses").select("playlist_id,response_type,sender_name,created_at").order("created_at", { ascending: false }),
        supabase.from("cut_records").select("id,song_id,artist,release_title,release_date,isrc,chart_stream_notes,dispute_status").order("release_date", { ascending: false }),
      ]);
      const error = sessionRes.error || songRes.error || actionRes.error || assetRes.error || splitRes.error || tagRes.error || playlistRes.error || viewRes.error || eventRes.error || responseRes.error || cutRes.error;
      if (error) {
        logSupabaseError("Failed to load reports data", error);
        setErrorMsg(supabaseUserMessage("Could not load reports", error));
        return;
      }
      setSessions((sessionRes.data ?? []).map((row) => mapSession(row as Record<string, unknown>)));
      setSongs((songRes.data ?? []).map((row) => mapSong(row as Record<string, unknown>)));
      setActions((actionRes.data ?? []).map((row) => mapAction(row as Record<string, unknown>)));
      setAssets((assetRes.data ?? []) as AssetRef[]);
      setSplits((splitRes.data ?? []).map((row) => {
        const r = row as { song_id: string; percentage?: number | null; writers?: { name?: string } | null };
        return { song_id: String(r.song_id), writer_name: String(r.writers?.name ?? ""), percentage: r.percentage ?? null };
      }));
      setTags((tagRes.data ?? []).map((row) => {
        const r = row as { song_id: string; song_tags?: { name?: string } | null };
        return { song_id: String(r.song_id), tag_name: String(r.song_tags?.name ?? "") };
      }));
      setPlaylists((playlistRes.data ?? []) as PlaylistRow[]);
      setPlaylistViews((viewRes.data ?? []) as PlaylistView[]);
      setPlaylistEvents((eventRes.data ?? []) as PlaylistEvent[]);
      setPlaylistResponses((responseRes.data ?? []) as PlaylistResponse[]);
      setCuts((cutRes.data ?? []) as CutRow[]);
    };
    load();
  }, []);

  const sessionById = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);
  const songById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const tagsBySong = useMemo(() => {
    const map = new Map<string, string[]>();
    tags.forEach((tag) => {
      map.set(tag.song_id, [...(map.get(tag.song_id) || []), tag.tag_name]);
    });
    return map;
  }, [tags]);
  const splitsBySong = useMemo(() => {
    const map = new Map<string, SplitRef[]>();
    splits.forEach((split) => {
      map.set(split.song_id, [...(map.get(split.song_id) || []), split]);
    });
    return map;
  }, [splits]);
  const assetsBySong = useMemo(() => {
    const map = new Map<string, AssetRef[]>();
    assets.forEach((asset) => {
      map.set(asset.song_id, [...(map.get(asset.song_id) || []), asset]);
    });
    return map;
  }, [assets]);

  const allWriterNames = useMemo(() => [...new Set(splits.map((split) => split.writer_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [splits]);
  const allTagNames = useMemo(() => [...new Set(tags.map((tag) => tag.tag_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [tags]);

  const songFacts = useMemo(() => {
    return songs.map((song) => {
      const songAssets = assetsBySong.get(song.id) || [];
      const songSplits = splitsBySong.get(song.id) || [];
      const songTags = tagsBySong.get(song.id) || [];
      const parentSession = song.sessionId ? sessionById.get(song.sessionId) : undefined;
      const hasType = (type: string) => songAssets.some((asset) => normalizeEvidenceType(asset.type) === type && Boolean(asset.url));
      const hasBounce = Boolean(song.bounceLink?.trim()) || hasType("bounce");
      const hasLyrics = Boolean(song.lyricsLink?.trim()) || hasType("lyrics");
      const hasAcapella = songAssets.some((asset) => normalizeEvidenceType(asset.type) === "acapella" && Boolean(asset.url));
      const hasPitchAudio = Boolean(song.audioStoragePath);
      const splitTotal = songSplits.reduce((sum, split) => sum + Number(split.percentage ?? 0), 0);
      const missing = [
        !hasBounce ? "No Bounce" : "",
        !hasLyrics ? "No Lyrics" : "",
        !hasAcapella ? "No Acapella" : "",
        !hasPitchAudio ? "No Audio / Pitch Audio" : "",
        !songSplits.length ? "Missing Writers/Splits" : "",
        songSplits.length && Math.round(splitTotal * 100) / 100 !== 100 ? "Missing Writers/Splits" : "",
      ].filter(Boolean);
      const songActions = actions.filter((action) => action.songId === song.id || action.sessionId === song.sessionId);
      const pitchReadiness = songReadiness(
        { id: song.id, title: song.title, bounce_link: song.bounceLink, lyrics_link: song.lyricsLink },
        songAssets.map((asset) => ({ song_id: asset.song_id, type: asset.type, url: asset.url })),
        songSplits.map((split) => ({ song_id: split.song_id, percentage: split.percentage })),
        songActions.map((action) => ({ status: action.status, song_id: action.songId, session_id: action.sessionId })),
      );
      return {
        song,
        parentSession,
        tags: songTags,
        writerNames: [...new Set(songSplits.map((split) => split.writer_name).filter(Boolean))],
        missing,
        hasBounce,
        hasLyrics,
        hasAcapella,
        hasPitchAudio,
        pitchReadiness,
      };
    });
  }, [songs, assetsBySong, splitsBySong, tagsBySong, sessionById, actions]);

  const reports = useMemo(() => {
    const playlistViewsById: Record<string, number> = {};
    playlistViews.forEach((row) => { playlistViewsById[row.playlist_id] = (playlistViewsById[row.playlist_id] || 0) + 1; });
    const playlistPlaysById: Record<string, number> = {};
    playlistEvents.forEach((row) => { if (row.event_type === "play") playlistPlaysById[row.playlist_id] = (playlistPlaysById[row.playlist_id] || 0) + 1; });
    const playlistResponsesById: Record<string, PlaylistResponse[]> = {};
    playlistResponses.forEach((row) => {
      playlistResponsesById[row.playlist_id] = [...(playlistResponsesById[row.playlist_id] || []), row];
    });

    const allSongsRows: ReportRow[] = songFacts.map((fact) => ({
      id: fact.song.id,
      title: fact.song.title || "Untitled Song",
      date: fact.parentSession?.date || "",
      related: fact.writerNames.join(", "),
      status: fact.song.status,
      evidence: fact.parentSession?.evidence_strength || "",
      missing: fact.missing.join(", "),
      notes: fact.tags.join(", "),
      link: `/songs/${fact.song.id}`,
      meta: {
        date: fact.parentSession?.date || "",
        status: fact.song.status,
        evidenceStrength: fact.parentSession?.evidence_strength || "",
        reviewed: fact.parentSession?.archive_reviewed ? "reviewed" : "unreviewed",
        writers: fact.writerNames,
        tags: fact.tags,
        missing: fact.missing,
        pitchReadiness: fact.pitchReadiness,
      },
    }));

    const allSessionsRows: ReportRow[] = sessions.map((session) => ({
      id: session.id,
      title: session.title || "Untitled Session",
      date: session.date,
      related: session.location || "",
      status: session.source,
      evidence: session.evidence_strength || "",
      missing: songFacts.filter((fact) => fact.song.sessionId === session.id).flatMap((fact) => fact.missing).filter((value, index, arr) => arr.indexOf(value) === index).join(", "),
      notes: session.archive_review_notes || "",
      link: `/sessions/${session.id}`,
      meta: {
        date: session.date,
        status: session.source,
        evidenceStrength: session.evidence_strength || "",
        reviewed: session.archive_reviewed ? "reviewed" : "unreviewed",
        missing: songFacts.filter((fact) => fact.song.sessionId === session.id).flatMap((fact) => fact.missing),
      },
    }));

    const archiveReviewRows = allSessionsRows.map((row) => ({
      ...row,
      status: row.meta.reviewed === "reviewed" ? "Reviewed" : "Unreviewed",
    }));

    const evidenceGapRows = allSongsRows.filter((row) => row.meta.missing && row.meta.missing.length > 0);

    const actionRows: ReportRow[] = actions.map((action) => {
      const parentSong = action.songId ? songById.get(action.songId) : undefined;
      const parentSession = action.sessionId ? sessionById.get(action.sessionId) : undefined;
      return {
        id: action.id,
        title: action.task || "Untitled Action",
        date: action.dueDate || "",
        related: parentSong?.title || parentSession?.title || "",
        status: action.status,
        evidence: parentSession?.evidence_strength || "",
        missing: action.priority,
        notes: action.notes || "",
        link: action.songId ? `/songs/${action.songId}` : action.sessionId ? `/sessions/${action.sessionId}` : "/actions",
        meta: {
          date: action.dueDate || "",
          status: action.status,
          evidenceStrength: parentSession?.evidence_strength || "",
          reviewed: parentSession?.archive_reviewed ? "reviewed" : parentSession ? "unreviewed" : "all",
        },
      };
    });

    const playlistRows: ReportRow[] = playlists.map((playlist) => {
      const responses = playlistResponsesById[playlist.id] || [];
      const latestResponse = responses[0]?.response_type || "";
      return {
        id: playlist.id,
        title: playlist.title,
        date: playlist.expires_at || "",
        related: [playlist.recipient_name, playlist.recipient_company].filter(Boolean).join(" / "),
        status: playlist.is_active ? "Active" : "Inactive",
        evidence: String(playlistViewsById[playlist.id] || 0),
        missing: String(playlistPlaysById[playlist.id] || 0),
        notes: latestResponse || "",
        link: `/playlists/${playlist.id}`,
        meta: {
          date: playlist.expires_at || "",
          status: playlist.is_active ? "Active" : "Inactive",
          playlistResponseStatus: latestResponse || "none",
        },
      };
    });

    const cutsRows: ReportRow[] = cuts.map((cut) => {
      const song = songById.get(cut.song_id);
      return {
        id: cut.id,
        title: cut.release_title || song?.title || "Untitled Cut",
        date: cut.release_date || "",
        related: cut.artist || song?.title || "",
        status: song?.status || "Cut",
        evidence: cut.isrc || "",
        missing: cut.dispute_status || "",
        notes: `${parseAchievements(cut.chart_stream_notes).length} achievements`,
        link: `/cuts/${cut.id}`,
        meta: {
          date: cut.release_date || "",
          status: song?.status || "Cut",
          cutStatus: song?.status || "Cut",
        },
      };
    });

    const cutAchievementRows: ReportRow[] = cuts.flatMap((cut) => {
      const song = songById.get(cut.song_id);
      return parseAchievements(cut.chart_stream_notes).map((achievement, index) => ({
        id: `${cut.id}-${index}`,
        title: achievement.title || achievement.type || "Achievement",
        date: achievement.date || cut.release_date || "",
        related: cut.artist || song?.title || "",
        status: achievement.type || "",
        evidence: cut.release_title || song?.title || "",
        missing: "",
        notes: [achievement.notes, achievement.evidenceLink].filter(Boolean).join(" | "),
        link: `/cuts/${cut.id}`,
        meta: {
          date: achievement.date || cut.release_date || "",
          status: achievement.type || "",
          cutStatus: song?.status || "Cut",
        },
      }));
    });

    const writerSummaryRows: ReportRow[] = allWriterNames.map((writer) => {
      const writerSplits = splits.filter((split) => split.writer_name === writer);
      const songIds = [...new Set(writerSplits.map((split) => split.song_id))];
      return {
        id: writer,
        title: writer,
        date: "",
        related: `${songIds.length} songs`,
        status: "",
        evidence: "",
        missing: "",
        notes: writerSplits.map((split) => `${songById.get(split.song_id)?.title || "Song"}: ${split.percentage ?? "auto"}%`).join(" | "),
        link: "/songs",
        meta: {
          writers: [writer],
        },
      };
    });

    const reportList: ReportConfig[] = [
      { id: "all-songs", title: "All Songs / Works", description: "Full catalogue export with tags, writers, evidence and readiness context.", group: "Catalogue", columns: [{ key: "title", label: "Title" }, { key: "date", label: "Session Date" }, { key: "related", label: "Writers" }, { key: "status", label: "Status" }, { key: "evidence", label: "Evidence" }, { key: "missing", label: "Missing" }, { key: "notes", label: "Tags" }], rows: allSongsRows },
      { id: "all-sessions", title: "All Sessions", description: "Diary-level session export with review and evidence context.", group: "Catalogue", columns: [{ key: "title", label: "Title" }, { key: "date", label: "Date" }, { key: "related", label: "Location" }, { key: "status", label: "Source" }, { key: "evidence", label: "Evidence Strength" }, { key: "missing", label: "Missing" }], rows: allSessionsRows },
      { id: "archive-review-summary", title: "Archive Review Summary", description: "Reviewed vs unreviewed archive state for session-by-session follow-up.", group: "Archive", columns: [{ key: "title", label: "Session" }, { key: "date", label: "Date" }, { key: "status", label: "Review Status" }, { key: "evidence", label: "Evidence Strength" }, { key: "missing", label: "Missing" }, { key: "notes", label: "Notes" }], rows: archiveReviewRows },
      { id: "evidence-gaps", title: "Evidence Gaps", description: "Missing-asset view across songs and sessions.", group: "Archive", columns: [{ key: "title", label: "Song / Work" }, { key: "date", label: "Session Date" }, { key: "related", label: "Writers" }, { key: "status", label: "Status" }, { key: "missing", label: "Missing" }, { key: "notes", label: "Tags" }], rows: evidenceGapRows },
      { id: "actions-followups", title: "Actions / Follow-ups", description: "Open and completed admin follow-ups in one export.", group: "Archive", columns: [{ key: "title", label: "Task" }, { key: "date", label: "Due Date" }, { key: "related", label: "Linked To" }, { key: "status", label: "Status" }, { key: "missing", label: "Priority" }, { key: "notes", label: "Notes" }], rows: actionRows },
      { id: "playlist-pitch-activity", title: "Playlist Pitch Activity", description: "Views, plays, responses and expiry overview for pitch playlists.", group: "Pitch", columns: [{ key: "title", label: "Playlist" }, { key: "related", label: "Recipient" }, { key: "status", label: "Status" }, { key: "evidence", label: "Views" }, { key: "missing", label: "Plays" }, { key: "notes", label: "Latest Response" }], rows: playlistRows },
      { id: "cuts-releases", title: "Cuts / Releases", description: "Commercial cut records with release context and linked catalogue data.", group: "Cuts", columns: [{ key: "title", label: "Release" }, { key: "date", label: "Release Date" }, { key: "related", label: "Artist / Linked Song" }, { key: "status", label: "Cut Status" }, { key: "evidence", label: "ISRC" }, { key: "notes", label: "Achievements" }], rows: cutsRows },
      { id: "cut-achievements", title: "Cut Achievements", description: "Achievement-level export across charts, playlists, syncs and milestones.", group: "Cuts", columns: [{ key: "title", label: "Achievement" }, { key: "date", label: "Date" }, { key: "related", label: "Artist / Song" }, { key: "status", label: "Type" }, { key: "evidence", label: "Release" }, { key: "notes", label: "Details" }], rows: cutAchievementRows },
      { id: "writer-split-summary", title: "Writer / Split Summary", description: "Reusable summary of writer coverage across the catalogue.", group: "Catalogue", columns: [{ key: "title", label: "Writer" }, { key: "related", label: "Songs" }, { key: "notes", label: "Split Summary" }], rows: writerSummaryRows },
      { id: "no-bounce", title: "No Bounce", description: "Songs missing bounce evidence.", group: "Archive", columns: [{ key: "title", label: "Song / Work" }, { key: "date", label: "Session Date" }, { key: "related", label: "Writers" }, { key: "status", label: "Status" }, { key: "missing", label: "Missing" }], rows: allSongsRows.filter((row) => row.meta.missing?.includes("No Bounce")) },
      { id: "no-acapella", title: "No Acapella", description: "Songs missing acapella evidence.", group: "Archive", columns: [{ key: "title", label: "Song / Work" }, { key: "date", label: "Session Date" }, { key: "related", label: "Writers" }, { key: "status", label: "Status" }, { key: "missing", label: "Missing" }], rows: allSongsRows.filter((row) => row.meta.missing?.includes("No Acapella")) },
      { id: "no-lyrics", title: "No Lyrics", description: "Songs missing lyrics evidence.", group: "Archive", columns: [{ key: "title", label: "Song / Work" }, { key: "date", label: "Session Date" }, { key: "related", label: "Writers" }, { key: "status", label: "Status" }, { key: "missing", label: "Missing" }], rows: allSongsRows.filter((row) => row.meta.missing?.includes("No Lyrics")) },
      { id: "no-audio", title: "No Audio / Pitch Audio", description: "Songs without pitch playback copies.", group: "Archive", columns: [{ key: "title", label: "Song / Work" }, { key: "date", label: "Session Date" }, { key: "related", label: "Writers" }, { key: "status", label: "Status" }, { key: "missing", label: "Missing" }], rows: allSongsRows.filter((row) => row.meta.missing?.includes("No Audio / Pitch Audio")) },
      { id: "weak-partial-evidence", title: "Weak / Partial Evidence", description: "Sessions or songs needing stronger archive support.", group: "Archive", columns: [{ key: "title", label: "Title" }, { key: "date", label: "Date" }, { key: "status", label: "Status" }, { key: "evidence", label: "Evidence Strength" }, { key: "missing", label: "Missing" }], rows: [...allSongsRows.filter((row) => ["Weak", "Partial"].includes(row.meta.evidenceStrength || "")), ...archiveReviewRows.filter((row) => ["Weak", "Partial"].includes(row.meta.evidenceStrength || ""))] },
      { id: "missing-writers-splits", title: "Missing Writers / Splits", description: "Songs missing writer coverage or incomplete split totals.", group: "Archive", columns: [{ key: "title", label: "Song / Work" }, { key: "date", label: "Session Date" }, { key: "status", label: "Status" }, { key: "missing", label: "Missing" }, { key: "notes", label: "Tags" }], rows: allSongsRows.filter((row) => row.meta.missing?.includes("Missing Writers/Splits")) },
      { id: "unreviewed-sessions", title: "Unreviewed Sessions", description: "Sessions still needing archive review.", group: "Archive", columns: [{ key: "title", label: "Session" }, { key: "date", label: "Date" }, { key: "related", label: "Location" }, { key: "evidence", label: "Evidence Strength" }, { key: "missing", label: "Missing" }], rows: archiveReviewRows.filter((row) => row.meta.reviewed === "unreviewed") },
      { id: "open-followups", title: "Open Follow-ups", description: "Only active follow-up actions requiring attention.", group: "Archive", columns: [{ key: "title", label: "Task" }, { key: "date", label: "Due Date" }, { key: "related", label: "Linked To" }, { key: "status", label: "Status" }, { key: "missing", label: "Priority" }], rows: actionRows.filter((row) => row.status !== "Done") },
    ];
    return reportList;
  }, [actions, allWriterNames, cuts, playlistEvents, playlistResponses, playlistViews, playlists, sessionById, sessions, songById, songFacts, splits]);

  const reportGroups = useMemo(() => {
    return ["Catalogue", "Archive", "Pitch", "Cuts"].map((group) => ({
      group,
      reports: reports.filter((report) => report.group === group),
    }));
  }, [reports]);

  const activeReport = reports.find((report) => report.id === activeReportId) || reports[0];

  const filteredRows = useMemo(() => {
    if (!activeReport) return [];
    return activeReport.rows.filter((row) => {
      if (startDate && row.meta.date && row.meta.date < startDate) return false;
      if (endDate && row.meta.date && row.meta.date > endDate) return false;
      if (statusFilter !== "all" && String(row.meta.status || "") !== statusFilter) return false;
      if (evidenceFilter !== "all" && String(row.meta.evidenceStrength || "") !== evidenceFilter) return false;
      if (reviewedFilter !== "all" && String(row.meta.reviewed || "all") !== reviewedFilter) return false;
      if (writerFilter !== "all" && !(row.meta.writers || []).includes(writerFilter)) return false;
      if (tagFilter !== "all" && !(row.meta.tags || []).includes(tagFilter)) return false;
      if (missingFilter !== "all" && !(row.meta.missing || []).includes(missingFilter)) return false;
      if (cutStatusFilter !== "all" && String(row.meta.cutStatus || "") !== cutStatusFilter) return false;
      if (pitchReadinessFilter !== "all" && String(row.meta.pitchReadiness || "") !== pitchReadinessFilter) return false;
      if (playlistResponseFilter !== "all" && String(row.meta.playlistResponseStatus || "") !== playlistResponseFilter) return false;
      return true;
    });
  }, [activeReport, startDate, endDate, statusFilter, evidenceFilter, reviewedFilter, writerFilter, tagFilter, missingFilter, cutStatusFilter, pitchReadinessFilter, playlistResponseFilter]);

  const allStatuses = useMemo(() => [...new Set(reports.flatMap((report) => report.rows.map((row) => row.meta.status || "").filter(Boolean)))].sort((a, b) => a.localeCompare(b)), [reports]);
  const allEvidenceStrengths = ["Weak", "Partial", "Strong", "Complete"];
  const allMissingTypes = ["No Bounce", "No Acapella", "No Lyrics", "No Audio / Pitch Audio", "Missing Writers/Splits"];
  const allCutStatuses = ["Cut", "Released", "Approved", "Disputed"];
  const allPitchReadiness = ["Ready to Pitch", "Needs Bounce", "Needs Lyrics", "Needs Writers/Splits", "Needs Follow-up"];
  const allPlaylistResponses = ["interested", "hold", "pass", "feedback", "none"];

  const exportCsv = () => {
    if (!activeReport) return;
    const header = activeReport.columns.map((column) => column.label);
    const lines = [header.map(csvSafe).join(",")];
    filteredRows.forEach((row) => {
      lines.push(activeReport.columns.map((column) => csvSafe(String(row[column.key] || ""))).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeReport.id}_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Central export hub for archive, catalogue, evidence, playlist, and cuts reporting."
        actions={<div className="rowActions"><button className="button" onClick={exportCsv}>Export CSV</button><button className="button" onClick={() => window.print()}>Print / Save PDF</button></div>}
      />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}
      <p className="helper noPrint" style={{ marginBottom: ".8rem" }}>PDF export uses browser print/save-to-PDF for now.</p>

      {reportGroups.map(({ group, reports: groupedReports }) => (
        <SectionCard key={group} title={group} actions={<span className="helper">{groupedReports.length} reports</span>}>
          <div className="grid cards">
            {groupedReports.map((report) => (
              <button
                key={report.id}
                type="button"
                className={`reportCardButton ${activeReportId === report.id ? "active" : ""}`}
                onClick={() => setActiveReportId(report.id)}
              >
                <strong>{report.title}</strong>
                <p className="helper" style={{ marginTop: ".35rem" }}>{report.description}</p>
                <div className="rowActions compact" style={{ marginTop: ".55rem" }}>
                  <span className="statusBadge">{report.rows.length} rows</span>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>
      ))}

      <SectionCard title={activeReport?.title || "Report"} actions={<span className="helper">{filteredRows.length} row preview</span>}>
        {activeReport ? <p className="helper" style={{ marginBottom: ".7rem" }}>{activeReport.description}</p> : null}
        <div className="sessionFilterBar noPrint">
          <div className="sessionFilterTop">
            <div>
              <p className="sessionFilterTitle">Report Filters</p>
              <p className="helper">Use only what you need. Everything exports from here.</p>
            </div>
            <button
              className="button compact"
              type="button"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setStatusFilter("all");
                setEvidenceFilter("all");
                setReviewedFilter("all");
                setWriterFilter("all");
                setTagFilter("all");
                setMissingFilter("all");
                setCutStatusFilter("all");
                setPitchReadinessFilter("all");
                setPlaylistResponseFilter("all");
              }}
            >
              Clear Filters
            </button>
          </div>
          <div className="sessionFilterGrid">
            <label className="sessionFilterField">
              <span>From</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="sessionFilterField">
              <span>To</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="sessionFilterField">
              <span>Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                {allStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="sessionFilterField">
              <span>Evidence Strength</span>
              <select value={evidenceFilter} onChange={(e) => setEvidenceFilter(e.target.value)}>
                <option value="all">All</option>
                {allEvidenceStrengths.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="sessionFilterField">
              <span>Reviewed</span>
              <select value={reviewedFilter} onChange={(e) => setReviewedFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="reviewed">Reviewed</option>
                <option value="unreviewed">Unreviewed</option>
              </select>
            </label>
            <label className="sessionFilterField">
              <span>Writer</span>
              <select value={writerFilter} onChange={(e) => setWriterFilter(e.target.value)}>
                <option value="all">All Writers</option>
                {allWriterNames.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="sessionFilterField">
              <span>Tag</span>
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="all">All Tags</option>
                {allTagNames.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="sessionFilterField">
              <span>Missing Asset</span>
              <select value={missingFilter} onChange={(e) => setMissingFilter(e.target.value)}>
                <option value="all">All</option>
                {allMissingTypes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="sessionFilterField">
              <span>Cut Status</span>
              <select value={cutStatusFilter} onChange={(e) => setCutStatusFilter(e.target.value)}>
                <option value="all">All</option>
                {allCutStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="sessionFilterField">
              <span>Pitch Readiness</span>
              <select value={pitchReadinessFilter} onChange={(e) => setPitchReadinessFilter(e.target.value)}>
                <option value="all">All</option>
                {allPitchReadiness.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="sessionFilterField">
              <span>Playlist Response</span>
              <select value={playlistResponseFilter} onChange={(e) => setPlaylistResponseFilter(e.target.value)}>
                <option value="all">All</option>
                {allPlaylistResponses.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <EmptyState title="No rows for this report" hint="Adjust filters or choose another report." />
        ) : (
          <div className="tableWrap reportPrintArea">
            <table>
              <thead>
                <tr>
                  {activeReport.columns.map((column) => <th key={column.key}>{column.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    {activeReport.columns.map((column) => {
                      const cellValue = String(row[column.key] ?? "");
                      return (
                        <td key={`${row.id}-${column.key}`}>
                          {column.key === "title" && row.link ? <Link href={row.link}>{cellValue || ""}</Link> : (cellValue || <span className="helper">-</span>)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
