"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { mapSong } from "@/lib/mappers";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import { isAllowedPitchAudio, uploadPitchAudio, removePitchAudio, getPlayableAudioUrl } from "@/lib/pitchAudio";

export default function SongDetail() {
  const params = useParams<{ id: string }>();
  const [song, setSong] = useState<ReturnType<typeof mapSong> | null>(null);
  const [sessionRef, setSessionRef] = useState<{ id: string; title: string; date: string } | null>(null);
  const [assets, setAssets] = useState<Array<{ id: string; type: string; url?: string | null }>>([]);
  const [splits, setSplits] = useState<Array<{ id: string; percentage?: number | null; role?: string | null; writer_name: string }>>([]);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [tagOptions, setTagOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [songTags, setSongTags] = useState<Array<{ id: string; name: string; tag_id: string }>>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: songData, error: songErr } = await supabase.from("song_works").select("*").eq("id", params.id).single();
      if (songErr || !songData) {
        logSupabaseError("Failed to load song detail library view", songErr);
        setError(supabaseUserMessage("Could not load song/work", songErr));
        return;
      }
      const mapped = mapSong(songData as Record<string, unknown>);
      setSong(mapped);
      setAudioUrl(await getPlayableAudioUrl(mapped.audioStoragePath));

      if (mapped.sessionId) {
        const { data: sData } = await supabase.from("sessions").select("id,title,date").eq("id", mapped.sessionId).single();
        if (sData) setSessionRef({ id: String(sData.id), title: String(sData.title ?? ""), date: String(sData.date ?? "") });
      }

      const { data: aData } = await supabase.from("asset_links").select("id,type,url").eq("song_id", params.id);
      setAssets((aData ?? []) as Array<{ id: string; type: string; url?: string | null }>);
      const [{ data: tagDirectory }, { data: tagLinks }] = await Promise.all([
        supabase.from("song_tags").select("id,name").order("name", { ascending: true }),
        supabase.from("song_work_tags").select("id,tag_id,song_tags(name)").eq("song_id", params.id),
      ]);
      setTagOptions((tagDirectory ?? []) as Array<{ id: string; name: string }>);
      setSongTags(
        (tagLinks ?? []).map((r) => {
          const row = r as { id: string; tag_id: string; song_tags?: { name?: string } | null };
          return { id: row.id, tag_id: row.tag_id, name: String(row.song_tags?.name ?? "") };
        }),
      );

      const { data: splitRows, error: splitErr } = await supabase
        .from("song_writer_splits")
        .select("id,percentage,role,writers(name)")
        .eq("song_id", params.id);
      if (splitErr) {
        logSupabaseError("Failed to load song writer splits", splitErr);
        setError(supabaseUserMessage("Could not load writer splits", splitErr));
      } else {
        setSplits(
          (splitRows ?? []).map((row) => {
            const r = row as { id: string; percentage?: number | null; role?: string | null; writers?: { name?: string } | null };
            return { id: String(r.id), percentage: r.percentage ?? null, role: r.role ?? null, writer_name: String(r.writers?.name ?? "Unknown") };
          }),
        );
      }
    };
    load();
  }, [params.id]);

  if (!song) return <div className="helper">Song not found.</div>;

  const addTag = async () => {
    const next = tagInput.trim();
    if (!next) return;
    if (songTags.some((t) => t.name.toLowerCase() === next.toLowerCase())) {
      setTagInput("");
      return;
    }
    let tagId = tagOptions.find((t) => t.name.toLowerCase() === next.toLowerCase())?.id;
    if (!tagId) {
      const { data: created } = await supabase.from("song_tags").insert({ name: next }).select("id,name").single();
      if (created) {
        tagId = String((created as { id: string }).id);
        setTagOptions((prev) => [...prev, { id: tagId as string, name: String((created as { name: string }).name) }].sort((a, b) => a.name.localeCompare(b.name)));
      }
    }
    if (!tagId) return;
    const { data: linkRow } = await supabase.from("song_work_tags").insert({ song_id: song.id, tag_id: tagId }).select("id").single();
    if (linkRow) setSongTags((prev) => [...prev, { id: String((linkRow as { id: string }).id), tag_id: tagId as string, name: next }]);
    setTagInput("");
  };

  const removeTag = async (linkId: string) => {
    await supabase.from("song_work_tags").delete().eq("id", linkId);
    setSongTags((prev) => prev.filter((t) => t.id !== linkId));
  };

  return (
    <div>
      <PageHeader title={song.title || "Untitled Song"} subtitle="Library view. Manage this song from its Session workspace." actions={sessionRef ? <Link className="button primary" href={`/sessions/${sessionRef.id}`}>Open Session Workspace</Link> : undefined} />
      {error ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{error}</p> : null}

      <SectionCard title="Overview">
        <div className="kv">
          <dt>Status</dt><dd><StatusBadge label={song.status} /></dd>
          <dt>Tags</dt><dd><div className="rowActions compact"><input list="song-tag-options-detail" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Type or reuse tag" /><button className="button compact" type="button" onClick={addTag}>Add Tag</button></div><datalist id="song-tag-options-detail">{tagOptions.map((tag) => <option key={tag.id} value={tag.name} />)}</datalist><div className="rowActions compact" style={{ marginTop: ".4rem" }}>{songTags.length ? songTags.map((tag) => <button key={tag.id} className="button compact" type="button" onClick={() => removeTag(tag.id)}>{tag.name} ✕</button>) : <span className="helper">No tags</span>}</div></dd>
          <dt>Session</dt><dd>{sessionRef ? <Link href={`/sessions/${sessionRef.id}`}>{sessionRef.date} - {sessionRef.title || "Untitled Session"}</Link> : <span className="helper">Unlinked session</span>}</dd>
          <dt>Notes</dt><dd>{song.notes || <span className="helper">No notes</span>}</dd>
        </div>
      </SectionCard>

      <SectionCard title="Evidence">
        {assets.length === 0 ? <p className="helper">No evidence linked.</p> : (
          <div className="tableWrap"><table><thead><tr><th>Type</th><th>Link</th></tr></thead><tbody>{assets.map((a)=><tr key={a.id}><td>{a.type === "bounce" ? "Bounce" : a.type}</td><td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">Open link</a> : <span className="helper">No URL</span>}</td></tr>)}</tbody></table></div>
        )}
      </SectionCard>

      <SectionCard title="Writers / Splits">
        {splits.length === 0 ? <p className="helper">No writer split rows yet.</p> : (
          <div className="tableWrap"><table><thead><tr><th>Writer</th><th>Role</th><th>Split %</th></tr></thead><tbody>{splits.map((split)=><tr key={split.id}><td>{split.writer_name}</td><td>{split.role || <span className="helper">No role</span>}</td><td>{split.percentage ?? <span className="helper">auto</span>}</td></tr>)}</tbody></table></div>
        )}
      </SectionCard>

      <SectionCard title="Pitch Audio">
        <p className="helper" style={{ marginBottom: ".6rem" }}>For pitching, compressed MP3/M4A is recommended. Keep WAVs in Dropbox unless needed.</p>
        {song.audioStoragePath ? <p style={{ marginBottom: ".5rem" }}><strong>Audio ready for pitching:</strong> {song.audioFileName || "Uploaded file"}</p> : <p className="helper" style={{ marginBottom: ".5rem" }}>No pitch playback copy uploaded yet.</p>}
        {audioUrl ? <audio controls preload="none" style={{ width: "100%", marginBottom: ".6rem" }}><source src={audioUrl} /></audio> : null}
        <div className="rowActions compact">
          <input
            type="file"
            accept=".mp3,.wav,.m4a,.aac,audio/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!isAllowedPitchAudio(file)) {
                setError("Unsupported audio format. Use mp3, wav, m4a, or aac.");
                return;
              }
              try {
                await uploadPitchAudio(song.id, file);
                const { error: noteErr } = await supabase.from("song_works").update({ audio_source_note: song.audioSourceNote || null }).eq("id", song.id);
                if (noteErr) logSupabaseError("Failed to update audio source note", noteErr);
                window.location.reload();
              } catch (err) {
                logSupabaseError("Failed to upload pitch audio from song detail", err);
                setError(supabaseUserMessage("Could not upload pitch audio", err));
              }
            }}
          />
          {song.audioStoragePath ? <button className="button compact" onClick={async () => { try { await removePitchAudio(song.id, song.audioStoragePath); window.location.reload(); } catch (err) { logSupabaseError("Failed to remove pitch audio", err); setError(supabaseUserMessage("Could not remove pitch audio", err)); } }}>Remove Audio</button> : null}
        </div>
        <div style={{ marginTop: ".6rem" }}>
          <label className="helper">Audio source note (optional)</label>
          <input
            value={song.audioSourceNote || ""}
            placeholder="e.g. Downloaded from Dropbox bounce folder"
            onChange={async (e) => {
              const next = e.target.value;
              setSong((prev) => (prev ? { ...prev, audioSourceNote: next } : prev));
              const { error: noteErr } = await supabase.from("song_works").update({ audio_source_note: next || null }).eq("id", song.id);
              if (noteErr) {
                logSupabaseError("Failed to update audio source note", noteErr);
                setError(supabaseUserMessage("Could not save source note", noteErr));
              }
            }}
          />
        </div>
      </SectionCard>
    </div>
  );
}
