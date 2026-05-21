"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { hasBounce, hasLyrics } from "@/lib/selectors";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { supabase } from "@/lib/supabase";
import { mapAction, mapSession, mapSong } from "@/lib/mappers";
import { ActionItem, Session, SongWork } from "@/types";

export default function Page() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [songs, setSongs] = useState<SongWork[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    setSkip(new URLSearchParams(window.location.search).get("skip") === "1");
    const load = async () => {
      const [sRes, soRes, aRes] = await Promise.all([
        supabase.from("sessions").select("*").order("date", { ascending: false }),
        supabase.from("song_works").select("*").order("created_at", { ascending: false }),
        supabase.from("action_items").select("*").order("due_date", { ascending: true }),
      ]);
      setSessions((sRes.data ?? []).map((r) => mapSession(r as Record<string, unknown>)));
      setSongs((soRes.data ?? []).map((r) => mapSong(r as Record<string, unknown>)));
      setActions((aRes.data ?? []).map((r) => mapAction(r as Record<string, unknown>)));
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

  const missingBounce = songs.filter((s) => !hasBounce(s)).length;
  const missingLyrics = songs.filter((s) => !hasLyrics(s)).length;
  const cutReleased = songs.filter((s) => s.status === "Cut" || s.status === "Released").length;
  const disputed = songs.filter((s) => s.status === "Disputed").length;
  const upcoming = [...actions].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const currentYear = new Date().getFullYear();
  const yearSessions = sessions.filter((s) => s.date.startsWith(String(currentYear)));
  const latestAudited = yearSessions.filter((s) => s.archive_reviewed).map((s) => s.date).sort().at(-1);
  const sessionsNeedingEvidence = yearSessions.filter((s) => !s.evidence_strength || s.evidence_strength === "Weak" || s.evidence_strength === "Partial").length;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Elegant archive command centre for your catalogue workflow." />
      <div className="grid cards">
        <StatCard label="Total Sessions" value={sessions.length} />
        <StatCard label="Total Songs / Works" value={songs.length} />
        <StatCard label="Missing Bounce" value={missingBounce} />
        <StatCard label="Missing Lyrics" value={missingLyrics} />
        <StatCard label="Cut / Released" value={cutReleased} />
        <StatCard label="Disputed" value={disputed} />
      </div>
      <SectionCard title="Archive Progress" actions={<Link className="button primary" href="/archive-progress">Quick Resume</Link>}>
        <div className="grid cards">
          <StatCard label="Current Active Year" value={currentYear} />
          <StatCard label="Latest Audited Date" value={latestAudited || <span className="helper">Not set</span>} />
          <StatCard label="Sessions Needing Evidence" value={sessionsNeedingEvidence} />
        </div>
      </SectionCard>
      <SectionCard title="Quick Links"><div className="rowActions"><Link className="button" href="/songs?filter=no-bounce">No Bounce</Link><Link className="button" href="/songs?filter=no-lyrics">No Lyrics</Link><Link className="button" href="/songs?filter=disputed">Disputed</Link><Link className="button" href="/exports">Exports</Link></div></SectionCard>
      <SectionCard title="Upcoming Follow-ups">
        {upcoming.length === 0 ? <EmptyState title="No follow-ups yet" hint="Add action items to track next steps." /> : (
          <div className="tableWrap"><table><thead><tr><th>Due Date</th><th>Priority</th><th>Task</th><th>Status</th></tr></thead><tbody>{upcoming.map((a)=><tr key={a.id}><td>{a.dueDate}</td><td>{a.priority}</td><td>{a.task}</td><td>{a.status}</td></tr>)}</tbody></table></div>
        )}
      </SectionCard>
    </div>
  );
}
