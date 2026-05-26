"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import { isAllowedPitchAudio, uploadPitchAudio } from "@/lib/pitchAudio";

type Playlist = {
  id: string;
  title: string;
  description?: string | null;
  recipient_name?: string | null;
  recipient_company?: string | null;
  password?: string | null;
  expires_at?: string | null;
  is_active?: boolean | null;
  share_token: string;
};
type Track = { id: string; playlist_id: string; song_work_id: string; notes?: string | null; sort_order: number };
type SongOption = { id: string; title: string; audio_storage_path?: string | null; audio_file_name?: string | null };
type SplitRef = { song_id: string; writer_name: string };
type TagRef = { song_id: string; tag_name: string };
type PlaylistView = { id: string; created_at: string };
type PlaylistEvent = { id: string; playlist_track_id?: string | null; event_type: "view" | "play" | "finish"; created_at: string };
type PlaylistResponse = {
  id: string;
  playlist_track_id?: string | null;
  response_type: "interested" | "hold" | "pass" | "feedback";
  sender_name?: string | null;
  sender_company?: string | null;
  sender_artist?: string | null;
  sender_message?: string | null;
  created_at: string;
};

export default function PlaylistDetailPage() {
  const params = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [songs, setSongs] = useState<SongOption[]>([]);
  const [selectedSong, setSelectedSong] = useState("");
  const [pendingUploadSongId, setPendingUploadSongId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [views, setViews] = useState<PlaylistView[]>([]);
  const [events, setEvents] = useState<PlaylistEvent[]>([]);
  const [responses, setResponses] = useState<PlaylistResponse[]>([]);
  const [search, setSearch] = useState("");
  const [audioReadyOnly, setAudioReadyOnly] = useState(false);
  const [splits, setSplits] = useState<SplitRef[]>([]);
  const [tags, setTags] = useState<TagRef[]>([]);

  const load = async () => {
    const [pRes, tRes, sRes, vRes, eRes, rRes, splitRes, tagRes] = await Promise.all([
      supabase.from("pitch_playlists").select("*").eq("id", params.id).single(),
      supabase.from("pitch_playlist_tracks").select("id,playlist_id,song_work_id,notes,sort_order").eq("playlist_id", params.id).order("sort_order", { ascending: true }),
      supabase.from("song_works").select("id,title,audio_storage_path,audio_file_name").order("title", { ascending: true }),
      supabase.from("pitch_playlist_views").select("id,created_at").eq("playlist_id", params.id),
      supabase.from("pitch_playlist_events").select("id,playlist_track_id,event_type,created_at").eq("playlist_id", params.id),
      supabase.from("pitch_playlist_responses").select("id,playlist_track_id,response_type,sender_name,sender_company,sender_artist,sender_message,created_at").eq("playlist_id", params.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("song_writer_splits").select("song_id,writers(name)"),
      supabase.from("song_work_tags").select("song_id,song_tags(name)"),
    ]);
    if (pRes.error || tRes.error || sRes.error || vRes.error || eRes.error || rRes.error || splitRes.error || tagRes.error || !pRes.data) {
      const err = pRes.error || tRes.error || sRes.error || vRes.error || eRes.error || rRes.error || splitRes.error || tagRes.error;
      logSupabaseError("Failed to load playlist detail", err);
      setErrorMsg(supabaseUserMessage("Could not load playlist", err));
      return;
    }
    setPlaylist(pRes.data as Playlist);
    setTracks((tRes.data ?? []) as Track[]);
    setSongs((sRes.data ?? []) as SongOption[]);
    setViews((vRes.data ?? []) as PlaylistView[]);
    setEvents((eRes.data ?? []) as PlaylistEvent[]);
    setResponses((rRes.data ?? []) as PlaylistResponse[]);
    setSplits((splitRes.data ?? []).map((r) => ({ song_id: String((r as { song_id: string }).song_id), writer_name: String((r as { writers?: { name?: string } | null }).writers?.name ?? "") })));
    setTags((tagRes.data ?? []).map((r) => ({ song_id: String((r as { song_id: string }).song_id), tag_name: String((r as { song_tags?: { name?: string } | null }).song_tags?.name ?? "") })));
  };
  useEffect(() => {
    load();
  }, [params.id]);

  useEffect(() => {
    const onFocus = () => {
      load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const updatePlaylist = async (patch: Partial<Playlist>) => {
    if (!playlist) return;
    setPlaylist((p) => (p ? { ...p, ...patch } : p));
    const { error } = await supabase.from("pitch_playlists").update(patch).eq("id", playlist.id);
    if (error) {
      logSupabaseError("Failed to update playlist", error);
      setErrorMsg(supabaseUserMessage("Could not update playlist", error));
    }
  };

  const addSelectedSong = async () => {
    setErrorMsg("");
    setUploadSuccessMsg("");
    if (!playlist) return;
    const song = songs.find((s) => s.id === selectedSong);
    if (!song) return;
    if (tracks.some((t) => t.song_work_id === song.id)) {
      setErrorMsg("That song is already in this playlist.");
      return;
    }
    if (!song.audio_storage_path) {
      setPendingUploadSongId(song.id);
      return;
    }
    const { error } = await supabase.from("pitch_playlist_tracks").insert({
      playlist_id: playlist.id,
      song_work_id: song.id,
      notes: null,
      sort_order: tracks.length,
    });
    if (error) {
      logSupabaseError("Failed to add playlist track", error);
      setErrorMsg(supabaseUserMessage("Could not add track", error));
      return;
    }
    setSelectedSong("");
    await load();
  };

  const uploadAndAddPendingSong = async () => {
    if (!playlist) return;
    const pendingSong = songs.find((s) => s.id === pendingUploadSongId);
    if (!pendingSong || !selectedFile || uploading) return;

    setUploading(true);
    setErrorMsg("");
    setUploadSuccessMsg("");

    try {
      if (!isAllowedPitchAudio(selectedFile)) {
        setErrorMsg("This audio format is not allowed.");
        return;
      }

      await uploadPitchAudio(pendingSong.id, selectedFile);
      const { error } = await supabase.from("pitch_playlist_tracks").insert({
        playlist_id: playlist.id,
        song_work_id: pendingSong.id,
        notes: null,
        sort_order: tracks.length,
      });
      if (error) throw error;

      setUploadSuccessMsg("Audio uploaded and track added to playlist.");
      setPendingUploadSongId("");
      setSelectedSong("");
      setSelectedFile(null);
      await load();
    } catch (err) {
      console.error("Failed to upload/add song in playlist edit", JSON.stringify({
        message: (err as { message?: string })?.message ?? "No message",
        statusCode: (err as { statusCode?: string | number })?.statusCode ?? "No statusCode",
        error: (err as { error?: string })?.error ?? "No error",
        name: (err as { name?: string })?.name ?? "No name",
        raw: err,
      }, null, 2));
      setErrorMsg((err as { message?: string })?.message || supabaseUserMessage("Could not upload/add track", err));
    } finally {
      setUploading(false);
    }
  };

  const updateTrack = async (id: string, patch: Partial<Track>) => {
    const { error } = await supabase.from("pitch_playlist_tracks").update(patch).eq("id", id);
    if (error) {
      logSupabaseError("Failed to update playlist track", error);
      setErrorMsg(supabaseUserMessage("Could not update track", error));
      return;
    }
    await load();
  };

  const delTrack = async (id: string) => {
    if (!window.confirm("Delete this track?")) return;
    const { error } = await supabase.from("pitch_playlist_tracks").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete playlist track", error);
      setErrorMsg(supabaseUserMessage("Could not delete track", error));
      return;
    }
    await load();
  };

  const moveTrack = async (idx: number, direction: -1 | 1) => {
    const next = idx + direction;
    if (next < 0 || next >= tracks.length) return;
    const a = tracks[idx];
    const b = tracks[next];
    await Promise.all([
      supabase.from("pitch_playlist_tracks").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("pitch_playlist_tracks").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await load();
  };

  if (!playlist) return <div className="helper">Playlist not found.</div>;
  const shareLink = typeof window === "undefined" ? "" : `${window.location.origin}/pitch/${playlist.share_token}`;
  const pendingSong = songs.find((s) => s.id === pendingUploadSongId);
  const playEvents = events.filter((e) => e.event_type === "play");
  const finishEvents = events.filter((e) => e.event_type === "finish");
  const playsByTrack: Record<string, number> = {};
  playEvents.forEach((e) => {
    const key = e.playlist_track_id || "";
    if (!key) return;
    playsByTrack[key] = (playsByTrack[key] || 0) + 1;
  });
  const responseCounts = {
    interested: responses.filter((r) => r.response_type === "interested").length,
    hold: responses.filter((r) => r.response_type === "hold").length,
    pass: responses.filter((r) => r.response_type === "pass").length,
    feedback: responses.filter((r) => r.response_type === "feedback").length,
  };
  const filteredSongs = songs.filter((song) => {
    if (audioReadyOnly && !song.audio_storage_path) return false;
    const writerNames = [...new Set(splits.filter((s) => s.song_id === song.id).map((s) => s.writer_name).filter(Boolean))];
    const tagNames = tags.filter((t) => t.song_id === song.id).map((t) => t.tag_name);
    const hay = [song.title, ...writerNames, ...tagNames, song.audio_storage_path ? "audio ready" : "needs upload"].join(" ").toLowerCase();
    return hay.includes(search.trim().toLowerCase());
  });

  return (
    <div>
      <PageHeader title={playlist.title || "Playlist"} subtitle="Saved Songs/Works only. Add pitch-playback copies as needed." actions={<div className="rowActions compact"><Link className="button" href="/playlists">Back</Link><button className="button primary" onClick={() => navigator.clipboard.writeText(shareLink)}>Copy Share Link</button></div>} />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}
      {uploadSuccessMsg ? <p className="helper" style={{ color: "#3f6b4a", marginBottom: ".7rem" }}>{uploadSuccessMsg}</p> : null}

      <SectionCard title="Playlist Settings">
        <div className="kv">
          <dt>Title</dt><dd><input value={playlist.title || ""} onChange={(e) => updatePlaylist({ title: e.target.value })} /></dd>
          <dt>Description</dt><dd><textarea value={playlist.description || ""} onChange={(e) => updatePlaylist({ description: e.target.value })} /></dd>
          <dt>Recipient Name</dt><dd><input value={playlist.recipient_name || ""} onChange={(e) => updatePlaylist({ recipient_name: e.target.value })} /></dd>
          <dt>Recipient Company</dt><dd><input value={playlist.recipient_company || ""} onChange={(e) => updatePlaylist({ recipient_company: e.target.value })} /></dd>
          <dt>Password</dt><dd><input value={playlist.password || ""} onChange={(e) => updatePlaylist({ password: e.target.value })} /></dd>
          <dt>Expiry</dt><dd><input type="datetime-local" value={playlist.expires_at ? new Date(playlist.expires_at).toISOString().slice(0, 16) : ""} onChange={(e) => updatePlaylist({ expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></dd>
          <dt>Status</dt><dd><label><input type="checkbox" checked={Boolean(playlist.is_active)} onChange={(e) => updatePlaylist({ is_active: e.target.checked })} /> Active</label></dd>
        </div>
      </SectionCard>

      <SectionCard title="Tracks (Saved Songs/Works only)">
        <p className="helper" style={{ marginBottom: ".6rem" }}>Upload a pitch-playback copy here. Keep your archive/master files in Dropbox.</p>
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
            <input
              type="file"
              accept=".mp3,.wav,.m4a,.aac,audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
                if (!file) return;
                if (!isAllowedPitchAudio(file)) {
                  setErrorMsg("This audio format is not allowed.");
                  return;
                }
                setErrorMsg("");
              }}
            />
            {selectedFile ? (
              <div style={{ marginTop: ".6rem" }}>
                <p className="helper">Selected file: <strong>{selectedFile.name}</strong></p>
                <p className="helper">Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                <p className="helper">Type: {selectedFile.type || "Unknown"}</p>
                <p className="helper" style={{ marginTop: ".2rem" }}>{uploading ? "Uploading audio..." : "Ready to upload"}</p>
                <div className="rowActions compact" style={{ marginTop: ".5rem" }}>
                  <button className="button primary compact" onClick={uploadAndAddPendingSong} disabled={uploading}>
                    {uploading ? "Uploading audio..." : "Upload & Add to Playlist"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tracks.length === 0 ? <p className="helper">No tracks yet.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Order</th><th>Song/Work</th><th>Pitch Audio</th><th>Notes</th><th>Actions</th></tr></thead>
              <tbody>
                {tracks.map((track, idx) => {
                  const song = songs.find((s) => s.id === track.song_work_id);
                  return (
                    <tr key={track.id}>
                      <td>{idx + 1}</td>
                      <td>{song?.title || track.song_work_id}</td>
                      <td>{song?.audio_storage_path ? (song?.audio_file_name || "Audio ready") : <span className="helper">Audio missing - upload a new pitch audio file</span>}</td>
                      <td><input value={track.notes || ""} onChange={(e) => updateTrack(track.id, { notes: e.target.value })} /></td>
                      <td><div className="rowActions compact"><button className="button compact" onClick={() => moveTrack(idx, -1)}>Up</button><button className="button compact" onClick={() => moveTrack(idx, 1)}>Down</button><button className="button compact" onClick={() => delTrack(track.id)}>Delete</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Tracking">
        <div className="grid cards" style={{ marginBottom: ".8rem" }}>
          <div className="statCard"><p className="statLabel">Total Views</p><p className="statValue">{views.length}</p></div>
          <div className="statCard"><p className="statLabel">Total Plays</p><p className="statValue">{playEvents.length}</p></div>
          <div className="statCard"><p className="statLabel">Completed Listens</p><p className="statValue">{finishEvents.length}</p></div>
          <div className="statCard"><p className="statLabel">Interested</p><p className="statValue">{responseCounts.interested}</p></div>
          <div className="statCard"><p className="statLabel">Hold</p><p className="statValue">{responseCounts.hold}</p></div>
          <div className="statCard"><p className="statLabel">Pass</p><p className="statValue">{responseCounts.pass}</p></div>
          <div className="statCard"><p className="statLabel">Feedback</p><p className="statValue">{responseCounts.feedback}</p></div>
        </div>

        <h2 style={{ marginBottom: ".4rem" }}>Plays by Track</h2>
        <div className="tableWrap" style={{ marginBottom: ".8rem" }}>
          <table>
            <thead><tr><th>Track</th><th>Plays</th></tr></thead>
            <tbody>
              {tracks.map((track) => {
                const song = songs.find((s) => s.id === track.song_work_id);
                return <tr key={track.id}><td>{song?.title || track.song_work_id}</td><td>{playsByTrack[track.id] || 0}</td></tr>;
              })}
            </tbody>
          </table>
        </div>

        <h2 style={{ marginBottom: ".4rem" }}>Latest Responses</h2>
        {responses.length === 0 ? <p className="helper">No responses yet.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>When</th><th>Track</th><th>Type</th><th>Name</th><th>Company</th><th>Artist</th><th>Message</th></tr></thead>
              <tbody>
                {responses.map((r) => {
                  const t = tracks.find((track) => track.id === r.playlist_track_id);
                  const s = songs.find((song) => song.id === t?.song_work_id);
                  return (
                    <tr key={r.id}>
                      <td>{new Date(r.created_at).toLocaleString()}</td>
                      <td>{s?.title || r.playlist_track_id || "-"}</td>
                      <td>{r.response_type}</td>
                      <td>{r.sender_name || "-"}</td>
                      <td>{r.sender_company || "-"}</td>
                      <td>{r.sender_artist || "-"}</td>
                      <td>{r.sender_message || "-"}</td>
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
