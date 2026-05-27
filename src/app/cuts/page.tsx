"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CutRecord } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

type SpotifyApiPreview = {
  title: string;
  artist: string;
  project: string;
  artwork: string;
  releaseDate: string;
  listenLink: string;
  platform: string;
  isrc: string;
  trackId: string;
  album?: string;
};
const ACHV_PREFIX = "ACHV1:";

const mapCut = (r: Record<string, unknown>): CutRecord => ({
  id: String(r.id ?? ""),
  songId: String(r.song_id ?? ""),
  artist: r.artist ? String(r.artist) : undefined,
  releaseTitle: r.release_title ? String(r.release_title) : undefined,
  releaseDate: r.release_date ? String(r.release_date) : undefined,
  label: r.label ? String(r.label) : undefined,
  distributor: r.distributor ? String(r.distributor) : undefined,
  isrc: r.isrc ? String(r.isrc) : undefined,
  chartStreamNotes: r.chart_stream_notes ? String(r.chart_stream_notes) : undefined,
  registrationStatus: r.registration_status ? String(r.registration_status) : undefined,
  royaltyAdminNotes: r.royalty_admin_notes ? String(r.royalty_admin_notes) : undefined,
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
    return "";
  } catch {
    return "";
  }
}

export default function CutsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CutRecord[]>([]);
  const [songOptions, setSongOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [songTitleById, setSongTitleById] = useState<Record<string, string>>({});
  const [newCutSongId, setNewCutSongId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [playlistInput, setPlaylistInput] = useState("");
  const [savedPlaylistRef, setSavedPlaylistRef] = useState("");
  const [showPlaylistEditor, setShowPlaylistEditor] = useState(true);
  const [playlistSaveState, setPlaylistSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [playlistSaveMsg, setPlaylistSaveMsg] = useState("");

  const [importUrl, setImportUrl] = useState("");
  const [importPreview, setImportPreview] = useState<SpotifyApiPreview | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const [spotifyArtistQuery, setSpotifyArtistQuery] = useState("");
  const [spotifyTitleQuery, setSpotifyTitleQuery] = useState("");
  const [spotifyReleaseQuery, setSpotifyReleaseQuery] = useState("");
  const [spotifySearchResults, setSpotifySearchResults] = useState<SpotifyApiPreview[]>([]);
  const [importLoading, setImportLoading] = useState(false);

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
    const mappedCuts = (cutRes.data ?? []).map((r) => mapCut(r as Record<string, unknown>));
    setRows(mappedCuts);
    const options = ((songRes.data ?? []) as Array<{ id: string; title?: string | null }>).map((s) => ({ id: String(s.id), title: String(s.title ?? "Untitled Song") }));
    setSongOptions(options);
    setSongTitleById(Object.fromEntries(options.map((s) => [s.id, s.title])));
    setNewCutSongId("");
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
    if (data) router.push(`/cuts/${String((data as { id: string }).id)}`);
  };

  const createFromImportPreview = async () => {
    if (!importPreview || !newCutSongId) {
      setErrorMsg("Select a song/work and prepare metadata preview before saving.");
      return;
    }
    const duplicate = rows.some((r) =>
      (importPreview.isrc && String(r.isrc || "").toLowerCase() === importPreview.isrc.toLowerCase())
      || (importPreview.listenLink && String(r.distributor || "").trim() === importPreview.listenLink.trim())
      || (
        String(r.releaseTitle || "").toLowerCase() === String(importPreview.project || importPreview.title || "").toLowerCase()
        && String(r.artist || "").toLowerCase() === String(importPreview.artist || "").toLowerCase()
      ),
    );
    if (duplicate) {
      setImportMsg("Possible duplicate detected by ISRC/link/title+artist. Review before creating.");
      return;
    }

    const payload = {
      song_id: newCutSongId,
      artist: importPreview.artist || null,
      release_title: importPreview.project || importPreview.title || null,
      release_date: importPreview.releaseDate || null,
      label: importPreview.platform || null,
      distributor: importPreview.listenLink || null,
      isrc: importPreview.isrc || null,
      chart_stream_notes: null,
      registration_status: importPreview.trackId ? `Spotify Track ID: ${importPreview.trackId}` : null,
      royalty_admin_notes: importPreview.artwork ? `Artwork URL: ${importPreview.artwork}` : null,
    };
    const { data, error } = await supabase.from("cut_records").insert(payload).select("*").single();
    if (error) {
      logSupabaseError("Failed to create cut from import preview", error);
      setErrorMsg(supabaseUserMessage("Could not create cut record from imported metadata", error));
      return;
    }
    if (data) router.push(`/cuts/${String((data as { id: string }).id)}`);
  };

  const lookupSpotifyFromUrl = async () => {
    const url = importUrl.trim();
    if (!url) {
      setImportMsg("Paste a Spotify track URL first.");
      return;
    }
    setImportLoading(true);
    setImportMsg("");
    try {
      const res = await fetch(`/api/spotify/track?url=${encodeURIComponent(url)}`);
      const json = (await res.json()) as { item?: SpotifyApiPreview; error?: string; detail?: string };
      if (!res.ok || !json.item) {
        setImportMsg(json.error ? `${json.error}${json.detail ? `: ${json.detail}` : ""}` : "Could not import from Spotify URL.");
        return;
      }
      const item = json.item;
      setImportPreview({
        title: item.title || "",
        artist: item.artist || "",
        project: item.project || item.album || "",
        artwork: item.artwork || "",
        releaseDate: item.releaseDate || "",
        listenLink: item.listenLink || url,
        platform: "Spotify",
        isrc: item.isrc || "",
        trackId: item.trackId || "",
      });
      setImportMsg("Spotify metadata imported. Review and save.");
    } finally {
      setImportLoading(false);
    }
  };

  const searchSpotify = async () => {
    const artist = spotifyArtistQuery.trim();
    const title = spotifyTitleQuery.trim();
    const release = spotifyReleaseQuery.trim();
    const q = [artist ? `artist:${artist}` : "", title ? `track:${title}` : "", release ? `album:${release}` : ""].filter(Boolean).join(" ");
    if (!q) return;
    setImportLoading(true);
    setImportMsg("");
    setSpotifySearchResults([]);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { items?: SpotifyApiPreview[]; error?: string; detail?: string };
      if (!res.ok) {
        setImportMsg(json.error ? `${json.error}${json.detail ? `: ${json.detail}` : ""}` : "Spotify search failed.");
        return;
      }
      const items = (json.items ?? []).map((item) => ({
        title: item.title || "",
        artist: item.artist || "",
        project: item.project || item.album || "",
        artwork: item.artwork || "",
        releaseDate: item.releaseDate || "",
        listenLink: item.listenLink || "",
        platform: "Spotify",
        isrc: item.isrc || "",
        trackId: item.trackId || "",
      }));
      setSpotifySearchResults(items);
      setImportMsg(items.length ? "Select a result to preview/edit." : "No Spotify matches found.");
    } finally {
      setImportLoading(false);
    }
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete this cut record?")) return;
    const { error } = await supabase.from("cut_records").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete cut", error);
      setErrorMsg(supabaseUserMessage("Could not delete cut record", error));
      return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
  };

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

  const rowAchievementCount = (c: CutRecord) => {
    const raw = String(c.chartStreamNotes || "").trim();
    if (!raw) return 0;
    if (raw.startsWith(ACHV_PREFIX)) {
      try {
        const parsed = JSON.parse(raw.slice(ACHV_PREFIX.length)) as { achievements?: Array<Record<string, unknown>> };
        return Array.isArray(parsed.achievements) ? parsed.achievements.length : 0;
      } catch {
        return 0;
      }
    }
    return 1;
  };

  const totalCuts = rows.length;

  return (
    <div>
      <PageHeader
        title="Cuts"
        subtitle="Commercial release tracking with understated, auditable detail."
        actions={<div className="rowActions compact"><select value={newCutSongId} onChange={(e) => setNewCutSongId(e.target.value)} style={{ minWidth: 220 }}><option value="">Select song/work</option>{songOptions.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select><button className="button primary" onClick={addRow}>Add Cut Record</button></div>}
      />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}

      <SectionCard title="Import Cut Metadata">
        <p className="helper" style={{ marginBottom: ".5rem" }}>Paste a Spotify track link for server-side metadata import, or search Spotify catalogue by artist/title.</p>
        <div className="rowActions compact">
          <input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="Paste Spotify track URL" style={{ minWidth: 340 }} />
          <button className="button compact" onClick={lookupSpotifyFromUrl} disabled={importLoading}>Import Spotify URL</button>
        </div>
        <div className="rowActions compact" style={{ marginTop: ".45rem" }}>
          <input value={spotifyArtistQuery} onChange={(e) => setSpotifyArtistQuery(e.target.value)} placeholder="Artist" style={{ minWidth: 180 }} />
          <input value={spotifyTitleQuery} onChange={(e) => setSpotifyTitleQuery(e.target.value)} placeholder="Track title" style={{ minWidth: 180 }} />
          <input value={spotifyReleaseQuery} onChange={(e) => setSpotifyReleaseQuery(e.target.value)} placeholder="Release/Project (optional)" style={{ minWidth: 220 }} />
          <button className="button compact" onClick={searchSpotify} disabled={importLoading}>Search Spotify</button>
        </div>
        {importMsg ? <p className="helper" style={{ marginTop: ".45rem" }}>{importMsg}</p> : null}

        {spotifySearchResults.length ? (
          <div className="tableWrap" style={{ marginTop: ".55rem" }}>
            <table>
              <thead><tr><th>Track</th><th>Artist</th><th>Album</th><th>Release</th><th>Action</th></tr></thead>
              <tbody>
                {spotifySearchResults.map((item) => (
                  <tr key={`${item.trackId}-${item.listenLink}`}>
                    <td>{item.title}</td><td>{item.artist}</td><td>{item.project}</td><td>{item.releaseDate || <span className="helper">Unknown</span>}</td>
                    <td><button className="button compact" onClick={() => setImportPreview(item)}>Use</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {importPreview ? (
          <>
            <div className="grid" style={{ marginTop: ".65rem", gap: ".5rem", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              <div><label className="helper">Track title</label><input value={importPreview.title} onChange={(e) => setImportPreview((p) => p ? { ...p, title: e.target.value } : p)} /></div>
              <div><label className="helper">Artist</label><input value={importPreview.artist} onChange={(e) => setImportPreview((p) => p ? { ...p, artist: e.target.value } : p)} /></div>
              <div><label className="helper">Album / Project</label><input value={importPreview.project} onChange={(e) => setImportPreview((p) => p ? { ...p, project: e.target.value } : p)} /></div>
              <div><label className="helper">Artwork URL</label><input value={importPreview.artwork} onChange={(e) => setImportPreview((p) => p ? { ...p, artwork: e.target.value } : p)} /></div>
              <div><label className="helper">Release date</label><input type="date" value={importPreview.releaseDate} onChange={(e) => setImportPreview((p) => p ? { ...p, releaseDate: e.target.value } : p)} /></div>
              <div><label className="helper">Listen link</label><input value={importPreview.listenLink} onChange={(e) => setImportPreview((p) => p ? { ...p, listenLink: e.target.value } : p)} /></div>
              <div><label className="helper">Platform</label><input value={importPreview.platform} onChange={(e) => setImportPreview((p) => p ? { ...p, platform: e.target.value } : p)} /></div>
              <div><label className="helper">ISRC</label><input value={importPreview.isrc} onChange={(e) => setImportPreview((p) => p ? { ...p, isrc: e.target.value } : p)} /></div>
              <div><label className="helper">Spotify track ID</label><input value={importPreview.trackId} onChange={(e) => setImportPreview((p) => p ? { ...p, trackId: e.target.value } : p)} /></div>
            </div>
            <div className="rowActions compact" style={{ marginTop: ".6rem" }}><button className="button primary compact" onClick={createFromImportPreview}>Save as Cut Record</button></div>
          </>
        ) : null}
      </SectionCard>

      <SectionCard title="Writer Playlist / Reference Playlist">
        <p className="helper" style={{ marginBottom: ".55rem" }}>Embed a Spotify, SoundCloud, YouTube or other playlist here to assist with cut tracking.</p>
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
              <iframe title="Cuts playlist reference" src={embedUrl} width="100%" height="340" style={{ border: "1px solid var(--line)", borderRadius: "12px", background: "#fff" }} allow="autoplay; encrypted-media; picture-in-picture" loading="lazy" />
            ) : fallbackUrl ? (
              <p className="helper">Saved. Embed preview unavailable for this format. Open your saved playlist link: <a href={fallbackUrl} target="_blank" rel="noreferrer">Open playlist</a></p>
            ) : (
              <p className="helper">Saved. Could not parse a valid URL from this embed snippet yet.</p>
            )}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title={`Cuts (${totalCuts})`}>
        {rows.length === 0 ? <EmptyState title="No cut records yet" hint="Add a cut once a song is commercially active." action={<button className="button primary" onClick={addRow}>Add Cut Record</button>} /> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Song / Work</th><th>Artist</th><th>Release Title</th><th>Release Date</th><th>Achievements</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((c) => {
                  const achievementCount = rowAchievementCount(c);
                  return (
                    <tr key={c.id}>
                      <td>{songTitleById[c.songId] || <span className="helper">Linked song</span>}</td>
                      <td>{c.artist || <span className="helper">Add artist</span>}</td>
                      <td>{c.releaseTitle || <span className="helper">Add release title</span>}</td>
                      <td>{c.releaseDate || <span className="helper">Add date</span>}</td>
                      <td>
                        {achievementCount > 0 ? `${achievementCount}` : <span className="helper">0</span>}
                      </td>
                      <td>
                        <div className="rowActions compact">
                          <Link className="button compact" href={`/cuts/${c.id}`}>View</Link>
                          <button className="button compact" onClick={() => del(c.id)}>Delete</button>
                        </div>
                      </td>
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
