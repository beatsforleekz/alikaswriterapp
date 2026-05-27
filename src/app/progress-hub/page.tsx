"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabase";
import { mapSession, mapSong } from "@/lib/mappers";
import { Session, SongWork } from "@/types";
import { songReadiness } from "@/lib/evidence";

type PlaylistRow = { id: string; created_at?: string | null };
type PlaylistView = { playlist_id: string; created_at: string };
type PlaylistEvent = { playlist_id: string; event_type: string };
type PlaylistResponse = { playlist_id: string; response_type: string; created_at: string };
type AssetRef = { song_id: string; type: string; url?: string | null };
type SplitRef = { song_id: string; percentage?: number | null };
type CutRef = { id: string; release_date?: string | null; dispute_status?: string | null; chart_stream_notes?: string | null };
type GoalCard = {
  id: string;
  title: string;
  category: "creative" | "archive" | "pitch" | "career" | "personal";
  target: number;
  current: number;
  timeframe: "monthly" | "yearly" | "custom";
  note?: string;
  done?: boolean;
};

const GOAL_KEY = "progress_hub_goal_cards_v1";
const ACHV_PREFIX = "ACHV1:";

function progressPct(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

function achievementCountFromNotes(raw: string | null | undefined) {
  const value = String(raw || "").trim();
  if (!value) return 0;
  if (value.startsWith(ACHV_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(ACHV_PREFIX.length)) as { achievements?: Array<Record<string, unknown>> };
      return Array.isArray(parsed.achievements) ? parsed.achievements.length : 0;
    } catch {
      return 0;
    }
  }
  return 1;
}

export default function ProgressHubPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [songs, setSongs] = useState<SongWork[]>([]);
  const [assets, setAssets] = useState<AssetRef[]>([]);
  const [splits, setSplits] = useState<SplitRef[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [playlistViews, setPlaylistViews] = useState<PlaylistView[]>([]);
  const [playlistEvents, setPlaylistEvents] = useState<PlaylistEvent[]>([]);
  const [playlistResponses, setPlaylistResponses] = useState<PlaylistResponse[]>([]);
  const [cuts, setCuts] = useState<CutRef[]>([]);
  const [songTags, setSongTags] = useState<Array<{ song_id: string; tag_name: string }>>([]);
  const [goals, setGoals] = useState<GoalCard[]>([]);
  const [newGoal, setNewGoal] = useState<GoalCard>({ id: "", title: "", category: "creative", target: 10, current: 0, timeframe: "monthly", note: "", done: false });

  useEffect(() => {
    const raw = window.localStorage.getItem(GOAL_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as GoalCard[];
      if (Array.isArray(parsed)) setGoals(parsed);
    } catch {
      // ignore malformed local cache
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(GOAL_KEY, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    const load = async () => {
      const [sRes, soRes, assetRes, splitRes, plRes, viewRes, eventRes, respRes, cutRes, tagRes] = await Promise.all([
        supabase.from("sessions").select("*").order("date", { ascending: false }),
        supabase.from("song_works").select("*").order("created_at", { ascending: false }),
        supabase.from("asset_links").select("song_id,type,url"),
        supabase.from("song_writer_splits").select("song_id,percentage"),
        supabase.from("pitch_playlists").select("id,created_at"),
        supabase.from("pitch_playlist_views").select("playlist_id,created_at"),
        supabase.from("pitch_playlist_events").select("playlist_id,event_type"),
        supabase.from("pitch_playlist_responses").select("playlist_id,response_type,created_at").order("created_at", { ascending: false }),
        supabase.from("cut_records").select("id,release_date,dispute_status,chart_stream_notes"),
        supabase.from("song_work_tags").select("song_id,song_tags(name)"),
      ]);
      setSessions((sRes.data ?? []).map((r) => mapSession(r as Record<string, unknown>)));
      setSongs((soRes.data ?? []).map((r) => mapSong(r as Record<string, unknown>)));
      setAssets((assetRes.data ?? []) as AssetRef[]);
      setSplits((splitRes.data ?? []) as SplitRef[]);
      setPlaylists((plRes.data ?? []) as PlaylistRow[]);
      setPlaylistViews((viewRes.data ?? []) as PlaylistView[]);
      setPlaylistEvents((eventRes.data ?? []) as PlaylistEvent[]);
      setPlaylistResponses((respRes.data ?? []) as PlaylistResponse[]);
      setCuts((cutRes.data ?? []) as CutRef[]);
      setSongTags((tagRes.data ?? []).map((row) => {
        const r = row as { song_id: string; song_tags?: { name?: string } | null };
        return { song_id: String(r.song_id), tag_name: String(r.song_tags?.name ?? "") };
      }));
    };
    load();
  }, []);

  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yyyyMm = now.toISOString().slice(0, 7);

  const metrics = useMemo(() => {
    const sessionsThisYear = sessions.filter((s) => s.date?.startsWith(yyyy)).length;
    const sessionsThisMonth = sessions.filter((s) => s.date?.startsWith(yyyyMm)).length;
    const worksThisYear = songs.filter((s) => {
      const se = sessions.find((x) => x.id === s.sessionId);
      return Boolean(se?.date?.startsWith(yyyy));
    }).length;
    const readiness = songs.map((song) => {
      const relatedAssets = assets.filter((a) => a.song_id === song.id);
      const relatedSplits = splits.filter((sp) => sp.song_id === song.id);
      return songReadiness({ id: song.id, title: song.title, bounce_link: song.bounceLink, lyrics_link: song.lyricsLink }, relatedAssets, relatedSplits, []);
    });
    const pitchReady = readiness.filter((r) => r === "Ready to Pitch").length;
    const archiveComplete = sessions.length ? Math.round((sessions.filter((s) => s.archive_reviewed).length / sessions.length) * 100) : 0;
    const responsesInterested = playlistResponses.filter((r) => String(r.response_type).toLowerCase() === "interested").length;
    const responsesHold = playlistResponses.filter((r) => String(r.response_type).toLowerCase() === "hold").length;
    const playlistPlays = playlistEvents.filter((e) => e.event_type === "play").length;
    const playlistFinishes = playlistEvents.filter((e) => e.event_type === "finish").length;
    const playlistsSent = playlists.length;
    const cutsCount = songs.filter((s) => s.status === "Cut").length;
    const releasesCount = songs.filter((s) => s.status === "Released").length;
    const unresolvedDisputes = songs.filter((s) => s.status === "Disputed").length;
    const resolvedDisputes = cuts.filter((c) => String(c.dispute_status || "").toLowerCase().includes("resolved")).length;
    const cutsLogged = cuts.length;
    const totalAchievements = cuts.reduce((sum, cut) => sum + achievementCountFromNotes(cut.chart_stream_notes), 0);
    const cutsWithAchievements = cuts.filter((cut) => achievementCountFromNotes(cut.chart_stream_notes) > 0).length;
    const achievementsThisYear = cuts
      .filter((cut) => String(cut.release_date || "").startsWith(yyyy))
      .reduce((sum, cut) => sum + achievementCountFromNotes(cut.chart_stream_notes), 0);
    const syncPitches = songs.filter((s) => s.status === "Pitched" && songTags.some((t) => t.song_id === s.id && t.tag_name.toLowerCase().includes("sync"))).length;
    const syncPlacements = songs.filter((s) => s.status === "Released" && songTags.some((t) => t.song_id === s.id && t.tag_name.toLowerCase().includes("sync"))).length;

    return { sessionsThisYear, sessionsThisMonth, worksThisYear, pitchReady, playlistsSent, playlistViews: playlistViews.length, playlistPlays, playlistFinishes, responsesInterested, responsesHold, cutsCount, releasesCount, syncPitches, syncPlacements, archiveComplete, unresolvedDisputes, resolvedDisputes, cutsLogged, totalAchievements, cutsWithAchievements, achievementsThisYear };
  }, [sessions, songs, assets, splits, playlists, playlistViews, playlistEvents, playlistResponses, cuts, songTags, yyyy, yyyyMm]);

  const addGoal = () => {
    const title = newGoal.title.trim();
    if (!title) return;
    setGoals((prev) => [{ ...newGoal, id: crypto.randomUUID(), title, target: Number(newGoal.target) || 0, current: Number(newGoal.current) || 0 }, ...prev]);
    setNewGoal({ id: "", title: "", category: "creative", target: 10, current: 0, timeframe: "monthly", note: "", done: false });
  };

  return (
    <div>
      <PageHeader title="Progress Hub" subtitle="A lightweight goals board for creative momentum, archive progress, and pitching outcomes." />

      <SectionCard title="Quick Momentum">
        <div className="progressGrid">
          <div className="progressTile"><p className="helper">Sessions this month</p><strong>{metrics.sessionsThisMonth}</strong></div>
          <div className="progressTile"><p className="helper">Sessions this year</p><strong>{metrics.sessionsThisYear}</strong></div>
          <div className="progressTile"><p className="helper">Works logged this year</p><strong>{metrics.worksThisYear}</strong></div>
          <div className="progressTile"><p className="helper">Pitch-ready songs</p><strong>{metrics.pitchReady}</strong></div>
          <div className="progressTile"><p className="helper">Cuts logged</p><strong>{metrics.cutsLogged}</strong></div>
          <div className="progressTile"><p className="helper">Achievements logged</p><strong>{metrics.totalAchievements}</strong></div>
        </div>
      </SectionCard>

      <div className="section">
        <SectionCard title="Cuts + Achievements">
          <div className="progressGrid">
            <div className="progressTile"><p className="helper">Cuts with achievements</p><strong>{metrics.cutsWithAchievements}/{metrics.cutsLogged}</strong></div>
            <div className="progressTile"><p className="helper">Achievements this year</p><strong>{metrics.achievementsThisYear}</strong></div>
            <div className="progressTile"><p className="helper">Total achievements</p><strong>{metrics.totalAchievements}</strong></div>
            <div className="progressTile"><p className="helper">Releases</p><strong>{metrics.releasesCount}</strong></div>
          </div>
        </SectionCard>
      </div>

      <div className="section">
        <SectionCard title="Auto Metrics Board">
          <div className="goalBoard">
            {[{label:"Archive completeness", value: `${metrics.archiveComplete}%`, pct: metrics.archiveComplete}, {label:"Playlists sent", value: String(metrics.playlistsSent), pct: Math.min(100, metrics.playlistsSent * 10)}, {label:"Playlist plays", value: String(metrics.playlistPlays), pct: Math.min(100, metrics.playlistPlays * 5)}, {label:"Interested + Hold", value: String(metrics.responsesInterested + metrics.responsesHold), pct: Math.min(100, (metrics.responsesInterested + metrics.responsesHold) * 10)}, {label:"Cuts", value: String(metrics.cutsCount), pct: Math.min(100, metrics.cutsCount * 20)}, {label:"Cut achievements", value: String(metrics.totalAchievements), pct: Math.min(100, metrics.totalAchievements * 10)}, {label:"Releases", value: String(metrics.releasesCount), pct: Math.min(100, metrics.releasesCount * 20)}, {label:"Sync pitches", value: String(metrics.syncPitches), pct: Math.min(100, metrics.syncPitches * 15)}, {label:"Sync placements", value: String(metrics.syncPlacements), pct: Math.min(100, metrics.syncPlacements * 25)}, {label:"Unresolved disputes", value: String(metrics.unresolvedDisputes), pct: metrics.unresolvedDisputes ? 100 : 0}, {label:"Resolved disputes", value: String(metrics.resolvedDisputes), pct: Math.min(100, metrics.resolvedDisputes * 30)}].map((m) => (
              <div key={m.label} className="goalCard">
                <p className="helper">{m.label}</p>
                <strong>{m.value}</strong>
                <div className="progressBar" style={{ marginTop: ".5rem" }}><span style={{ width: `${m.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="section">
        <SectionCard title="Custom Goal Cards" actions={<button className="button primary" onClick={addGoal}>Add Goal Card</button>}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: ".35rem", marginBottom: ".25rem" }}>
            <label className="helper">Goal title</label>
            <label className="helper">Category</label>
            <label className="helper">Timeframe</label>
            <label className="helper">Target</label>
            <label className="helper">Current</label>
            <label className="helper">Motivation note</label>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: ".55rem", marginBottom: ".7rem" }}>
            <input value={newGoal.title} onChange={(e) => setNewGoal((p) => ({ ...p, title: e.target.value }))} placeholder="Goal title" />
            <select value={newGoal.category} onChange={(e) => setNewGoal((p) => ({ ...p, category: e.target.value as GoalCard["category"] }))}><option value="creative">Creative</option><option value="archive">Archive</option><option value="pitch">Pitch</option><option value="career">Career Win</option><option value="personal">Personal</option></select>
            <select value={newGoal.timeframe} onChange={(e) => setNewGoal((p) => ({ ...p, timeframe: e.target.value as GoalCard["timeframe"] }))}><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom</option></select>
            <input type="number" value={newGoal.target} onChange={(e) => setNewGoal((p) => ({ ...p, target: Number(e.target.value) }))} placeholder="Target" />
            <input type="number" value={newGoal.current} onChange={(e) => setNewGoal((p) => ({ ...p, current: Number(e.target.value) }))} placeholder="Current" />
            <input value={newGoal.note || ""} onChange={(e) => setNewGoal((p) => ({ ...p, note: e.target.value }))} placeholder="Motivation note (optional)" />
          </div>

          {goals.length === 0 ? <p className="helper">No custom goals yet. Add one quick win to start momentum.</p> : (
            <div className="goalBoard">
              {goals.map((g) => {
                const pct = progressPct(g.current, g.target);
                return (
                  <div key={g.id} className="goalCard">
                    <div className="rowActions" style={{ justifyContent: "space-between" }}>
                      <strong>{g.title}</strong>
                      <button className="button compact" onClick={() => setGoals((prev) => prev.filter((x) => x.id !== g.id))}>Delete</button>
                    </div>
                    <p className="helper" style={{ marginTop: ".25rem" }}>{g.category} · {g.timeframe}</p>
                    <p style={{ marginTop: ".25rem" }}>{g.current}/{g.target}</p>
                    <div className="progressBar" style={{ marginTop: ".45rem" }}><span style={{ width: `${pct}%` }} /></div>
                    {g.note ? <p className="helper" style={{ marginTop: ".45rem" }}>{g.note}</p> : null}
                    <div className="rowActions compact" style={{ marginTop: ".45rem" }}>
                      <button className="button compact" onClick={() => setGoals((prev) => prev.map((x) => x.id === g.id ? { ...x, current: x.current + 1 } : x))}>+1</button>
                      <button className="button compact" onClick={() => setGoals((prev) => prev.map((x) => x.id === g.id ? { ...x, done: !x.done } : x))}>{g.done ? "Reopen" : "Mark Done"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
