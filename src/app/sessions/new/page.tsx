"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";

type WriterOption = { id: string; name: string };
type StudioOption = { id: string; name: string };
type DraftSplit = { name: string; role: string; split: string };
type DraftEvidence = { type: string; url: string };

export default function NewSessionPage() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState("manual");
  const [notes, setNotes] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [songStatus, setSongStatus] = useState("Started");
  const [songNotes, setSongNotes] = useState("");
  const [splits, setSplits] = useState<DraftSplit[]>([{ name: "", role: "Songwriter", split: "" }]);
  const [evidence, setEvidence] = useState<DraftEvidence[]>([
    { type: "bounce", url: "" },
    { type: "lyrics", url: "" },
  ]);
  const [writers, setWriters] = useState<WriterOption[]>([]);
  const [studios, setStudios] = useState<StudioOption[]>([]);
  const [error, setError] = useState("");
  const [studioMsg, setStudioMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      const [writerRes, studioRes] = await Promise.all([
        supabase.from("writers").select("id,name").order("name", { ascending: true }),
        supabase.from("studios").select("id,name").order("name", { ascending: true }),
      ]);
      if (writerRes.error) {
        logSupabaseError("Failed to load writer directory for new session", writerRes.error);
      } else {
        setWriters((writerRes.data ?? []) as WriterOption[]);
      }
      if (studioRes.error) {
        logSupabaseError("Failed to load studios for new session", studioRes.error);
      } else {
        setStudios((studioRes.data ?? []) as StudioOption[]);
      }
    };
    loadOptions();
  }, []);

  const saveStudio = async () => {
    const name = location.trim();
    if (!name) return;
    if (studios.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setStudioMsg("Studio Saved");
      window.setTimeout(() => setStudioMsg(""), 1600);
      return;
    }
    const { error } = await supabase.from("studios").insert({ name });
    if (error) {
      logSupabaseError("Failed to save studio from add session", error);
      setError(supabaseUserMessage("Could not save studio location", error));
      return;
    }
    const { data } = await supabase.from("studios").select("id,name").order("name", { ascending: true });
    setStudios((data ?? []) as StudioOption[]);
    setStudioMsg("Studio Saved");
    window.setTimeout(() => setStudioMsg(""), 1600);
  };

  const onSave = async () => {
    if (!date.trim() || !title.trim()) {
      setError("Session date and title are required.");
      return;
    }

    setSaving(true);
    setError("");

    const { data: sessionRow, error: saveError } = await supabase
      .from("sessions")
      .insert({
        date,
        title,
        location,
        source,
        archive_reviewed: false,
        archive_review_notes: notes || null,
      })
      .select("id")
      .single();

    if (saveError || !sessionRow) {
      logSupabaseError("Failed to create session", saveError);
      setError(supabaseUserMessage("Could not save session", saveError));
      setSaving(false);
      return;
    }

    const sessionId = String(sessionRow.id);
    const hasSongContext =
      Boolean(songTitle.trim()) ||
      Boolean(songNotes.trim()) ||
      splits.some((s) => s.name.trim()) ||
      evidence.some((e) => e.url.trim());

    let songId = "";
    if (hasSongContext) {
      const hasBounce = evidence.some((e) => e.type === "bounce" && e.url.trim());
      const hasLyrics = evidence.some((e) => e.type === "lyrics" && e.url.trim());
      const effectiveSongStatus =
        hasBounce && hasLyrics && (songStatus === "Started" || songStatus === "Written" || songStatus === "Bounce In")
          ? "Assets Filed"
          : hasBounce && !hasLyrics && (songStatus === "Started" || songStatus === "Written")
            ? "Bounce In"
          : songStatus;
      const { data: songRow, error: songErr } = await supabase
        .from("song_works")
        .insert({ title: songTitle.trim() || "Untitled Song", session_id: sessionId, status: effectiveSongStatus, notes: songNotes || null })
        .select("id")
        .single();

      if (songErr || !songRow) {
        logSupabaseError("Failed to create song/work from add session", songErr);
        setError(supabaseUserMessage("Session saved, but song/work creation failed", songErr));
        setSaving(false);
        router.push(`/sessions/${sessionId}`);
        return;
      }
      songId = String(songRow.id);
    }

    if (songId) {
      for (const row of splits) {
        const writerName = row.name.trim();
        if (!writerName) continue;

        let writerId = writers.find((w) => w.name.toLowerCase() === writerName.toLowerCase())?.id;
        if (!writerId) {
          const { data: existing } = await supabase.from("writers").select("id,name").ilike("name", writerName).limit(1);
          writerId = existing?.[0]?.id as string | undefined;
        }
        if (!writerId) {
          const { data: newWriter, error: createWriterErr } = await supabase.from("writers").insert({ name: writerName }).select("id").single();
          if (createWriterErr || !newWriter) {
            logSupabaseError("Failed to create writer from add session", createWriterErr);
            setError(supabaseUserMessage("Session saved, but a writer could not be created", createWriterErr));
            continue;
          }
          writerId = String(newWriter.id);
        }

        const splitValue = row.split.trim() ? Number(row.split) : null;
        const validSplit = splitValue !== null && !Number.isNaN(splitValue) ? splitValue : null;
        const { error: splitErr } = await supabase.from("song_writer_splits").insert({
          song_id: songId,
          writer_id: writerId,
          role: row.role.trim() || "Songwriter",
          percentage: validSplit,
        });
        if (splitErr) {
          logSupabaseError("Failed to create writer split from add session", splitErr);
          setError(supabaseUserMessage("Session saved, but a writer split could not be added", splitErr));
        }
      }

      const evidenceRows = evidence
        .map((e) => ({ type: e.type, url: e.url.trim() }))
        .filter((e) => Boolean(e.url));
      if (evidenceRows.length) {
        const { error: assetErr } = await supabase.from("asset_links").insert(evidenceRows.map((e) => ({ song_id: songId, type: e.type, url: e.url })));
        if (assetErr) {
          logSupabaseError("Failed to add evidence from add session", assetErr);
          setError(supabaseUserMessage("Session saved, but evidence could not be added", assetErr));
        }

        const bounce = evidenceRows.find((e) => e.type === "bounce")?.url;
        const lyrics = evidenceRows.find((e) => e.type === "lyrics")?.url;
        if (bounce || lyrics) {
          const patch: { bounce_link?: string; lyrics_link?: string } = {};
          if (bounce) patch.bounce_link = bounce;
          if (lyrics) patch.lyrics_link = lyrics;
          const { error: syncErr } = await supabase.from("song_works").update(patch).eq("id", songId);
          if (syncErr) {
            logSupabaseError("Failed to sync bounce/lyrics links on add session", syncErr);
            setError(supabaseUserMessage("Session saved, but song evidence links did not fully sync", syncErr));
          }
        }
      }
    }

    router.push(`/sessions/${sessionId}`);
  };

  return (
    <div>
      <PageHeader title="Add Session" subtitle="Create a manual session record and optionally capture writers/splits/evidence now." actions={<Link className="button" href="/sessions">Back to Sessions</Link>} />
      <SectionCard title="Session Form" actions={<button className="button primary" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Session"}</button>}>
        {error ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{error}</p> : null}
        <div className="kv">
          <dt>Session Date *</dt><dd><input type="date" value={date} onChange={(e)=>setDate(e.target.value)} /></dd>
          <dt>Title *</dt><dd><input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Session title" /></dd>
          <dt>Location</dt><dd><div className="rowActions compact"><input list="studio-directory-new-session" value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Studio, city, or remote" /><button className="button compact" type="button" onClick={saveStudio}>Save Studio</button>{studioMsg ? <span className="helper" style={{ color: "#3f6b4a" }}>{studioMsg}</span> : null}</div><datalist id="studio-directory-new-session">{studios.map((studio) => <option key={studio.id} value={studio.name} />)}</datalist></dd>
          <dt>Source</dt><dd><select value={source} onChange={(e)=>setSource(e.target.value)}><option value="manual">manual</option><option value="calendar">calendar</option><option value="calendar_import">calendar_import</option></select></dd>
          <dt>Session Notes</dt><dd><textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Session notes" /></dd>
        </div>
      </SectionCard>

      <SectionCard title="Initial Song / Work (Optional)" actions={<button className="button primary compact" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Session"}</button>}>
        <p className="helper" style={{ marginBottom: ".6rem" }}>After entering initial song/work details, click Save Session to create the session and linked work.</p>
        <div className="kv">
          <dt>Song Title</dt><dd><input value={songTitle} onChange={(e)=>setSongTitle(e.target.value)} placeholder="Creates linked song/work" /></dd>
          <dt>Status</dt><dd><select value={songStatus} onChange={(e)=>setSongStatus(e.target.value)}><option>Started</option><option>Written</option><option>Bounce In</option><option>Assets Filed</option><option>Pitched</option><option>On Hold</option><option>Cut</option><option>Approved</option><option>Released</option><option>Disputed</option><option>Registered</option><option>Complete</option></select></dd>
          <dt>Song Notes</dt><dd><textarea value={songNotes} onChange={(e)=>setSongNotes(e.target.value)} placeholder="Song/work notes" /></dd>
        </div>
      </SectionCard>

      <SectionCard title="Writers / Splits (Optional)" actions={<button className="button primary compact" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Session"}</button>}>
        <p className="helper" style={{ marginBottom: ".6rem" }}>After adding writer rows, click Save Session to store them.</p>
        <div className="rowActions compact" style={{ marginBottom: ".6rem" }}>
          <button className="button compact" onClick={() => setSplits((prev) => [...prev, { name: "", role: "Songwriter", split: "" }])}>Add Writer Row</button>
        </div>
        {splits.map((row, idx) => (
          <div key={`split-${idx}`} className="rowActions compact" style={{ marginBottom: ".45rem", alignItems: "end" }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <input
                list="writer-directory-new-session"
                value={row.name}
                onChange={(e) => setSplits((prev) => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                placeholder="Existing or new writer"
              />
            </div>
            <select value={row.role} onChange={(e) => setSplits((prev) => prev.map((s, i) => i === idx ? { ...s, role: e.target.value } : s))} style={{ minWidth: 140 }}>
              <option>Songwriter</option><option>Producer</option><option>Artist</option><option>Featured Artist</option><option>Vocalist</option><option>Topliner</option><option>Composer</option><option>Lyricist</option><option>Other</option>
            </select>
            <input value={row.split} onChange={(e) => setSplits((prev) => prev.map((s, i) => i === idx ? { ...s, split: e.target.value } : s))} placeholder="Split %" style={{ maxWidth: 100 }} />
            <button className="button compact" onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
          </div>
        ))}
        <datalist id="writer-directory-new-session">
          {writers.map((writer) => <option key={writer.id} value={writer.name} />)}
        </datalist>
      </SectionCard>

      <SectionCard title="Evidence / Assets (Optional)" actions={<button className="button primary compact" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Session"}</button>}>
        <p className="helper" style={{ marginBottom: ".6rem" }}>After adding evidence rows, click Save Session to store them.</p>
        <div className="rowActions compact" style={{ marginBottom: ".6rem" }}>
          <button className="button compact" onClick={() => setEvidence((prev) => [...prev, { type: "other", url: "" }])}>Add Evidence Row</button>
        </div>
        {evidence.map((row, idx) => (
          <div key={`evidence-${idx}`} className="rowActions compact" style={{ marginBottom: ".45rem", alignItems: "end" }}>
            <select value={row.type} onChange={(e) => setEvidence((prev) => prev.map((r, i) => i === idx ? { ...r, type: e.target.value } : r))} style={{ minWidth: 140 }}>
              <option value="bounce">Bounce</option>
              <option value="lyrics">Lyrics</option>
              <option value="instrumental">Instrumental</option>
              <option value="acapella">Acapella</option>
              <option value="apple_note">Apple Note</option>
              <option value="dropbox">Dropbox</option>
              <option value="google_doc">Google Doc</option>
              <option value="voice_note">Voice note</option>
              <option value="message_evidence">Email/Pitch Trail</option>
              <option value="screenshots">Screenshots</option>
              <option value="session_file">Session File</option>
              <option value="other">Other</option>
            </select>
            <input value={row.url} onChange={(e) => setEvidence((prev) => prev.map((r, i) => i === idx ? { ...r, url: e.target.value } : r))} placeholder="https://..." style={{ minWidth: 260, flex: 1 }} />
            <button className="button compact" onClick={() => setEvidence((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
          </div>
        ))}
      </SectionCard>
      <div className="rowActions" style={{ justifyContent: "flex-end", marginTop: ".8rem" }}>
        <button className="button primary" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Session"}</button>
      </div>
    </div>
  );
}
