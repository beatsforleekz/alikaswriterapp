"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

type CutWorkspaceRow = {
  id: string;
  song_id: string;
  artist?: string | null;
  release_title?: string | null;
  release_date?: string | null;
  label?: string | null;
  distributor?: string | null;
  isrc?: string | null;
  chart_stream_notes?: string | null;
  registration_status?: string | null;
  royalty_admin_notes?: string | null;
  dispute_status?: string | null;
};

type AchievementItem = {
  id: string;
  type: string;
  title?: string;
  notes?: string;
  evidenceLink?: string;
  date?: string;
};

const ACHV_PREFIX = "ACHV1:";
const ARTWORK_PREFIX = "Artwork URL:";
const LEGACY_ARTWORK_PREFIX = "Artwork:";

const ACHIEVEMENT_TYPES = [
  "Chart Placement",
  "Editorial Playlist",
  "Radio Support",
  "Stream Milestone",
  "Sync Placement",
  "Certification",
  "Celebrity/DJ Support",
  "Press/Magazine Feature",
  "Social Milestone",
  "Other Achievement",
] as const;

function parseAchievements(raw: string | null | undefined): { achievements: AchievementItem[]; legacyText: string } {
  const input = String(raw || "").trim();
  if (!input) return { achievements: [], legacyText: "" };
  if (input.startsWith(ACHV_PREFIX)) {
    try {
      const payload = JSON.parse(input.slice(ACHV_PREFIX.length)) as { achievements?: AchievementItem[]; legacyText?: string };
      return {
        achievements: Array.isArray(payload.achievements)
          ? payload.achievements.map((a, idx) => ({
            id: a.id || `achv-${idx + 1}`,
            type: a.type || "Other Achievement",
            title: a.title || "",
            notes: a.notes || "",
            evidenceLink: a.evidenceLink || "",
            date: a.date || "",
          }))
          : [],
        legacyText: payload.legacyText || "",
      };
    } catch {
      return { achievements: [], legacyText: input };
    }
  }
  return { achievements: [], legacyText: input };
}

function serializeAchievements(achievements: AchievementItem[], legacyText: string): string | null {
  const clean = achievements
    .map((a) => ({
      id: a.id,
      type: a.type,
      title: (a.title || "").trim(),
      notes: (a.notes || "").trim(),
      evidenceLink: (a.evidenceLink || "").trim(),
      date: a.date || "",
    }))
    .filter((a) => a.type || a.title || a.notes || a.evidenceLink || a.date);
  const legacy = legacyText.trim();
  if (!clean.length && !legacy) return null;
  return `${ACHV_PREFIX}${JSON.stringify({ achievements: clean, legacyText: legacy })}`;
}

function extractArtworkUrl(notes: string | null | undefined): string {
  const rows = String(notes || "").split("\n");
  const line = rows.find((r) => {
    const lower = r.trim().toLowerCase();
    return lower.startsWith(ARTWORK_PREFIX.toLowerCase()) || lower.startsWith(LEGACY_ARTWORK_PREFIX.toLowerCase());
  });
  if (!line) return "";
  return line.slice(line.indexOf(":") + 1).trim();
}

function withoutArtworkUrl(notes: string | null | undefined): string {
  return String(notes || "")
    .split("\n")
    .filter((line) => {
      const lower = line.trim().toLowerCase();
      return !lower.startsWith(ARTWORK_PREFIX.toLowerCase()) && !lower.startsWith(LEGACY_ARTWORK_PREFIX.toLowerCase());
    })
    .join("\n")
    .trim();
}

export default function CutDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [cut, setCut] = useState<CutWorkspaceRow | null>(null);
  const [songTitle, setSongTitle] = useState("");
  const [songOptions, setSongOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [artworkLoading, setArtworkLoading] = useState(false);
  const [legacyAchievementNotes, setLegacyAchievementNotes] = useState("");
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);

  const [draftType, setDraftType] = useState<string>(ACHIEVEMENT_TYPES[0]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftEvidenceLink, setDraftEvidenceLink] = useState("");
  const [draftDate, setDraftDate] = useState("");

  const linkedSong = useMemo(() => songOptions.find((s) => s.id === (cut?.song_id || "")), [songOptions, cut?.song_id]);

  const load = async () => {
    setErrorMsg("");
    const [{ data: cutData, error: cutErr }, { data: songsData, error: songsErr }] = await Promise.all([
      supabase.from("cut_records").select("*").eq("id", params.id).single(),
      supabase.from("song_works").select("id,title").order("title", { ascending: true }),
    ]);
    if (cutErr || !cutData || songsErr) {
      logSupabaseError("Failed to load cut workspace", cutErr || songsErr);
      setErrorMsg(supabaseUserMessage("Could not load cut workspace", cutErr || songsErr));
      return;
    }
    const row = cutData as CutWorkspaceRow;
    const parsed = parseAchievements(row.chart_stream_notes);
    const extractedArtwork = extractArtworkUrl(row.royalty_admin_notes);
    setAchievements(parsed.achievements);
    setLegacyAchievementNotes(parsed.legacyText);
    setArtworkUrl(extractedArtwork);
    setCut({
      id: String(row.id),
      song_id: String(row.song_id || ""),
      artist: row.artist ?? "",
      release_title: row.release_title ?? "",
      release_date: row.release_date ?? "",
      label: row.label ?? "",
      distributor: row.distributor ?? "",
      isrc: row.isrc ?? "",
      chart_stream_notes: row.chart_stream_notes ?? "",
      registration_status: row.registration_status ?? "",
      royalty_admin_notes: withoutArtworkUrl(row.royalty_admin_notes ?? ""),
      dispute_status: row.dispute_status ?? "",
    });
    const options = ((songsData ?? []) as Array<{ id: string; title?: string | null }>).map((s) => ({
      id: String(s.id),
      title: String(s.title ?? "Untitled Song"),
    }));
    setSongOptions(options);
    const titleMap = Object.fromEntries(options.map((s) => [s.id, s.title]));
    setSongTitle(titleMap[String(row.song_id || "")] || "No linked work");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    const fetchSpotifyArtwork = async () => {
      if (artworkUrl || !cut?.distributor || !cut.distributor.includes("open.spotify.com/track/")) return;
      setArtworkLoading(true);
      try {
        const res = await fetch(`/api/spotify/track?url=${encodeURIComponent(cut.distributor)}`);
        const json = (await res.json()) as { item?: { artwork?: string } };
        if (res.ok && json.item?.artwork) {
          setArtworkUrl(json.item.artwork);
        }
      } finally {
        setArtworkLoading(false);
      }
    };
    fetchSpotifyArtwork();
  }, [artworkUrl, cut?.distributor]);

  const update = (key: keyof CutWorkspaceRow, value: string) => {
    setCut((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const addAchievement = () => {
    const hasContent = draftType.trim() || draftTitle.trim() || draftNotes.trim() || draftEvidenceLink.trim() || draftDate;
    if (!hasContent) return;
    const next: AchievementItem = {
      id: crypto.randomUUID(),
      type: draftType,
      title: draftTitle.trim(),
      notes: draftNotes.trim(),
      evidenceLink: draftEvidenceLink.trim(),
      date: draftDate,
    };
    setAchievements((prev) => [next, ...prev]);
    setDraftType(ACHIEVEMENT_TYPES[0]);
    setDraftTitle("");
    setDraftNotes("");
    setDraftEvidenceLink("");
    setDraftDate("");
  };

  const removeAchievement = (id: string) => {
    setAchievements((prev) => prev.filter((item) => item.id !== id));
  };

  const save = async () => {
    if (!cut) return;
    setSaveState("saving");
    const serializedAchievements = serializeAchievements(achievements, legacyAchievementNotes);
    const mergedRoyaltyNotes = [artworkUrl.trim() ? `${ARTWORK_PREFIX} ${artworkUrl.trim()}` : "", cut.royalty_admin_notes?.trim() || ""].filter(Boolean).join("\n");
    const payload = {
      song_id: cut.song_id || null,
      artist: cut.artist?.trim() || null,
      release_title: cut.release_title?.trim() || null,
      release_date: cut.release_date || null,
      label: cut.label?.trim() || null,
      distributor: cut.distributor?.trim() || null,
      isrc: cut.isrc?.trim() || null,
      chart_stream_notes: serializedAchievements,
      registration_status: cut.registration_status?.trim() || null,
      royalty_admin_notes: mergedRoyaltyNotes || null,
      dispute_status: cut.dispute_status?.trim() || null,
    };
    const { error } = await supabase.from("cut_records").update(payload).eq("id", cut.id);
    if (error) {
      logSupabaseError("Failed to save cut workspace", error);
      setErrorMsg(supabaseUserMessage("Could not save cut record", error));
      setSaveState("error");
      return;
    }
    const selected = songOptions.find((s) => s.id === cut.song_id);
    setSongTitle(selected?.title || "No linked work");
    setSaveState("saved");
    setLastSavedAt(new Date().toLocaleString());
    window.setTimeout(() => setSaveState("idle"), 1200);
  };

  const del = async () => {
    if (!cut || !window.confirm("Delete this cut record?")) return;
    const { error } = await supabase.from("cut_records").delete().eq("id", cut.id);
    if (error) {
      logSupabaseError("Failed to delete cut from workspace", error);
      setErrorMsg(supabaseUserMessage("Could not delete cut record", error));
      return;
    }
    router.push("/cuts");
  };

  if (!cut) return <div className="helper">Cut not found.</div>;

  return (
    <div>
      <PageHeader
        title={cut.release_title?.trim() || "Cut Workspace"}
        subtitle={linkedSong ? `Linked work: ${linkedSong.title}` : "No linked work yet"}
        actions={
          <div className="rowActions compact">
            <Link className="button compact" href="/cuts">Back to Cuts</Link>
            <button className="button primary compact" onClick={save}>Save</button>
            <button className="button compact" onClick={del}>Delete</button>
          </div>
        }
      />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}
      <p className="helper" style={{ marginBottom: ".7rem" }}>
        {saveState === "saving" ? "Saving..." : saveState === "saved" ? `Saved ${lastSavedAt}` : saveState === "error" ? "Could not save changes" : (lastSavedAt ? `Last saved ${lastSavedAt}` : "")}
      </p>

      <SectionCard title="Release Snapshot">
        <div className="cutHero">
          <div className="cutArtworkWrap">
            {artworkUrl ? <img src={artworkUrl} alt="Release artwork" className="cutArtwork" /> : <div className="cutArtworkPlaceholder">No Artwork</div>}
            <p className="helper">{artworkLoading ? "Fetching artwork from Spotify..." : (artworkUrl ? "Artwork pulled from Spotify metadata." : "No Spotify artwork found yet.")}</p>
          </div>
          <div className="cutHeroMeta">
            <div className="grid" style={{ gap: ".55rem", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              <div><label className="helper">Title</label><input value={cut.release_title || ""} onChange={(e) => update("release_title", e.target.value)} /></div>
              <div><label className="helper">Artist</label><input value={cut.artist || ""} onChange={(e) => update("artist", e.target.value)} /></div>
              <div><label className="helper">Release date</label><input type="date" value={cut.release_date || ""} onChange={(e) => update("release_date", e.target.value)} /></div>
              <div><label className="helper">Listen link</label><input value={cut.distributor || ""} onChange={(e) => update("distributor", e.target.value)} placeholder="https://..." /></div>
            </div>
            {cut.distributor ? <a className="button compact" href={cut.distributor} target="_blank" rel="noreferrer" style={{ marginTop: ".55rem", width: "fit-content" }}>Open Release Link</a> : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Work Linking">
        {!cut.song_id ? (
          <div className="emptyState" style={{ textAlign: "left" }}>
            <p style={{ marginBottom: ".45rem" }}>No linked work yet. Add or link a session/work if this cut relates to your catalogue.</p>
            <div className="rowActions compact" style={{ marginBottom: ".55rem" }}>
              <button className="button compact" onClick={() => { const first = songOptions[0]?.id || ""; if (first) update("song_id", first); }}>Link existing work</button>
              <Link className="button compact" href="/sessions/new">Add session</Link>
              <span className="statusBadge">Continue without linking</span>
            </div>
          </div>
        ) : null}
        <div className="kv" style={{ marginTop: !cut.song_id ? ".7rem" : 0 }}>
          <dt>Linked Song / Work</dt>
          <dd>
            <select value={cut.song_id} onChange={(e) => update("song_id", e.target.value)}>
              <option value="">No linked work</option>
              {songOptions.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
            </select>
          </dd>
          <dt>Link Status</dt>
          <dd>{cut.song_id ? <span className="statusBadge sage">Linked</span> : <span className="statusBadge amber">Unlinked</span>}</dd>
        </div>
      </SectionCard>

      <SectionCard title="Achievements">
        <p className="helper" style={{ marginBottom: ".6rem" }}>Track visible wins here. Keep admin/registration notes separate below.</p>
        <div className="cutAchievementComposer">
          <select value={draftType} onChange={(e) => setDraftType(e.target.value)}>
            {ACHIEVEMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Headline (optional)" />
          <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
          <input value={draftEvidenceLink} onChange={(e) => setDraftEvidenceLink(e.target.value)} placeholder="Evidence link (optional)" />
          <textarea value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} placeholder="Notes/details (optional)" />
          <button className="button primary compact" onClick={addAchievement}>Add Achievement</button>
        </div>

        {achievements.length === 0 ? <p className="helper" style={{ marginTop: ".65rem" }}>No achievements added yet.</p> : (
          <div className="cutAchievementGrid" style={{ marginTop: ".7rem" }}>
            {achievements.map((item) => (
              <div key={item.id} className="cutAchievementCard">
                <div className="rowActions compact" style={{ justifyContent: "space-between" }}>
                  <span className="statusBadge gold">{item.type}</span>
                  {item.date ? <span className="helper">{item.date}</span> : null}
                </div>
                {item.title ? <h4>{item.title}</h4> : null}
                {item.notes ? <p className="helper">{item.notes}</p> : null}
                <div className="rowActions compact" style={{ marginTop: ".55rem" }}>
                  {item.evidenceLink ? <a className="button compact" href={item.evidenceLink} target="_blank" rel="noreferrer">Evidence</a> : null}
                  <button className="button compact" onClick={() => removeAchievement(item.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {legacyAchievementNotes ? (
          <div className="emptyState" style={{ textAlign: "left", marginTop: ".7rem" }}>
            <p className="helper" style={{ marginBottom: ".35rem" }}>Legacy achievement notes imported from older entries:</p>
            <textarea value={legacyAchievementNotes} onChange={(e) => setLegacyAchievementNotes(e.target.value)} placeholder="Legacy achievement notes" />
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Admin Metadata">
        <div className="kv">
          <dt>Platform / Source</dt><dd><input value={cut.label || ""} onChange={(e) => update("label", e.target.value)} placeholder="Spotify, YouTube, etc." /></dd>
          <dt>Spotify Track ID</dt><dd><input value={String(cut.registration_status || "")} onChange={(e) => update("registration_status", e.target.value)} placeholder="Spotify track ID and registration notes" /></dd>
          <dt>ISRC</dt><dd><input value={cut.isrc || ""} onChange={(e) => update("isrc", e.target.value)} /></dd>
          <dt>Dispute Status</dt><dd><input value={cut.dispute_status || ""} onChange={(e) => update("dispute_status", e.target.value)} placeholder="Open / Resolved / None" /></dd>
          <dt>Royalty / Admin Notes</dt><dd><textarea value={cut.royalty_admin_notes || ""} onChange={(e) => update("royalty_admin_notes", e.target.value)} placeholder="Royalty/admin/internal notes" /></dd>
        </div>
      </SectionCard>
    </div>
  );
}
