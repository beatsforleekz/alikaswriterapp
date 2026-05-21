"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabase";

type SessionLite = { id: string; title: string; date: string; evidence_strength?: string; archive_reviewed?: boolean };

export default function ExportsPage() {
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [songCount, setSongCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [sRes, soRes] = await Promise.all([
        supabase.from("sessions").select("id,title,date,evidence_strength,archive_reviewed"),
        supabase.from("song_works").select("id", { count: "exact" }),
      ]);
      setSessions((sRes.data ?? []) as SessionLite[]);
      setSongCount(soRes.count ?? 0);
    };
    load();
  }, []);

  const cards = ["No Bounce","No Lyrics","Missing Writers","Missing Splits","Pitched","On Hold","Cut","Released","Cut but No Contract","Released but Not Registered","Disputed","All Approved / Complete"];
  return (
    <div>
      <PageHeader title="Exports" subtitle="Clean reporting surfaces for catalog audit and handoff." actions={<button className="button primary">Add Report Filter</button>} />
      <div className="grid cards">{cards.map((c)=><SectionCard key={c} title={c}><button className="button" disabled>Export</button><p className="helper" style={{ marginTop: ".6rem" }}>{songCount === 0 ? "No songs yet." : "Filtered rows will appear here."}</p></SectionCard>)}</div>
      <SectionCard title="Evidence Strength Snapshot"><div className="tableWrap"><table><thead><tr><th>Session</th><th>Date</th><th>Evidence Strength</th><th>Archive Reviewed</th></tr></thead><tbody>{sessions.length===0 ? <tr><td colSpan={4} className="helper">No sessions yet.</td></tr> : sessions.map((s)=><tr key={s.id}><td>{s.title || "Untitled Session"}</td><td>{s.date || <span className="helper">No date</span>}</td><td>{s.evidence_strength || <span className="helper">Not set</span>}</td><td>{s.archive_reviewed ? "Yes" : "No"}</td></tr>)}</tbody></table></div></SectionCard>
    </div>
  );
}
