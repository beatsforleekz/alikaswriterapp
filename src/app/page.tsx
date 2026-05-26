"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { supabase } from "@/lib/supabase";
import { mapAction, mapSession, mapSong } from "@/lib/mappers";
import { ActionItem, Session, SongWork } from "@/types";
type AssetRef = { song_id: string; type: string; url?: string | null };
type ReviewEventRef = { created_at: string; event_type: string; session_id: string };
type PlaylistRef = { id: string; title: string };
type PlaylistTrackRef = { id: string; playlist_id: string; song_work_id: string };
type PlaylistResponseRef = { id: string; playlist_id: string; playlist_track_id?: string | null; response_type: string; sender_name?: string | null; created_at: string };

export default function Page() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [songs, setSongs] = useState<SongWork[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [assets, setAssets] = useState<AssetRef[]>([]);
  const [reviewEvents, setReviewEvents] = useState<ReviewEventRef[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRef[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackRef[]>([]);
  const [playlistResponses, setPlaylistResponses] = useState<PlaylistResponseRef[]>([]);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    setSkip(new URLSearchParams(window.location.search).get("skip") === "1");
    const load = async () => {
      const [sRes, soRes, aRes, assetRes, reviewRes, plRes, trackRes, responseRes] = await Promise.all([
        supabase.from("sessions").select("*").order("date", { ascending: false }),
        supabase.from("song_works").select("*").order("created_at", { ascending: false }),
        supabase.from("action_items").select("*").order("due_date", { ascending: true }),
        supabase.from("asset_links").select("song_id,type,url"),
        supabase.from("session_review_history").select("created_at,event_type,session_id").eq("event_type", "marked_reviewed").order("created_at", { ascending: false }),
        supabase.from("pitch_playlists").select("id,title"),
        supabase.from("pitch_playlist_tracks").select("id,playlist_id,song_work_id"),
        supabase.from("pitch_playlist_responses").select("id,playlist_id,playlist_track_id,response_type,sender_name,created_at").order("created_at", { ascending: false }).limit(40),
      ]);
      setSessions((sRes.data ?? []).map((r) => mapSession(r as Record<string, unknown>)));
      setSongs((soRes.data ?? []).map((r) => mapSong(r as Record<string, unknown>)));
      setActions((aRes.data ?? []).map((r) => mapAction(r as Record<string, unknown>)));
      setAssets((assetRes.data ?? []) as AssetRef[]);
      setReviewEvents((reviewRes.data ?? []) as ReviewEventRef[]);
      setPlaylists((plRes.data ?? []) as PlaylistRef[]);
      setPlaylistTracks((trackRes.data ?? []) as PlaylistTrackRef[]);
      setPlaylistResponses((responseRes.data ?? []) as PlaylistResponseRef[]);
    };
    load();
  }, []);

  const hasCoreData = sessions.length > 0 || songs.length > 0;
  const showOnboarding = !hasCoreData && !skip;

  if (showOnboarding) {
    return (
      <div>
        <PageHeader title="Start with your session diary" subtitle="Connect your Google Calendar or add sessions manually so every writing session has a record." />
        <SectionCard>
          <div className="rowActions">
            <button className="button" disabled>Connect Google Calendar (Coming soon)</button>
            <Link className="button" href="/sessions?import=1">Import Calendar</Link>
            <Link className="button primary" href="/sessions/new">Add Session Manually</Link>
            <Link className="button" href="/?skip=1">Skip for now</Link>
          </div>
          <p className="helper" style={{ marginTop: ".7rem" }}>This will later import session dates, attendees, locations and calendar notes.</p>
          <p className="helper">You can connect calendar later from Settings.</p>
        </SectionCard>
      </div>
    );
  }

  const hasBounceForSong = (songId: string, bounceLink?: string) =>
    Boolean(bounceLink) || assets.some((a) => a.song_id === songId && String(a.type || "").toLowerCase() === "bounce" && Boolean(a.url));
  const hasLyricsForSong = (songId: string, lyricsLink?: string) =>
    Boolean(lyricsLink) || assets.some((a) => a.song_id === songId && String(a.type || "").toLowerCase() === "lyrics" && Boolean(a.url));

  const missingBounce = songs.filter((s) => !hasBounceForSong(s.id, s.bounceLink)).length;
  const missingLyrics = songs.filter((s) => !hasLyricsForSong(s.id, s.lyricsLink)).length;
  const cutReleased = songs.filter((s) => s.status === "Cut" || s.status === "Released").length;
  const disputed = songs.filter((s) => s.status === "Disputed").length;
  const sessionsWithNoSongs = sessions.filter((se) => songs.every((song) => song.sessionId !== se.id)).length;
  const sessionsWithNoBounce = sessions.filter((se) => {
    const sessionSongs = songs.filter((song) => song.sessionId === se.id);
    if (sessionSongs.length === 0) return true;
    return sessionSongs.every((song) => !hasBounceForSong(song.id, song.bounceLink));
  }).length;
  const activeActions = actions.filter((a) => a.status !== "Done");
  const upcoming = [...activeActions].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const currentYear = new Date().getFullYear();
  const yearSessions = sessions.filter((s) => s.date.startsWith(String(currentYear)));
  const latestReviewEvent = reviewEvents[0];
  const latestAudited = latestReviewEvent
    ? new Date(latestReviewEvent.created_at).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const sessionsNeedingEvidence = yearSessions.filter((s) => !s.evidence_strength || s.evidence_strength === "Weak" || s.evidence_strength === "Partial").length;
  const totalReviewedAll = sessions.filter((s) => s.archive_reviewed === true).length;
  const totalRemainingAll = sessions.length - totalReviewedAll;
  const weakPartialSessions = sessions.filter((s) => !s.evidence_strength || s.evidence_strength === "Weak" || s.evidence_strength === "Partial");
  const missingBounceSongs = songs.filter((s) => !hasBounceForSong(s.id, s.bounceLink));
  const missingLyricsSongs = songs.filter((s) => !hasLyricsForSong(s.id, s.lyricsLink));
  const disputedSongs = songs.filter((s) => s.status === "Disputed");
  const responseCount = playlistResponses.length;
  const playlistTitleById = new Map(playlists.map((p) => [p.id, p.title]));
  const trackById = new Map(playlistTracks.map((t) => [t.id, t]));
  const songById = new Map(songs.map((s) => [s.id, s]));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Archive command centre for your catalogue workflow." />
      <div className="grid cards">
        <StatCard label="Total Sessions" value={sessions.length} tone="neutral" />
        <StatCard label="Total Songs / Works" value={songs.length} tone="neutral" />
        <StatCard label="Sessions with 0 Songs" value={sessionsWithNoSongs} tone={sessionsWithNoSongs > 0 ? "amber" : "success"} href="#warn-no-songs" />
        <StatCard label="Sessions with 0 Bounce" value={sessionsWithNoBounce} tone={sessionsWithNoBounce > 0 ? "amber" : "success"} href="#warn-session-no-bounce" />
        <StatCard label="Songs Missing Bounce" value={missingBounce} tone={missingBounce > 0 ? "danger" : "success"} href="#warn-missing-bounce" />
        <StatCard label="Songs Missing Lyrics" value={missingLyrics} tone={missingLyrics > 0 ? "danger" : "success"} href="#warn-missing-lyrics" />
        <StatCard label="Cut / Released" value={cutReleased} tone={cutReleased > 0 ? "success" : "neutral"} />
        <StatCard label="Disputed" value={disputed} tone={disputed > 0 ? "danger" : "success"} href="#warn-disputed" />
      </div>
      <div className="section">
      <SectionCard title="Archive Review Snapshot" actions={<Link className="button primary" href="/archive-progress">Open Archive Review</Link>}>
        <div className="grid cards">
          <StatCard label="Current Active Year" value={currentYear} />
          <StatCard label="Latest Audited Date" value={latestAudited || <span className="helper">Not set</span>} />
          <StatCard label="Sessions Needing Evidence" value={sessionsNeedingEvidence} />
          <StatCard label="Total Sessions In Library" value={sessions.length} />
          <StatCard label="Reviewed (All Time)" value={totalReviewedAll} />
          <StatCard label="Remaining (All Time)" value={totalRemainingAll} />
        </div>
      </SectionCard>
      </div>
      <div className="section">
      <SectionCard title="Quick Links"><div className="rowActions"><Link className="button" href="/songs?filter=no-bounce">No Bounce</Link><Link className="button" href="/songs?filter=no-lyrics">No Lyrics</Link><Link className="button" href="/songs?filter=disputed">Disputed</Link><Link className="button" href="/exports">Exports</Link></div></SectionCard>
      </div>
      <div className="section">
      <SectionCard title="Upcoming Follow-ups">
        {upcoming.length === 0 ? <EmptyState title="No follow-ups yet" hint="Add action items to track next steps." /> : (
          <div className="tableWrap"><table><thead><tr><th>Due Date</th><th>Priority</th><th>Task</th><th>Status</th><th>Actions</th></tr></thead><tbody>{upcoming.map((a)=><tr key={a.id}><td>{a.dueDate}</td><td>{a.priority}</td><td>{a.task}</td><td>{a.status}</td><td><Link className="button compact" href="/actions">Open</Link></td></tr>)}</tbody></table></div>
        )}
      </SectionCard>
      </div>

      <div className="section">
      <SectionCard title="Actionable Warnings">
        <details id="warn-no-songs">
          <summary><span style={{ color: "#8a5f2b", fontWeight: 600 }}>Sessions with 0 Songs ({sessionsWithNoSongs})</span></summary>
          <div className="tableWrap"><table><thead><tr><th>Date</th><th>Session</th><th>Open</th></tr></thead><tbody>{sessionsWithNoSongs === 0 ? <tr><td colSpan={3} className="helper">None</td></tr> : sessions.filter((se) => songs.every((song) => song.sessionId !== se.id)).map((se) => <tr key={se.id}><td>{se.date}</td><td>{se.title || "Untitled Session"}</td><td><Link className="button compact" href={`/sessions/${se.id}`}>Workspace</Link></td></tr>)}</tbody></table></div>
        </details>
        <details id="warn-session-no-bounce" style={{ marginTop: ".6rem" }}>
          <summary><span style={{ color: "#8a5f2b", fontWeight: 600 }}>Sessions with 0 Bounce ({sessionsWithNoBounce})</span></summary>
          <div className="tableWrap"><table><thead><tr><th>Date</th><th>Session</th><th>Open</th></tr></thead><tbody>{sessionsWithNoBounce === 0 ? <tr><td colSpan={3} className="helper">None</td></tr> : sessions.filter((se) => { const sessionSongs = songs.filter((song) => song.sessionId === se.id); if (sessionSongs.length === 0) return true; return sessionSongs.every((song) => !hasBounceForSong(song.id, song.bounceLink)); }).map((se) => <tr key={se.id}><td>{se.date}</td><td>{se.title || "Untitled Session"}</td><td><Link className="button compact" href={`/sessions/${se.id}`}>Workspace</Link></td></tr>)}</tbody></table></div>
        </details>
        <details id="warn-missing-bounce" style={{ marginTop: ".6rem" }}>
          <summary><span style={{ color: "#8a3d3d", fontWeight: 600 }}>Missing Bounce ({missingBounceSongs.length})</span></summary>
          <div className="tableWrap"><table><thead><tr><th>Song</th><th>Session</th><th>Status</th><th>Open</th></tr></thead><tbody>{missingBounceSongs.length === 0 ? <tr><td colSpan={4} className="helper">None</td></tr> : missingBounceSongs.map((s) => { const se = sessions.find((x) => x.id === s.sessionId); return <tr key={s.id}><td>{s.title || "Untitled Song"}</td><td>{se ? `${se.date} - ${se.title || "Untitled Session"}` : "Unlinked"}</td><td>{s.status}</td><td><Link className="button compact" href={`/songs/${s.id}`}>Song</Link></td></tr>; })}</tbody></table></div>
        </details>
        <details id="warn-missing-lyrics" style={{ marginTop: ".6rem" }}>
          <summary><span style={{ color: "#8a5f2b", fontWeight: 600 }}>Missing Lyrics ({missingLyricsSongs.length})</span></summary>
          <div className="tableWrap"><table><thead><tr><th>Song</th><th>Session</th><th>Status</th><th>Open</th></tr></thead><tbody>{missingLyricsSongs.length === 0 ? <tr><td colSpan={4} className="helper">None</td></tr> : missingLyricsSongs.map((s) => { const se = sessions.find((x) => x.id === s.sessionId); return <tr key={s.id}><td>{s.title || "Untitled Song"}</td><td>{se ? `${se.date} - ${se.title || "Untitled Session"}` : "Unlinked"}</td><td>{s.status}</td><td><Link className="button compact" href={`/songs/${s.id}`}>Song</Link></td></tr>; })}</tbody></table></div>
        </details>
        <details id="warn-weak-partial" style={{ marginTop: ".6rem" }}>
          <summary><span style={{ color: "#8a5f2b", fontWeight: 600 }}>Weak/Partial Evidence Sessions ({weakPartialSessions.length})</span></summary>
          <div className="tableWrap"><table><thead><tr><th>Date</th><th>Session</th><th>Evidence</th><th>Open</th></tr></thead><tbody>{weakPartialSessions.length === 0 ? <tr><td colSpan={4} className="helper">None</td></tr> : weakPartialSessions.map((s) => <tr key={s.id}><td>{s.date}</td><td>{s.title || "Untitled Session"}</td><td>{s.evidence_strength || "Not set"}</td><td><Link className="button compact" href={`/sessions/${s.id}`}>Workspace</Link></td></tr>)}</tbody></table></div>
        </details>
        <details id="warn-disputed" style={{ marginTop: ".6rem" }}>
          <summary><span style={{ color: "#8a3d3d", fontWeight: 600 }}>Disputed Songs ({disputedSongs.length})</span></summary>
          <div className="tableWrap"><table><thead><tr><th>Song</th><th>Session</th><th>Open</th></tr></thead><tbody>{disputedSongs.length === 0 ? <tr><td colSpan={3} className="helper">None</td></tr> : disputedSongs.map((s) => { const se = sessions.find((x) => x.id === s.sessionId); return <tr key={s.id}><td>{s.title || "Untitled Song"}</td><td>{se ? `${se.date} - ${se.title || "Untitled Session"}` : "Unlinked"}</td><td><Link className="button compact" href={`/songs/${s.id}`}>Song</Link></td></tr>; })}</tbody></table></div>
        </details>
        <details id="warn-playlist-responses" style={{ marginTop: ".6rem" }}>
          <summary><span style={{ color: "#5f6b74", fontWeight: 600 }}>Playlist Responses ({responseCount})</span></summary>
          <div className="tableWrap"><table><thead><tr><th>When</th><th>Playlist</th><th>Song</th><th>Response</th><th>Sender</th><th>Open</th></tr></thead><tbody>{playlistResponses.length === 0 ? <tr><td colSpan={6} className="helper">No responses yet.</td></tr> : playlistResponses.map((r) => { const tr = r.playlist_track_id ? trackById.get(r.playlist_track_id) : undefined; const song = tr ? songById.get(tr.song_work_id) : undefined; return <tr key={r.id}><td>{new Date(r.created_at).toLocaleDateString()}</td><td>{playlistTitleById.get(r.playlist_id) || "Playlist"}</td><td>{song?.title || "Unknown song"}</td><td>{r.response_type}</td><td>{r.sender_name || <span className="helper">Unknown</span>}</td><td>{r.playlist_id ? <Link className="button compact" href={`/playlists/${r.playlist_id}`}>Playlist</Link> : <span className="helper">-</span>}</td></tr>; })}</tbody></table></div>
        </details>
      </SectionCard>
      </div>

      <div className="section">
      <SectionCard title="Recommended Next Features">
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>Add batch evidence tools (bulk add bounce/lyrics across selected songs).</li>
          <li>Add dashboard saved views by period (Current month, Quarter, Year).</li>
          <li>Add action reminders (due-soon digest with one-click Done).</li>
          <li>Add playlist response follow-up templates to create actions automatically.</li>
        </ul>
      </SectionCard>
      </div>
    </div>
  );
}
