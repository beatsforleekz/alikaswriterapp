"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

type SessionLite = {
  id: string;
  date: string;
  title: string;
  location: string;
  archive_reviewed?: boolean;
  archive_review_notes?: string;
  evidence_strength?: string;
  apple_note_exists?: boolean;
};
type SongLite = { id: string; session_id?: string | null; title: string; bounce_link?: string | null; lyrics_link?: string | null };
type AssetLite = { id: string; song_id: string; type: string; url?: string | null };
type SplitLite = { id: string; song_id: string; writer_id: string; writer_name: string; percentage?: number | null };
type WriterLite = { id: string; name: string };
type ActionLite = { id: string; session_id?: string | null; due_date?: string | null; task: string; status: string; created_at?: string | null };

type ReviewFilter = "needs-review" | "all";
const years = [2026, 2025, 2024, 2023, 2022, 2021];

function normalizeEvidenceType(raw: string) {
  const t = raw.toLowerCase().trim();
  if (["lyrics", "lyric", "song lyrics", "song_lyrics"].includes(t)) return "lyrics";
  if (["bounce", "bounce in", "bounce_in"].includes(t)) return "bounce";
  return t;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function calcEvidence(session: SessionLite | null, songs: SongLite[], assets: AssetLite[], splits: SplitLite[], actions: ActionLite[]) {
  const hasBounce = (song: SongLite) => Boolean(song.bounce_link) || assets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "bounce" && Boolean(a.url));
  const hasLyrics = (song: SongLite) => Boolean(song.lyrics_link) || assets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "lyrics" && Boolean(a.url));
  const totalSongs = songs.length;
  const bounceCount = songs.filter((s) => hasBounce(s)).length;
  const lyricsCount = songs.filter((s) => hasLyrics(s)).length;
  const allSongsHaveFullEvidence = totalSongs > 0 && songs.every((s) => hasBounce(s) && hasLyrics(s));
  const voiceNoteExists = assets.some((a) => normalizeEvidenceType(a.type || "") === "voice_note" && Boolean(a.url));
  const acapellaExists = assets.some((a) => normalizeEvidenceType(a.type || "") === "acapella" && Boolean(a.url));
  const googleDocExists = assets.some((a) => normalizeEvidenceType(a.type || "") === "google_doc" && Boolean(a.url));
  const dropboxExists = assets.some((a) => normalizeEvidenceType(a.type || "") === "dropbox" && Boolean(a.url));
  const appleNoteExists = Boolean(session?.apple_note_exists) || assets.some((a) => normalizeEvidenceType(a.type || "") === "apple_note" && Boolean(a.url));
  const emailTrailExists = assets.some((a) => ["message_evidence", "screenshots"].includes(normalizeEvidenceType(a.type || "")) && Boolean(a.url));
  const writersAdded = splits.length > 0;
  const splitsAdded = splits.some((s) => s.percentage !== null && s.percentage !== undefined);
  const attendeesAdded = writersAdded;
  const songTitlesLogged = totalSongs > 0;
  const followUpLogged = actions.length > 0;
  const sessionCore = Boolean(session?.date?.trim()) && Boolean(session?.title?.trim());

  let score = 0;
  if (sessionCore) score += 1;
  if (songTitlesLogged) score += 1;
  if (bounceCount > 0) score += 2;
  if (lyricsCount > 0) score += 2;
  if (voiceNoteExists) score += 1;
  if (acapellaExists) score += 1;
  if (appleNoteExists) score += 1;
  if (googleDocExists) score += 1;
  if (dropboxExists) score += 1;
  if (emailTrailExists) score += 1;
  if (writersAdded) score += 2;
  if (splitsAdded) score += 1;
  if (attendeesAdded) score += 1;
  if (followUpLogged) score += 1;

  let level = "Partial";
  if (bounceCount === 0 && lyricsCount === 0 && score <= 3) level = "Weak";
  else if ((bounceCount > 0 || lyricsCount > 0) && score < 9) level = "Partial";
  else if (bounceCount > 0 && lyricsCount > 0 && score >= 9 && score < 13) level = "Strong";
  else if (allSongsHaveFullEvidence && writersAdded && splitsAdded && (dropboxExists || googleDocExists || appleNoteExists || voiceNoteExists || acapellaExists) && (session?.archive_reviewed || followUpLogged)) level = "Complete";
  else level = score >= 9 ? "Strong" : "Partial";

  const blockers: string[] = [];
  if (!sessionCore) blockers.push("Missing session date/title");
  if (!songTitlesLogged) blockers.push("No linked songs/works");
  if (bounceCount < totalSongs) blockers.push(`Bounce missing on ${Math.max(totalSongs - bounceCount, 0)} song(s)`);
  if (lyricsCount < totalSongs) blockers.push(`Lyrics missing on ${Math.max(totalSongs - lyricsCount, 0)} song(s)`);
  if (!writersAdded) blockers.push("No writers/attendees added");
  if (!splitsAdded) blockers.push("No split percentages added");
  if (!(dropboxExists || googleDocExists || appleNoteExists || voiceNoteExists || acapellaExists || emailTrailExists)) blockers.push("No supporting evidence links");

  const contributors: string[] = [];
  if (sessionCore) contributors.push("Session core details present");
  if (songTitlesLogged) contributors.push("Songs/works linked");
  if (bounceCount > 0) contributors.push(`Bounce coverage ${bounceCount}/${totalSongs}`);
  if (lyricsCount > 0) contributors.push(`Lyrics coverage ${lyricsCount}/${totalSongs}`);
  if (writersAdded) contributors.push("Writers added");
  if (splitsAdded) contributors.push("Splits added");
  if (voiceNoteExists) contributors.push("Voice note evidence");
  if (acapellaExists) contributors.push("Acapella evidence (optional)");
  if (googleDocExists || dropboxExists || appleNoteExists) contributors.push("Admin/supporting links present");
  if (followUpLogged) contributors.push("Follow-up actions logged");

  return {
    level,
    score,
    totalSongs,
    bounceCount,
    lyricsCount,
    blockers,
    contributors,
  };
}

export default function ArchiveProgressPage() {
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [splits, setSplits] = useState<SplitLite[]>([]);
  const [writers, setWriters] = useState<WriterLite[]>([]);
  const [actions, setActions] = useState<ActionLite[]>([]);

  const [year, setYear] = useState<number>(years[0]);
  const [startDate, setStartDate] = useState<string>(`${years[0]}-01-01`);
  const [endDate, setEndDate] = useState<string>(`${years[0]}-12-31`);
  const [filter, setFilter] = useState<ReviewFilter>("needs-review");
  const [inReview, setInReview] = useState(false);
  const [cursor, setCursor] = useState(0);

  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [followUpTask, setFollowUpTask] = useState("");
  const [followUpDue, setFollowUpDue] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("Open");
  const [newSongTitle, setNewSongTitle] = useState("");
  const [songDrafts, setSongDrafts] = useState<Record<string, { title: string; bounce: string; lyrics: string }>>({});
  const [newAssetType, setNewAssetType] = useState("other");
  const [newAssetSongId, setNewAssetSongId] = useState("");
  const [newAssetUrl, setNewAssetUrl] = useState("");
  const [splitSongId, setSplitSongId] = useState("");
  const [splitWriterName, setSplitWriterName] = useState("");
  const [splitPct, setSplitPct] = useState("");
  const [copyFromSongId, setCopyFromSongId] = useState("");
  const [copyTargetSongIds, setCopyTargetSongIds] = useState<string[]>([]);

  const [errorMsg, setErrorMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const reviewTopRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const [sRes, songRes, assetRes, splitRes, writerRes, actionRes] = await Promise.all([
      supabase.from("sessions").select("id,date,title,location,archive_reviewed,archive_review_notes,evidence_strength,apple_note_exists").order("date", { ascending: true }),
      supabase.from("song_works").select("id,session_id,title,bounce_link,lyrics_link"),
      supabase.from("asset_links").select("id,song_id,type,url"),
      supabase.from("song_writer_splits").select("id,song_id,writer_id,percentage,writers(name)"),
      supabase.from("writers").select("id,name").order("name", { ascending: true }),
      supabase.from("action_items").select("id,session_id,due_date,task,status,created_at").order("created_at", { ascending: false }),
    ]);
    if (sRes.error || songRes.error || assetRes.error || splitRes.error || writerRes.error || actionRes.error) {
      const e = sRes.error || songRes.error || assetRes.error || splitRes.error || writerRes.error || actionRes.error;
      logSupabaseError("Failed to load archive review data", e);
      setErrorMsg(supabaseUserMessage("Could not load archive review data", e));
      return;
    }

    setSessions((sRes.data ?? []) as SessionLite[]);
    setSongs((songRes.data ?? []) as SongLite[]);
    setAssets((assetRes.data ?? []) as AssetLite[]);
    setSplits((splitRes.data ?? []).map((r) => {
      const row = r as { id: string; song_id: string; writer_id: string; percentage?: number | null; writers?: { name?: string } | null };
      return { id: String(row.id), song_id: String(row.song_id), writer_id: String(row.writer_id), writer_name: String(row.writers?.name ?? ""), percentage: row.percentage ?? null };
    }));
    setWriters((writerRes.data ?? []) as WriterLite[]);
    setActions((actionRes.data ?? []) as ActionLite[]);
  };

  useEffect(() => {
    load();
  }, []);

  const periodSessions = useMemo(() => sessions
    .filter((s) => s.date?.startsWith(String(year)))
    .filter((s) => !startDate || s.date >= startDate)
    .filter((s) => !endDate || s.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date)), [sessions, year, startDate, endDate]);

  const filteredSessions = useMemo(() => periodSessions
    .filter((s) => {
      if (filter !== "needs-review") return true;
      const sessionSongs = songs.filter((x) => String(x.session_id || "") === s.id);
      const songIds = new Set(sessionSongs.map((x) => x.id));
      const sessionAssets = assets.filter((a) => songIds.has(String(a.song_id)));
      const sessionSplits = splits.filter((sp) => songIds.has(String(sp.song_id)));
      const sessionActions = actions.filter((a) => String(a.session_id || "") === s.id);
      const level = calcEvidence(s, sessionSongs, sessionAssets, sessionSplits, sessionActions).level;
      const openStatuses = new Set(["open", "in progress", "pending", "todo"]);
      const hasOpenFollowUp = sessionActions.some((a) => openStatuses.has(String(a.status || "").toLowerCase().trim()));
      const notStrongEnough = !["Strong", "Complete"].includes(level);
      return s.archive_reviewed !== true || hasOpenFollowUp || notStrongEnough;
    })
    .sort((a, b) => a.date.localeCompare(b.date)), [periodSessions, songs, assets, splits, actions, filter]);

  const current = filteredSessions[cursor] ?? null;
  const currentSongs = useMemo(() => songs.filter((s) => String(s.session_id || "") === String(current?.id || "")), [songs, current?.id]);
  const currentSongIds = useMemo(() => new Set(currentSongs.map((s) => s.id)), [currentSongs]);
  const currentAssets = useMemo(() => assets.filter((a) => currentSongIds.has(String(a.song_id))), [assets, currentSongIds]);
  const currentSplits = useMemo(() => splits.filter((sp) => currentSongIds.has(String(sp.song_id))), [splits, currentSongIds]);
  const currentActions = useMemo(() => actions.filter((a) => String(a.session_id || "") === String(current?.id || "")), [actions, current?.id]);
  const evidence = useMemo(() => calcEvidence(current, currentSongs, currentAssets, currentSplits, currentActions), [current, currentSongs, currentAssets, currentSplits, currentActions]);

  useEffect(() => {
    const next: Record<string, { title: string; bounce: string; lyrics: string }> = {};
    currentSongs.forEach((s) => {
      next[s.id] = { title: s.title || "", bounce: s.bounce_link || "", lyrics: s.lyrics_link || "" };
    });
    setSongDrafts(next);
  }, [currentSongs]);

  const reviewedCount = useMemo(() => periodSessions.filter((s) => s.archive_reviewed).length, [periodSessions]);
  const remainingCount = Math.max(periodSessions.length - reviewedCount, 0);
  const progressPct = filteredSessions.length ? Math.round(((cursor + 1) / filteredSessions.length) * 100) : 0;

  const startReview = () => {
    setCursor(0);
    setInReview(true);
    setSaveMsg("");
    setErrorMsg("");
  };

  const patchSession = async (sessionId: string, patch: Record<string, string | boolean | null>) => {
    setErrorMsg("");
    const { error } = await supabase.from("sessions").update(patch).eq("id", sessionId);
    if (error) {
      logSupabaseError("Failed to update session in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not update session", error));
      return false;
    }
    return true;
  };

  const saveCurrent = async (markReviewed?: boolean) => {
    if (!current) return true;
    const auto = calcEvidence(current, currentSongs, currentAssets, currentSplits, currentActions);
    const appleNoteExists = currentAssets.some((a) => normalizeEvidenceType(a.type || "") === "apple_note" && Boolean(a.url));
    const notes = (notesDraft[current.id] ?? current.archive_review_notes ?? "").trim();
    const patch: Record<string, string | boolean | null> = {
      archive_review_notes: notes || null,
      evidence_strength: auto.level,
      apple_note_exists: appleNoteExists,
    };
    if (typeof markReviewed === "boolean") patch.archive_reviewed = markReviewed;

    const wasReviewed = Boolean(current.archive_reviewed);
    const ok = await patchSession(current.id, patch);
    if (!ok) return false;

    const nowReviewed = Boolean(patch.archive_reviewed);
    if (!wasReviewed && nowReviewed) {
      await supabase.from("session_review_history").insert({
        session_id: current.id,
        event_type: "marked_reviewed",
        field_name: "archive_reviewed",
        old_value: "false",
        new_value: "true",
      });
    }

    if (followUpTask.trim()) {
      const { error: actionErr } = await supabase.from("action_items").insert({
        task: followUpTask.trim(),
        due_date: followUpDue || "",
        priority: "Medium",
        status: followUpStatus || "Open",
        session_id: current.id,
      });
      if (actionErr) {
        logSupabaseError("Failed to create follow-up from archive review", actionErr);
        setErrorMsg(supabaseUserMessage("Session saved, but follow-up could not be created", actionErr));
      } else {
        setFollowUpTask("");
        setFollowUpDue("");
        setFollowUpStatus("Open");
      }
    }

    await load();
    setSaveMsg("Progress saved.");
    window.setTimeout(() => setSaveMsg(""), 1200);
    return true;
  };

  const back = () => setCursor((c) => Math.max(c - 1, 0));
  const next = () => setCursor((c) => Math.min(c + 1, Math.max(filteredSessions.length - 1, 0)));

  const scrollReviewTop = () => {
    window.setTimeout(() => reviewTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  };

  const markReviewedAndNext = async () => {
    const ok = await saveCurrent(true);
    if (!ok) return;
    if (cursor < filteredSessions.length - 1) {
      setCursor((c) => c + 1);
      scrollReviewTop();
    }
  };

  const updateSongField = async (songId: string, patch: { bounce_link?: string | null; lyrics_link?: string | null; title?: string }) => {
    const { error } = await supabase.from("song_works").update(patch).eq("id", songId);
    if (error) {
      logSupabaseError("Failed to update song/work in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not update song/work", error));
      return;
    }

    const syncCoreEvidenceLink = async (type: "bounce" | "lyrics", urlValue: string | null | undefined) => {
      const normalizedUrl = String(urlValue || "").trim();
      const existingForType = currentAssets.filter((a) => String(a.song_id) === String(songId) && normalizeEvidenceType(a.type || "") === type);
      if (!normalizedUrl) {
        if (existingForType.length) {
          const { error: delErr } = await supabase.from("asset_links").delete().eq("song_id", songId).eq("type", type);
          if (delErr) {
            logSupabaseError(`Failed to clear ${type} asset link during song save`, delErr);
            setErrorMsg(supabaseUserMessage(`Could not sync ${type} evidence`, delErr));
          }
        }
        return;
      }

      const exact = existingForType.find((a) => String(a.url || "").trim() === normalizedUrl);
      if (exact) return;
      if (existingForType.length) {
        const target = existingForType[0];
        const { error: updErr } = await supabase.from("asset_links").update({ url: normalizedUrl }).eq("id", target.id);
        if (updErr) {
          logSupabaseError(`Failed to update existing ${type} asset link during song save`, updErr);
          setErrorMsg(supabaseUserMessage(`Could not sync ${type} evidence`, updErr));
        }
      } else {
        const { error: insErr } = await supabase.from("asset_links").insert({ song_id: songId, type, url: normalizedUrl });
        if (insErr) {
          logSupabaseError(`Failed to insert ${type} asset link during song save`, insErr);
          setErrorMsg(supabaseUserMessage(`Could not sync ${type} evidence`, insErr));
        }
      }
    };

    if (Object.prototype.hasOwnProperty.call(patch, "bounce_link")) await syncCoreEvidenceLink("bounce", patch.bounce_link);
    if (Object.prototype.hasOwnProperty.call(patch, "lyrics_link")) await syncCoreEvidenceLink("lyrics", patch.lyrics_link);
    await load();
  };

  const addSong = async () => {
    if (!current || !newSongTitle.trim()) return;
    const { error } = await supabase.from("song_works").insert({ title: newSongTitle.trim(), session_id: current.id, status: "Started" });
    if (error) {
      logSupabaseError("Failed to add song/work in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not add song/work", error));
      return;
    }
    setNewSongTitle("");
    await load();
  };

  const deleteSong = async (songId: string) => {
    if (!window.confirm("Delete this song/work from the session?")) return;
    const { error } = await supabase.from("song_works").delete().eq("id", songId);
    if (error) {
      logSupabaseError("Failed to delete song/work in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not delete song/work", error));
      return;
    }
    await load();
    setSaveMsg("Song/work deleted.");
    window.setTimeout(() => setSaveMsg(""), 1300);
  };

  const addAsset = async () => {
    if (!newAssetSongId || !newAssetType || !newAssetUrl.trim()) return;
    const normalizedType = normalizeEvidenceType(newAssetType);
    const normalizedUrl = newAssetUrl.trim();
    const exists = currentAssets.some((a) =>
      String(a.song_id) === String(newAssetSongId)
      && normalizeEvidenceType(a.type || "") === normalizedType
      && String(a.url || "").trim() === normalizedUrl,
    );
    if (exists) {
      setSaveMsg("That evidence link is already added for this song.");
      window.setTimeout(() => setSaveMsg(""), 1400);
      return;
    }
    const { error } = await supabase.from("asset_links").insert({ song_id: newAssetSongId, type: newAssetType, url: newAssetUrl.trim() });
    if (error) {
      logSupabaseError("Failed to add asset in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not add evidence asset", error));
      return;
    }
    setNewAssetUrl("");
    await load();
  };

  const deleteAsset = async (id: string) => {
    const { error } = await supabase.from("asset_links").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete asset in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not delete evidence asset", error));
      return;
    }
    await load();
  };

  const addSplit = async () => {
    if (!splitSongId || !splitWriterName.trim()) return;
    let writerId = writers.find((w) => w.name.toLowerCase() === splitWriterName.trim().toLowerCase())?.id;
    if (!writerId) {
      const { data, error } = await supabase.from("writers").insert({ name: splitWriterName.trim() }).select("id").single();
      if (error || !data) {
        logSupabaseError("Failed to create writer in archive review", error);
        setErrorMsg(supabaseUserMessage("Could not create writer", error));
        return;
      }
      writerId = String((data as { id: string }).id);
    }
    const pct = splitPct.trim() ? Number(splitPct) : null;
    const { error } = await supabase.from("song_writer_splits").insert({ song_id: splitSongId, writer_id: writerId, percentage: pct });
    if (error) {
      logSupabaseError("Failed to add split in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not add writer/split", error));
      return;
    }
    setSplitWriterName("");
    setSplitPct("");
    await load();
  };

  const editSplit = async (split: SplitLite) => {
    const nextWriterName = window.prompt("Writer name", split.writer_name || "");
    if (nextWriterName === null) return;
    const cleanWriter = nextWriterName.trim();
    if (!cleanWriter) return;
    const nextPct = window.prompt("Split % (leave blank for auto)", split.percentage === null || split.percentage === undefined ? "" : String(split.percentage));
    if (nextPct === null) return;

    let writerId = writers.find((w) => w.name.toLowerCase() === cleanWriter.toLowerCase())?.id;
    if (!writerId) {
      const { data, error } = await supabase.from("writers").insert({ name: cleanWriter }).select("id").single();
      if (error || !data) {
        logSupabaseError("Failed to create writer while editing split", error);
        setErrorMsg(supabaseUserMessage("Could not create writer", error));
        return;
      }
      writerId = String((data as { id: string }).id);
    }

    const pct = nextPct.trim() ? Number(nextPct) : null;
    const { error } = await supabase.from("song_writer_splits").update({ writer_id: writerId, percentage: pct }).eq("id", split.id);
    if (error) {
      logSupabaseError("Failed to edit writer split in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not update writer/split", error));
      return;
    }
    await load();
    setSaveMsg("Writer/split updated.");
    window.setTimeout(() => setSaveMsg(""), 1300);
  };

  const deleteSplit = async (splitId: string) => {
    if (!window.confirm("Delete this writer/split row?")) return;
    const { error } = await supabase.from("song_writer_splits").delete().eq("id", splitId);
    if (error) {
      logSupabaseError("Failed to delete writer split in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not delete writer/split", error));
      return;
    }
    await load();
    setSaveMsg("Writer/split deleted.");
    window.setTimeout(() => setSaveMsg(""), 1300);
  };

  const duplicateWritersAcrossSongs = async () => {
    if (!copyFromSongId || currentSongs.length < 2) return;
    if (!copyTargetSongIds.length) {
      setSaveMsg("Select at least one target song.");
      window.setTimeout(() => setSaveMsg(""), 1400);
      return;
    }
    const sourceSplits = currentSplits.filter((sp) => sp.song_id === copyFromSongId);
    if (!sourceSplits.length) {
      setSaveMsg("Source song has no writers/splits to copy.");
      window.setTimeout(() => setSaveMsg(""), 1400);
      return;
    }

    let inserted = 0;
    for (const targetSong of currentSongs) {
      if (targetSong.id === copyFromSongId) continue;
      if (!copyTargetSongIds.includes(targetSong.id)) continue;
      for (const split of sourceSplits) {
        const exists = currentSplits.some((sp) => sp.song_id === targetSong.id && sp.writer_id === split.writer_id);
        if (exists) continue;
        const { error } = await supabase.from("song_writer_splits").insert({
          song_id: targetSong.id,
          writer_id: split.writer_id,
          percentage: split.percentage ?? null,
        });
        if (error) {
          logSupabaseError("Failed to duplicate writer split across songs", error);
          setErrorMsg(supabaseUserMessage("Could not duplicate all writers/splits", error));
          return;
        }
        inserted += 1;
      }
    }
    await load();
    setCopyTargetSongIds([]);
    setSaveMsg(inserted > 0 ? "Writers/splits duplicated across songs." : "All songs already had these writers.");
    window.setTimeout(() => setSaveMsg(""), 1500);
  };

  const updateActionStatus = async (actionId: string, status: string) => {
    const { error } = await supabase.from("action_items").update({ status }).eq("id", actionId);
    if (error) {
      logSupabaseError("Failed to update action status in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not update follow-up", error));
      return;
    }
    await load();
  };

  const editActionTask = async (action: ActionLite) => {
    const nextTask = window.prompt("Update follow-up task", action.task || "");
    if (nextTask === null) return;
    const { error } = await supabase.from("action_items").update({ task: nextTask }).eq("id", action.id);
    if (error) {
      logSupabaseError("Failed to edit action task in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not update follow-up", error));
      return;
    }
    await load();
  };

  const deleteAction = async (actionId: string) => {
    if (!window.confirm("Delete this follow-up action?")) return;
    const { error } = await supabase.from("action_items").delete().eq("id", actionId);
    if (error) {
      logSupabaseError("Failed to delete follow-up action in archive review", error);
      setErrorMsg(supabaseUserMessage("Could not delete follow-up", error));
      return;
    }
    await load();
  };

  const completionStats = useMemo(() => {
    const sessionIds = new Set(periodSessions.map((s) => s.id));
    const scopedSongs = songs.filter((s) => sessionIds.has(String(s.session_id || "")));
    const scopedAssets = assets.filter((a) => scopedSongs.some((s) => s.id === a.song_id));
    const scopedSplits = splits.filter((sp) => scopedSongs.some((s) => s.id === sp.song_id));
    const missingBounce = scopedSongs.filter((song) => !(Boolean(song.bounce_link) || scopedAssets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "bounce" && Boolean(a.url)))).length;
    const missingLyrics = scopedSongs.filter((song) => !(Boolean(song.lyrics_link) || scopedAssets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "lyrics" && Boolean(a.url)))).length;
    const weakPartial = periodSessions.filter((s) => {
      const ss = songs.filter((x) => String(x.session_id || "") === s.id);
      const sids = new Set(ss.map((x) => x.id));
      const sa = assets.filter((a) => sids.has(a.song_id));
      const sp = splits.filter((x) => sids.has(x.song_id));
      const ac = actions.filter((x) => String(x.session_id || "") === s.id);
      const lvl = calcEvidence(s, ss, sa, sp, ac).level;
      return lvl === "Weak" || lvl === "Partial";
    }).length;
    const followUps = actions.filter((a) => sessionIds.has(String(a.session_id || ""))).length;
    return { missingBounce, missingLyrics, weakPartial, followUps, scopedSplits: scopedSplits.length };
  }, [periodSessions, songs, assets, splits, actions]);

  return (
    <div>
      <PageHeader title="Archive Progress" subtitle="Guided Archive Review workspace for chronological session processing." />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}

      <SectionCard title="Archive Review Setup">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: ".6rem" }}>
          <div><label className="helper">Year</label><select value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); setStartDate(`${y}-01-01`); setEndDate(`${y}-12-31`); }}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
          <div><label className="helper">Start date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><label className="helper">End date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          <div><label className="helper">Status filter</label><select value={filter} onChange={(e) => setFilter(e.target.value as ReviewFilter)}><option value="needs-review">Needs Review Only</option><option value="all">All sessions</option></select></div>
        </div>
        <div className="rowActions" style={{ marginTop: ".75rem" }}>
          <button className="button primary" onClick={startReview}>Start Review</button>
          <span className="helper">{filteredSessions.length} sessions match filter ({periodSessions.length} total in period)</span>
        </div>
      </SectionCard>

      {inReview ? (
        filteredSessions.length === 0 ? (
          <SectionCard title="No Sessions In This Period"><p className="helper">Adjust date range/filter and start review again.</p></SectionCard>
        ) : !current ? (
          <SectionCard title="Review Complete">
            <p>Review period complete.</p>
            <div className="grid" style={{ marginTop: ".7rem", gap: ".35rem" }}>
              <div>Total sessions reviewed: {reviewedCount}</div>
              <div>Missing Bounce count: {completionStats.missingBounce}</div>
              <div>Missing Lyrics count: {completionStats.missingLyrics}</div>
              <div>Weak/Partial evidence count: {completionStats.weakPartial}</div>
              <div>Follow-up actions created: {completionStats.followUps}</div>
            </div>
            <div className="rowActions" style={{ marginTop: ".75rem" }}>
              <button className="button" disabled>Export Review Summary (Soon)</button>
              <button className="button" onClick={() => { setInReview(false); setCursor(0); }}>Back to setup</button>
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Guided Review Step" actions={<Link className="button compact" href={`/sessions/${current.id}`}>Open Full Session Workspace</Link>}>
            <div ref={reviewTopRef} />
            <div className="rowActions" style={{ justifyContent: "space-between", marginBottom: ".55rem" }}>
              <strong>Session {cursor + 1} of {filteredSessions.length}</strong>
              <span className="helper">Reviewed: {reviewedCount} · Remaining: {remainingCount}</span>
            </div>
            <div className="rowActions" style={{ marginBottom: ".55rem" }}>
              <button className="button compact" onClick={() => { next(); scrollReviewTop(); }} disabled={cursor >= filteredSessions.length - 1}>Next</button>
            </div>
            <div className="progressBar" style={{ marginBottom: ".8rem" }}><span style={{ width: `${progressPct}%` }} /></div>

            <div className="kv">
              <dt>Date</dt><dd><input type="date" value={current.date || ""} onChange={async (e) => { await patchSession(current.id, { date: e.target.value }); await load(); }} /></dd>
              <dt>Title</dt><dd><input value={current.title || ""} onChange={async (e) => { await patchSession(current.id, { title: e.target.value }); await load(); }} /></dd>
              <dt>Location</dt><dd><input value={current.location || ""} onChange={async (e) => { await patchSession(current.id, { location: e.target.value }); await load(); }} /></dd>
              <dt>Archive Reviewed</dt><dd>{current.archive_reviewed ? "Yes" : "No"}</dd>
              <dt>Evidence Strength (Auto)</dt><dd><StatusBadge label={evidence.level} /></dd>
              <dt>Review Notes</dt><dd><textarea value={notesDraft[current.id] ?? current.archive_review_notes ?? ""} onChange={(e) => setNotesDraft((p) => ({ ...p, [current.id]: e.target.value }))} placeholder="Add review notes for this session" /></dd>
            </div>

            <div className="card" style={{ marginTop: ".75rem" }}>
              <h3 style={{ color: "var(--text)", fontSize: ".95rem", marginBottom: ".45rem" }}>Evidence Strength Breakdown</h3>
              <div className="rowActions compact" style={{ marginBottom: ".45rem" }}>
                <span className="statusBadge">{evidence.bounceCount}/{evidence.totalSongs} Bounce</span>
                <span className="statusBadge">{evidence.lyricsCount}/{evidence.totalSongs} Lyrics</span>
                <span className="statusBadge">Strength: {evidence.level}</span>
              </div>
              <p className="helper" style={{ marginBottom: ".35rem" }}>What contributes to stronger evidence:</p>
              <ul style={{ paddingLeft: "1.1rem" }}>
                {evidence.contributors.length ? evidence.contributors.map((c) => <li key={c}>{c}</li>) : <li>None yet</li>}
              </ul>
              <p className="helper" style={{ marginTop: ".45rem", marginBottom: ".35rem" }}>What is preventing stronger archive status:</p>
              <ul style={{ paddingLeft: "1.1rem" }}>
                {evidence.blockers.length ? evidence.blockers.map((b) => <li key={b}>{b}</li>) : <li>No major blockers.</li>}
              </ul>
            </div>

            <SectionCard title="Songs / Works" actions={<div className="rowActions compact"><input value={newSongTitle} onChange={(e) => setNewSongTitle(e.target.value)} placeholder="Add song/work title" style={{ minWidth: 220 }} /><button className="button primary compact" onClick={addSong}>Add Song</button></div>}>
              {currentSongs.length === 0 ? <p className="helper">No linked songs/works yet.</p> : (
                <div className="tableWrap">
                  <table>
                    <thead><tr><th>Title</th><th>Bounce Link</th><th>Lyrics Link</th><th>Actions</th></tr></thead>
                    <tbody>
                      {currentSongs.map((song) => (
                        <tr key={song.id}>
                          <td><input value={songDrafts[song.id]?.title ?? ""} onChange={(e) => setSongDrafts((p) => ({ ...p, [song.id]: { ...(p[song.id] || { title: "", bounce: "", lyrics: "" }), title: e.target.value } }))} /></td>
                          <td><input value={songDrafts[song.id]?.bounce ?? ""} placeholder="https://..." onChange={(e) => setSongDrafts((p) => ({ ...p, [song.id]: { ...(p[song.id] || { title: "", bounce: "", lyrics: "" }), bounce: e.target.value } }))} /></td>
                          <td><input value={songDrafts[song.id]?.lyrics ?? ""} placeholder="https://..." onChange={(e) => setSongDrafts((p) => ({ ...p, [song.id]: { ...(p[song.id] || { title: "", bounce: "", lyrics: "" }), lyrics: e.target.value } }))} /></td>
                          <td><div className="rowActions compact"><button className="button compact" onClick={() => updateSongField(song.id, { title: songDrafts[song.id]?.title ?? "", bounce_link: (songDrafts[song.id]?.bounce || "").trim() || null, lyrics_link: (songDrafts[song.id]?.lyrics || "").trim() || null })}>Save</button><button className="button compact" onClick={() => deleteSong(song.id)}>Delete</button><Link className="button compact" href={`/songs/${song.id}`}>Song Detail</Link></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Writers / Splits" actions={<div className="rowActions compact"><select value={splitSongId} onChange={(e) => setSplitSongId(e.target.value)} style={{ minWidth: 180 }}><option value="">Select song</option>{currentSongs.map((s) => <option key={s.id} value={s.id}>{s.title || "Untitled"}</option>)}</select><input list="writer-dir-archive" value={splitWriterName} onChange={(e) => setSplitWriterName(e.target.value)} placeholder="Writer name" style={{ minWidth: 180 }} /><input value={splitPct} onChange={(e) => setSplitPct(e.target.value)} placeholder="Split %" style={{ maxWidth: 90 }} /><button className="button primary compact" onClick={addSplit}>Add Writer/Split</button><datalist id="writer-dir-archive">{writers.map((w) => <option key={w.id} value={w.name} />)}</datalist></div>}>
              <div className="rowActions compact" style={{ marginBottom: ".6rem" }}>
                <select value={copyFromSongId} onChange={(e) => setCopyFromSongId(e.target.value)} style={{ minWidth: 220 }}>
                  <option value="">Duplicate writers from song...</option>
                  {currentSongs.map((s) => <option key={s.id} value={s.id}>{s.title || "Untitled"}</option>)}
                </select>
                <button className="button compact" onClick={duplicateWritersAcrossSongs} disabled={!copyFromSongId || currentSongs.length < 2 || !copyTargetSongIds.length}>Duplicate to Selected Songs</button>
              </div>
              {copyFromSongId ? (
                <div className="rowActions compact" style={{ marginBottom: ".6rem", flexWrap: "wrap" }}>
                  {currentSongs.filter((s) => s.id !== copyFromSongId).map((s) => (
                    <label key={s.id} className={`targetChip ${copyTargetSongIds.includes(s.id) ? "selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={copyTargetSongIds.includes(s.id)}
                        onChange={(e) => {
                          setCopyTargetSongIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id));
                        }}
                      />
                      <span className="targetChipCheck" aria-hidden="true">✓</span>
                      {s.title || "Untitled"}
                    </label>
                  ))}
                </div>
              ) : null}
              <div className="rowActions compact" style={{ marginBottom: ".6rem" }}>
                <button className="button compact" onClick={() => setCopyTargetSongIds(currentSongs.filter((s) => s.id !== copyFromSongId).map((s) => s.id))} disabled={!copyFromSongId}>Select All Targets</button>
                <button className="button compact" onClick={() => setCopyTargetSongIds([])} disabled={!copyTargetSongIds.length}>Clear Targets</button>
              </div>
              {currentSplits.length === 0 ? <p className="helper">No writers/splits added yet.</p> : (
                <div className="tableWrap"><table><thead><tr><th>Song</th><th>Writer</th><th>Split</th><th>Actions</th></tr></thead><tbody>{currentSplits.map((sp) => <tr key={sp.id}><td>{currentSongs.find((s) => s.id === sp.song_id)?.title || "Untitled"}</td><td>{sp.writer_name}</td><td>{sp.percentage ?? <span className="helper">auto</span>}</td><td><div className="rowActions compact"><button className="button compact" onClick={() => editSplit(sp)}>Edit</button><button className="button compact" onClick={() => deleteSplit(sp.id)}>Delete</button></div></td></tr>)}</tbody></table></div>
              )}
            </SectionCard>

            <SectionCard title="Evidence / Assets" actions={<div className="rowActions compact"><select value={newAssetSongId} onChange={(e) => setNewAssetSongId(e.target.value)} style={{ minWidth: 160 }}><option value="">Select song</option>{currentSongs.map((s) => <option key={s.id} value={s.id}>{s.title || "Untitled"}</option>)}</select><select value={newAssetType} onChange={(e) => setNewAssetType(e.target.value)} style={{ minWidth: 160 }}><option value="bounce">Bounce</option><option value="lyrics">Lyrics</option><option value="acapella">Acapella</option><option value="voice_note">Voice Note</option><option value="apple_note">Apple Note</option><option value="google_doc">Google Doc</option><option value="dropbox">Dropbox</option><option value="message_evidence">Email/Pitch Trail</option><option value="screenshots">Screenshots</option><option value="other">Other</option></select><input value={newAssetUrl} onChange={(e) => setNewAssetUrl(e.target.value)} placeholder="https://..." style={{ minWidth: 220 }} /><button className="button primary compact" onClick={addAsset}>Add Asset</button></div>}>
              {currentAssets.length === 0 ? <p className="helper">No assets linked yet.</p> : (
                <div className="tableWrap"><table><thead><tr><th>Song</th><th>Type</th><th>Link</th><th>Action</th></tr></thead><tbody>{currentAssets.map((a) => <tr key={a.id}><td>{currentSongs.find((s) => s.id === a.song_id)?.title || "Untitled"}</td><td>{a.type}</td><td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">Open</a> : <span className="helper">No link</span>}</td><td><button className="button compact" onClick={() => deleteAsset(a.id)}>Delete</button></td></tr>)}</tbody></table></div>
              )}
            </SectionCard>

            <SectionCard title="Follow-up Actions">
              {currentActions.length ? <div className="tableWrap"><table><thead><tr><th>Due</th><th>Task</th><th>Status</th><th>Actions</th></tr></thead><tbody>{currentActions.map((a) => <tr key={a.id}><td>{a.due_date || <span className="helper">No date</span>}</td><td>{a.task}</td><td><select value={a.status} onChange={(e) => updateActionStatus(a.id, e.target.value)}><option>Open</option><option>In Progress</option><option>Done</option></select></td><td><div className="rowActions compact"><button className="button compact" onClick={() => editActionTask(a)}>Edit</button><button className="button compact" onClick={() => deleteAction(a.id)}>Delete</button></div></td></tr>)}</tbody></table></div> : <p className="helper">No follow-ups yet.</p>}
              <div className="rowActions compact" style={{ marginTop: ".5rem" }}>
                <input value={followUpTask} onChange={(e) => setFollowUpTask(e.target.value)} placeholder="Add follow-up task" style={{ minWidth: 240 }} />
                <input type="date" value={followUpDue} onChange={(e) => setFollowUpDue(e.target.value)} style={{ maxWidth: 180 }} />
                <select value={followUpStatus} onChange={(e) => setFollowUpStatus(e.target.value)} style={{ maxWidth: 160 }}><option>Open</option><option>In Progress</option><option>Done</option></select>
              </div>
            </SectionCard>

            <div className="rowActions" style={{ marginTop: ".85rem" }}>
              <button className="button" onClick={() => { back(); scrollReviewTop(); }} disabled={cursor === 0}>Back</button>
              <button className="button" onClick={() => { next(); scrollReviewTop(); }} disabled={cursor >= filteredSessions.length - 1}>Next</button>
              <button className="button primary" onClick={markReviewedAndNext}>Mark Reviewed & Next</button>
              <button className="button" onClick={() => saveCurrent()}>Save Progress</button>
              {saveMsg ? <span className="helper">{saveMsg}</span> : null}
            </div>
            <p className="helper" style={{ marginTop: ".55rem" }}>Archive Reviewed means this session has been intentionally reviewed and outstanding items acknowledged, not necessarily fully complete.</p>
          </SectionCard>
        )
      ) : null}
    </div>
  );
}
