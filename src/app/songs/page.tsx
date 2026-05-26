"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SongWork } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import FilterBar from "@/components/ui/FilterBar";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { supabase } from "@/lib/supabase";
import { mapSong } from "@/lib/mappers";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

type SessionRef = { id: string; title: string; date: string; evidence_strength?: string | null };
type AssetRef = { song_id: string; type: string; url?: string | null };
type SplitRef = { song_id: string; writer_name: string; percentage?: number | null };
type SongTagRef = { song_id: string; tag_name: string };

function normalizeEvidenceType(raw: string) {
  const t = raw.toLowerCase().trim();
  if (["lyrics", "lyric", "song lyrics", "song_lyrics"].includes(t)) return "lyrics";
  if (["bounce", "bounce in", "bounce_in"].includes(t)) return "bounce";
  return t;
}

function match(song: SongWork, f: string, assets: AssetRef[]) {
  const songAssets = assets.filter((a) => a.song_id === song.id);
  const hasBounce = Boolean(song.bounceLink?.trim()) || songAssets.some((a) => normalizeEvidenceType(a.type) === "bounce" && Boolean(a.url));
  const hasLyrics = Boolean(song.lyricsLink?.trim()) || songAssets.some((a) => normalizeEvidenceType(a.type) === "lyrics" && Boolean(a.url));
  switch (f) {
    case "no-bounce": return !hasBounce;
    case "no-lyrics": return !hasLyrics;
    case "pitched": return song.status === "Pitched";
    case "on-hold": return song.status === "On Hold";
    case "cut": return song.status === "Cut";
    case "released": return song.status === "Released";
    case "disputed": return song.status === "Disputed";
    case "complete": return song.status === "Complete";
    case "audio-ready": return Boolean(song.audioStoragePath);
    default: return true;
  }
}

const csvSafe = (v: string) => `"${v.replace(/"/g, '""')}"`;

export default function SongsPage() {
  const [rows, setRows] = useState<SongWork[]>([]);
  const [sessions, setSessions] = useState<SessionRef[]>([]);
  const [assets, setAssets] = useState<AssetRef[]>([]);
  const [splits, setSplits] = useState<SplitRef[]>([]);
  const [songTags, setSongTags] = useState<SongTagRef[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"az" | "za" | "date" | "recent" | "added">("recent");
  const [errorMsg, setErrorMsg] = useState("");

  const deleteSong = async (id: string) => {
    if (!window.confirm("Delete this song/work?")) return;
    setErrorMsg("");
    const { error } = await supabase.from("song_works").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete song from songs list", error);
      setErrorMsg(supabaseUserMessage("Could not delete song/work", error));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingFilter = params.get("filter");
    if (incomingFilter) setFilter(incomingFilter);
    const incomingSearch = params.get("search");
    if (incomingSearch) setSearch(incomingSearch);
    const incomingTag = params.get("tag");
    if (incomingTag) setTagFilter(incomingTag);
  }, []);

  const load = async () => {
    const [songRes, sessionRes, assetRes, splitRes, tagRes] = await Promise.all([
      supabase.from("song_works").select("*").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id,title,date,evidence_strength"),
      supabase.from("asset_links").select("song_id,type,url"),
      supabase.from("song_writer_splits").select("song_id,percentage,writers(name)"),
      supabase.from("song_work_tags").select("song_id,song_tags(name)"),
    ]);
    if (songRes.error || sessionRes.error || assetRes.error || splitRes.error || tagRes.error) {
      const e = songRes.error || sessionRes.error || assetRes.error || splitRes.error || tagRes.error;
      logSupabaseError("Failed to load songs library", e);
      setErrorMsg(supabaseUserMessage("Could not load songs/works", e));
      return;
    }
    setRows((songRes.data ?? []).map((r) => mapSong(r as Record<string, unknown>)));
    setSessions((sessionRes.data ?? []) as SessionRef[]);
    setAssets((assetRes.data ?? []) as AssetRef[]);
    setSplits(
      (splitRes.data ?? []).map((row) => {
        const r = row as { song_id: string; percentage?: number | null; writers?: { name?: string } | null };
        return { song_id: String(r.song_id), writer_name: String(r.writers?.name ?? ""), percentage: r.percentage ?? null };
      }),
    );
    setSongTags(
      (tagRes.data ?? []).map((row) => {
        const r = row as { song_id: string; song_tags?: { name?: string } | null };
        return { song_id: String(r.song_id), tag_name: String(r.song_tags?.name ?? "") };
      }),
    );
  };
  useEffect(() => { load(); }, []);

  const allTags = useMemo(() => [...new Set(songTags.map((t) => t.tag_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [songTags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!match(r, filter, assets)) return false;
      const tagsForSong = songTags.filter((t) => t.song_id === r.id).map((t) => t.tag_name);
      if (tagFilter !== "all" && !tagsForSong.some((t) => t.toLowerCase() === tagFilter.toLowerCase())) return false;
      if (!q) return true;
      const writerNames = [...new Set(splits.filter((split) => split.song_id === r.id).map((split) => split.writer_name).filter(Boolean))];
      const hay = [r.title, r.status, ...writerNames, ...tagsForSong].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, assets, search, splits, songTags, tagFilter]);

  const sortedFiltered = useMemo(() => {
    const next = [...filtered];
    if (sortBy === "az") {
      next.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));
    } else if (sortBy === "za") {
      next.sort((a, b) => (b.title || "").localeCompare(a.title || "", undefined, { sensitivity: "base" }));
    } else if (sortBy === "date") {
      const sessionDate = (song: SongWork) => sessions.find((s) => s.id === song.sessionId)?.date || "";
      next.sort((a, b) => sessionDate(a).localeCompare(sessionDate(b)));
    } else if (sortBy === "added") {
      next.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
    } else {
      const sessionDate = (song: SongWork) => sessions.find((s) => s.id === song.sessionId)?.date || "";
      next.sort((a, b) => sessionDate(b).localeCompare(sessionDate(a)));
    }
    return next;
  }, [filtered, sortBy, sessions]);

  const exportCsv = () => {
    const header = ["Title", "Status", "Tags", "Writers", "Splits", "Session Date", "Evidence Strength", "Bounce", "Lyrics", "Audio Ready", "Notes"];
    const lines = [header.map(csvSafe).join(",")];
    for (const s of filtered) {
      const songAssets = assets.filter((a) => a.song_id === s.id);
      const hasBounce = Boolean(s.bounceLink?.trim()) || songAssets.some((a) => normalizeEvidenceType(a.type) === "bounce" && Boolean(a.url));
      const hasLyrics = Boolean(s.lyricsLink?.trim()) || songAssets.some((a) => normalizeEvidenceType(a.type) === "lyrics" && Boolean(a.url));
      const writerRows = splits.filter((split) => split.song_id === s.id).filter((w) => w.writer_name);
      const writerNames = [...new Set(writerRows.map((w) => w.writer_name))];
      const splitText = writerRows.map((w) => `${w.writer_name}:${w.percentage ?? "auto"}`).join(" | ");
      const tagsForSong = songTags.filter((t) => t.song_id === s.id).map((t) => t.tag_name);
      const parent = sessions.find((x) => x.id === s.sessionId);
      const row = [
        s.title || "Untitled Song",
        s.status || "",
        tagsForSong.join(", "),
        writerNames.join(", "),
        splitText,
        parent?.date || "",
        String(parent?.evidence_strength || ""),
        hasBounce ? "Yes" : "No",
        hasLyrics ? "Yes" : "No",
        s.audioStoragePath ? "Yes" : "No",
        s.notes || "",
      ];
      lines.push(row.map((cell) => csvSafe(String(cell))).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `songs_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Songs / Works" subtitle="Songs are managed from Session workspaces. This page reflects linked catalogue data." actions={<div className="rowActions"><button className="button" onClick={exportCsv}>Export CSV</button><Link className="button" href="/sessions">Go to Sessions Workspace</Link></div>} />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}

      <FilterBar>
        <label>Filter</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="all">All</option>
          <option value="no-bounce">No Bounce</option>
          <option value="no-lyrics">No Lyrics</option>
          <option value="pitched">Pitched</option>
          <option value="on-hold">On Hold</option>
          <option value="cut">Cut</option>
          <option value="released">Released</option>
          <option value="disputed">Disputed</option>
          <option value="complete">Complete</option>
          <option value="audio-ready">Audio Ready</option>
        </select>
        <label>Tag</label>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="all">All Tags</option>
          {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        <label>Search</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, writer, status, tag" style={{ maxWidth: 280 }} />
        <label>Sort</label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "az" | "za" | "date" | "recent" | "added")} style={{ maxWidth: 200 }}>
          <option value="az">A-Z</option>
          <option value="za">Z-A</option>
          <option value="date">Date (Oldest)</option>
          <option value="recent">Most Recent</option>
          <option value="added">Date Added</option>
        </select>
      </FilterBar>

      <SectionCard>
        {sortedFiltered.length === 0 ? (
          <EmptyState title="No songs/works yet" hint="Open a session to add songs and enrich catalogue records." action={<Link className="button primary" href="/sessions">Open Sessions</Link>} />
        ) : (
          <>
          <div className="tableWrap desktopOnly">
            <table>
              <thead><tr><th>Title</th><th>Status</th><th>Tags</th><th>Bounce</th><th>Lyrics</th><th>Writers</th><th>Session</th><th>Actions</th></tr></thead>
              <tbody>
                {sortedFiltered.map((s) => {
                  const songAssets = assets.filter((a) => a.song_id === s.id);
                  const hasBounce = Boolean(s.bounceLink?.trim()) || songAssets.some((a) => normalizeEvidenceType(a.type) === "bounce" && Boolean(a.url));
                  const hasLyrics = Boolean(s.lyricsLink?.trim()) || songAssets.some((a) => normalizeEvidenceType(a.type) === "lyrics" && Boolean(a.url));
                  const writerNames = [...new Set(splits.filter((split) => split.song_id === s.id).map((split) => split.writer_name).filter(Boolean))];
                  const tagsForSong = songTags.filter((t) => t.song_id === s.id).map((t) => t.tag_name);
                  const parent = sessions.find((x) => x.id === s.sessionId);
                  return (
                    <tr key={s.id}>
                      <td><Link href={`/songs/${s.id}`}>{s.title || "Untitled Song"}</Link></td>
                      <td><StatusBadge label={s.status} /></td>
                      <td>{tagsForSong.length ? tagsForSong.join(", ") : <span className="helper">No tags</span>}</td>
                      <td>{hasBounce ? "Yes" : <span className="helper">Missing</span>}</td>
                      <td>{hasLyrics ? "Yes" : <span className="helper">Missing</span>}</td>
                      <td>{writerNames.length ? writerNames.join(", ") : <span className="helper">No writers</span>}</td>
                      <td>{parent ? `${parent.date} - ${parent.title || "Untitled Session"}` : <span className="helper">Unlinked</span>}</td>
                      <td><div className="rowActions compact"><Link className="button compact" href={`/songs/${s.id}`}>Edit</Link>{parent ? <Link className="button compact" href={`/sessions/${parent.id}`}>Session</Link> : <span className="helper">No session</span>}<button className="button compact" onClick={() => deleteSong(s.id)}>Delete</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mobileOnly mobileCardList">
            {sortedFiltered.map((s) => {
              const songAssets = assets.filter((a) => a.song_id === s.id);
              const hasBounce = Boolean(s.bounceLink?.trim()) || songAssets.some((a) => normalizeEvidenceType(a.type) === "bounce" && Boolean(a.url));
              const hasLyrics = Boolean(s.lyricsLink?.trim()) || songAssets.some((a) => normalizeEvidenceType(a.type) === "lyrics" && Boolean(a.url));
              const parent = sessions.find((x) => x.id === s.sessionId);
              return (
                <div key={`mobile-song-${s.id}`} className="mobileDataCard">
                  <h4>{s.title || "Untitled Song"}</h4>
                  <div className="rowActions compact" style={{ marginBottom: ".35rem" }}>
                    <StatusBadge label={s.status} />
                    <span className={`statusBadge ${hasBounce ? "sage" : "amber"}`}>{hasBounce ? "Bounce" : "Needs Bounce"}</span>
                    <span className={`statusBadge ${hasLyrics ? "sage" : "amber"}`}>{hasLyrics ? "Lyrics" : "Needs Lyrics"}</span>
                  </div>
                  <p className="helper">{parent ? `${parent.date} - ${parent.title || "Untitled Session"}` : "Unlinked session"}</p>
                  <div className="rowActions compact" style={{ marginTop: ".45rem" }}>
                    <Link className="button compact" href={`/songs/${s.id}`}>Edit</Link>
                    {parent ? <Link className="button compact" href={`/sessions/${parent.id}`}>Session</Link> : null}
                    <button className="button compact" onClick={() => deleteSong(s.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
