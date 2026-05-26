"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Session } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { supabase } from "@/lib/supabase";
import { mapSession, mapSong, mapAction } from "@/lib/mappers";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import { isAllowedPitchAudio, uploadPitchAudio, removePitchAudio } from "@/lib/pitchAudio";

type AssetRow = { id: string; song_id: string; type: string; url?: string | null };
type WriterRow = { id: string; name: string };
type StudioRow = { id: string; name: string };
type SongTagRow = { id: string; song_id: string; tag_id: string; tag_name: string };
type SplitRow = {
  id: string;
  song_id: string;
  writer_id: string;
  percentage?: number | null;
  role?: string | null;
  writer_name: string;
};
type ReviewHistoryRow = { id: string; event_type: string; field_name: string; old_value?: string | null; new_value?: string | null; created_at: string };

const ROLE_OPTIONS = [
  "Songwriter",
  "Producer",
  "Artist",
  "Featured Artist",
  "Vocalist",
  "Topliner",
  "Composer",
  "Lyricist",
  "Other",
] as const;

const normalizeEvidenceType = (raw: string) => {
  const t = raw.toLowerCase().trim();
  if (["lyrics", "lyric", "lyrics", "song lyrics", "song_lyrics"].includes(t)) return "lyrics";
  if (["bounce", "bounce in", "bounce_in"].includes(t)) return "bounce";
  return t;
};

const evidenceLabel = (raw: string) => {
  const n = normalizeEvidenceType(raw);
  if (n === "lyrics") return "Lyrics";
  if (n === "bounce") return "Bounce";
  if (n === "dropbox") return "Dropbox";
  if (n === "google_doc") return "Google Doc";
  if (n === "apple_note") return "Apple Note";
  if (n === "voice_note") return "Voice note";
  if (n === "acapella") return "Acapella";
  return raw;
};

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [songs, setSongs] = useState<ReturnType<typeof mapSong>[]>([]);
  const [actions, setActions] = useState<ReturnType<typeof mapAction>[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [writers, setWriters] = useState<WriterRow[]>([]);
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  const [tagOptions, setTagOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [songTags, setSongTags] = useState<SongTagRow[]>([]);
  const [tagInputBySong, setTagInputBySong] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [studioMsg, setStudioMsg] = useState("");

  const [newSongTitle, setNewSongTitle] = useState("");
  const [newActionTask, setNewActionTask] = useState("");
  const [newActionDate, setNewActionDate] = useState("");
  const [assetSongId, setAssetSongId] = useState("");
  const [assetType, setAssetType] = useState("other");
  const [assetUrl, setAssetUrl] = useState("");
  const [songNotesDraft, setSongNotesDraft] = useState<Record<string, string>>({});
  const [archiveSaveState, setArchiveSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastReviewedDate, setLastReviewedDate] = useState("");
  const [writerSongId, setWriterSongId] = useState("");
  const [writerNameInput, setWriterNameInput] = useState("");
  const [writerRole, setWriterRole] = useState<string>("Songwriter");
  const [writerRoleCustom, setWriterRoleCustom] = useState("");
  const [writerSplitInput, setWriterSplitInput] = useState("");
  const [splitDrafts, setSplitDrafts] = useState<Record<string, { role: string; split: string }>>({});
  const [audioFileBySong, setAudioFileBySong] = useState<Record<string, File | null>>({});
  const [audioUploadStateBySong, setAudioUploadStateBySong] = useState<Record<string, "idle" | "ready" | "uploading" | "saved" | "error">>({});
  const [audioUploadMsgBySong, setAudioUploadMsgBySong] = useState<Record<string, string>>({});
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryRow[]>([]);

  const load = async () => {
    const { data: sData, error: sErr } = await supabase.from("sessions").select("*").eq("id", params.id).single();
    if (sErr) {
      logSupabaseError("Failed to load session detail", sErr);
      setErrorMsg(supabaseUserMessage("Could not load session", sErr));
      return;
    }
    const current = mapSession(sData as Record<string, unknown>);
    setSession(current);
    setLastReviewedDate(current.archive_reviewed ? String((sData as { updated_at?: string }).updated_at ?? "") : "");

    const { data: songRows, error: songErr } = await supabase.from("song_works").select("*").eq("session_id", current.id).order("created_at", { ascending: false });
    if (songErr) {
      logSupabaseError("Failed to load linked songs", songErr);
      setErrorMsg(supabaseUserMessage("Could not load linked songs", songErr));
    }
    const mappedSongs = (songRows ?? []).map((r) => mapSong(r as Record<string, unknown>));
    setSongs(mappedSongs);
    setSongNotesDraft(Object.fromEntries(mappedSongs.map((s) => [s.id, s.notes || ""])));
    setAssetSongId((prev) => {
      if (prev && mappedSongs.some((song) => song.id === prev)) return prev;
      return mappedSongs[0]?.id || "";
    });
    setWriterSongId((prev) => {
      if (prev && mappedSongs.some((song) => song.id === prev)) return prev;
      return mappedSongs[0]?.id || "";
    });

    const [actionRes, historyRes] = await Promise.all([
      supabase.from("action_items").select("*").eq("session_id", current.id).order("due_date", { ascending: true }),
      supabase.from("session_review_history").select("id,event_type,field_name,old_value,new_value,created_at").eq("session_id", current.id).order("created_at", { ascending: false }),
    ]);
    const actionRows = actionRes.data;
    const actionErr = actionRes.error;
    if (actionErr) {
      logSupabaseError("Failed to load session actions", actionErr);
      setErrorMsg(supabaseUserMessage("Could not load follow-ups", actionErr));
    }
    setActions((actionRows ?? []).map((r) => mapAction(r as Record<string, unknown>)));
    if (historyRes.error) {
      logSupabaseError("Failed to load session review history", historyRes.error);
    } else {
      setReviewHistory((historyRes.data ?? []) as ReviewHistoryRow[]);
    }

    if (mappedSongs.length) {
      const ids = mappedSongs.map((s) => s.id);
      const [{ data: assetRows, error: assetErr }, { data: tagDir }, { data: songTagRows }] = await Promise.all([
        supabase.from("asset_links").select("id,song_id,type,url").in("song_id", ids),
        supabase.from("song_tags").select("id,name").order("name", { ascending: true }),
        supabase.from("song_work_tags").select("id,song_id,tag_id,song_tags(name)").in("song_id", ids),
      ]);
      if (assetErr) {
        logSupabaseError("Failed to load linked assets", assetErr);
        setErrorMsg(supabaseUserMessage("Could not load assets", assetErr));
      }
      setAssets((assetRows ?? []) as AssetRow[]);
      setTagOptions((tagDir ?? []) as Array<{ id: string; name: string }>);
      setSongTags(
        (songTagRows ?? []).map((row) => {
          const r = row as { id: string; song_id: string; tag_id: string; song_tags?: { name?: string } | null };
          return { id: String(r.id), song_id: String(r.song_id), tag_id: String(r.tag_id), tag_name: String(r.song_tags?.name ?? "") };
        }),
      );
      if (process.env.NODE_ENV !== "production") {
        console.log("[session workspace load]", {
          sessionId: current.id,
          songIds: ids,
          assetLinksCount: (assetRows ?? []).length,
        });
      }

      const { data: splitRowsData, error: splitErr } = await supabase.from("song_writer_splits").select("id,song_id,writer_id,percentage,role").in("song_id", ids);
      if (splitErr) {
        logSupabaseError("Failed to load split rows", splitErr);
        setErrorMsg(supabaseUserMessage("Could not load attendees", splitErr));
      }
      const [{ data: writerDirectory, error: writerDirectoryErr }, { data: studioRows }] = await Promise.all([
        supabase.from("writers").select("id,name").order("name", { ascending: true }),
        supabase.from("studios").select("id,name").order("name", { ascending: true }),
      ]);
      if (writerDirectoryErr) {
        logSupabaseError("Failed to load writer directory", writerDirectoryErr);
        setErrorMsg(supabaseUserMessage("Could not load writer directory", writerDirectoryErr));
      }
      const writerIndex = new Map((writerDirectory ?? []).map((w) => [String((w as { id: string }).id), String((w as { name: string }).name)]));
      const mappedSplitRows = (splitRowsData ?? []).map((row) => {
          const r = row as { id: string; song_id: string; writer_id: string; percentage?: number | null; role?: string | null };
          return {
            id: String(r.id),
            song_id: String(r.song_id),
            writer_id: String(r.writer_id),
            percentage: r.percentage ?? null,
            role: r.role ?? null,
            writer_name: writerIndex.get(String(r.writer_id)) || "Unknown",
          };
        });
      setSplitRows(mappedSplitRows);
      setSplitDrafts(
        Object.fromEntries(
          mappedSplitRows.map((row) => [
            row.id,
            {
              role: row.role ?? "",
              split: row.percentage === null || row.percentage === undefined ? "" : String(row.percentage),
            },
          ]),
        ),
      );
      setWriters((writerDirectory ?? []) as WriterRow[]);
      setStudios((studioRows ?? []) as StudioRow[]);
    } else {
      setAssets([]);
      setWriters([]);
      setSongTags([]);
      const { data: studioRows } = await supabase.from("studios").select("id,name").order("name", { ascending: true });
      setStudios((studioRows ?? []) as StudioRow[]);
      setSplitRows([]);
      setSplitDrafts({});
    }
  };

  useEffect(() => { load(); }, [params.id]);

  const evidenceChecks = useMemo(() => {
    const safeSession = session ?? null;
    const safeSongs = songs ?? [];
    const safeAssets = assets ?? [];
    const safeSplitRows = splitRows ?? [];
    const safeActions = actions ?? [];
    const normalizedAssets = safeAssets.map((a) => ({ ...a, t: normalizeEvidenceType(a.type || "") }));
    const hasBounce = (song: (typeof safeSongs)[number]) => Boolean(song.bounceLink) || normalizedAssets.some((a) => a.song_id === song.id && a.t === "bounce" && Boolean(a.url));
    const hasLyrics = (song: (typeof safeSongs)[number]) => Boolean(song.lyricsLink) || normalizedAssets.some((a) => a.song_id === song.id && a.t === "lyrics" && Boolean(a.url));
    const bounceLinked = safeSongs.some((song) => hasBounce(song));
    const lyricsLinked = safeSongs.some((song) => hasLyrics(song));
    const songsWithFullEvidence = safeSongs.filter((song) => hasBounce(song) && hasLyrics(song)).length;
    const allSongsHaveFullEvidence = safeSongs.length > 0 && songsWithFullEvidence === safeSongs.length;
    const voiceNoteExists = normalizedAssets.some((a) => a.t === "voice_note" && Boolean(a.url));
    const acapellaExists = normalizedAssets.some((a) => a.t === "acapella" && Boolean(a.url));
    const appleNoteExists = normalizedAssets.some((a) => a.t === "apple_note" && Boolean(a.url));
    const googleDocExists = normalizedAssets.some((a) => a.t === "google_doc" && Boolean(a.url));
    const dropboxExists = normalizedAssets.some((a) => a.t === "dropbox" && Boolean(a.url));
    const emailTrailExists = normalizedAssets.some((a) => (a.t === "message_evidence" || a.t === "screenshots") && Boolean(a.url));
    const writersAdded = safeSplitRows.length > 0;
    const splitsAdded = safeSplitRows.some((r) => r.percentage !== null && r.percentage !== undefined);
    const attendeesAdded = safeSplitRows.length > 0;
    const songTitlesLogged = safeSongs.length > 0;
    const followUpLogged = safeActions.length > 0;
    const sessionCore = Boolean(safeSession?.date?.trim()) && Boolean(safeSession?.title?.trim());
    return {
      sessionCore,
      songTitlesLogged,
      bounceLinked,
      lyricsLinked,
      voiceNoteExists,
      acapellaExists,
      appleNoteExists,
      googleDocExists,
      dropboxExists,
      emailTrailExists,
      writersAdded,
      splitsAdded,
      attendeesAdded,
      followUpLogged,
      allSongsHaveFullEvidence,
    };
  }, [assets, songs, splitRows, actions, session]);

  const autoEvidenceStrength = useMemo(() => {
    const c = evidenceChecks;
    let score = 0;
    if (c.sessionCore) score += 1;
    if (c.songTitlesLogged) score += 1;
    if (c.bounceLinked) score += 2;
    if (c.lyricsLinked) score += 2;
    if (c.voiceNoteExists) score += 1;
    if (c.acapellaExists) score += 1;
    if (c.appleNoteExists) score += 1;
    if (c.googleDocExists) score += 1;
    if (c.dropboxExists) score += 1;
    if (c.emailTrailExists) score += 1;
    if (c.writersAdded) score += 2;
    if (c.splitsAdded) score += 1;
    if (c.attendeesAdded) score += 1;
    if (c.followUpLogged) score += 1;
    if (!c.bounceLinked && !c.lyricsLinked && score <= 3) return "Weak";
    if ((c.bounceLinked || c.lyricsLinked) && score < 9) return "Partial";
    if (c.bounceLinked && c.lyricsLinked && score >= 9 && score < 13) return "Strong";
    if (c.allSongsHaveFullEvidence && c.writersAdded && c.splitsAdded && (c.dropboxExists || c.googleDocExists || c.appleNoteExists || c.voiceNoteExists) && (session?.archive_reviewed || c.followUpLogged)) return "Complete";
    return score >= 9 ? "Strong" : "Partial";
  }, [evidenceChecks, session?.archive_reviewed]);

  const effectiveEvidenceStrength = (session?.evidence_strength_override ? (session?.evidence_strength || "") : autoEvidenceStrength) as string;
  const strengthSourceLabel = session?.evidence_strength_override ? "Manually overridden" : "Auto-calculated";
  const missingWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!evidenceChecks.bounceLinked) warnings.push("No Bounce");
    if (!evidenceChecks.lyricsLinked) warnings.push("No Lyrics");
    if (!evidenceChecks.writersAdded) warnings.push("No Writers");
    if (!evidenceChecks.splitsAdded) warnings.push("Missing Splits");
    if (!(evidenceChecks.dropboxExists || evidenceChecks.googleDocExists || evidenceChecks.appleNoteExists || evidenceChecks.voiceNoteExists || evidenceChecks.emailTrailExists)) warnings.push("No Supporting Links");
    return warnings;
  }, [evidenceChecks]);

  const reviewFollowUpState = useMemo(() => {
    if (!session?.archive_reviewed) return "Not reviewed";
    if (actions.length === 0) return "Reviewed";
    const openStatuses = new Set(["open", "in progress", "pending", "todo"]);
    const hasOpen = actions.some((a) => openStatuses.has(String(a.status || "").toLowerCase().trim()));
    return hasOpen ? "Reviewed needs follow-up" : "Reviewed closed";
  }, [session?.archive_reviewed, actions]);

  if (!session) return <div className="helper">Session not found.</div>;

  const updateSession = async (key: keyof Session, value: string | boolean) => {
    setSession((s) => (s ? { ...s, [key]: value } : s));
    const colMap: Record<string, string> = { date: "date", title: "title", location: "location", source: "source", archive_reviewed: "archive_reviewed", archive_review_notes: "archive_review_notes", evidence_strength: "evidence_strength" };
    const { error } = await supabase.from("sessions").update({ [colMap[key]]: value }).eq("id", session.id);
    if (error) {
      logSupabaseError("Failed to update session detail", error);
      setErrorMsg(supabaseUserMessage("Could not update session", error));
    }
  };

  const saveStudio = async () => {
    const name = session.location.trim();
    if (!name) return;
    if (studios.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setStudioMsg("Studio Saved");
      window.setTimeout(() => setStudioMsg(""), 1600);
      return;
    }
    const { error } = await supabase.from("studios").insert({ name });
    if (error) {
      logSupabaseError("Failed to save studio from session detail", error);
      setErrorMsg(supabaseUserMessage("Could not save studio location", error));
      return;
    }
    const { data: studioRows } = await supabase.from("studios").select("id,name").order("name", { ascending: true });
    setStudios((studioRows ?? []) as StudioRow[]);
    setStudioMsg("Studio Saved");
    window.setTimeout(() => setStudioMsg(""), 1600);
  };

  const addSong = async () => {
    if (!newSongTitle.trim()) return;
    const { error } = await supabase.from("song_works").insert({ title: newSongTitle, session_id: session.id, status: "Started" });
    if (error) {
      logSupabaseError("Failed to add song from session detail", error);
      setErrorMsg(supabaseUserMessage("Could not add song/work", error));
      return;
    }
    setNewSongTitle("");
    await load();
  };

  const addAction = async () => {
    if (!newActionTask.trim()) return;
    const { error } = await supabase.from("action_items").insert({ task: newActionTask, due_date: newActionDate || "", priority: "Medium", status: "Open", session_id: session.id });
    if (error) {
      logSupabaseError("Failed to add action from session detail", error);
      setErrorMsg(supabaseUserMessage("Could not add follow-up", error));
      return;
    }
    setNewActionTask("");
    setNewActionDate("");
    await load();
  };

  const addAsset = async () => {
    if (!assetSongId || !assetUrl.trim()) return;
    const { error } = await supabase.from("asset_links").insert({ song_id: assetSongId, type: assetType, url: assetUrl });
    if (error) {
      logSupabaseError("Failed to add asset from session detail", error);
      setErrorMsg(supabaseUserMessage("Could not add asset/evidence", error));
      return;
    }

    if (assetType === "bounce") {
      const { error: bErr } = await supabase.from("song_works").update({ bounce_link: assetUrl }).eq("id", assetSongId);
      if (bErr) {
        logSupabaseError("Failed to sync Bounce to song_works", bErr);
        setErrorMsg(supabaseUserMessage("Asset saved, but Bounce sync failed", bErr));
      }
    }
    if (assetType === "lyrics") {
      const { error: lErr } = await supabase.from("song_works").update({ lyrics_link: assetUrl }).eq("id", assetSongId);
      if (lErr) {
        logSupabaseError("Failed to sync Lyrics to song_works", lErr);
        setErrorMsg(supabaseUserMessage("Asset saved, but Lyrics sync failed", lErr));
      }
    }
    await maybePromoteSongToAssetsFiled(assetSongId);

    setAssetUrl("");
    await load();
  };

  const updateSong = async (songId: string, patch: { status?: string; notes?: string }) => {
    const payload: Record<string, string> = {};
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.notes !== undefined) payload.notes = patch.notes;
    const { error } = await supabase.from("song_works").update(payload).eq("id", songId);
    if (error) {
      logSupabaseError("Failed to update linked song", error);
      setErrorMsg(supabaseUserMessage("Could not update linked song/work", error));
      return;
    }
    await load();
  };

  const maybePromoteSongToAssetsFiled = async (songId: string) => {
    const { data: songRow } = await supabase.from("song_works").select("status,bounce_link,lyrics_link").eq("id", songId).single();
    if (!songRow) return;
    const status = String((songRow as { status?: string }).status ?? "");
    const bounceDirect = Boolean((songRow as { bounce_link?: string | null }).bounce_link);
    const lyricsDirect = Boolean((songRow as { lyrics_link?: string | null }).lyrics_link);
    const { data: links } = await supabase.from("asset_links").select("type,url").eq("song_id", songId);
    const hasBounce = bounceDirect || (links ?? []).some((l) => String((l as { type?: string }).type || "").toLowerCase() === "bounce" && Boolean((l as { url?: string | null }).url));
    const hasLyrics = lyricsDirect || (links ?? []).some((l) => String((l as { type?: string }).type || "").toLowerCase() === "lyrics" && Boolean((l as { url?: string | null }).url));
    const promotableToAssetsFiled = status === "Started" || status === "Written" || status === "Bounce In";
    const promotableToBounceIn = status === "Started" || status === "Written";
    if (hasBounce && hasLyrics && promotableToAssetsFiled) {
      await supabase.from("song_works").update({ status: "Assets Filed" }).eq("id", songId);
      return;
    }
    if (hasBounce && !hasLyrics && promotableToBounceIn) {
      await supabase.from("song_works").update({ status: "Bounce In" }).eq("id", songId);
    }
  };

  const addTagToSong = async (songId: string) => {
    const raw = (tagInputBySong[songId] || "").trim();
    if (!raw) return;
    const existingOnSong = songTags.some((t) => t.song_id === songId && t.tag_name.toLowerCase() === raw.toLowerCase());
    if (existingOnSong) return;
    let tagId = tagOptions.find((t) => t.name.toLowerCase() === raw.toLowerCase())?.id;
    if (!tagId) {
      const { data: created } = await supabase.from("song_tags").insert({ name: raw }).select("id,name").single();
      if (created) {
        tagId = String((created as { id: string }).id);
        setTagOptions((prev) => [...prev, { id: tagId as string, name: String((created as { name: string }).name) }].sort((a, b) => a.name.localeCompare(b.name)));
      }
    }
    if (!tagId) return;
    const { data: link } = await supabase.from("song_work_tags").insert({ song_id: songId, tag_id: tagId }).select("id").single();
    if (link) setSongTags((prev) => [...prev, { id: String((link as { id: string }).id), song_id: songId, tag_id: tagId as string, tag_name: raw }]);
    setTagInputBySong((prev) => ({ ...prev, [songId]: "" }));
  };

  const removeTagFromSong = async (linkId: string) => {
    await supabase.from("song_work_tags").delete().eq("id", linkId);
    setSongTags((prev) => prev.filter((t) => t.id !== linkId));
  };

  const deleteSong = async (id: string) => {
    if (!window.confirm("Delete this linked song/work?")) return;
    const { error } = await supabase.from("song_works").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete linked song", error);
      setErrorMsg(supabaseUserMessage("Could not delete linked song/work", error));
      return;
    }
    await load();
  };

  const deleteAsset = async (id: string) => {
    if (!window.confirm("Delete this asset/evidence?")) return;
    const { error } = await supabase.from("asset_links").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete linked asset", error);
      setErrorMsg(supabaseUserMessage("Could not delete asset/evidence", error));
      return;
    }
    await load();
  };

  const updateAsset = async (id: string, patch: { type?: string; url?: string }) => {
    const payload: Record<string, string> = {};
    if (patch.type !== undefined) payload.type = patch.type;
    if (patch.url !== undefined) payload.url = patch.url;
    const { error } = await supabase.from("asset_links").update(payload).eq("id", id);
    if (error) {
      logSupabaseError("Failed to update linked asset", error);
      setErrorMsg(supabaseUserMessage("Could not update asset/evidence", error));
      return;
    }
    const targetSongId = assets.find((a) => a.id === id)?.song_id;
    if (targetSongId) await maybePromoteSongToAssetsFiled(targetSongId);
    await load();
  };

  const deleteAction = async (id: string) => {
    if (!window.confirm("Delete this follow-up action?")) return;
    const { error } = await supabase.from("action_items").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete linked action", error);
      setErrorMsg(supabaseUserMessage("Could not delete follow-up", error));
      return;
    }
    await load();
  };

  const promptIfSplitTotalNotHundred = async (songId: string) => {
    const { data: rows, error } = await supabase
      .from("song_writer_splits")
      .select("percentage")
      .eq("song_id", songId);
    if (error) {
      logSupabaseError("Failed to check split total", error);
      return;
    }
    const total = (rows ?? []).reduce((sum, row) => sum + (Number((row as { percentage?: number | null }).percentage ?? 0) || 0), 0);
    if (Math.round(total * 100) / 100 !== 100) {
      window.alert(`Split total for this title is ${total}%. It should equal 100%.`);
    }
  };

  const addWriterSplitForSong = async (songId?: string) => {
    const targetSongId = songId || writerSongId;

    if (!targetSongId) {
      setErrorMsg("Could not add writer/split: select a valid linked song.");
      return;
    }

    const writerName = writerNameInput.trim();
    if (!writerName) {
      setErrorMsg("Could not add writer/split: writer name is required.");
      return;
    }
    const chosenRole = writerRole === "Other" ? writerRoleCustom.trim() : writerRole;
    const splitValue = writerSplitInput.trim() ? Number(writerSplitInput) : null;

    if (writerSplitInput.trim() && Number.isNaN(splitValue)) {
      setErrorMsg("Could not add writer/split: split must be a number.");
      return;
    }

    const { data: existing, error: findErr } = await supabase
      .from("writers")
      .select("id,name")
      .ilike("name", writerName)
      .limit(1);

    if (findErr) {
      console.error(
        "Failed to find writer before split create",
        JSON.stringify({
          writerPayload: { name: writerName },
          splitPayload: {
            song_id: targetSongId,
            role: chosenRole || null,
            percentage: splitValue,
          },
          song_work_id: targetSongId,
          writer_id: null,
          message: findErr?.message,
          details: findErr?.details,
          hint: findErr?.hint,
          code: findErr?.code,
          raw: findErr,
        }),
      );
      logSupabaseError("Failed to find writer before split create", findErr);
      setErrorMsg(supabaseUserMessage("Could not add writer/split", findErr));
      return;
    }

    let writerId = existing?.[0]?.id as string | undefined;

    if (!writerId) {
      const { data: newWriter, error: createWriterErr } = await supabase
        .from("writers")
        .insert({ name: writerName })
        .select("id")
        .single();

      if (createWriterErr || !newWriter) {
        console.error(
          "Failed to create writer from session workspace",
          JSON.stringify({
            writerPayload: { name: writerName },
            splitPayload: {
              song_id: targetSongId,
              role: chosenRole || null,
              percentage: splitValue,
            },
            song_work_id: targetSongId,
            writer_id: null,
            message: createWriterErr?.message,
            details: createWriterErr?.details,
            hint: createWriterErr?.hint,
            code: createWriterErr?.code,
            raw: createWriterErr,
          }),
        );
        logSupabaseError("Failed to create writer from session workspace", createWriterErr);
        setErrorMsg(supabaseUserMessage("Could not add writer/split", createWriterErr));
        return;
      }

      writerId = String(newWriter.id);
    }

    const splitPayload = {
      song_id: targetSongId,
      writer_id: writerId,
      role: chosenRole || null,
      percentage: splitValue,
    };
    const writerPayload = {
      name: writerName,
    };

    const { data: insertedSplit, error: splitErr } = await supabase
      .from("song_writer_splits")
      .insert(splitPayload)
      .select("id")
      .single();

    if (splitErr || !insertedSplit) {
      console.error(
        "Failed to create writer split from session workspace",
        JSON.stringify({
          writerPayload,
          splitPayload,
          song_work_id: targetSongId,
          writer_id: writerId,
          message: splitErr?.message,
          details: splitErr?.details,
          hint: splitErr?.hint,
          code: splitErr?.code,
          raw: splitErr,
        }),
      );
      logSupabaseError("Failed to create writer split from session workspace", splitErr);
      setErrorMsg(supabaseUserMessage("Could not add writer/split", splitErr));
      return;
    }

    await promptIfSplitTotalNotHundred(targetSongId);

    setWriterNameInput("");
    setWriterRole("Songwriter");
    setWriterRoleCustom("");
    setWriterSplitInput("");

    await load();
  };

  const updateSplit = async (id: string, patch: { role?: string | null; percentage?: number | null }) => {
    const payload: { role?: string | null; percentage?: number | null } = {};
    if (patch.role !== undefined) payload.role = patch.role;
    if (patch.percentage !== undefined) payload.percentage = patch.percentage;
    const { error } = await supabase.from("song_writer_splits").update(payload).eq("id", id);
    if (error) {
      logSupabaseError("Failed to update writer split", error);
      setErrorMsg(supabaseUserMessage("Could not update writer split", error));
      return;
    }
    const existing = splitRows.find((row) => row.id === id);
    if (existing) await promptIfSplitTotalNotHundred(existing.song_id);
    await load();
  };

  const deleteSplit = async (id: string) => {
    if (!window.confirm("Remove this writer split from the song?")) return;
    const { error } = await supabase.from("song_writer_splits").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete writer split", error);
      setErrorMsg(supabaseUserMessage("Could not remove writer split", error));
      return;
    }
    const existing = splitRows.find((row) => row.id === id);
    if (existing) await promptIfSplitTotalNotHundred(existing.song_id);
    await load();
  };

  const deleteWriter = async (writerId: string, writerName: string) => {
    if (!window.confirm(`Delete writer "${writerName}" from the directory? This removes their linked split rows.`)) return;
    const { error } = await supabase.from("writers").delete().eq("id", writerId);
    if (error) {
      logSupabaseError("Failed to delete writer", error);
      setErrorMsg(supabaseUserMessage("Could not delete writer", error));
      return;
    }
    await load();
  };

  const updateArchiveField = async (key: "archive_reviewed" | "archive_review_notes" | "evidence_strength" | "apple_note_exists" | "evidence_strength_override", value: string | boolean) => {
    const priorValue = session ? String(session[key] ?? "") : "";
    setArchiveSaveState("saving");
    setSession((s) => (s ? { ...s, [key]: value } : s));
    const { data, error } = await supabase
      .from("sessions")
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq("id", session.id)
      .select("updated_at")
      .single();

    if (error) {
      logSupabaseError("Failed to update archive review fields", error);
      setErrorMsg(supabaseUserMessage("Could not save archive review update", error));
      setArchiveSaveState("error");
      return;
    }

    const updatedAt = String((data as { updated_at?: string } | null)?.updated_at ?? "");
    if (key === "archive_reviewed" && value === true) setLastReviewedDate(updatedAt);
    if (key === "archive_reviewed" && value === false) setLastReviewedDate("");
    await supabase.from("session_review_history").insert({
      session_id: session.id,
      event_type: key === "archive_reviewed" && value === true ? "marked_reviewed" : key === "archive_reviewed" && value === false ? "marked_not_reviewed" : "field_update",
      field_name: key,
      old_value: priorValue || null,
      new_value: String(value),
    });
    setArchiveSaveState("saved");
    window.setTimeout(() => setArchiveSaveState("idle"), 1200);
    await load();
  };

  return (
    <div>
      <PageHeader title={session.title || "Untitled Session"} subtitle="Sessions are your diary layer. Build songs, assets, and follow-ups from here." actions={<div className="rowActions compact"><Link className="button compact" href="/sessions">Back</Link><button className="button compact" onClick={() => setEditing((v) => !v)}>{editing ? "Save" : "Edit"}</button></div>} />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}

      <SectionCard title="Overview">
        <div className="kv">
          <dt>Date</dt><dd>{editing ? <input type="date" value={session.date} onChange={(e)=>updateSession("date", e.target.value)} /> : (session.date || <span className="helper">Add date</span>)}</dd>
          <dt>Title</dt><dd>{editing ? <input value={session.title} onChange={(e)=>updateSession("title", e.target.value)} /> : (session.title || <span className="helper">Add title</span>)}</dd>
          <dt>Location</dt><dd>{editing ? <div className="rowActions compact"><input list="studio-directory-session-detail" value={session.location} onChange={(e)=>updateSession("location", e.target.value)} /><button className="button compact" type="button" onClick={saveStudio}>Save Studio</button>{studioMsg ? <span className="helper" style={{ color: "#3f6b4a" }}>{studioMsg}</span> : null}<datalist id="studio-directory-session-detail">{studios.map((studio) => <option key={studio.id} value={studio.name} />)}</datalist></div> : (session.location || <span className="helper">Add location</span>)}</dd>
          <dt>Source</dt><dd>{editing ? <select value={session.source} onChange={(e)=>updateSession("source", e.target.value)}><option value="manual">manual</option><option value="calendar">calendar</option><option value="calendar_import">calendar_import</option></select> : session.source}</dd>
          <dt>Notes</dt><dd>{editing ? <textarea value={session.archive_review_notes || ""} onChange={(e)=>updateSession("archive_review_notes", e.target.value)} /> : (session.archive_review_notes || <span className="helper">Add notes</span>)}</dd>
        </div>
      </SectionCard>

      <SectionCard title="Linked Songs / Works" actions={<div id="add-song" className="rowActions compact"><input value={newSongTitle} onChange={(e)=>setNewSongTitle(e.target.value)} placeholder="Song/work title" style={{ minWidth: 220 }} /><button className="button primary compact" onClick={addSong}>Quick Add Song/Work</button></div>}>
        {songs.length === 0 ? <p className="helper">No linked songs yet.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Title</th><th>Status</th><th>Notes</th><th>Tags</th><th>Evidence</th><th>Actions</th></tr></thead>
              <tbody>
                {songs.map((song) => {
                  const songAssets = assets.filter((a) => a.song_id === song.id);
                  const normalized = songAssets.map((a) => normalizeEvidenceType(a.type));
                  const hasBounce = Boolean(song.bounceLink) || normalized.includes("bounce");
                  const hasLyrics = Boolean(song.lyricsLink) || normalized.includes("lyrics");
                  const evidenceItems = [...songAssets];
                  const tagsForSong = songTags.filter((t) => t.song_id === song.id);
                  if (song.bounceLink && !normalized.includes("bounce")) evidenceItems.push({ id: `virtual-bounce-${song.id}`, song_id: song.id, type: "bounce", url: song.bounceLink });
                  if (song.lyricsLink && !normalized.includes("lyrics")) evidenceItems.push({ id: `virtual-lyrics-${song.id}`, song_id: song.id, type: "lyrics", url: song.lyricsLink });
                  return (
                    <tr key={song.id}>
                      <td><strong>{song.title || "Untitled"}</strong></td>
                      <td><select value={song.status} onChange={(e) => updateSong(song.id, { status: e.target.value })}><option>Started</option><option>Written</option><option>Bounce In</option><option>Assets Filed</option><option>Pitched</option><option>On Hold</option><option>Cut</option><option>Approved</option><option>Released</option><option>Disputed</option><option>Registered</option><option>Complete</option></select></td>
                      <td><div className="rowActions compact"><input value={songNotesDraft[song.id] ?? ""} onChange={(e) => setSongNotesDraft((p) => ({ ...p, [song.id]: e.target.value }))} placeholder="Song notes" style={{ minWidth: 180 }} /><button className="button compact" onClick={() => updateSong(song.id, { notes: songNotesDraft[song.id] ?? "" })}>Save</button></div></td>
                      <td><div className="rowActions compact"><input list={`song-tags-${song.id}`} value={tagInputBySong[song.id] ?? ""} onChange={(e) => setTagInputBySong((p) => ({ ...p, [song.id]: e.target.value }))} placeholder="Add tag" style={{ minWidth: 140 }} /><button className="button compact" onClick={() => addTagToSong(song.id)}>Add</button><datalist id={`song-tags-${song.id}`}>{tagOptions.map((tag) => <option key={tag.id} value={tag.name} />)}</datalist></div><div className="rowActions compact" style={{ marginTop: ".35rem" }}>{tagsForSong.length ? tagsForSong.map((tag) => <button key={tag.id} className="button compact" onClick={() => removeTagFromSong(tag.id)}>{tag.tag_name} ✕</button>) : <span className="helper">No tags</span>}</div></td>
                      <td><div>{hasBounce && hasLyrics ? "Bounce + Lyrics" : hasBounce ? "Bounce only" : hasLyrics ? "Lyrics only" : <span className="helper">Missing</span>}</div><div className="helper" style={{ marginTop: ".35rem" }}>{evidenceItems.length ? evidenceItems.map((e) => evidenceLabel(e.type)).join(", ") : "No assets"}</div></td>
                      <td><div className="rowActions compact"><Link className="button compact" href={`/songs/${song.id}`}>Library View</Link><button className="button compact" onClick={() => deleteSong(song.id)}>Delete</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Writers / Attendees" actions={<button className="button primary compact" onClick={() => addWriterSplitForSong()}>Add Writer/Split</button>}>
        <p className="helper" style={{ marginBottom: ".6rem" }}>Writers are saved for reuse. Roles can be selected or custom typed. Blank split assumes equal splits temporarily.</p>
        <div className="rowActions compact" style={{ marginBottom: ".8rem", alignItems: "end" }}>
          <select value={writerSongId} onChange={(e) => setWriterSongId(e.target.value)} style={{ minWidth: 170 }}>
            <option value="">Select linked song</option>
            {songs.map((song) => <option key={song.id} value={song.id}>{song.title || "Untitled"}</option>)}
          </select>
          <div>
            <input
              list="writer-directory"
              value={writerNameInput}
              onChange={(e) => setWriterNameInput(e.target.value)}
              placeholder="Search or create writer name"
              style={{ minWidth: 220 }}
            />
            <datalist id="writer-directory">
              {writers.map((writer) => <option key={writer.id} value={writer.name} />)}
            </datalist>
          </div>
          <select value={writerRole} onChange={(e) => setWriterRole(e.target.value)} style={{ minWidth: 140 }}>
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          {writerRole === "Other" ? (
            <input value={writerRoleCustom} onChange={(e) => setWriterRoleCustom(e.target.value)} placeholder="Custom role" style={{ minWidth: 150 }} />
          ) : null}
          <input value={writerSplitInput} onChange={(e) => setWriterSplitInput(e.target.value)} placeholder="Split %" style={{ maxWidth: 100 }} />
        </div>
        {songs.length === 0 ? <p className="helper">No linked songs yet.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Song</th><th>Writer</th><th>Role</th><th>Split %</th><th>Actions</th></tr></thead>
              <tbody>
                {songs.map((song) => {
                  const rowsForSong = splitRows.filter((row) => row.song_id === song.id);
                  const total = rowsForSong.reduce((sum, row) => sum + (row.percentage ?? 0), 0);
                  const warn = rowsForSong.length > 0 && Math.round(total * 100) / 100 !== 100;
                  if (rowsForSong.length === 0) {
                    return (
                      <tr key={`${song.id}-none`}>
                        <td>{song.title || "Untitled"}</td>
                        <td colSpan={4} className="helper">No writer/split rows yet.</td>
                      </tr>
                    );
                  }
                  return rowsForSong.map((row, idx) => (
                    <tr key={row.id}>
                      <td>{idx === 0 ? song.title || "Untitled" : ""}{idx === 0 && warn ? <span className="helper"> (total {total}%, not 100)</span> : null}</td>
                      <td>{row.writer_name}</td>
                      <td>
                        <input
                          list="role-options"
                          value={splitDrafts[row.id]?.role ?? ""}
                          onChange={(e) => setSplitDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] || { role: "", split: "" }), role: e.target.value } }))}
                          placeholder="Role"
                          style={{ minWidth: 130 }}
                        />
                      </td>
                      <td>
                        <input
                          value={splitDrafts[row.id]?.split ?? ""}
                          onChange={(e) => setSplitDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] || { role: "", split: "" }), split: e.target.value } }))}
                          placeholder="%"
                          style={{ maxWidth: 90 }}
                        />
                      </td>
                      <td>
                        <div className="rowActions compact">
                          <button
                            className="button compact"
                            onClick={() => {
                              const draft = splitDrafts[row.id] || { role: row.role || "", split: row.percentage?.toString() || "" };
                              const nextSplit = draft.split.trim() ? Number(draft.split) : null;
                              if (draft.split.trim() && Number.isNaN(nextSplit)) {
                                setErrorMsg("Could not update split: split must be a number.");
                                return;
                              }
                              updateSplit(row.id, { role: draft.role.trim() || null, percentage: nextSplit });
                            }}
                          >
                            Save
                          </button>
                          <button
                            className="button compact"
                            onClick={() => deleteWriter(row.writer_id, row.writer_name)}
                          >
                            Delete Writer
                          </button>
                          <button className="button compact" onClick={() => deleteSplit(row.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
        <datalist id="role-options">
          {ROLE_OPTIONS.map((role) => <option key={role} value={role} />)}
        </datalist>
      </SectionCard>

      <SectionCard title="Pitch Audio by Song">
        <p className="helper" style={{ marginBottom: ".6rem" }}>Upload a pitch-playback copy here. Keep your archive/master files in Dropbox.</p>
        <p className="helper" style={{ marginBottom: ".7rem" }}>For pitching, compressed MP3/M4A is recommended. Keep WAVs in Dropbox unless needed.</p>
        {songs.length === 0 ? <p className="helper">No linked songs yet.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Song</th><th>Status</th><th>File</th><th>Upload/Replace</th><th>Source Note</th><th>Actions</th></tr></thead>
              <tbody>
                {songs.map((song) => (
                  <tr key={`pitch-audio-${song.id}`}>
                    <td>{song.title || "Untitled"}</td>
                    <td>{song.audioStoragePath ? "Audio ready for pitching" : <span className="helper">No pitch audio</span>}</td>
                    <td>{song.audioFileName || <span className="helper">None</span>}</td>
                    <td>
                      <div style={{ display: "grid", gap: ".4rem", minWidth: 230 }}>
                        <input
                          type="file"
                          accept=".mp3,.wav,.m4a,.aac,audio/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setAudioFileBySong((prev) => ({ ...prev, [song.id]: file }));
                            if (!file) {
                              setAudioUploadStateBySong((prev) => ({ ...prev, [song.id]: "idle" }));
                              setAudioUploadMsgBySong((prev) => ({ ...prev, [song.id]: "" }));
                              return;
                            }
                            if (!isAllowedPitchAudio(file)) {
                              setAudioUploadStateBySong((prev) => ({ ...prev, [song.id]: "error" }));
                              setAudioUploadMsgBySong((prev) => ({ ...prev, [song.id]: "This audio format is not allowed." }));
                              return;
                            }
                            setAudioUploadStateBySong((prev) => ({ ...prev, [song.id]: "ready" }));
                            setAudioUploadMsgBySong((prev) => ({ ...prev, [song.id]: "Ready to upload" }));
                          }}
                        />
                        {audioFileBySong[song.id] ? (
                          <div>
                            <p className="helper">{audioFileBySong[song.id]?.name}</p>
                            <p className="helper">{((audioFileBySong[song.id]?.size || 0) / (1024 * 1024)).toFixed(2)} MB • {audioFileBySong[song.id]?.type || "Unknown type"}</p>
                          </div>
                        ) : null}
                        <button
                          className="button compact"
                          disabled={audioUploadStateBySong[song.id] === "uploading" || !audioFileBySong[song.id]}
                          onClick={async () => {
                            const file = audioFileBySong[song.id];
                            if (!file) return;
                            if (!isAllowedPitchAudio(file)) {
                              setAudioUploadStateBySong((prev) => ({ ...prev, [song.id]: "error" }));
                              setAudioUploadMsgBySong((prev) => ({ ...prev, [song.id]: "This audio format is not allowed." }));
                              return;
                            }
                            setAudioUploadStateBySong((prev) => ({ ...prev, [song.id]: "uploading" }));
                            setAudioUploadMsgBySong((prev) => ({ ...prev, [song.id]: "Uploading audio..." }));
                            try {
                              await uploadPitchAudio(song.id, file);
                              setAudioUploadStateBySong((prev) => ({ ...prev, [song.id]: "saved" }));
                              setAudioUploadMsgBySong((prev) => ({ ...prev, [song.id]: "Audio uploaded and saved." }));
                              setAudioFileBySong((prev) => ({ ...prev, [song.id]: null }));
                              await load();
                            } catch (err) {
                              logSupabaseError("Failed to upload pitch audio from session workspace", err);
                              const msg = supabaseUserMessage("Could not upload pitch audio", err);
                              setAudioUploadStateBySong((prev) => ({ ...prev, [song.id]: "error" }));
                              setAudioUploadMsgBySong((prev) => ({ ...prev, [song.id]: msg }));
                              setErrorMsg(msg);
                            }
                          }}
                        >
                          {audioUploadStateBySong[song.id] === "uploading" ? "Uploading audio..." : "Upload Audio"}
                        </button>
                        {audioUploadMsgBySong[song.id] ? (
                          <p className="helper" style={{ color: audioUploadStateBySong[song.id] === "error" ? "#8a3d3d" : audioUploadStateBySong[song.id] === "saved" ? "#3f6b4a" : undefined }}>
                            {audioUploadMsgBySong[song.id]}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <input
                        value={song.audioSourceNote || ""}
                        placeholder="e.g. Downloaded from Dropbox bounce folder"
                        onChange={async (e) => {
                          const next = e.target.value;
                          setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, audioSourceNote: next } : s)));
                          const { error } = await supabase.from("song_works").update({ audio_source_note: next || null }).eq("id", song.id);
                          if (error) {
                            logSupabaseError("Failed to update audio source note from session workspace", error);
                            setErrorMsg(supabaseUserMessage("Could not save source note", error));
                          }
                        }}
                      />
                    </td>
                    <td>
                      <div className="rowActions compact">
                        {song.audioStoragePath ? <button className="button compact" onClick={async () => { try { await removePitchAudio(song.id, song.audioStoragePath); await load(); } catch (err) { logSupabaseError("Failed to remove pitch audio from session workspace", err); setErrorMsg(supabaseUserMessage("Could not remove pitch audio", err)); } }}>Remove</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Evidence / Assets" actions={<div id="add-asset" className="rowActions compact"><select value={assetSongId} onChange={(e)=>setAssetSongId(e.target.value)} style={{ minWidth: 160 }}><option value="">Select linked song</option>{songs.map((s)=><option key={s.id} value={s.id}>{s.title || "Untitled"}</option>)}</select><select value={assetType} onChange={(e)=>setAssetType(e.target.value)} style={{ minWidth: 180 }}><option value="bounce">Bounce</option><option value="lyrics">Lyrics</option><option value="acapella">Acapella</option><option value="voice_note">Voice Note</option><option value="apple_note">Apple Note</option><option value="google_doc">Google Doc</option><option value="dropbox">Dropbox</option><option value="message_evidence">Email/Pitch Trail</option><option value="screenshots">Screenshots</option><option value="other">Other</option></select><input value={assetUrl} onChange={(e)=>setAssetUrl(e.target.value)} placeholder="https://..." style={{ minWidth: 220 }} /><button className="button primary compact" onClick={addAsset}>Add Asset/Evidence</button></div>}>
        {assets.length === 0 ? <p className="helper">No assets/evidence linked yet.</p> : <div className="tableWrap"><table><thead><tr><th>Song</th><th>Type</th><th>Link</th><th>Actions</th></tr></thead><tbody>{assets.map((a)=><tr key={a.id}><td>{songs.find((s)=>s.id===a.song_id)?.title || a.song_id}</td><td>{evidenceLabel(a.type)}</td><td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">Open link</a> : <span className="helper">No link</span>}</td><td><div className="rowActions compact"><button className="button compact" onClick={()=>{ const next = window.prompt("Update evidence type", a.type); if (next !== null) updateAsset(a.id, { type: next }); }}>Edit Type</button><button className="button compact" onClick={()=>{ const next = window.prompt("Update evidence link", a.url || ""); if (next !== null) updateAsset(a.id, { url: next }); }}>Edit Link</button><button className="button compact" onClick={()=>deleteAsset(a.id)}>Delete</button></div></td></tr>)}</tbody></table></div>}
      </SectionCard>

      <SectionCard title="Actions / Follow-ups" actions={<div id="add-action" className="rowActions compact"><input value={newActionTask} onChange={(e)=>setNewActionTask(e.target.value)} placeholder="Follow-up task" style={{ minWidth: 220 }} /><input type="date" value={newActionDate} onChange={(e)=>setNewActionDate(e.target.value)} style={{ maxWidth: 170 }} /><button className="button primary compact" onClick={addAction}>Add Follow-up</button></div>}>
        {actions.length === 0 ? <p className="helper">No follow-ups linked yet.</p> : <div className="tableWrap"><table><thead><tr><th>Due</th><th>Task</th><th>Status</th><th>Actions</th></tr></thead><tbody>{actions.map((a)=><tr key={a.id}><td>{a.dueDate || <span className="helper">No date</span>}</td><td>{a.task || <span className="helper">No task</span>}</td><td>{a.status}</td><td><div className="rowActions compact"><button className="button compact" onClick={()=>deleteAction(a.id)}>Delete</button></div></td></tr>)}</tbody></table></div>}
      </SectionCard>

      <SectionCard title="Archive Review">
        <p className="helper" style={{ marginBottom: ".7rem" }}>
          Archive Reviewed means you have checked this session for the key admin/evidence items you currently know about.
        </p>
        <div className="kv">
          <dt>Archive Reviewed</dt><dd>{session.archive_reviewed ? "Yes" : "No"}</dd>
          <dt>Review Action</dt><dd><div className="rowActions compact"><button className={`button compact${session.archive_reviewed ? " primary" : ""}`} onClick={() => updateArchiveField("archive_reviewed", true)}>Mark as Reviewed</button></div></dd>
          <dt>Review Status</dt><dd><StatusBadge label={reviewFollowUpState} /></dd>
          <dt>Evidence Strength</dt><dd><div className="rowActions compact"><select value={effectiveEvidenceStrength} onChange={async (e)=>{ await updateArchiveField("evidence_strength", e.target.value); await updateArchiveField("evidence_strength_override", true); }}><option value="">Not Set</option><option value="Weak">Weak</option><option value="Partial">Partial</option><option value="Strong">Strong</option><option value="Complete">Complete</option></select><button className="button compact" onClick={async ()=>{ await updateArchiveField("evidence_strength", autoEvidenceStrength); await updateArchiveField("evidence_strength_override", false); }}>Use Auto</button><span className="helper">{strengthSourceLabel} ({autoEvidenceStrength})</span></div></dd>
          <dt>Review notes</dt><dd><textarea value={session.archive_review_notes || ""} onChange={(e)=>setSession((s)=>s ? { ...s, archive_review_notes: e.target.value } : s)} onBlur={(e)=>updateArchiveField("archive_review_notes", e.target.value)} placeholder="Add notes about what was checked or what is still missing." /></dd>
          <dt>Last reviewed date</dt><dd>{lastReviewedDate ? new Date(lastReviewedDate).toLocaleString() : <span className="helper">Not reviewed yet</span>}</dd>
        </div>
        <p className="helper" style={{ marginTop: ".6rem" }}>
          {archiveSaveState === "saving" ? "Saving..." : archiveSaveState === "saved" ? "Saved" : archiveSaveState === "error" ? "Could not save archive review update" : ""}
        </p>
        <div className="card" style={{ marginTop: ".8rem" }}>
          <h3 style={{ color: "var(--text)", fontSize: ".95rem", marginBottom: ".5rem" }}>Before marking reviewed, check:</h3>
          <div className="grid" style={{ gap: ".35rem" }}>
            <div>{evidenceChecks.sessionCore ? "✓" : "○"} session date/title correct</div>
            <div>{evidenceChecks.attendeesAdded ? "✓" : "○"} session attendees added where known</div>
            <div>{evidenceChecks.songTitlesLogged ? "✓" : "○"} song/work titles logged</div>
            <div>{evidenceChecks.writersAdded ? "✓" : "○"} writers added</div>
            <div>{evidenceChecks.splitsAdded ? "✓" : "○"} splits added</div>
            <div>{evidenceChecks.bounceLinked ? "✓" : "○"} bounce linked</div>
            <div>{evidenceChecks.lyricsLinked ? "✓" : "○"} lyrics linked</div>
            <div>{evidenceChecks.voiceNoteExists ? "✓" : "○"} voice note exists</div>
            <div>{evidenceChecks.acapellaExists ? "✓" : "○"} acapella exists (optional)</div>
            <div>{evidenceChecks.appleNoteExists ? "✓" : "○"} Apple Note exists</div>
            <div>{evidenceChecks.googleDocExists ? "✓" : "○"} Google Doc exists</div>
            <div>{evidenceChecks.dropboxExists ? "✓" : "○"} Dropbox link added</div>
            <div>{evidenceChecks.emailTrailExists ? "✓" : "○"} email/pitch trail exists</div>
            <div>{evidenceChecks.followUpLogged ? "✓" : "○"} follow-up action logged if something is missing</div>
          </div>
        </div>
        <div className="card" style={{ marginTop: ".65rem" }}>
          <h3 style={{ color: "var(--text)", fontSize: ".95rem", marginBottom: ".5rem" }}>Missing Evidence Warnings</h3>
          {missingWarnings.length ? <div className="rowActions compact">{missingWarnings.map((w) => <span key={w} className="statusBadge amber">{w}</span>)}</div> : <p className="helper">No major evidence gaps detected.</p>}
        </div>
        <details style={{ marginTop: ".75rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Review History</summary>
          {reviewHistory.length === 0 ? <p className="helper" style={{ marginTop: ".5rem" }}>No review history yet.</p> : (
            <div className="tableWrap" style={{ marginTop: ".6rem" }}>
              <table>
                <thead><tr><th>When</th><th>Event</th><th>Field</th><th>From</th><th>To</th></tr></thead>
                <tbody>
                  {reviewHistory.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.created_at).toLocaleString()}</td>
                      <td>{row.event_type}</td>
                      <td>{row.field_name}</td>
                      <td>{row.old_value || <span className="helper">-</span>}</td>
                      <td>{row.new_value || <span className="helper">-</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      </SectionCard>
    </div>
  );
}
