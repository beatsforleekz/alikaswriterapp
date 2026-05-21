"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";

export default function NewSessionPage() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState("manual");
  const [attendees, setAttendees] = useState("");
  const [firstSongTitle, setFirstSongTitle] = useState("");
  const [bounceLink, setBounceLink] = useState("");
  const [lyricsLink, setLyricsLink] = useState("");
  const [dropboxLink, setDropboxLink] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
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

    if (attendees.trim()) {
      const names = attendees.split(",").map((n) => n.trim()).filter(Boolean);
      for (const name of names) {
        const { error: writerErr } = await supabase.from("writers").insert({ name });
        if (writerErr) {
          logSupabaseError("Failed to create attendee writer", writerErr);
          setError(supabaseUserMessage("Session saved, but attendee writer creation failed", writerErr));
        }
      }
    }

    if (firstSongTitle.trim()) {
      const { data: songRow, error: songErr } = await supabase
        .from("song_works")
        .insert({ title: firstSongTitle, session_id: sessionId, status: "Started" })
        .select("id")
        .single();

      if (songErr || !songRow) {
        logSupabaseError("Failed to create first song/work", songErr);
        setError(supabaseUserMessage("Session saved, but first song/work creation failed", songErr));
        setSaving(false);
        router.push(`/sessions/${sessionId}`);
        return;
      }

      const songId = String(songRow.id);
      const assets = [
        bounceLink ? { song_id: songId, type: "bounce", url: bounceLink } : null,
        lyricsLink ? { song_id: songId, type: "lyrics", url: lyricsLink } : null,
        dropboxLink ? { song_id: songId, type: "dropbox", url: dropboxLink } : null,
      ].filter(Boolean) as Array<{ song_id: string; type: string; url: string }>;

      if (assets.length) {
        const { error: assetErr } = await supabase.from("asset_links").insert(assets);
        if (assetErr) {
          logSupabaseError("Failed to create quick-add assets", assetErr);
          setError(supabaseUserMessage("Session and song saved, but asset link creation failed", assetErr));
        }
      }
    }

    router.push(`/sessions/${sessionId}`);
  };

  return (
    <div>
      <PageHeader title="Add Session" subtitle="Create a manual session record." actions={<Link className="button" href="/sessions">Back to Sessions</Link>} />
      <SectionCard title="Session Form" actions={<button className="button primary" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Session"}</button>}>
        {error ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{error}</p> : null}
        <div className="kv">
          <dt>Session Date *</dt><dd><input type="date" value={date} onChange={(e)=>setDate(e.target.value)} /></dd>
          <dt>Title *</dt><dd><input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Session title" /></dd>
          <dt>Location</dt><dd><input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Studio, city, or remote" /></dd>
          <dt>Source</dt><dd><select value={source} onChange={(e)=>setSource(e.target.value)}><option value="manual">manual</option><option value="calendar">calendar</option><option value="calendar_import">calendar_import</option></select></dd>
          <dt>Attendees/Writers (optional)</dt><dd><input value={attendees} onChange={(e)=>setAttendees(e.target.value)} placeholder="Comma-separated names" /></dd>
          <dt>First Song/Work Title (optional)</dt><dd><input value={firstSongTitle} onChange={(e)=>setFirstSongTitle(e.target.value)} placeholder="Creates linked song/work" /></dd>
          <dt>Bounce Link (optional)</dt><dd><input value={bounceLink} onChange={(e)=>setBounceLink(e.target.value)} placeholder="https://..." /></dd>
          <dt>Lyrics Link (optional)</dt><dd><input value={lyricsLink} onChange={(e)=>setLyricsLink(e.target.value)} placeholder="https://..." /></dd>
          <dt>Dropbox Folder Link (optional)</dt><dd><input value={dropboxLink} onChange={(e)=>setDropboxLink(e.target.value)} placeholder="https://..." /></dd>
          <dt>Notes (optional)</dt><dd><textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Session notes" /></dd>
        </div>
      </SectionCard>
    </div>
  );
}
