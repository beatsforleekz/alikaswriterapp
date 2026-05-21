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

type AssetRow = { id: string; song_id: string; type: string; url?: string | null };
type WriterRow = { id: string; name: string };

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
  return raw;
};

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [songs, setSongs] = useState<ReturnType<typeof mapSong>[]>([]);
  const [actions, setActions] = useState<ReturnType<typeof mapAction>[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [writers, setWriters] = useState<WriterRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [newSongTitle, setNewSongTitle] = useState("");
  const [newActionTask, setNewActionTask] = useState("");
  const [newActionDate, setNewActionDate] = useState("");
  const [assetSongId, setAssetSongId] = useState("");
  const [assetType, setAssetType] = useState("other");
  const [assetUrl, setAssetUrl] = useState("");
  const [songNotesDraft, setSongNotesDraft] = useState<Record<string, string>>({});

  const load = async () => {
    const { data: sData, error: sErr } = await supabase.from("sessions").select("*").eq("id", params.id).single();
    if (sErr) {
      logSupabaseError("Failed to load session detail", sErr);
      setErrorMsg(supabaseUserMessage("Could not load session", sErr));
      return;
    }
    const current = mapSession(sData as Record<string, unknown>);
    setSession(current);

    const { data: songRows, error: songErr } = await supabase.from("song_works").select("*").eq("session_id", current.id).order("created_at", { ascending: false });
    if (songErr) {
      logSupabaseError("Failed to load linked songs", songErr);
      setErrorMsg(supabaseUserMessage("Could not load linked songs", songErr));
    }
    const mappedSongs = (songRows ?? []).map((r) => mapSong(r as Record<string, unknown>));
    setSongs(mappedSongs);
    setSongNotesDraft(Object.fromEntries(mappedSongs.map((s) => [s.id, s.notes || ""])));
    setAssetSongId(mappedSongs[0]?.id || "");

    const { data: actionRows, error: actionErr } = await supabase.from("action_items").select("*").eq("session_id", current.id).order("due_date", { ascending: true });
    if (actionErr) {
      logSupabaseError("Failed to load session actions", actionErr);
      setErrorMsg(supabaseUserMessage("Could not load follow-ups", actionErr));
    }
    setActions((actionRows ?? []).map((r) => mapAction(r as Record<string, unknown>)));

    if (mappedSongs.length) {
      const ids = mappedSongs.map((s) => s.id);
      const { data: assetRows, error: assetErr } = await supabase.from("asset_links").select("id,song_id,type,url").in("song_id", ids);
      if (assetErr) {
        logSupabaseError("Failed to load linked assets", assetErr);
        setErrorMsg(supabaseUserMessage("Could not load assets", assetErr));
      }
      setAssets((assetRows ?? []) as AssetRow[]);
      if (process.env.NODE_ENV !== "production") {
        console.log("[session workspace load]", {
          sessionId: current.id,
          songIds: ids,
          assetLinksCount: (assetRows ?? []).length,
        });
      }

      const { data: splitRows, error: splitErr } = await supabase.from("song_writer_splits").select("writer_id").in("song_id", ids);
      if (splitErr) {
        logSupabaseError("Failed to load split rows", splitErr);
        setErrorMsg(supabaseUserMessage("Could not load attendees", splitErr));
      }
      const writerIds = [...new Set((splitRows ?? []).map((s) => String((s as { writer_id: string }).writer_id)))];
      if (writerIds.length) {
        const { data: wRows, error: wErr } = await supabase.from("writers").select("id,name").in("id", writerIds);
        if (wErr) {
          logSupabaseError("Failed to load writers", wErr);
          setErrorMsg(supabaseUserMessage("Could not load attendees", wErr));
        }
        setWriters((wRows ?? []) as WriterRow[]);
      } else {
        setWriters([]);
      }
    } else {
      setAssets([]);
      setWriters([]);
    }
  };

  useEffect(() => { load(); }, [params.id]);

  const attendeeNames = useMemo(() => writers.map((w) => w.name).join(", "), [writers]);
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

  return (
    <div>
      <PageHeader title={session.title || "Untitled Session"} subtitle="Sessions are your diary layer. Build songs, assets, and follow-ups from here." actions={<div className="rowActions compact"><Link className="button compact" href="/sessions">Back</Link><button className="button compact" onClick={() => setEditing((v) => !v)}>{editing ? "Save" : "Edit"}</button></div>} />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}

      <SectionCard title="Overview">
        <div className="kv">
          <dt>Date</dt><dd>{editing ? <input type="date" value={session.date} onChange={(e)=>updateSession("date", e.target.value)} /> : (session.date || <span className="helper">Add date</span>)}</dd>
          <dt>Title</dt><dd>{editing ? <input value={session.title} onChange={(e)=>updateSession("title", e.target.value)} /> : (session.title || <span className="helper">Add title</span>)}</dd>
          <dt>Location</dt><dd>{editing ? <input value={session.location} onChange={(e)=>updateSession("location", e.target.value)} /> : (session.location || <span className="helper">Add location</span>)}</dd>
          <dt>Source</dt><dd>{editing ? <select value={session.source} onChange={(e)=>updateSession("source", e.target.value)}><option value="manual">manual</option><option value="calendar">calendar</option><option value="calendar_import">calendar_import</option></select> : session.source}</dd>
          <dt>Notes</dt><dd>{editing ? <textarea value={session.archive_review_notes || ""} onChange={(e)=>updateSession("archive_review_notes", e.target.value)} /> : (session.archive_review_notes || <span className="helper">Add notes</span>)}</dd>
        </div>
      </SectionCard>

      <SectionCard title="Linked Songs / Works" actions={<div id="add-song" className="rowActions compact"><input value={newSongTitle} onChange={(e)=>setNewSongTitle(e.target.value)} placeholder="Song/work title" style={{ minWidth: 220 }} /><button className="button primary compact" onClick={addSong}>Quick Add Song/Work</button></div>}>
        {songs.length === 0 ? <p className="helper">No linked songs yet.</p> : <div className="tableWrap"><table><thead><tr><th>Title</th><th>Status</th><th>Notes</th><th>Evidence</th><th>Actions</th></tr></thead><tbody>{songs.map((song)=>{ const songAssets = assets.filter((a)=>a.song_id===song.id); const normalized = songAssets.map((a)=>normalizeEvidenceType(a.type)); const hasBounce = Boolean(song.bounceLink) || normalized.includes("bounce"); const hasLyrics = Boolean(song.lyricsLink) || normalized.includes("lyrics"); const evidenceItems = [...songAssets]; if (song.bounceLink && !normalized.includes("bounce")) evidenceItems.push({ id:`virtual-bounce-${song.id}`, song_id:song.id, type:"bounce", url:song.bounceLink }); if (song.lyricsLink && !normalized.includes("lyrics")) evidenceItems.push({ id:`virtual-lyrics-${song.id}`, song_id:song.id, type:"lyrics", url:song.lyricsLink }); return <tr key={song.id}><td><strong>{song.title || "Untitled"}</strong></td><td><select value={song.status} onChange={(e)=>updateSong(song.id,{ status: e.target.value })}><option>Started</option><option>Written</option><option>Bounce In</option><option>Assets Filed</option><option>Pitched</option><option>On Hold</option><option>Cut</option><option>Approved</option><option>Released</option><option>Disputed</option><option>Registered</option><option>Complete</option></select></td><td><div className="rowActions compact"><input value={songNotesDraft[song.id] ?? ""} onChange={(e)=>setSongNotesDraft((p)=>({ ...p, [song.id]: e.target.value }))} placeholder="Song notes" style={{ minWidth: 180 }} /><button className="button compact" onClick={()=>updateSong(song.id,{ notes: songNotesDraft[song.id] ?? "" })}>Save</button></div></td><td><div>{hasBounce && hasLyrics ? "Bounce + Lyrics" : hasBounce ? "Bounce only" : hasLyrics ? "Lyrics only" : <span className="helper">Missing</span>}</div><div className="helper" style={{ marginTop: ".35rem" }}>{evidenceItems.length ? evidenceItems.map((e)=>evidenceLabel(e.type)).join(", ") : "No assets"}</div></td><td><div className="rowActions compact"><Link className="button compact" href={`/songs/${song.id}`}>Library View</Link><button className="button compact" onClick={()=>deleteSong(song.id)}>Delete</button></div></td></tr>; })}</tbody></table></div>}
      </SectionCard>

      <SectionCard title="Writers / Attendees">
        {attendeeNames ? attendeeNames : <p className="helper">No attendees inferred yet. Add writers from this session's song/work forms. When adding from this session, linked session context is auto-filled.</p>}
      </SectionCard>

      <SectionCard title="Evidence / Assets" actions={<div id="add-asset" className="rowActions compact"><select value={assetSongId} onChange={(e)=>setAssetSongId(e.target.value)} style={{ minWidth: 160 }}><option value="">Select linked song</option>{songs.map((s)=><option key={s.id} value={s.id}>{s.title || "Untitled"}</option>)}</select><select value={assetType} onChange={(e)=>setAssetType(e.target.value)} style={{ minWidth: 150 }}><option value="bounce">Bounce</option><option value="lyrics">Lyrics</option><option value="dropbox">Dropbox</option><option value="other">Other</option></select><input value={assetUrl} onChange={(e)=>setAssetUrl(e.target.value)} placeholder="https://..." style={{ minWidth: 220 }} /><button className="button primary compact" onClick={addAsset}>Add Asset/Evidence</button></div>}>
        {assets.length === 0 ? <p className="helper">No assets/evidence linked yet.</p> : <div className="tableWrap"><table><thead><tr><th>Song</th><th>Type</th><th>Link</th><th>Actions</th></tr></thead><tbody>{assets.map((a)=><tr key={a.id}><td>{songs.find((s)=>s.id===a.song_id)?.title || a.song_id}</td><td>{evidenceLabel(a.type)}</td><td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">Open link</a> : <span className="helper">No link</span>}</td><td><div className="rowActions compact"><button className="button compact" onClick={()=>{ const next = window.prompt("Update evidence type", a.type); if (next !== null) updateAsset(a.id, { type: next }); }}>Edit Type</button><button className="button compact" onClick={()=>{ const next = window.prompt("Update evidence link", a.url || ""); if (next !== null) updateAsset(a.id, { url: next }); }}>Edit Link</button><button className="button compact" onClick={()=>deleteAsset(a.id)}>Delete</button></div></td></tr>)}</tbody></table></div>}
      </SectionCard>

      <SectionCard title="Actions / Follow-ups" actions={<div id="add-action" className="rowActions compact"><input value={newActionTask} onChange={(e)=>setNewActionTask(e.target.value)} placeholder="Follow-up task" style={{ minWidth: 220 }} /><input type="date" value={newActionDate} onChange={(e)=>setNewActionDate(e.target.value)} style={{ maxWidth: 170 }} /><button className="button primary compact" onClick={addAction}>Add Follow-up</button></div>}>
        {actions.length === 0 ? <p className="helper">No follow-ups linked yet.</p> : <div className="tableWrap"><table><thead><tr><th>Due</th><th>Task</th><th>Status</th><th>Actions</th></tr></thead><tbody>{actions.map((a)=><tr key={a.id}><td>{a.dueDate || <span className="helper">No date</span>}</td><td>{a.task || <span className="helper">No task</span>}</td><td>{a.status}</td><td><div className="rowActions compact"><button className="button compact" onClick={()=>deleteAction(a.id)}>Delete</button></div></td></tr>)}</tbody></table></div>}
      </SectionCard>

      <SectionCard title="Archive Review">
        <div className="kv">
          <dt>Archive Reviewed</dt><dd>{editing ? <input type="checkbox" checked={Boolean(session.archive_reviewed)} onChange={(e)=>updateSession("archive_reviewed", e.target.checked)} /> : (session.archive_reviewed ? "Yes" : "No")}</dd>
          <dt>Evidence Strength</dt><dd>{editing ? <select value={session.evidence_strength || ""} onChange={(e)=>updateSession("evidence_strength", e.target.value)}><option value="">-</option><option value="Weak">Weak</option><option value="Partial">Partial</option><option value="Strong">Strong</option><option value="Complete">Complete</option></select> : (session.evidence_strength ? <StatusBadge label={session.evidence_strength} /> : <span className="helper">Not set</span>)}</dd>
        </div>
      </SectionCard>
    </div>
  );
}
