"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

type PlaylistRow = {
  id: string;
  title: string;
  recipient_name?: string | null;
  recipient_company?: string | null;
  expires_at?: string | null;
  is_active?: boolean | null;
  share_token: string;
};
type PlaylistView = { playlist_id: string; created_at: string };
type PlaylistEvent = { playlist_id: string; event_type: "view" | "play" | "finish" };
type PlaylistResponse = { playlist_id: string; response_type: "interested" | "hold" | "pass" | "feedback"; created_at: string };

export default function PlaylistsPage() {
  const [rows, setRows] = useState<PlaylistRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [viewsByPlaylist, setViewsByPlaylist] = useState<Record<string, number>>({});
  const [playsByPlaylist, setPlaysByPlaylist] = useState<Record<string, number>>({});
  const [interestedByPlaylist, setInterestedByPlaylist] = useState<Record<string, number>>({});
  const [holdsByPlaylist, setHoldsByPlaylist] = useState<Record<string, number>>({});
  const [latestResponseByPlaylist, setLatestResponseByPlaylist] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [origin, setOrigin] = useState("");

  const load = async () => {
    const [playRes, trackRes, viewsRes, eventsRes, responsesRes] = await Promise.all([
      supabase.from("pitch_playlists").select("id,title,recipient_name,recipient_company,expires_at,is_active,share_token").order("created_at", { ascending: false }),
      supabase.from("pitch_playlist_tracks").select("playlist_id"),
      supabase.from("pitch_playlist_views").select("playlist_id,created_at"),
      supabase.from("pitch_playlist_events").select("playlist_id,event_type"),
      supabase.from("pitch_playlist_responses").select("playlist_id,response_type,created_at").order("created_at", { ascending: false }),
    ]);
    if (playRes.error || trackRes.error || viewsRes.error || eventsRes.error || responsesRes.error) {
      const err = playRes.error || trackRes.error || viewsRes.error || eventsRes.error || responsesRes.error;
      logSupabaseError("Failed to load playlists", err);
      setErrorMsg(supabaseUserMessage("Could not load playlists", err));
      return;
    }
    const grouped: Record<string, number> = {};
    (trackRes.data ?? []).forEach((r) => {
      const id = String((r as { playlist_id: string }).playlist_id);
      grouped[id] = (grouped[id] || 0) + 1;
    });
    const viewGrouped: Record<string, number> = {};
    ((viewsRes.data ?? []) as PlaylistView[]).forEach((r) => {
      viewGrouped[r.playlist_id] = (viewGrouped[r.playlist_id] || 0) + 1;
    });
    const playGrouped: Record<string, number> = {};
    ((eventsRes.data ?? []) as PlaylistEvent[]).forEach((r) => {
      if (r.event_type !== "play") return;
      playGrouped[r.playlist_id] = (playGrouped[r.playlist_id] || 0) + 1;
    });
    const interestedGrouped: Record<string, number> = {};
    const holdGrouped: Record<string, number> = {};
    const latestResponseGrouped: Record<string, string> = {};
    ((responsesRes.data ?? []) as PlaylistResponse[]).forEach((r) => {
      if (!latestResponseGrouped[r.playlist_id]) latestResponseGrouped[r.playlist_id] = r.created_at;
      if (r.response_type === "interested") interestedGrouped[r.playlist_id] = (interestedGrouped[r.playlist_id] || 0) + 1;
      if (r.response_type === "hold") holdGrouped[r.playlist_id] = (holdGrouped[r.playlist_id] || 0) + 1;
    });
    setCounts(grouped);
    setViewsByPlaylist(viewGrouped);
    setPlaysByPlaylist(playGrouped);
    setInterestedByPlaylist(interestedGrouped);
    setHoldsByPlaylist(holdGrouped);
    setLatestResponseByPlaylist(latestResponseGrouped);
    setRows((playRes.data ?? []) as PlaylistRow[]);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const del = async (id: string) => {
    if (!window.confirm("Delete this playlist?")) return;
    const { error } = await supabase.from("pitch_playlists").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete playlist", error);
      setErrorMsg(supabaseUserMessage("Could not delete playlist", error));
      return;
    }
    await load();
  };

  return (
    <div>
      <PageHeader title="Playlists" subtitle="Private pitch playlists for recipient streaming." actions={<Link className="button primary" href="/playlists/new">New Playlist</Link>} />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}
      <SectionCard>
        {rows.length === 0 ? (
          <EmptyState title="No playlists yet" hint="Create a private playlist and share a streaming link." action={<Link className="button primary" href="/playlists/new">Create Playlist</Link>} />
        ) : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Title</th><th>Recipient</th><th>Tracks</th><th>Views</th><th>Plays</th><th>Holds</th><th>Interested</th><th>Latest Response</th><th>Status</th><th>Expiry</th><th>Share Link</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const shareLink = `${origin}/pitch/${row.share_token}`;
                  const recipient = [row.recipient_name, row.recipient_company].filter(Boolean).join(" / ");
                  return (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{recipient || <span className="helper">Not set</span>}</td>
                      <td>{counts[row.id] || 0}</td>
                      <td>{viewsByPlaylist[row.id] || 0}</td>
                      <td>{playsByPlaylist[row.id] || 0}</td>
                      <td>{holdsByPlaylist[row.id] || 0}</td>
                      <td>{interestedByPlaylist[row.id] || 0}</td>
                      <td>{latestResponseByPlaylist[row.id] ? new Date(latestResponseByPlaylist[row.id]).toLocaleString() : <span className="helper">None</span>}</td>
                      <td>{row.is_active ? "Active" : "Inactive"}</td>
                      <td>{row.expires_at ? new Date(row.expires_at).toLocaleString() : <span className="helper">None</span>}</td>
                      <td>{origin ? <button className="button compact" onClick={() => navigator.clipboard.writeText(shareLink)}>Copy link</button> : <span className="helper">Loading</span>}</td>
                      <td><div className="rowActions compact"><Link className="button compact" href={`/playlists/${row.id}`}>View/Edit</Link><button className="button compact" onClick={() => del(row.id)}>Delete</button></div></td>
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
