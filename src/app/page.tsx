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
import ReadinessPipeline, { ReadinessItem } from "@/components/review/ReadinessPipeline";
import { songReadiness } from "@/lib/evidence";
type AssetRef = { song_id: string; type: string; url?: string | null };
type SplitRef = { song_id: string; percentage?: number | null };
type ReviewEventRef = { created_at: string; event_type: string; session_id: string };
type PlaylistRef = { id: string; title: string };
type PlaylistTrackRef = { id: string; playlist_id: string; song_work_id: string };
type PlaylistResponseRef = { id: string; playlist_id: string; playlist_track_id?: string | null; response_type: string; sender_name?: string | null; created_at: string };
type CutRef = { id: string };
type CalendarBatchItem = { status: "already_logged" | "possible_duplicate" | "likely_missing" | "created" | "ignored" };
const CALENDAR_HELPER_BATCH_KEY = "calendar_session_helper_batch_v1";

export default function Page() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [songs, setSongs] = useState<SongWork[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [assets, setAssets] = useState<AssetRef[]>([]);
  const [splits, setSplits] = useState<SplitRef[]>([]);
  const [reviewEvents, setReviewEvents] = useState<ReviewEventRef[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRef[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackRef[]>([]);
  const [playlistResponses, setPlaylistResponses] = useState<PlaylistResponseRef[]>([]);
  const [cuts, setCuts] = useState<CutRef[]>([]);
  const [skip, setSkip] = useState(false);
  const [calendarBatchRows, setCalendarBatchRows] = useState<CalendarBatchItem[]>([]);

  useEffect(() => {
    setSkip(new URLSearchParams(window.location.search).get("skip") === "1");
    try {
      const raw = window.localStorage.getItem(CALENDAR_HELPER_BATCH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CalendarBatchItem[];
        if (Array.isArray(parsed)) setCalendarBatchRows(parsed);
      }
    } catch {
      // ignore malformed cache
    }
    const load = async () => {
      const [sRes, soRes, aRes, assetRes, splitRes, reviewRes, plRes, trackRes, responseRes, cutRes] = await Promise.all([
        supabase.from("sessions").select("*").order("date", { ascending: false }),
        supabase.from("song_works").select("*").order("created_at", { ascending: false }),
        supabase.from("action_items").select("*").order("due_date", { ascending: true }),
        supabase.from("asset_links").select("song_id,type,url"),
        supabase.from("song_writer_splits").select("song_id,percentage"),
        supabase.from("session_review_history").select("created_at,event_type,session_id").eq("event_type", "marked_reviewed").order("created_at", { ascending: false }),
        supabase.from("pitch_playlists").select("id,title"),
        supabase.from("pitch_playlist_tracks").select("id,playlist_id,song_work_id"),
        supabase.from("pitch_playlist_responses").select("id,playlist_id,playlist_track_id,response_type,sender_name,created_at").order("created_at", { ascending: false }).limit(40),
        supabase.from("cut_records").select("id"),
      ]);
      setSessions((sRes.data ?? []).map((r) => mapSession(r as Record<string, unknown>)));
      setSongs((soRes.data ?? []).map((r) => mapSong(r as Record<string, unknown>)));
      setActions((aRes.data ?? []).map((r) => mapAction(r as Record<string, unknown>)));
      setAssets((assetRes.data ?? []) as AssetRef[]);
      setSplits((splitRes.data ?? []) as SplitRef[]);
      setReviewEvents((reviewRes.data ?? []) as ReviewEventRef[]);
      setPlaylists((plRes.data ?? []) as PlaylistRef[]);
      setPlaylistTracks((trackRes.data ?? []) as PlaylistTrackRef[]);
      setPlaylistResponses((responseRes.data ?? []) as PlaylistResponseRef[]);
      setCuts((cutRes.data ?? []) as CutRef[]);
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
  const today = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  const yearSessions = sessions.filter((s) => s.date.startsWith(String(currentYear)));
  const currentMonth = new Date().toISOString().slice(0, 7);
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
  const readinessItems: ReadinessItem[] = songs.slice(0, 16).map((song) => {
    const relatedAssets = assets.filter((a) => a.song_id === song.id);
    const relatedSplits = splits.filter((sp) => sp.song_id === song.id);
    const relatedActions = actions.filter((a) => a.songId === song.id || a.sessionId === song.sessionId);
    const status = songReadiness(
      { id: song.id, title: song.title, bounce_link: song.bounceLink, lyrics_link: song.lyricsLink },
      relatedAssets.map((a) => ({ song_id: a.song_id, type: a.type, url: a.url })),
      relatedSplits.map((sp) => ({ song_id: sp.song_id, percentage: sp.percentage })),
      relatedActions.map((a) => ({ status: a.status, song_id: a.songId, session_id: a.sessionId })),
    );
    const parent = sessions.find((s) => s.id === song.sessionId);
    return {
      id: song.id,
      title: song.title || "Untitled Song",
      type: "song",
      status,
      href: `/songs/${song.id}`,
      context: parent ? `${parent.date} - ${parent.title || "Untitled Session"}` : "Unlinked",
    };
  });
  const pitchReadyCount = readinessItems.filter((r) => r.status === "Ready to Pitch").length;
  const pitchReadyBlockers = readinessItems.filter((r) => r.status !== "Ready to Pitch").length;
  const sessionsNotReviewed = sessions.filter((s) => s.archive_reviewed !== true);
  const reviewedThisYear = reviewEvents.filter((e) => String(e.created_at || "").startsWith(String(currentYear))).length;
  const reviewedThisMonth = reviewEvents.filter((e) => String(e.created_at || "").startsWith(currentMonth)).length;
  const reviewedThisWeek = reviewEvents.filter((e) => {
    const d = new Date(e.created_at);
    const now = new Date();
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 7;
  }).length;
  const worksLoggedThisYear = songs.filter((s) => {
    const parent = sessions.find((se) => se.id === s.sessionId);
    return Boolean(parent?.date?.startsWith(String(currentYear)));
  }).length;
  const archiveCompletenessPct = sessions.length ? Math.round((sessions.filter((s) => s.archive_reviewed).length / sessions.length) * 100) : 0;
  const holdInterestedResponses = playlistResponses.filter((r) => {
    const t = String(r.response_type || "").toLowerCase();
    return t.includes("hold") || t.includes("interested");
  });
  const overdueActions = activeActions.filter((a) => a.dueDate && a.dueDate < today);
  const dueSoonActions = activeActions.filter((a) => a.dueDate && a.dueDate >= today && a.dueDate <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const unresolvedSplitSongIds = new Set<string>();
  for (const song of songs) {
    const songSplits = splits.filter((sp) => sp.song_id === song.id);
    if (!songSplits.length) {
      unresolvedSplitSongIds.add(song.id);
      continue;
    }
    const total = songSplits.reduce((sum, sp) => sum + (sp.percentage ?? 0), 0);
    if (Math.round(total * 100) / 100 !== 100) unresolvedSplitSongIds.add(song.id);
  }
  const unresolvedSplitSongs = songs.filter((s) => unresolvedSplitSongIds.has(s.id));
  const pitchedSongs = songs.filter((s) => ["Pitched", "On Hold"].includes(s.status));
  const cutsCount = cuts.length;
  const weakEvidenceSessions = sessions.filter((s) => !s.evidence_strength || s.evidence_strength === "Weak" || s.evidence_strength === "Partial");
  const topBlockerSongs = readinessItems.filter((r) => r.status !== "Ready to Pitch").slice(0, 5);
  const calendarSessionsToLog = calendarBatchRows.filter((row) => row.status === "likely_missing").length;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Archive command centre for your catalogue workflow." />
      <SectionCard title="At a Glance">
        <div className="grid cards">
          <StatCard label="Total Sessions" value={sessions.length} tone="neutral" />
          <StatCard label="Total Songs / Works" value={songs.length} tone="neutral" />
          <StatCard label="Pitch-Ready Songs" value={pitchReadyCount} tone={pitchReadyCount ? "success" : "neutral"} href="/songs" />
          <StatCard label="Archive Completeness %" value={archiveCompletenessPct} tone={archiveCompletenessPct >= 70 ? "success" : archiveCompletenessPct >= 40 ? "amber" : "danger"} href="/archive-progress" />
        </div>
      </SectionCard>
      <div className="section">
      <SectionCard title="What Matters" actions={<Link className="button primary" href={overdueActions.length ? "/actions" : holdInterestedResponses.length ? "/playlists" : "/archive-progress"}>{overdueActions.length ? "Handle Overdue Actions" : holdInterestedResponses.length ? "Review Playlist Responses" : "Open Archive Review"}</Link>}>
        <div className="grid cards">
          <StatCard label="Hold/Interested Responses" value={holdInterestedResponses.length} tone={holdInterestedResponses.length ? "amber" : "success"} href="/playlists" />
          <StatCard label="Disputed Songs" value={disputed} tone={disputed ? "danger" : "success"} href="/songs?filter=disputed" />
          <StatCard label="Songs with Pitch Activity" value={pitchedSongs.length} tone={pitchedSongs.length ? "neutral" : "success"} href="/songs?filter=pitched" />
          <StatCard label="Cuts" value={cutsCount} tone={cutsCount ? "neutral" : "success"} href="/cuts" />
          <StatCard label="Overdue Follow-ups" value={overdueActions.length} tone={overdueActions.length ? "danger" : "success"} href="/actions" />
        </div>
        <div className="rowActions compact" style={{ marginTop: ".65rem", flexWrap: "wrap" }}>
          {topBlockerSongs.length ? topBlockerSongs.map((r) => <Link key={r.id} className="button compact" href={r.href}>{r.title}: {r.status}</Link>) : <span className="helper">No high-priority pitch blockers.</span>}
        </div>
      </SectionCard>
      </div>
      <div className="section">
      <SectionCard title="What’s Missing" actions={<Link className="button" href="/archive-progress">Resolve In Archive Review</Link>}>
        <div className="grid cards">
          <StatCard label="Songs Missing Bounce" value={missingBounce} tone={missingBounce ? "danger" : "success"} href="/songs?filter=no-bounce" />
          <StatCard label="Songs Missing Lyrics" value={missingLyrics} tone={missingLyrics ? "danger" : "success"} href="/songs?filter=no-lyrics" />
          <StatCard label="Unresolved Splits" value={unresolvedSplitSongs.length} tone={unresolvedSplitSongs.length ? "amber" : "success"} href="/songs" />
          <StatCard label="Sessions Missing Songs" value={sessionsWithNoSongs} tone={sessionsWithNoSongs ? "amber" : "success"} href="/sessions" />
          <StatCard label="Sessions Not Reviewed" value={sessionsNotReviewed.length} tone={sessionsNotReviewed.length ? "amber" : "success"} href="/archive-progress" />
          <StatCard label="Pitch-Ready Blockers" value={pitchReadyBlockers} tone={pitchReadyBlockers ? "danger" : "success"} href="/songs" />
          <StatCard label="Weak/Partial Evidence" value={weakEvidenceSessions.length} tone={weakEvidenceSessions.length ? "amber" : "success"} href="/archive-progress" />
        </div>
        <div className="rowActions compact" style={{ marginTop: ".65rem", flexWrap: "wrap" }}>
          {sessionsNotReviewed.slice(0, 4).map((s) => <Link key={s.id} className="button compact" href={`/sessions/${s.id}`}>{s.date} {s.title || "Untitled"}</Link>)}
        </div>
      </SectionCard>
      </div>
      <div className="section">
      <SectionCard title="Momentum" actions={<Link className="button" href="/archive-progress">Continue Review</Link>}>
        <div className="grid cards">
          <StatCard label="Reviewed This Year" value={reviewedThisYear} tone={reviewedThisYear ? "success" : "neutral"} />
          <StatCard label="Reviewed This Month" value={reviewedThisMonth} tone={reviewedThisMonth ? "success" : "neutral"} />
          <StatCard label="Works Logged This Year" value={worksLoggedThisYear} tone={worksLoggedThisYear ? "success" : "neutral"} />
          <StatCard label="Archive Completeness %" value={archiveCompletenessPct} tone={archiveCompletenessPct >= 70 ? "success" : archiveCompletenessPct >= 40 ? "amber" : "danger"} />
          <StatCard label="Pitch-Ready Songs" value={pitchReadyCount} tone={pitchReadyCount ? "success" : "neutral"} href="/songs" />
          <StatCard label="Recent Playlist Responses" value={responseCount} tone={responseCount ? "neutral" : "success"} href="/playlists" />
        </div>
        <p className="helper" style={{ marginTop: ".6rem" }}>Last review completed: {latestAudited || "Not set"} · Reviewed this week: {reviewedThisWeek} · Remaining this year: {Math.max(yearSessions.length - reviewedThisYear, 0)}</p>
      </SectionCard>
      </div>
      <div className="section">
      <SectionCard title="Follow-up" actions={<Link className="button primary" href="/actions">Open Actions</Link>}>
        {activeActions.length === 0 ? <EmptyState title="No active follow-ups" hint="You are clear right now." /> : (
          <div className="grid cards">
            <StatCard label="Overdue" value={overdueActions.length} tone={overdueActions.length ? "danger" : "success"} href="/actions" />
            <StatCard label="Due In 7 Days" value={dueSoonActions.length} tone={dueSoonActions.length ? "amber" : "success"} href="/actions" />
            <StatCard label="Open Actions" value={activeActions.length} tone={activeActions.length ? "amber" : "success"} href="/actions" />
            <StatCard label="Hold/Interested To Reply" value={holdInterestedResponses.length} tone={holdInterestedResponses.length ? "amber" : "success"} href="/playlists" />
          </div>
        )}
        <div className="rowActions compact" style={{ marginTop: ".65rem", flexWrap: "wrap" }}>
          {upcoming.slice(0, 6).map((a) => <Link key={a.id} className="button compact" href="/actions">{a.dueDate || "No date"} · {a.task || "Untitled task"}</Link>)}
        </div>
      </SectionCard>
      </div>

      <div className="section">
      <SectionCard title="Pitch Readiness Command Centre">
        <ReadinessPipeline items={readinessItems} />
      </SectionCard>
      </div>

    </div>
  );
}
