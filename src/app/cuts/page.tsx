"use client";

import { useEffect, useState } from "react";
import { CutRecord } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

const mapCut = (r: Record<string, unknown>): CutRecord => ({
  id: String(r.id ?? ""),
  songId: String(r.song_id ?? ""),
  artist: r.artist ? String(r.artist) : undefined,
  releaseTitle: r.release_title ? String(r.release_title) : undefined,
  releaseDate: r.release_date ? String(r.release_date) : undefined,
});

const CUTS_PLAYLIST_KEY = "cuts_playlist_reference_v1";

function extractEmbedUrl(raw: string) {
  const input = raw.trim();
  if (!input) return "";
  const srcMatch = input.match(/src=["']([^"']+)["']/i);
  const candidate = (srcMatch?.[1] || input).trim();
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("open.spotify.com") && parsed.pathname.includes("/playlist/")) {
      const playlistId = parsed.pathname.split("/playlist/")[1]?.split("?")[0];
      return playlistId ? `https://open.spotify.com/embed/playlist/${playlistId}` : "";
    }
    if (host.includes("w.soundcloud.com") && parsed.pathname.includes("/player")) return parsed.toString();
    if (host.includes("soundcloud.com")) return `https://w.soundcloud.com/player/?url=${encodeURIComponent(parsed.toString())}`;
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      const videoId = host.includes("youtu.be")
        ? parsed.pathname.replace("/", "")
        : (parsed.searchParams.get("v") || (parsed.pathname.includes("/embed/") ? parsed.pathname.split("/embed/")[1] : ""));
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }
    if (host.includes("music.apple.com")) return parsed.toString();
    return "";
  } catch {
    return "";
  }
}

export default function CutsPage() {
  const [rows, setRows] = useState<CutRecord[]>([]);
  const [songOptions, setSongOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [newCutSongId, setNewCutSongId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [playlistInput, setPlaylistInput] = useState("");
  const [savedPlaylistRef, setSavedPlaylistRef] = useState("");
  const [showPlaylistEditor, setShowPlaylistEditor] = useState(true);
  const [playlistSaveState, setPlaylistSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [playlistSaveMsg, setPlaylistSaveMsg] = useState("");

  const embedUrl = extractEmbedUrl(savedPlaylistRef);
  const fallbackUrl = (() => {
    if (!savedPlaylistRef.trim()) return "";
    const srcMatch = savedPlaylistRef.match(/src=["']([^"']+)["']/i);
    const candidate = (srcMatch?.[1] || savedPlaylistRef).trim();
    try {
      return new URL(candidate).toString();
    } catch {
      return "";
    }
  })();

  const load = async () => {
    const [cutRes, songRes] = await Promise.all([
      supabase.from("cut_records").select("*").order("created_at", { ascending: false }),
      supabase.from("song_works").select("id,title").order("title", { ascending: true }),
    ]);
    if (cutRes.error || songRes.error) {
      const error = cutRes.error || songRes.error;
      logSupabaseError("Failed to load cuts", error);
      setErrorMsg(supabaseUserMessage("Could not load cut records", error));
      return;
    }
    setRows((cutRes.data ?? []).map((r) => mapCut(r as Record<string, unknown>)));
    const options = ((songRes.data ?? []) as Array<{ id: string; title?: string | null }>).map((s) => ({ id: String(s.id), title: String(s.title ?? "Untitled Song") }));
    setSongOptions(options);
    setNewCutSongId((prev) => prev || options[0]?.id || "");
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const saved = window.localStorage.getItem(CUTS_PLAYLIST_KEY) || "";
    setSavedPlaylistRef(saved);
    setPlaylistInput(saved);
    setShowPlaylistEditor(!saved);
  }, []);

  const addRow = async () => {
    setErrorMsg("");
    if (!newCutSongId) {
      setErrorMsg("Select a song/work before adding a cut record.");
      return;
    }
    const { data, error } = await supabase.from("cut_records").insert({ song_id: newCutSongId }).select("*").single();
    if (error) {
      logSupabaseError("Failed to create cut", error);
      setErrorMsg(supabaseUserMessage("Could not create cut record", error));
      return;
    }
    if (data) { setRows((r) => [mapCut(data as Record<string, unknown>), ...r]); setEditingId(String(data.id)); }
  };
  const update = async (id: string, key: keyof CutRecord, value: string) => {
    if (key === "songId" && !value.trim()) {
      setErrorMsg("Song ID is required for cut records.");
      return;
    }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    const colMap: Record<string, string> = { songId: "song_id", artist: "artist", releaseTitle: "release_title", releaseDate: "release_date" };
    const { error } = await supabase.from("cut_records").update({ [colMap[key]]: value }).eq("id", id);
    if (error) {
      logSupabaseError("Failed to update cut", error);
      setErrorMsg(supabaseUserMessage("Could not update cut record", error));
    }
  };
  const del = async (id: string) => { if (!window.confirm("Delete this cut record?")) return; const { error } = await supabase.from("cut_records").delete().eq("id", id); if (error) { logSupabaseError("Failed to delete cut", error); setErrorMsg(supabaseUserMessage("Could not delete cut record", error)); return; } setRows((r) => r.filter((x) => x.id !== id)); };
  const savePlaylistRef = () => {
    try {
      const next = playlistInput.trim();
      window.localStorage.setItem(CUTS_PLAYLIST_KEY, next);
      setSavedPlaylistRef(next);
      setShowPlaylistEditor(false);
      setPlaylistSaveState("saved");
      setPlaylistSaveMsg("Saved in app");
    } catch {
      setPlaylistSaveState("error");
      setPlaylistSaveMsg("Could not save playlist reference. Please try again.");
    }
  };
  const removePlaylistRef = () => {
    try {
      window.localStorage.removeItem(CUTS_PLAYLIST_KEY);
      setSavedPlaylistRef("");
      setPlaylistInput("");
      setShowPlaylistEditor(true);
      setPlaylistSaveState("idle");
      setPlaylistSaveMsg("");
    } catch {
      setPlaylistSaveState("error");
      setPlaylistSaveMsg("Could not remove playlist reference.");
    }
  };

  return (
    <div>
      <PageHeader title="Cuts" subtitle="Commercial release tracking with understated, auditable detail." actions={<div className="rowActions compact"><select value={newCutSongId} onChange={(e) => setNewCutSongId(e.target.value)} style={{ minWidth: 220 }}><option value="">Select song/work</option>{songOptions.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select><button className="button primary" onClick={addRow}>Add Cut Record</button></div>} />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}

      <SectionCard title="Writer Playlist / Reference Playlist">
        <p className="helper" style={{ marginBottom: ".55rem" }}>Embed a Spotify, SoundCloud, Apple Music, YouTube or other playlist here to assist with cut tracking.</p>
        {showPlaylistEditor ? (
          <>
            <textarea value={playlistInput} onChange={(e) => setPlaylistInput(e.target.value)} placeholder="Paste playlist URL or embed code" />
            <div className="rowActions compact" style={{ marginTop: ".55rem" }}>
              <button className="button primary compact" onClick={savePlaylistRef}>Save Playlist Reference</button>
              <button className="button compact" onClick={removePlaylistRef} disabled={!savedPlaylistRef}>Remove</button>
            </div>
          </>
        ) : (
          <div className="rowActions compact" style={{ marginBottom: ".55rem" }}>
            <span className="helper" style={{ color: playlistSaveState === "error" ? "#8a3d3d" : "#3f6b4a" }}>{playlistSaveMsg || "Saved in app"}</span>
            <button className="button compact" onClick={() => setShowPlaylistEditor(true)}>Replace playlist</button>
            <button className="button compact" onClick={removePlaylistRef} disabled={!savedPlaylistRef}>Remove</button>
          </div>
        )}
        {savedPlaylistRef ? (
          <div style={{ marginTop: ".75rem" }}>
            {embedUrl ? (
              <iframe
                title="Cuts playlist reference"
                src={embedUrl}
                width="100%"
                height="340"
                style={{ border: "1px solid var(--line)", borderRadius: "12px", background: "#fff" }}
                allow="autoplay; encrypted-media; picture-in-picture"
                loading="lazy"
              />
            ) : fallbackUrl ? (
              <p className="helper">Saved. Embed preview unavailable for this format. Open your saved playlist link: <a href={fallbackUrl} target="_blank" rel="noreferrer">Open playlist</a></p>
            ) : (
              <p className="helper">Saved. Could not parse a valid URL from this embed snippet yet.</p>
            )}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard>
        {rows.length===0 ? <EmptyState title="No cut records yet" hint="Add a cut once a song is commercially active." action={<button className="button primary" onClick={addRow}>Add Cut Record</button>} /> : (
          <div className="tableWrap"><table><thead><tr><th>Song ID</th><th>Artist</th><th>Release Title</th><th>Release Date</th><th>Actions</th></tr></thead><tbody>{rows.map((c)=><tr key={c.id}><td>{editingId===c.id ? <input value={c.songId} onChange={(e)=>update(c.id,"songId",e.target.value)} /> : (c.songId || <span className="helper">Link song</span>)}</td><td>{editingId===c.id ? <input value={c.artist || ""} onChange={(e)=>update(c.id,"artist",e.target.value)} /> : (c.artist || <span className="helper">Add artist</span>)}</td><td>{editingId===c.id ? <input value={c.releaseTitle || ""} onChange={(e)=>update(c.id,"releaseTitle",e.target.value)} /> : (c.releaseTitle || <span className="helper">Add release</span>)}</td><td>{editingId===c.id ? <input type="date" value={c.releaseDate || ""} onChange={(e)=>update(c.id,"releaseDate",e.target.value)} /> : (c.releaseDate || <span className="helper">Add date</span>)}</td><td className="rowActions"><button className="button" onClick={()=>setEditingId(editingId===c.id ? null : c.id)}>{editingId===c.id ? "Save" : "Edit"}</button><button className="button" onClick={()=>del(c.id)}>Delete</button></td></tr>)}</tbody></table></div>
        )}
      </SectionCard>
    </div>
  );
}
