"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mapSession } from "@/lib/mappers";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import { Session } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";

type ImportPreviewRow = { id: string; title: string; date: string; dateTimeText: string; location: string; notes: string; attendees: string[]; source: "calendar_import"; calendar_event_id?: string; isDuplicate: boolean };
type SongRow = { id: string; session_id?: string | null; bounce_link?: string | null; lyrics_link?: string | null };
type AssetRow = { song_id: string; type: string; url?: string | null };
type SplitRow = { song_id: string; percentage?: number | null };
type ActionRow = { session_id?: string | null; status?: string | null };

const unfoldIcs = (text: string) => text.replace(/\r\n/g, "\n").split("\n").reduce<string[]>((a, l) => {
  if ((l.startsWith(" ") || l.startsWith("\t")) && a.length) a[a.length - 1] += l.trimStart();
  else a.push(l);
  return a;
}, []);
const normalizeText = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
const similarTitle = (a: string, b: string) => { const x = normalizeText(a), y = normalizeText(b); return x === y || x.includes(y) || y.includes(x); };
function parseIcsDate(value: string) {
  if (!value) return { date: "", text: "" };
  if (/^\d{8}$/.test(value)) {
    const d = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    return { date: d, text: d };
  }
  const raw = value.endsWith("Z") ? value.slice(0, -1) : value;
  const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return { date, text: `${date} ${raw.slice(9, 11) || "00"}:${raw.slice(11, 13) || "00"}` };
}
function parseIcs(text: string, existing: Session[]) {
  const lines = unfoldIcs(text);
  const out: ImportPreviewRow[] = [];
  let inEvent = false, title = "", location = "", notes = "", dtStart = "", uid = "", attendees: string[] = [];
  const flush = () => {
    if (!title && !dtStart && !location && !notes) return;
    const d = parseIcsDate(dtStart);
    out.push({
      id: crypto.randomUUID(),
      title,
      date: d.date,
      dateTimeText: d.text,
      location,
      notes,
      attendees,
      source: "calendar_import",
      calendar_event_id: uid,
      isDuplicate: existing.some((s) => s.date === d.date && similarTitle(s.title || "", title || "")),
    });
  };
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { inEvent = true; title = ""; location = ""; notes = ""; dtStart = ""; uid = ""; attendees = []; continue; }
    if (line === "END:VEVENT") { inEvent = false; flush(); continue; }
    if (!inEvent) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).split(";")[0];
    const value = line.slice(idx + 1).replace(/\\n/g, " ").trim();
    if (key === "SUMMARY") title = value;
    if (key === "DTSTART") dtStart = value;
    if (key === "LOCATION") location = value;
    if (key === "DESCRIPTION") notes = value;
    if (key === "UID") uid = value;
    if (key === "ATTENDEE") attendees.push(value.replace(/^mailto:/i, ""));
  }
  return out;
}

function normalizeEvidenceType(raw: string) {
  const t = raw.toLowerCase().trim();
  if (["lyrics", "lyric", "song lyrics", "song_lyrics"].includes(t)) return "lyrics";
  if (["bounce", "bounce in", "bounce_in"].includes(t)) return "bounce";
  return t;
}

function autoStrengthForSession(session: Session, songs: SongRow[], assets: AssetRow[], splits: SplitRow[], actions: ActionRow[]) {
  const normalizedAssets = assets.map((a) => ({ ...a, t: normalizeEvidenceType(a.type || "") }));
  const hasBounce = (song: SongRow) => Boolean(song.bounce_link) || normalizedAssets.some((a) => a.song_id === song.id && a.t === "bounce" && Boolean(a.url));
  const hasLyrics = (song: SongRow) => Boolean(song.lyrics_link) || normalizedAssets.some((a) => a.song_id === song.id && a.t === "lyrics" && Boolean(a.url));
  const bounceLinked = songs.some((song) => hasBounce(song));
  const lyricsLinked = songs.some((song) => hasLyrics(song));
  const songsWithFullEvidence = songs.filter((song) => hasBounce(song) && hasLyrics(song)).length;
  const allSongsHaveFullEvidence = songs.length > 0 && songsWithFullEvidence === songs.length;
  const voiceNoteExists = normalizedAssets.some((a) => a.t === "voice_note" && Boolean(a.url));
  const acapellaExists = normalizedAssets.some((a) => a.t === "acapella" && Boolean(a.url));
  const appleNoteExists = normalizedAssets.some((a) => a.t === "apple_note" && Boolean(a.url));
  const googleDocExists = normalizedAssets.some((a) => a.t === "google_doc" && Boolean(a.url));
  const dropboxExists = normalizedAssets.some((a) => a.t === "dropbox" && Boolean(a.url));
  const emailTrailExists = normalizedAssets.some((a) => (a.t === "message_evidence" || a.t === "screenshots") && Boolean(a.url));
  const writersAdded = splits.length > 0;
  const splitsAdded = splits.some((r) => r.percentage !== null && r.percentage !== undefined);
  const attendeesAdded = splits.length > 0;
  const songTitlesLogged = songs.length > 0;
  const followUpLogged = actions.length > 0;
  const sessionCore = Boolean(session.date?.trim()) && Boolean(session.title?.trim());

  let score = 0;
  if (sessionCore) score += 1;
  if (songTitlesLogged) score += 1;
  if (bounceLinked) score += 2;
  if (lyricsLinked) score += 2;
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

  if (!bounceLinked && !lyricsLinked && score <= 3) return "Weak" as const;
  if ((bounceLinked || lyricsLinked) && score < 9) return "Partial" as const;
  if (bounceLinked && lyricsLinked && score >= 9 && score < 13) return "Strong" as const;
  if (allSongsHaveFullEvidence && writersAdded && splitsAdded && (dropboxExists || googleDocExists || appleNoteExists || voiceNoteExists) && (session.archive_reviewed || followUpLogged)) return "Complete" as const;
  return score >= 9 ? ("Strong" as const) : ("Partial" as const);
}

export default function SessionsPage() {
  const [viewMode, setViewMode] = useState<"calendar" | "records">("records");
  const [rows, setRows] = useState<Session[]>([]);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<string>>(new Set());
  const [importMessage, setImportMessage] = useState("");
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<"az" | "za" | "date" | "recent" | "added">("recent");
  const [reviewFilter, setReviewFilter] = useState<"all" | "reviewed" | "not-reviewed" | "needs-follow-up">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "calendar" | "calendar_import">("all");
  const [evidenceFilter, setEvidenceFilter] = useState<"all" | "weak-partial" | "strong-complete">("all");
  const initialized = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [sessionRes, songRes, assetRes, splitRes, actionRes] = await Promise.all([
      supabase.from("sessions").select("*").order("date", { ascending: false }),
      supabase.from("song_works").select("id,session_id,bounce_link,lyrics_link"),
      supabase.from("asset_links").select("song_id,type,url"),
      supabase.from("song_writer_splits").select("song_id,percentage"),
      supabase.from("action_items").select("session_id,status"),
    ]);
    if (sessionRes.error || songRes.error || assetRes.error || splitRes.error || actionRes.error) {
      const e = sessionRes.error || songRes.error || assetRes.error || splitRes.error || actionRes.error;
      logSupabaseError("Failed to load sessions", e);
      setError(supabaseUserMessage("Could not load sessions", e));
      return;
    }
    setRows((sessionRes.data ?? []).map((r) => mapSession(r as Record<string, unknown>)));
    setSongs((songRes.data ?? []) as SongRow[]);
    setAssets((assetRes.data ?? []) as AssetRow[]);
    setSplits((splitRes.data ?? []) as SplitRow[]);
    setActions((actionRes.data ?? []) as ActionRow[]);
  };
  useEffect(() => { load(); }, []);

  const effectiveStrengthBySession = useMemo(() => {
    const out: Record<string, { value: string; source: "manual" | "auto" }> = {};
    rows.forEach((session) => {
      const sessionSongs = songs.filter((s) => String(s.session_id || "") === session.id);
      const songIds = new Set(sessionSongs.map((s) => s.id));
      const sessionAssets = assets.filter((a) => songIds.has(String(a.song_id)));
      const sessionSplits = splits.filter((sp) => songIds.has(String(sp.song_id)));
      const sessionActions = actions.filter((a) => String(a.session_id || "") === session.id);
      const auto = autoStrengthForSession(session, sessionSongs, sessionAssets, sessionSplits, sessionActions);
      if (session.evidence_strength_override && session.evidence_strength) {
        out[session.id] = { value: session.evidence_strength, source: "manual" };
      } else {
        out[session.id] = { value: auto, source: "auto" };
      }
    });
    return out;
  }, [rows, songs, assets, splits, actions]);

  const archiveReviewedLabelBySession = useMemo(() => {
    const openStatuses = new Set(["open", "in progress", "pending", "todo"]);
    const out: Record<string, string> = {};
    rows.forEach((session) => {
      if (!session.archive_reviewed) {
        out[session.id] = "No";
        return;
      }
      const sessionActions = actions.filter((a) => String(a.session_id || "") === session.id);
      if (!sessionActions.length) {
        out[session.id] = "Yes";
        return;
      }
      const hasOpen = sessionActions.some((a) => openStatuses.has(String(a.status || "").toLowerCase().trim()));
      out[session.id] = hasOpen ? "Yes - Open" : "Yes - Closed";
    });
    return out;
  }, [rows, actions]);

  const evidenceAssetSummaryBySession = useMemo(() => {
    const out: Record<string, string> = {};
    rows.forEach((session) => {
      const sessionSongs = songs.filter((s) => String(s.session_id || "") === session.id);
      const total = sessionSongs.length;
      const bounceCount = sessionSongs.filter((song) =>
        Boolean(song.bounce_link) || assets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "bounce" && Boolean(a.url)),
      ).length;
      const lyricsCount = sessionSongs.filter((song) =>
        Boolean(song.lyrics_link) || assets.some((a) => a.song_id === song.id && normalizeEvidenceType(a.type || "") === "lyrics" && Boolean(a.url)),
      ).length;
      if (total === 0 || (bounceCount === 0 && lyricsCount === 0)) {
        out[session.id] = "No Evidence";
      } else if (lyricsCount === 0) {
        out[session.id] = `${bounceCount}/${total} Bounce`;
      } else if (bounceCount === 0) {
        out[session.id] = `${lyricsCount}/${total} Lyrics`;
      } else {
        out[session.id] = `${bounceCount}/${total} Bounce, ${lyricsCount}/${total} Lyrics`;
      }
    });
    return out;
  }, [rows, songs, assets]);

  const sortedRows = useMemo(() => {
    const openStatuses = new Set(["open", "in progress", "pending", "todo"]);
    const filteredRows = rows.filter((session) => {
      if (sourceFilter !== "all" && session.source !== sourceFilter) return false;
      if (reviewFilter === "reviewed" && !session.archive_reviewed) return false;
      if (reviewFilter === "not-reviewed" && session.archive_reviewed) return false;
      if (reviewFilter === "needs-follow-up") {
        const sessionActions = actions.filter((a) => String(a.session_id || "") === session.id);
        const hasOpen = sessionActions.some((a) => openStatuses.has(String(a.status || "").toLowerCase().trim()));
        if (!hasOpen) return false;
      }
      const strength = effectiveStrengthBySession[session.id]?.value || "Weak";
      if (evidenceFilter === "weak-partial" && !["Weak", "Partial"].includes(strength)) return false;
      if (evidenceFilter === "strong-complete" && !["Strong", "Complete"].includes(strength)) return false;
      return true;
    });
    const next = [...filteredRows];
    if (sortBy === "az") {
      next.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));
    } else if (sortBy === "za") {
      next.sort((a, b) => (b.title || "").localeCompare(a.title || "", undefined, { sensitivity: "base" }));
    } else if (sortBy === "date") {
      next.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    } else if (sortBy === "added") {
      next.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
    } else {
      next.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }
    return next;
  }, [rows, sortBy, reviewFilter, sourceFilter, evidenceFilter, actions, effectiveStrengthBySession]);

  const update = async (id: string, key: keyof Session, value: string | boolean) => {
    setError("");
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    const colMap: Record<string, string> = { archive_reviewed: "archive_reviewed", evidence_strength: "evidence_strength", date: "date", title: "title", location: "location", source: "source" };
    const { error } = await supabase.from("sessions").update({ [colMap[key]]: value }).eq("id", id);
    if (error) {
      logSupabaseError("Failed to update session", error);
      setError(supabaseUserMessage("Could not update session", error));
    }
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete this session?")) return;
    setError("");
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete session", error);
      setError(supabaseUserMessage("Could not delete session", error));
      return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = parseIcs(await file.text(), rows);
    setPreviewRows(parsed);
    setSelectedPreviewIds(new Set(parsed.map((p) => p.id)));
    setShowImportPreview(true);
    setImportMessage(parsed.length ? "" : "No events found in this .ics file.");
  };

  const importSelected = async () => {
    const selected = previewRows.filter((row) => selectedPreviewIds.has(row.id));
    if (!selected.length) return;
    const { error } = await supabase.from("sessions").insert(selected.map((row) => ({ date: row.date, title: row.title, location: row.location, source: "calendar_import", calendar_event_id: row.calendar_event_id, archive_reviewed: false, archive_review_notes: row.notes })));
    if (error) {
      logSupabaseError("Failed to import sessions", error);
      setError(supabaseUserMessage("Could not import selected events", error));
      return;
    }
    setImportMessage(`${selected.length} events imported.`);
    setShowImportPreview(false);
    await load();
  };

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (!initialized.current && qs.get("new") === "1") {
      initialized.current = true;
      window.location.href = "/sessions/new";
    }
    if (qs.get("import") === "1") fileInputRef.current?.click();
  }, []);

  return (
    <div>
      <PageHeader title="Sessions" subtitle="Sessions can start as calendar records. Open a session to add songs, writers, assets, and follow-ups." actions={<><button className="button" onClick={() => fileInputRef.current?.click()}>Import Calendar (.ics)</button><Link className="button primary" href="/sessions/new">Add Session</Link></>} />
      <input ref={fileInputRef} type="file" accept=".ics,text/calendar" onChange={onFileChange} style={{ display: "none" }} />

      <SectionCard>
        <div className="rowActions compact" style={{ marginBottom: ".75rem" }}>
          <button className={`button compact ${viewMode === "calendar" ? "primary" : ""}`} onClick={() => setViewMode("calendar")}>Session Calendar</button>
          <button className={`button compact ${viewMode === "records" ? "primary" : ""}`} onClick={() => setViewMode("records")}>Logged Sessions</button>
        </div>

        {viewMode === "calendar" ? (
          <>
            <p className="helper" style={{ marginBottom: ".7rem" }}>Use this shared calendar as a reference while manually logging sessions. Direct import/sync can be added later.</p>
            <iframe
              title="Session Calendar"
              src="https://calendar.google.com/calendar/embed?src=fqpihr2loirht1lhkue8ihmlko%40group.calendar.google.com&ctz=Europe%2FLondon"
              style={{ width: "100%", height: "76vh", minHeight: 520, border: "1px solid #e3d7cb", borderRadius: 14, background: "#fff" }}
            />
          </>
        ) : (
          <>
            {showImportPreview ? (
              <SectionCard title="Import Preview" actions={<><button className="button compact" onClick={() => setSelectedPreviewIds(new Set(previewRows.map((r) => r.id)))}>Select All</button><button className="button compact" onClick={() => setSelectedPreviewIds(new Set())}>Deselect All</button><button className="button primary compact" onClick={importSelected}>Import Selected</button></>}>
                <div className="tableWrap">
                  <table>
                    <thead><tr><th>Select</th><th>Event title</th><th>Date/time</th><th>Location</th><th>Description/notes</th><th>Attendees</th><th>Source</th><th>Duplicate warning</th></tr></thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.id}>
                          <td><input type="checkbox" checked={selectedPreviewIds.has(row.id)} onChange={() => { const next = new Set(selectedPreviewIds); next.has(row.id) ? next.delete(row.id) : next.add(row.id); setSelectedPreviewIds(next); }} /></td>
                          <td>{row.title || <span className="helper">Untitled</span>}</td>
                          <td>{row.dateTimeText}</td>
                          <td>{row.location || <span className="helper">No location</span>}</td>
                          <td>{row.notes || <span className="helper">No notes</span>}</td>
                          <td>{row.attendees.length ? row.attendees.join(", ") : <span className="helper">No attendees</span>}</td>
                          <td>{row.source}</td>
                          <td>{row.isDuplicate ? <span className="helper">Possible duplicate</span> : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            ) : null}

            {error ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{error}</p> : null}
            {importMessage ? <p className="helper" style={{ marginBottom: ".7rem" }}>{importMessage}</p> : null}
            <div className="rowActions compact" style={{ marginBottom: ".6rem" }}>
              <label className="helper">Review</label>
              <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value as "all" | "reviewed" | "not-reviewed" | "needs-follow-up")} style={{ maxWidth: 190 }}>
                <option value="all">All</option>
                <option value="reviewed">Reviewed</option>
                <option value="not-reviewed">Not Reviewed</option>
                <option value="needs-follow-up">Needs Follow-up</option>
              </select>
              <label className="helper">Source</label>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as "all" | "manual" | "calendar" | "calendar_import")} style={{ maxWidth: 190 }}>
                <option value="all">All Sources</option>
                <option value="manual">Manual</option>
                <option value="calendar">Calendar</option>
                <option value="calendar_import">Calendar Import</option>
              </select>
              <label className="helper">Evidence</label>
              <select value={evidenceFilter} onChange={(e) => setEvidenceFilter(e.target.value as "all" | "weak-partial" | "strong-complete")} style={{ maxWidth: 190 }}>
                <option value="all">All Evidence</option>
                <option value="weak-partial">Weak/Partial</option>
                <option value="strong-complete">Strong/Complete</option>
              </select>
              <label className="helper">Sort</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "az" | "za" | "date" | "recent" | "added")} style={{ maxWidth: 200 }}>
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
                <option value="date">Date (Oldest)</option>
                <option value="recent">Most Recent</option>
                <option value="added">Date Added</option>
              </select>
            </div>
            <p className="helper" style={{ marginBottom: ".6rem" }}>Archive Reviewed means you have checked this session for the key admin/evidence items you currently know about.</p>

            {sortedRows.length === 0 ? (
              <EmptyState title="No sessions yet" hint="Import a calendar file or add sessions manually." action={<><button className="button" onClick={() => fileInputRef.current?.click()}>Import Calendar</button><Link className="button primary" href="/sessions/new">Add Session</Link></>} />
            ) : (
              <>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Date</th><th>Title</th><th>Location</th><th>Source</th><th>Archive Reviewed</th><th>Evidence Strength</th><th>Actions</th></tr></thead>
                  <tbody>
                    {sortedRows.map((se) => {
                      const effective = effectiveStrengthBySession[se.id];
                      return (
                        <tr key={se.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{editingId === se.id ? <input type="date" value={se.date} onChange={(e) => update(se.id, "date", e.target.value)} /> : (se.date || <span className="helper">Add date</span>)}</td>
                          <td>{editingId === se.id ? <input value={se.title} onChange={(e) => update(se.id, "title", e.target.value)} /> : <Link href={`/sessions/${se.id}`}>{se.title || "Untitled Session"}</Link>}</td>
                          <td>{editingId === se.id ? <input value={se.location} onChange={(e) => update(se.id, "location", e.target.value)} /> : (se.location || <span className="helper">Add location</span>)}</td>
                          <td>{editingId === se.id ? <select value={se.source} onChange={(e) => update(se.id, "source", e.target.value)}><option value="manual">manual</option><option value="calendar">calendar</option><option value="calendar_import">calendar_import</option></select> : se.source}</td>
                          <td>{editingId === se.id ? <input type="checkbox" checked={Boolean(se.archive_reviewed)} onChange={(e) => update(se.id, "archive_reviewed", e.target.checked)} /> : (archiveReviewedLabelBySession[se.id] || <span className="helper">No</span>)}</td>
                          <td>{editingId === se.id ? <select value={se.evidence_strength || ""} onChange={(e) => update(se.id, "evidence_strength", e.target.value)}><option value="">-</option><option value="Weak">Weak</option><option value="Partial">Partial</option><option value="Strong">Strong</option><option value="Complete">Complete</option></select> : effective?.value ? <><StatusBadge label={effective.value} /><div className="helper" style={{ marginTop: ".25rem" }}>{evidenceAssetSummaryBySession[se.id]}</div></> : <span className="helper">{evidenceAssetSummaryBySession[se.id]}</span>}</td>
                          <td><div className="rowActions compact"><Link className="button compact" href={`/sessions/${se.id}`}>View</Link><button className="button compact" onClick={() => setEditingId(editingId === se.id ? null : se.id)}>{editingId === se.id ? "Save" : "Edit"}</button><button className="button compact" onClick={() => del(se.id)}>Delete</button></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
