"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import { AppSettings, defaultSettings, mergeSettings, SETTINGS_STORAGE_KEY } from "@/lib/settings";

type IntegrationStatus = {
  supabase: string;
  spotify: string;
  googleCalendar: string;
  dropbox: string;
  googleDrive: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [tagRows, setTagRows] = useState<Array<{ id: string; name: string }>>([]);
  const [renameTagId, setRenameTagId] = useState("");
  const [renameTagValue, setRenameTagValue] = useState("");
  const [mergeFromTagId, setMergeFromTagId] = useState("");
  const [mergeToTagId, setMergeToTagId] = useState("");

  const [audioSummary, setAudioSummary] = useState({ totalSongs: 0, songsWithAudio: 0 });
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<AppSettings>) : null;
      setSettings(mergeSettings(parsed));
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const [tagRes, songRes] = await Promise.all([
        supabase.from("song_tags").select("id,name").order("name", { ascending: true }),
        supabase.from("song_works").select("id,audio_storage_path"),
      ]);

      if (tagRes.error) {
        logSupabaseError("Failed to load settings tags", tagRes.error);
        setErrorMsg(supabaseUserMessage("Could not load saved tags", tagRes.error));
      } else {
        const tags = (tagRes.data ?? []) as Array<{ id: string; name: string }>;
        setTagRows(tags);
        setRenameTagId(tags[0]?.id || "");
        setMergeFromTagId(tags[0]?.id || "");
        setMergeToTagId(tags[1]?.id || tags[0]?.id || "");
      }

      if (songRes.error) {
        logSupabaseError("Failed to load settings storage summary", songRes.error);
      } else {
        const songs = (songRes.data ?? []) as Array<{ id: string; audio_storage_path?: string | null }>;
        setAudioSummary({
          totalSongs: songs.length,
          songsWithAudio: songs.filter((s) => Boolean(String(s.audio_storage_path || "").trim())).length,
        });
      }

      try {
        const res = await fetch("/api/integrations/status");
        const json = (await res.json()) as IntegrationStatus;
        setIntegrationStatus(json);
      } catch {
        setIntegrationStatus(null);
      }
    };
    load();
  }, []);

  const update = <K extends keyof AppSettings, F extends keyof AppSettings[K]>(section: K, field: F, value: AppSettings[K][F]) => {
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const saveSettings = () => {
    setSaveState("saving");
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      setSaveState("saved");
      setLastSavedAt(new Date().toLocaleString());
      window.setTimeout(() => setSaveState("idle"), 1000);
    } catch {
      setSaveState("error");
      setErrorMsg("Could not save settings locally.");
    }
  };

  const renameTag = async () => {
    if (!renameTagId || !renameTagValue.trim()) return;
    const { error } = await supabase.from("song_tags").update({ name: renameTagValue.trim() }).eq("id", renameTagId);
    if (error) {
      logSupabaseError("Failed to rename tag", error);
      setErrorMsg(supabaseUserMessage("Could not rename tag", error));
      return;
    }
    setTagRows((prev) => prev.map((t) => (t.id === renameTagId ? { ...t, name: renameTagValue.trim() } : t)).sort((a, b) => a.name.localeCompare(b.name)));
    setRenameTagValue("");
  };

  const mergeTags = async () => {
    if (!mergeFromTagId || !mergeToTagId || mergeFromTagId === mergeToTagId) return;
    const { error: updateErr } = await supabase.from("song_work_tags").update({ tag_id: mergeToTagId }).eq("tag_id", mergeFromTagId);
    if (updateErr) {
      logSupabaseError("Failed to reassign tag links during merge", updateErr);
      setErrorMsg(supabaseUserMessage("Could not merge tags", updateErr));
      return;
    }
    const { error: deleteErr } = await supabase.from("song_tags").delete().eq("id", mergeFromTagId);
    if (deleteErr) {
      logSupabaseError("Failed to delete merged source tag", deleteErr);
      setErrorMsg(supabaseUserMessage("Could not complete tag merge", deleteErr));
      return;
    }
    setTagRows((prev) => prev.filter((t) => t.id !== mergeFromTagId));
    setMergeFromTagId("");
  };

  const integrationBadge = (value?: string) => {
    if (!value) return <span className="statusBadge">Unknown</span>;
    if (value === "connected") return <span className="statusBadge sage">Connected</span>;
    if (value === "embed_only") return <span className="statusBadge amber">Embed Only</span>;
    if (value === "future") return <span className="statusBadge">Future</span>;
    return <span className="statusBadge rose">Needs setup</span>;
  };

  const completeRequirements = useMemo(
    () => [
      "Bounce",
      "Lyrics",
      "writers/splits",
      "supporting evidence link",
      "follow-up action for missing items",
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Workflow defaults, profile/contact settings, archive standards, and lightweight integration controls."
        actions={<div className="rowActions compact"><button className="button primary" onClick={saveSettings}>Save Settings</button><Link className="button" href="/help">Open Help</Link></div>}
      />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}
      <p className="helper" style={{ marginBottom: ".8rem" }}>{saveState === "saving" ? "Saving..." : saveState === "saved" ? `Saved ${lastSavedAt}` : saveState === "error" ? "Could not save" : (lastSavedAt ? `Last saved ${lastSavedAt}` : "")}</p>

      <SectionCard title="User / Profile">
        <div className="kv">
          <dt>Display name</dt><dd><input value={settings.profile.displayName} onChange={(e) => update("profile", "displayName", e.target.value)} /></dd>
          <dt>Email</dt><dd><input value={settings.profile.email} onChange={(e) => update("profile", "email", e.target.value)} /></dd>
          <dt>Role / Title</dt><dd><input value={settings.profile.roleTitle} onChange={(e) => update("profile", "roleTitle", e.target.value)} /></dd>
          <dt>Default company / brand</dt><dd><input value={settings.profile.defaultCompany} onChange={(e) => update("profile", "defaultCompany", e.target.value)} /></dd>
          <dt>Default contact email</dt><dd><input value={settings.profile.defaultContactEmail} onChange={(e) => update("profile", "defaultContactEmail", e.target.value)} /></dd>
        </div>
      </SectionCard>

      <SectionCard title="General Settings">
        <div className="kv">
          <dt>Default review year</dt><dd><input type="number" value={settings.general.defaultReviewYear} onChange={(e) => update("general", "defaultReviewYear", Number(e.target.value || new Date().getFullYear()))} /></dd>
          <dt>Default session sort</dt><dd><select value={settings.general.defaultSessionSort} onChange={(e) => update("general", "defaultSessionSort", e.target.value as AppSettings["general"]["defaultSessionSort"])}><option value="most_recent">Most Recent</option><option value="date_oldest">Date (Oldest)</option><option value="a_z">A-Z</option><option value="z_a">Z-A</option><option value="date_added">Date Added</option></select></dd>
          <dt>Date format</dt><dd><select value={settings.general.dateFormat} onChange={(e) => update("general", "dateFormat", e.target.value as AppSettings["general"]["dateFormat"])}><option value="yyyy-mm-dd">YYYY-MM-DD</option><option value="dd-mm-yyyy">DD-MM-YYYY</option><option value="mm-dd-yyyy">MM-DD-YYYY</option></select></dd>
          <dt>Timezone</dt><dd><input value={settings.general.timezone} onChange={(e) => update("general", "timezone", e.target.value)} /></dd>
          <dt>UI density</dt><dd><select value={settings.general.density} onChange={(e) => update("general", "density", e.target.value as AppSettings["general"]["density"])}><option value="compact">Compact</option><option value="spacious">Spacious</option></select></dd>
        </div>
      </SectionCard>

      <SectionCard title="Archive & Evidence">
        <div className="kv">
          <dt>Automatic evidence strength</dt><dd><input type="checkbox" checked={settings.archive.autoEvidenceStrength} onChange={(e) => update("archive", "autoEvidenceStrength", e.target.checked)} /></dd>
          <dt>Archive review default filter</dt><dd><select value={settings.archive.archiveFilterDefault} onChange={(e) => update("archive", "archiveFilterDefault", e.target.value as AppSettings["archive"]["archiveFilterDefault"])}><option value="needs_review_only">Needs Review Only</option><option value="all_sessions">All Sessions</option></select></dd>
          <dt>Require Bounce for Strong/Complete</dt><dd><input type="checkbox" checked={settings.archive.requireBounceForStrong} onChange={(e) => update("archive", "requireBounceForStrong", e.target.checked)} /></dd>
          <dt>Require Lyrics for Strong/Complete</dt><dd><input type="checkbox" checked={settings.archive.requireLyricsForStrong} onChange={(e) => update("archive", "requireLyricsForStrong", e.target.checked)} /></dd>
          <dt>Require writers/splits for Strong/Complete</dt><dd><input type="checkbox" checked={settings.archive.requireWritersSplitsForStrong} onChange={(e) => update("archive", "requireWritersSplitsForStrong", e.target.checked)} /></dd>
          <dt>Require supporting link for Strong/Complete</dt><dd><input type="checkbox" checked={settings.archive.requireSupportingLinkForStrong} onChange={(e) => update("archive", "requireSupportingLinkForStrong", e.target.checked)} /></dd>
          <dt>Require follow-up action if missing</dt><dd><input type="checkbox" checked={settings.archive.requireFollowUpForMissing} onChange={(e) => update("archive", "requireFollowUpForMissing", e.target.checked)} /></dd>
          <dt>Complete/Strong guidance</dt><dd>{completeRequirements.map((r) => <span key={r} className="statusBadge" style={{ marginRight: ".35rem", marginBottom: ".35rem" }}>{r}</span>)}</dd>
        </div>
      </SectionCard>

      <SectionCard title="Session Defaults">
        <div className="kv">
          <dt>Default location / studio</dt><dd><input value={settings.sessionDefaults.defaultLocationStudio} onChange={(e) => update("sessionDefaults", "defaultLocationStudio", e.target.value)} /></dd>
          <dt>Default attendees/writers suggestion</dt><dd><input value={settings.sessionDefaults.defaultAttendees} onChange={(e) => update("sessionDefaults", "defaultAttendees", e.target.value)} placeholder="Comma separated" /></dd>
          <dt>Default follow-up action owner</dt><dd><input value={settings.sessionDefaults.defaultFollowUpOwner} onChange={(e) => update("sessionDefaults", "defaultFollowUpOwner", e.target.value)} /></dd>
          <dt>Auto-create follow-up for missing Bounce/Lyrics</dt><dd><input type="checkbox" checked={settings.sessionDefaults.autoFollowUpMissingCoreEvidence} onChange={(e) => update("sessionDefaults", "autoFollowUpMissingCoreEvidence", e.target.checked)} /></dd>
        </div>
      </SectionCard>

      <SectionCard title="Writers & Splits">
        <div className="kv">
          <dt>Default equal split behaviour</dt><dd><input type="checkbox" checked={settings.writersSplits.defaultEqualSplitBehavior} onChange={(e) => update("writersSplits", "defaultEqualSplitBehavior", e.target.checked)} /></dd>
          <dt>Rounding rule note</dt><dd><input value={settings.writersSplits.roundingRuleNote} onChange={(e) => update("writersSplits", "roundingRuleNote", e.target.value)} /></dd>
          <dt>Saved writer roles</dt><dd><input value={settings.writersSplits.savedWriterRoles} onChange={(e) => update("writersSplits", "savedWriterRoles", e.target.value)} /></dd>
          <dt>Default writer role</dt><dd><input value={settings.writersSplits.defaultWriterRole} onChange={(e) => update("writersSplits", "defaultWriterRole", e.target.value)} /></dd>
        </div>
      </SectionCard>

      <SectionCard title="Playlist / Pitching">
        <div className="kv">
          <dt>Default pitch/contact email</dt><dd><input value={settings.playlistPitching.defaultPitchEmail} onChange={(e) => update("playlistPitching", "defaultPitchEmail", e.target.value)} /></dd>
          <dt>Default playlist expiry (days)</dt><dd><input type="number" value={settings.playlistPitching.defaultPlaylistExpiryDays} onChange={(e) => update("playlistPitching", "defaultPlaylistExpiryDays", Number(e.target.value || 14))} /></dd>
          <dt>Allow Hold/Interested/Pass/Feedback</dt><dd><input type="checkbox" checked={settings.playlistPitching.allowRecipientResponses} onChange={(e) => update("playlistPitching", "allowRecipientResponses", e.target.checked)} /></dd>
          <dt>Default public playlist footer/contact text</dt><dd><textarea value={settings.playlistPitching.defaultPublicFooterText} onChange={(e) => update("playlistPitching", "defaultPublicFooterText", e.target.value)} /></dd>
        </div>
      </SectionCard>

      <SectionCard title="Audio / Storage">
        <div className="kv">
          <dt>Preferred upload format</dt><dd><input value={settings.audioStorage.preferredUploadFormat} onChange={(e) => update("audioStorage", "preferredUploadFormat", e.target.value)} placeholder="mp3, m4a" /></dd>
          <dt>Max upload warning size (MB)</dt><dd><input type="number" value={settings.audioStorage.maxUploadWarningMb} onChange={(e) => update("audioStorage", "maxUploadWarningMb", Number(e.target.value || 30))} /></dd>
          <dt>Storage usage summary</dt><dd><span className="statusBadge">{audioSummary.songsWithAudio}/{audioSummary.totalSongs} songs have Supabase pitch audio</span></dd>
          <dt>Storage note</dt><dd><p className="helper">Dropbox remains archive/master storage. Supabase is pitch playback copy.</p></dd>
        </div>
      </SectionCard>

      <SectionCard title="Tags & Catalogue">
        <div className="kv">
          <dt>Preferred tag suggestions</dt><dd><textarea value={settings.tagsCatalogue.preferredTagSuggestions} onChange={(e) => update("tagsCatalogue", "preferredTagSuggestions", e.target.value)} /></dd>
          <dt>Status definitions note</dt><dd><textarea value={settings.tagsCatalogue.statusDefinitionsNote} onChange={(e) => update("tagsCatalogue", "statusDefinitionsNote", e.target.value)} /></dd>
          <dt>Rename tag</dt>
          <dd>
            <div className="rowActions compact">
              <select value={renameTagId} onChange={(e) => setRenameTagId(e.target.value)}>{tagRows.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>
              <input value={renameTagValue} onChange={(e) => setRenameTagValue(e.target.value)} placeholder="New name" />
              <button className="button compact" onClick={renameTag}>Rename</button>
            </div>
          </dd>
          <dt>Merge tag</dt>
          <dd>
            <div className="rowActions compact">
              <select value={mergeFromTagId} onChange={(e) => setMergeFromTagId(e.target.value)}>{tagRows.map((tag) => <option key={tag.id} value={tag.id}>From: {tag.name}</option>)}</select>
              <select value={mergeToTagId} onChange={(e) => setMergeToTagId(e.target.value)}>{tagRows.map((tag) => <option key={tag.id} value={tag.id}>Into: {tag.name}</option>)}</select>
              <button className="button compact" onClick={mergeTags}>Merge</button>
            </div>
          </dd>
        </div>
      </SectionCard>

      <SectionCard title="Brand / Public Pages">
        <div className="kv">
          <dt>Public playlist brand name</dt><dd><input value={settings.brandPublic.publicBrandName} onChange={(e) => update("brandPublic", "publicBrandName", e.target.value)} /></dd>
          <dt>Logo/artwork placeholder</dt><dd><p className="helper">Placeholder only for now. Full logo upload can be added later.</p></dd>
          <dt>Public footer text</dt><dd><textarea value={settings.brandPublic.publicFooterText} onChange={(e) => update("brandPublic", "publicFooterText", e.target.value)} /></dd>
          <dt>Contact email</dt><dd><input value={settings.brandPublic.contactEmail} onChange={(e) => update("brandPublic", "contactEmail", e.target.value)} /></dd>
          <dt>Colour/accent preference</dt><dd><input value={settings.brandPublic.accentPreference} onChange={(e) => update("brandPublic", "accentPreference", e.target.value)} /></dd>
        </div>
      </SectionCard>

      <SectionCard title="Integrations">
        <div className="kv">
          <dt>Supabase</dt><dd>{integrationBadge(integrationStatus?.supabase)} <span className="helper">Project data + storage</span></dd>
          <dt>Spotify API</dt><dd>{integrationBadge(integrationStatus?.spotify)} <span className="helper">Cut metadata import/search</span></dd>
          <dt>Google Calendar</dt><dd>{integrationBadge(integrationStatus?.googleCalendar)} <span className="helper">Embedded reference + ICS import workflow</span></dd>
          <dt>Dropbox</dt><dd>{integrationBadge(integrationStatus?.dropbox)} <span className="helper">Future direct integration</span></dd>
          <dt>Google Drive</dt><dd>{integrationBadge(integrationStatus?.googleDrive)} <span className="helper">Future direct integration</span></dd>
        </div>
      </SectionCard>

      <SectionCard title="Admin / Export">
        <div className="rowActions" style={{ flexWrap: "wrap" }}>
          <Link className="button" href="/reports">Open Reports Hub</Link>
          <Link className="button" href="/archive-progress">Export Archive Review Summary</Link>
          <Link className="button" href="/playlists">Export Pitch History</Link>
          <span className="statusBadge">Database backup/export: use Supabase project backup/export tools</span>
        </div>
      </SectionCard>
    </div>
  );
}
