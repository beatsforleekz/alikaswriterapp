"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  evidence_strength_override?: boolean;
};
type SongLite = { id: string; session_id?: string | null; title: string; bounce_link?: string | null; lyrics_link?: string | null };
type AssetLite = { song_id: string; type: string; url?: string | null };
type SplitLite = { song_id: string; writer_name: string; percentage?: number | null };
type ActionLite = { id: string; session_id?: string | null; due_date?: string | null; task: string; status: string; created_at?: string | null };

type ReviewFilter = "not-reviewed" | "all";
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

export default function ArchiveProgressPage() {
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [splits, setSplits] = useState<SplitLite[]>([]);
  const [actions, setActions] = useState<ActionLite[]>([]);

  const [year, setYear] = useState<number>(years[0]);
  const [startDate, setStartDate] = useState<string>(`${years[0]}-01-01`);
  const [endDate, setEndDate] = useState<string>(`${years[0]}-12-31`);
  const [filter, setFilter] = useState<ReviewFilter>("not-reviewed");
  const [inReview, setInReview] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [strengthDraft, setStrengthDraft] = useState<Record<string, string>>({});
  const [followUpTask, setFollowUpTask] = useState("");
  const [followUpDue, setFollowUpDue] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const load = async () => {
    const [sRes, songRes, assetRes, splitRes, actionRes] = await Promise.all([
      supabase.from("sessions").select("id,date,title,location,archive_reviewed,archive_review_notes,evidence_strength,evidence_strength_override").order("date", { ascending: true }),
      supabase.from("song_works").select("id,session_id,title,bounce_link,lyrics_link"),
      supabase.from("asset_links").select("song_id,type,url"),
      supabase.from("song_writer_splits").select("song_id,percentage,writers(name)"),
      supabase.from("action_items").select("id,session_id,due_date,task,status,created_at").order("created_at", { ascending: false }),
    ]);
    if (sRes.error || songRes.error || assetRes.error || splitRes.error || actionRes.error) {
      const e = sRes.error || songRes.error || assetRes.error || splitRes.error || actionRes.error;
      logSupabaseError("Failed to load archive review data", e);
      setErrorMsg(supabaseUserMessage("Could not load archive review data", e));
      return;
    }

    setSessions((sRes.data ?? []) as SessionLite[]);
    setSongs((songRes.data ?? []) as SongLite[]);
    setAssets((assetRes.data ?? []) as AssetLite[]);
    setSplits((splitRes.data ?? []).map((r) => {
      const row = r as { song_id: string; percentage?: number | null; writers?: { name?: string } | null };
      return { song_id: String(row.song_id), writer_name: String(row.writers?.name ?? ""), percentage: row.percentage ?? null };
    }));
    setActions((actionRes.data ?? []) as ActionLite[]);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredSessions = useMemo(() => {
    return sessions
      .filter((s) => s.date?.startsWith(String(year)))
      .filter((s) => !startDate || s.date >= startDate)
      .filter((s) => !endDate || s.date <= endDate)
      .filter((s) => (filter === "not-reviewed" ? !s.archive_reviewed : true))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, year, startDate, endDate, filter]);

  const current = filteredSessions[cursor] ?? null;
  const currentSongs = useMemo(() => songs.filter((s) => String(s.session_id || "") === String(current?.id || "")), [songs, current?.id]);
  const currentSongIds = useMemo(() => new Set(currentSongs.map((s) => s.id)), [currentSongs]);
  const currentAssets = useMemo(() => assets.filter((a) => currentSongIds.has(String(a.song_id))), [assets, currentSongIds]);
  const currentSplits = useMemo(() => splits.filter((sp) => currentSongIds.has(String(sp.song_id))), [splits, currentSongIds]);
  const currentActions = useMemo(() => actions.filter((a) => String(a.session_id || "") === String(current?.id || "")), [actions, current?.id]);

  const evidence = useMemo(() => {
    const hasBounce = (song: SongLite) => Boolean(song.bounce_link) || currentAssets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "bounce" && Boolean(a.url));
    const hasLyrics = (song: SongLite) => Boolean(song.lyrics_link) || currentAssets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "lyrics" && Boolean(a.url));
    const totalSongs = currentSongs.length;
    const bounceCount = currentSongs.filter((s) => hasBounce(s)).length;
    const lyricsCount = currentSongs.filter((s) => hasLyrics(s)).length;
    const writersCount = [...new Set(currentSplits.map((s) => s.writer_name).filter(Boolean))].length;
    const hasSupporting = currentAssets.some((a) => ["voice_note", "acapella", "dropbox", "google_doc", "apple_note", "message_evidence", "screenshots"].includes(normalizeEvidenceType(a.type || "")) && Boolean(a.url));
    const missing: string[] = [];
    if (totalSongs === 0) missing.push("No linked songs");
    if (bounceCount < totalSongs) missing.push("Missing Bounce");
    if (lyricsCount < totalSongs) missing.push("Missing Lyrics");
    if (writersCount === 0) missing.push("No Writers");
    if (!hasSupporting) missing.push("No Supporting Links");
    return { totalSongs, bounceCount, lyricsCount, writersCount, hasSupporting, missing };
  }, [currentSongs, currentAssets, currentSplits]);

  const reviewedCount = useMemo(() => filteredSessions.filter((s) => s.archive_reviewed).length, [filteredSessions]);
  const remainingCount = Math.max(filteredSessions.length - reviewedCount, 0);
  const progressPct = filteredSessions.length ? Math.round(((cursor + 1) / filteredSessions.length) * 100) : 0;

  const startReview = () => {
    setCursor(0);
    setInReview(true);
    setSaveMsg("");
    setErrorMsg("");
  };

  const saveCurrent = async (markReviewed?: boolean) => {
    if (!current) return true;
    setErrorMsg("");
    const notes = (notesDraft[current.id] ?? current.archive_review_notes ?? "").trim();
    const strength = (strengthDraft[current.id] ?? current.evidence_strength ?? "").trim();
    const patch: Record<string, string | boolean | null> = {
      archive_review_notes: notes || null,
      evidence_strength: strength || null,
    };
    if (typeof markReviewed === "boolean") patch.archive_reviewed = markReviewed;

    const { error } = await supabase.from("sessions").update(patch).eq("id", current.id);
    if (error) {
      logSupabaseError("Failed to save archive review step", error);
      setErrorMsg(supabaseUserMessage("Could not save this review step", error));
      return false;
    }
    if (followUpTask.trim()) {
      const { error: actionErr } = await supabase.from("action_items").insert({
        task: followUpTask.trim(),
        due_date: followUpDue || "",
        priority: "Medium",
        status: "Open",
        session_id: current.id,
      });
      if (actionErr) {
        logSupabaseError("Failed to create follow-up from archive review", actionErr);
        setErrorMsg(supabaseUserMessage("Session saved, but follow-up could not be created", actionErr));
      } else {
        setFollowUpTask("");
        setFollowUpDue("");
      }
    }

    await supabase.from("archive_progress").upsert({
      year,
      archive_reviewed_up_to: current.date || null,
      last_audited_session_date: current.date || null,
      notes: `Guided review in progress (${startDate} to ${endDate}, filter: ${filter}).`,
    }, { onConflict: "year" });

    await load();
    setSaveMsg("Progress saved.");
    window.setTimeout(() => setSaveMsg(""), 1200);
    return true;
  };

  const back = () => setCursor((c) => Math.max(c - 1, 0));
  const next = () => setCursor((c) => Math.min(c + 1, Math.max(filteredSessions.length - 1, 0)));

  const markReviewedAndNext = async () => {
    const ok = await saveCurrent(true);
    if (!ok) return;
    if (cursor < filteredSessions.length - 1) setCursor((c) => c + 1);
  };

  const completionStats = useMemo(() => {
    const sessionIds = new Set(filteredSessions.map((s) => s.id));
    const scopedSongs = songs.filter((s) => sessionIds.has(String(s.session_id || "")));
    const hasBounce = (song: SongLite) => Boolean(song.bounce_link) || assets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "bounce" && Boolean(a.url));
    const hasLyrics = (song: SongLite) => Boolean(song.lyrics_link) || assets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "lyrics" && Boolean(a.url));
    const missingBounce = scopedSongs.filter((s) => !hasBounce(s)).length;
    const missingLyrics = scopedSongs.filter((s) => !hasLyrics(s)).length;
    const weakPartial = filteredSessions.filter((s) => ["Weak", "Partial"].includes(String(s.evidence_strength || ""))).length;
    const followUps = actions.filter((a) => sessionIds.has(String(a.session_id || ""))).length;
    return { missingBounce, missingLyrics, weakPartial, followUps };
  }, [filteredSessions, songs, assets, actions]);

  return (
    <div>
      <PageHeader title="Archive Progress" subtitle="Guided Archive Review workflow by period." />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}

      <SectionCard title="Archive Review Tool">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: ".6rem" }}>
          <div><label className="helper">Year</label><select value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); setStartDate(`${y}-01-01`); setEndDate(`${y}-12-31`); }}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
          <div><label className="helper">Start date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><label className="helper">End date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          <div><label className="helper">Status filter</label><select value={filter} onChange={(e) => setFilter(e.target.value as ReviewFilter)}><option value="not-reviewed">Not reviewed only</option><option value="all">All sessions</option></select></div>
        </div>
        <div className="rowActions" style={{ marginTop: ".75rem" }}>
          <button className="button primary" onClick={startReview}>Start Review</button>
          <span className="helper">{filteredSessions.length} sessions in selected period</span>
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
            <div className="rowActions" style={{ justifyContent: "space-between", marginBottom: ".55rem" }}>
              <strong>Session {cursor + 1} of {filteredSessions.length}</strong>
              <span className="helper">Reviewed: {reviewedCount} · Remaining: {remainingCount}</span>
            </div>
            <div className="progressBar" style={{ marginBottom: ".8rem" }}><span style={{ width: `${progressPct}%` }} /></div>

            <div className="kv">
              <dt>Date</dt><dd>{fmtDate(current.date)}</dd>
              <dt>Title</dt><dd>{current.title || <span className="helper">Untitled Session</span>}</dd>
              <dt>Location</dt><dd>{current.location || <span className="helper">No location</span>}</dd>
              <dt>Archive Reviewed</dt><dd>{current.archive_reviewed ? "Yes" : "No"}</dd>
              <dt>Evidence Strength</dt><dd><select value={strengthDraft[current.id] ?? current.evidence_strength ?? ""} onChange={(e) => setStrengthDraft((p) => ({ ...p, [current.id]: e.target.value }))}><option value="">Not Set</option><option value="Weak">Weak</option><option value="Partial">Partial</option><option value="Strong">Strong</option><option value="Complete">Complete</option></select></dd>
              <dt>Review Notes</dt><dd><textarea value={notesDraft[current.id] ?? current.archive_review_notes ?? ""} onChange={(e) => setNotesDraft((p) => ({ ...p, [current.id]: e.target.value }))} placeholder="Add review notes for this session" /></dd>
            </div>

            <div className="tableWrap" style={{ marginTop: ".75rem" }}>
              <table>
                <thead><tr><th>Song / Work</th><th>Bounce</th><th>Lyrics</th><th>Writers/Splits</th></tr></thead>
                <tbody>
                  {currentSongs.length === 0 ? <tr><td colSpan={4} className="helper">No linked songs/works yet.</td></tr> : currentSongs.map((song) => {
                    const hasBounce = Boolean(song.bounce_link) || currentAssets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "bounce" && Boolean(a.url));
                    const hasLyrics = Boolean(song.lyrics_link) || currentAssets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "lyrics" && Boolean(a.url));
                    const writersForSong = currentSplits.filter((s) => s.song_id === song.id).map((s) => `${s.writer_name}${s.percentage !== null && s.percentage !== undefined ? ` (${s.percentage}%)` : ""}`);
                    return <tr key={song.id}><td>{song.title || "Untitled"}</td><td>{hasBounce ? "Yes" : <span className="helper">Missing</span>}</td><td>{hasLyrics ? "Yes" : <span className="helper">Missing</span>}</td><td>{writersForSong.length ? writersForSong.join(", ") : <span className="helper">No writers yet</span>}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>

            <div className="card" style={{ marginTop: ".75rem" }}>
              <h3 style={{ color: "var(--text)", fontSize: ".95rem", marginBottom: ".45rem" }}>Evidence Checklist</h3>
              <div className="grid" style={{ gap: ".3rem" }}>
                <div>{evidence.bounceCount}/{evidence.totalSongs} Bounce linked</div>
                <div>{evidence.lyricsCount}/{evidence.totalSongs} Lyrics linked</div>
                <div>{evidence.writersCount > 0 ? "✓" : "○"} writers/attendees added</div>
                <div>{evidence.hasSupporting ? "✓" : "○"} supporting evidence links exist</div>
              </div>
            </div>

            <div className="card" style={{ marginTop: ".6rem" }}>
              <h3 style={{ color: "var(--text)", fontSize: ".95rem", marginBottom: ".45rem" }}>Missing Evidence Warnings</h3>
              {evidence.missing.length ? <div className="rowActions compact">{evidence.missing.map((m) => <span key={m} className="statusBadge amber">{m}</span>)}</div> : <p className="helper">No major evidence gaps detected.</p>}
            </div>

            <div className="card" style={{ marginTop: ".6rem" }}>
              <h3 style={{ color: "var(--text)", fontSize: ".95rem", marginBottom: ".45rem" }}>Follow-up Actions</h3>
              {currentActions.length ? <div className="tableWrap"><table><thead><tr><th>Due</th><th>Task</th><th>Status</th></tr></thead><tbody>{currentActions.map((a) => <tr key={a.id}><td>{a.due_date || <span className="helper">No date</span>}</td><td>{a.task}</td><td>{a.status}</td></tr>)}</tbody></table></div> : <p className="helper">No follow-ups yet.</p>}
              <div className="rowActions compact" style={{ marginTop: ".5rem" }}>
                <input value={followUpTask} onChange={(e) => setFollowUpTask(e.target.value)} placeholder="Add follow-up task" style={{ minWidth: 240 }} />
                <input type="date" value={followUpDue} onChange={(e) => setFollowUpDue(e.target.value)} style={{ maxWidth: 180 }} />
              </div>
            </div>

            <div className="rowActions" style={{ marginTop: ".85rem" }}>
              <button className="button" onClick={back} disabled={cursor === 0}>Back</button>
              <button className="button" onClick={next} disabled={cursor >= filteredSessions.length - 1}>Next</button>
              <button className="button primary" onClick={markReviewedAndNext}>Mark Reviewed & Next</button>
              <button className="button" onClick={() => saveCurrent()}>Save Progress</button>
              {saveMsg ? <span className="helper">{saveMsg}</span> : null}
            </div>
          </SectionCard>
        )
      ) : null}
    </div>
  );
}
