"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import { isAllowedPitchAudio, uploadPitchAudio } from "@/lib/pitchAudio";

type SongOption = { id: string; title: string; audio_storage_path?: string | null; audio_file_name?: string | null };
type TrackDraft = { song_work_id: string; notes: string };
type SplitRef = { song_id: string; writer_name: string };
type TagRef = { song_id: string; tag_name: string };

export default function NewPlaylistPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientCompany, setRecipientCompany] = useState("");
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [tracks, setTracks] = useState<TrackDraft[]>([]);
  const [songs, setSongs] = useState<SongOption[]>([]);
  const [selectedSong, setSelectedSong] = useState("");
  const [pendingUploadSongId, setPendingUploadSongId] = useState("");
  const [pendingNotes, setPendingNotes] = useState("");
  const [search, setSearch] = useState("");
  const [audioReadyOnly, setAudioReadyOnly] = useState(false);
  const [splits, setSplits] = useState<SplitRef[]>([]);
  const [tags, setTags] = useState<TagRef[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const loadSongs = async () => {
    const [songRes, splitRes, tagRes] = await Promise.all([
      supabase.from("song_works").select("id,title,audio_storage_path,audio_file_name").order("title", { ascending: true }),
      supabase.from("song_writer_splits").select("song_id,writers(name)"),
      supabase.from("song_work_tags").select("song_id,song_tags(name)"),
    ]);
    if (songRes.error || splitRes.error || tagRes.error) {
      const error = songRes.error || splitRes.error || tagRes.error;
      logSupabaseError("Failed to load songs for playlist create", error);
      setErrorMsg(supabaseUserMessage("Could not load song options", error));
      return;
    }
    setSongs((songRes.data ?? []) as SongOption[]);
    setSplits((splitRes.data ?? []).map((r) => ({ song_id: String((r as { song_id: string }).song_id), writer_name: String((r as { writers?: { name?: string } | null }).writers?.name ?? "") })));
    setTags((tagRes.data ?? []).map((r) => ({ song_id: String((r as { song_id: string }).song_id), tag_name: String((r as { song_tags?: { name?: string } | null }).song_tags?.name ?? "") })));
  };
  useEffect(() => { loadSongs(); }, []);

  useEffect(() => {
    const onFocus = () => loadSongs();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const addSelectedSong = () => {
    const song = songs.find((s) => s.id === selectedSong);
    if (!song) return;
    if (tracks.some((t) => t.song_work_id === song.id)) {
      setErrorMsg("That song is already in this playlist.");
      return;
    }
    if (!song.audio_storage_path) {
      setPendingUploadSongId(song.id);
      setPendingNotes("");
      return;
    }
    setTracks((prev) => [...prev, { song_work_id: song.id, notes: "" }]);
    setSelectedSong("");
  };

  const onSave = async () => {
    setErrorMsg("");
    const shareToken = crypto.randomUUID().replace(/-/g, "");
    const { data: playlist, error } = await supabase
      .from("pitch_playlists")
      .insert({
        title,
        description: description || null,
        recipient_name: recipientName || null,
        recipient_company: recipientCompany || null,
        password: password || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        share_token: shareToken,
        is_active: true,
      })
      .select("id")
      .single();
    if (error || !playlist) {
      logSupabaseError("Failed to create playlist", error);
      setErrorMsg(supabaseUserMessage("Could not save playlist", error));
      return;
    }

    if (tracks.length) {
      const { error: trackErr } = await supabase.from("pitch_playlist_tracks").insert(
        tracks.map((t, i) => ({
          playlist_id: String((playlist as { id: string }).id),
          song_work_id: t.song_work_id,
          notes: t.notes || null,
          sort_order: i,
        })),
      );
      if (trackErr) {
        logSupabaseError("Failed to create playlist tracks", trackErr);
        setErrorMsg(supabaseUserMessage("Playlist saved, but tracks failed", trackErr));
      }
    }
    router.push(`/playlists/${String((playlist as { id: string }).id)}`);
  };

  const pendingSong = songs.find((s) => s.id === pendingUploadSongId);
  const filteredSongs = songs.filter((song) => {
    if (audioReadyOnly && !song.audio_storage_path) return false;
    const writerNames = [...new Set(splits.filter((s) => s.song_id === song.id).map((s) => s.writer_name).filter(Boolean))];
    const tagNames = tags.filter((t) => t.song_id === song.id).map((t) => t.tag_name);
    const hay = [song.title, ...writerNames, ...tagNames, song.audio_storage_path ? "audio ready" : "needs upload"].join(" ").toLowerCase();
    return hay.includes(search.trim().toLowerCase());
  });

  return (
    <div>
      <PageHeader title="New Playlist" subtitle="Create a private recipient playlist from saved Songs/Works." actions={<Link className="button" href="/playlists">Back</Link>} />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}
      <SectionCard title="Playlist Details" actions={<button className="button primary" onClick={onSave}>Save Playlist</button>}>
        <div className="kv">
          <dt>Title</dt><dd><input value={title} onChange={(e) => setTitle(e.target.value)} /></dd>
          <dt>Description</dt><dd><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></dd>
          <dt>Recipient Name</dt><dd><input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></dd>
          <dt>Recipient Company</dt><dd><input value={recipientCompany} onChange={(e) => setRecipientCompany(e.target.value)} /></dd>
          <dt>Password (optional)</dt><dd><input value={password} onChange={(e) => setPassword(e.target.value)} /></dd>
          <dt>Expiry (optional)</dt><dd><input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></dd>
        </div>
      </SectionCard>

      <SectionCard title="Tracks (Saved Songs/Works only)">
        <p className="helper" style={{ marginBottom: ".6rem" }}>Upload a pitch-playback copy here. Keep your archive/master files in Dropbox.</p>
        <p className="helper" style={{ marginBottom: ".6rem" }}>For pitching, compressed MP3/M4A is recommended. Keep WAVs in Dropbox unless needed.</p>
        <div className="rowActions compact" style={{ marginBottom: ".6rem" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, tags, writers, audio status" style={{ minWidth: 320 }} />
          <label><input type="checkbox" checked={audioReadyOnly} onChange={(e) => setAudioReadyOnly(e.target.checked)} /> Audio ready only</label>
        </div>
        <div className="rowActions compact" style={{ alignItems: "end", marginBottom: ".7rem" }}>
          <select value={selectedSong} onChange={(e) => setSelectedSong(e.target.value)} style={{ minWidth: 260 }}>
            <option value="">Select saved Song/Work</option>
            {filteredSongs.map((song) => {
              const writerNames = [...new Set(splits.filter((s) => s.song_id === song.id).map((s) => s.writer_name).filter(Boolean))];
              const tagNames = tags.filter((t) => t.song_id === song.id).map((t) => t.tag_name);
              return <option key={song.id} value={song.id}>{song.title} {tagNames.length ? `• ${tagNames.join("/")}` : ""} {writerNames.length ? `• ${writerNames.join("/")}` : ""} {song.audio_storage_path ? "• Audio ready" : "• Needs upload"}</option>;
            })}
          </select>
          <button className="button primary compact" onClick={addSelectedSong}>Add Selected Song</button>
        </div>

        {pendingSong ? (
          <div className="card" style={{ marginBottom: ".7rem" }}>
            <p style={{ marginBottom: ".5rem" }}><strong>{pendingSong.title}</strong> has no pitch audio yet.</p>
            <p className="helper" style={{ marginBottom: ".5rem" }}>Upload audio before adding.</p>
            <p className="helper" style={{ marginBottom: ".5rem" }}>Upload a pitch-playback copy here. Keep your archive/master files in Dropbox.</p>
            <input
              type="file"
              accept=".mp3,.wav,.m4a,.aac,audio/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!isAllowedPitchAudio(file)) {
                  setErrorMsg("Unsupported audio format. Use mp3, wav, m4a, or aac.");
                  return;
                }
                try {
                  await uploadPitchAudio(pendingSong.id, file);
                  setTracks((prev) => [...prev, { song_work_id: pendingSong.id, notes: pendingNotes }]);
                  setPendingUploadSongId("");
                  setPendingNotes("");
                  setSelectedSong("");
                  await loadSongs();
                } catch (err) {
                  logSupabaseError("Failed to upload pitch audio from playlist create", err);
                  setErrorMsg(supabaseUserMessage("Could not upload pitch audio", err));
                }
              }}
            />
            <input style={{ marginTop: ".55rem" }} placeholder="Track note (optional)" value={pendingNotes} onChange={(e) => setPendingNotes(e.target.value)} />
          </div>
        ) : null}

        {tracks.length === 0 ? <p className="helper">No tracks selected yet.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Order</th><th>Song/Work</th><th>Pitch Audio</th><th>Notes</th><th>Actions</th></tr></thead>
              <tbody>
                {tracks.map((track, i) => {
                  const song = songs.find((s) => s.id === track.song_work_id);
                  return (
                    <tr key={`${track.song_work_id}-${i}`}>
                      <td>{i + 1}</td>
                      <td>{song?.title || track.song_work_id}</td>
                      <td>{song?.audio_storage_path ? (song?.audio_file_name || "Audio ready") : <span className="helper">Audio missing - upload a new pitch audio file</span>}</td>
                      <td><input value={track.notes} onChange={(e) => setTracks((prev) => prev.map((t, idx) => (idx === i ? { ...t, notes: e.target.value } : t)))} /></td>
                      <td><div className="rowActions compact"><button className="button compact" onClick={() => setTracks((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
