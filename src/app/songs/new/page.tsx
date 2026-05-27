"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SONG_STATUSES } from "@/types";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";

type SessionOpt = { id: string; title: string; date: string };
type WriterRow = { name: string; role: string; pro: string; publisher: string; split: string };
type TagOption = { id: string; name: string };

export default function NewSongWorkPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionOpt[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<(typeof SONG_STATUSES)[number]>("Started");
  const [writers, setWriters] = useState<WriterRow[]>([{ name: "", role: "", pro: "", publisher: "", split: "" }]);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [dropbox, setDropbox] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const [googleDoc, setGoogleDoc] = useState("");
  const [instrumental, setInstrumental] = useState("");
  const [acapella, setAcapella] = useState("");
  const [screenshots, setScreenshots] = useState("");
  const [otherEvidence, setOtherEvidence] = useState("");

  const [actionTask, setActionTask] = useState("");
  const [actionDue, setActionDue] = useState("");
  const [createCut, setCreateCut] = useState(false);
  const [cutArtist, setCutArtist] = useState("");
  const [cutReleaseDate, setCutReleaseDate] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const q = new URLSearchParams(window.location.search);
      const fromSession = q.get("sessionId");
      if (fromSession) setSessionId(fromSession);

      const { data, error } = await supabase.from("sessions").select("id,title,date").order("date", { ascending: false });
      if (error) {
        logSupabaseError("Failed to load sessions for song create", error);
        setError(supabaseUserMessage("Could not load session options", error));
        return;
      }
      setSessions((data ?? []) as SessionOpt[]);
      const { data: tagData } = await supabase.from("song_tags").select("id,name").order("name", { ascending: true });
      setTagOptions((tagData ?? []) as TagOption[]);
    };
    init();
  }, []);

  const splitTotal = useMemo(
    () => writers.reduce((sum, w) => sum + (w.split.trim() ? Number(w.split) || 0 : 0), 0),
    [writers],
  );
  const hasAnySplit = useMemo(() => writers.some((w) => w.split.trim() !== ""), [writers]);
  const splitWarn = hasAnySplit && Math.round(splitTotal * 100) / 100 !== 100;

  const updateWriter = (idx: number, key: keyof WriterRow, value: string) => {
    setWriters((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addWriterRow = () => {
    setWriters((rows) => [...rows, { name: "", role: "", pro: "", publisher: "", split: "" }]);
  };

  const removeWriterRow = (idx: number) => {
    setWriters((rows) => rows.filter((_, i) => i !== idx));
  };

  const onSave = async () => {
    setSaving(true);
    setError("");

    const effectiveStatus = status;

    const { data: songRow, error: songErr } = await supabase
      .from("song_works")
      .insert({ title, session_id: sessionId || null, status: effectiveStatus })
      .select("id")
      .single();

    if (songErr || !songRow) {
      logSupabaseError("Failed to create song/work", songErr);
      setError(supabaseUserMessage("Could not save song/work", songErr));
      setSaving(false);
      return;
    }

    const songId = String(songRow.id);

    for (const tagName of selectedTags) {
      const clean = tagName.trim();
      if (!clean) continue;
      const existing = tagOptions.find((t) => t.name.toLowerCase() === clean.toLowerCase());
      let tagId = existing?.id;
      if (!tagId) {
        const { data: createdTag } = await supabase.from("song_tags").insert({ name: clean }).select("id,name").single();
        tagId = createdTag?.id as string | undefined;
      }
      if (tagId) {
        await supabase.from("song_work_tags").insert({ song_id: songId, tag_id: tagId });
      }
    }

    const validWriters = writers.filter((w) => w.name.trim());
    let defaultSplit = 0;
    if (validWriters.length && !hasAnySplit) defaultSplit = Math.round((100 / validWriters.length) * 100) / 100;

    for (const w of validWriters) {
      const { data: existing } = await supabase.from("writers").select("id,name").eq("name", w.name.trim()).limit(1);
      let writerId = existing?.[0]?.id as string | undefined;
      if (!writerId) {
        const { data: wRow, error: wErr } = await supabase
          .from("writers")
          .insert({ name: w.name.trim(), pro: w.pro || null, publisher: w.publisher || null })
          .select("id")
          .single();
        if (wErr || !wRow) {
          logSupabaseError("Failed to create writer", wErr);
          setError(supabaseUserMessage("Song saved, but writer creation failed", wErr));
          continue;
        }
        writerId = String(wRow.id);
      }

      const percentage = hasAnySplit ? (w.split.trim() ? Number(w.split) : null) : defaultSplit;
      const { error: splitErr } = await supabase.from("song_writer_splits").insert({ song_id: songId, writer_id: writerId, percentage, role: w.role || null });
      if (splitErr) {
        logSupabaseError("Failed to create writer split", splitErr);
        setError(supabaseUserMessage("Song saved, but split creation failed", splitErr));
      }
    }

    const assets = [
      dropbox ? { song_id: songId, type: "dropbox", url: dropbox } : null,
      voiceNote ? { song_id: songId, type: "voice_note", url: voiceNote } : null,
      googleDoc ? { song_id: songId, type: "google_doc", url: googleDoc } : null,
      instrumental ? { song_id: songId, type: "instrumental", url: instrumental } : null,
      acapella ? { song_id: songId, type: "acapella", url: acapella } : null,
      screenshots ? { song_id: songId, type: "screenshots", url: screenshots } : null,
      otherEvidence ? { song_id: songId, type: "other", url: otherEvidence } : null,
    ].filter(Boolean) as Array<{ song_id: string; type: string; url: string }>;

    if (assets.length) {
      const { error: assetErr } = await supabase.from("asset_links").insert(assets);
      if (assetErr) {
        logSupabaseError("Failed to create evidence assets", assetErr);
        setError(supabaseUserMessage("Song saved, but evidence links failed", assetErr));
      }
    }

    if (actionTask.trim()) {
      const { error: actionErr } = await supabase.from("action_items").insert({
        task: actionTask,
        due_date: actionDue || "",
        priority: "Medium",
        status: "Open",
        song_id: songId,
        session_id: sessionId || null,
      });
      if (actionErr) {
        logSupabaseError("Failed to create linked action", actionErr);
        setError(supabaseUserMessage("Song saved, but follow-up creation failed", actionErr));
      }
    }

    if (createCut) {
      const { error: cutErr } = await supabase.from("cut_records").insert({
        song_id: songId,
        artist: cutArtist || null,
        release_date: cutReleaseDate || null,
      });
      if (cutErr) {
        logSupabaseError("Failed to create linked cut", cutErr);
        setError(supabaseUserMessage("Song saved, but cut record creation failed", cutErr));
      }
    }

    router.push(`/songs/${songId}`);
  };

  return (
    <div>
      <PageHeader title="Add Song / Work" subtitle="Create a complete songwriting admin record from one form." actions={<Link className="button" href="/songs">Back to Songs</Link>} />

      <SectionCard title="Core Details" actions={<button className="button primary" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Song / Work"}</button>}>
        {error ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{error}</p> : null}
        <div className="kv">
          <dt>Song/Work Title *</dt><dd><input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Title" /></dd>
          <dt>Status</dt><dd><select value={status} onChange={(e)=>setStatus(e.target.value as (typeof SONG_STATUSES)[number])}>{SONG_STATUSES.map((s)=><option key={s} value={s}>{s}</option>)}</select></dd>
          <dt>Linked Session</dt><dd><select value={sessionId} onChange={(e)=>setSessionId(e.target.value)}><option value="">Unlinked</option>{sessions.map((s)=><option key={s.id} value={s.id}>{s.date} - {s.title || "Untitled Session"}</option>)}</select></dd>
          <dt>Tags</dt><dd><div className="rowActions compact"><input list="song-tag-options-new" value={tagInput} onChange={(e)=>setTagInput(e.target.value)} placeholder="Type tag and add" /><button className="button compact" type="button" onClick={() => { const next = tagInput.trim(); if (!next) return; if (!selectedTags.some((t) => t.toLowerCase() === next.toLowerCase())) setSelectedTags((prev) => [...prev, next]); setTagInput(""); }}>Add Tag</button></div><datalist id="song-tag-options-new">{tagOptions.map((tag) => <option key={tag.id} value={tag.name} />)}</datalist><div className="rowActions compact" style={{ marginTop: ".4rem" }}>{selectedTags.map((tag) => <button key={tag} className="button compact" type="button" onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}>{tag} ✕</button>)}</div></dd>
        </div>
      </SectionCard>

      <SectionCard title="Writers" actions={<button className="button compact" onClick={addWriterRow}>Add Writer Row</button>}>
        <p className="helper" style={{ marginBottom: ".6rem" }}>If no splits are entered, equal splits will be assumed temporarily.</p>
        {writers.map((w, i) => (
          <div key={i} className="grid" style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr auto", alignItems: "end", gap: ".45rem", marginBottom: ".45rem" }}>
            <div><label className="helper">Writer name</label><input value={w.name} onChange={(e)=>updateWriter(i, "name", e.target.value)} /></div>
            <div><label className="helper">Role (optional)</label><input value={w.role} onChange={(e)=>updateWriter(i, "role", e.target.value)} /></div>
            <div><label className="helper">PRO (optional)</label><input value={w.pro} onChange={(e)=>updateWriter(i, "pro", e.target.value)} /></div>
            <div><label className="helper">Publisher (optional)</label><input value={w.publisher} onChange={(e)=>updateWriter(i, "publisher", e.target.value)} /></div>
            <div><label className="helper">Split %</label><input value={w.split} onChange={(e)=>updateWriter(i, "split", e.target.value)} placeholder="e.g. 25" /></div>
            <button className="button compact" onClick={()=>removeWriterRow(i)} disabled={writers.length===1}>Delete</button>
          </div>
        ))}
        <p className="helper">Current split total: {splitTotal}% {splitWarn ? "(warning: ideally 100%)" : ""}</p>
      </SectionCard>

      <SectionCard title="Evidence / Assets Quick Links">
        <div className="kv">
          <dt>Dropbox folder</dt><dd><input value={dropbox} onChange={(e)=>setDropbox(e.target.value)} /></dd>
          <dt>Voice note</dt><dd><input value={voiceNote} onChange={(e)=>setVoiceNote(e.target.value)} /></dd>
          <dt>Google Doc</dt><dd><input value={googleDoc} onChange={(e)=>setGoogleDoc(e.target.value)} /></dd>
          <dt>Instrumental</dt><dd><input value={instrumental} onChange={(e)=>setInstrumental(e.target.value)} /></dd>
          <dt>Acapella</dt><dd><input value={acapella} onChange={(e)=>setAcapella(e.target.value)} /></dd>
          <dt>Screenshots</dt><dd><input value={screenshots} onChange={(e)=>setScreenshots(e.target.value)} /></dd>
          <dt>Other evidence</dt><dd><input value={otherEvidence} onChange={(e)=>setOtherEvidence(e.target.value)} /></dd>
        </div>
      </SectionCard>

      <SectionCard title="Linked Follow-up & Cut (optional)">
        <div className="kv">
          <dt>Follow-up task</dt><dd><input value={actionTask} onChange={(e)=>setActionTask(e.target.value)} placeholder="Add follow-up action" /></dd>
          <dt>Follow-up due date</dt><dd><input type="date" value={actionDue} onChange={(e)=>setActionDue(e.target.value)} /></dd>
          <dt>Create cut record</dt><dd><input type="checkbox" checked={createCut} onChange={(e)=>setCreateCut(e.target.checked)} /></dd>
          <dt>Cut artist</dt><dd><input value={cutArtist} onChange={(e)=>setCutArtist(e.target.value)} placeholder="Artist" /></dd>
          <dt>Cut release date</dt><dd><input type="date" value={cutReleaseDate} onChange={(e)=>setCutReleaseDate(e.target.value)} /></dd>
        </div>
      </SectionCard>
    </div>
  );
}
