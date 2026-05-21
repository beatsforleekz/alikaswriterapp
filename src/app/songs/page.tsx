"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SongWork } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import FilterBar from "@/components/ui/FilterBar";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { supabase } from "@/lib/supabase";
import { mapSong } from "@/lib/mappers";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

type SessionRef = { id: string; title: string; date: string };
type AssetRef = { song_id: string; type: string; url?: string | null };

function match(song: SongWork, f: string, assets: AssetRef[]) {
  const songAssets = assets.filter((a) => a.song_id === song.id);
  const hasBounce = Boolean(song.bounceLink) || songAssets.some((a) => a.type.toLowerCase() === "bounce");
  const hasLyrics = Boolean(song.lyricsLink) || songAssets.some((a) => a.type.toLowerCase() === "lyrics");
  switch (f) {
    case "no-bounce": return !hasBounce;
    case "no-lyrics": return !hasLyrics;
    case "pitched": return song.status === "Pitched";
    case "on-hold": return song.status === "On Hold";
    case "cut": return song.status === "Cut";
    case "released": return song.status === "Released";
    case "disputed": return song.status === "Disputed";
    case "complete": return song.status === "Complete";
    default: return true;
  }
}

export default function SongsPage() {
  const [rows, setRows] = useState<SongWork[]>([]);
  const [sessions, setSessions] = useState<SessionRef[]>([]);
  const [assets, setAssets] = useState<AssetRef[]>([]);
  const [filter, setFilter] = useState("all");
  const [errorMsg, setErrorMsg] = useState("");

  const load = async () => {
    const [songRes, sessionRes, assetRes] = await Promise.all([
      supabase.from("song_works").select("*").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id,title,date"),
      supabase.from("asset_links").select("song_id,type,url"),
    ]);
    if (songRes.error || sessionRes.error || assetRes.error) {
      const e = songRes.error || sessionRes.error || assetRes.error;
      logSupabaseError("Failed to load songs library", e);
      setErrorMsg(supabaseUserMessage("Could not load songs/works", e));
      return;
    }
    setRows((songRes.data ?? []).map((r) => mapSong(r as Record<string, unknown>)));
    setSessions((sessionRes.data ?? []) as SessionRef[]);
    setAssets((assetRes.data ?? []) as AssetRef[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => match(r, filter, assets)), [rows, filter, assets]);

  return (
    <div>
      <PageHeader title="Songs / Works" subtitle="Songs are managed from Session workspaces. This page reflects linked catalogue data." actions={<Link className="button" href="/sessions">Go to Sessions Workspace</Link>} />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}

      <FilterBar>
        <label>Filter</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="all">All</option>
          <option value="no-bounce">No Bounce</option>
          <option value="no-lyrics">No Lyrics</option>
          <option value="pitched">Pitched</option>
          <option value="on-hold">On Hold</option>
          <option value="cut">Cut</option>
          <option value="released">Released</option>
          <option value="disputed">Disputed</option>
          <option value="complete">Complete</option>
        </select>
      </FilterBar>

      <SectionCard>
        {filtered.length === 0 ? (
          <EmptyState title="No songs/works yet" hint="Open a session to add songs and enrich catalogue records." action={<Link className="button primary" href="/sessions">Open Sessions</Link>} />
        ) : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Title</th><th>Status</th><th>Bounce</th><th>Lyrics</th><th>Session</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((s) => {
                  const songAssets = assets.filter((a) => a.song_id === s.id);
                  const hasBounce = Boolean(s.bounceLink) || songAssets.some((a) => a.type.toLowerCase() === "bounce");
                  const hasLyrics = Boolean(s.lyricsLink) || songAssets.some((a) => a.type.toLowerCase() === "lyrics");
                  const parent = sessions.find((x) => x.id === s.sessionId);
                  return (
                    <tr key={s.id}>
                      <td><Link href={`/songs/${s.id}`}>{s.title || "Untitled Song"}</Link></td>
                      <td><StatusBadge label={s.status} /></td>
                      <td>{hasBounce ? "Yes" : <span className="helper">Missing</span>}</td>
                      <td>{hasLyrics ? "Yes" : <span className="helper">Missing</span>}</td>
                      <td>{parent ? `${parent.date} - ${parent.title || "Untitled Session"}` : <span className="helper">Unlinked</span>}</td>
                      <td><div className="rowActions compact">{parent ? <Link className="button compact" href={`/sessions/${parent.id}`}>Open Session Workspace</Link> : <span className="helper">No session workspace</span>}</div></td>
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
