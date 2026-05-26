"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

type YearProgress = { id: string; year: number; archiveReviewedUpTo: string; lastAuditedSessionDate: string; notes: string };
type SessionLite = { id: string; date: string; title: string; evidence_strength?: string; archive_reviewed?: boolean };
type SongLite = { id: string; session_id?: string | null; status: string; bounce_link?: string | null; lyrics_link?: string | null };
const years = [2026, 2025, 2024, 2023, 2022, 2021];

export default function ArchiveProgressPage() {
  const [progress, setProgress] = useState<YearProgress[]>([]);
  const [activeYear, setActiveYear] = useState<number>(years[0]);
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const progressSectionRef = useRef<HTMLDivElement | null>(null);
  const reviewedUpToInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const [pRes, sRes, soRes] = await Promise.all([
        supabase.from("archive_progress").select("*").order("year", { ascending: false }),
        supabase.from("sessions").select("id,date,title,evidence_strength,archive_reviewed"),
        supabase.from("song_works").select("id,session_id,status,bounce_link,lyrics_link"),
      ]);
      if (pRes.error || sRes.error || soRes.error) {
        const e = pRes.error || sRes.error || soRes.error;
        logSupabaseError("Failed to load archive progress", e);
        setErrorMsg(supabaseUserMessage("Could not load archive progress data", e));
        return;
      }
      const p = (pRes.data ?? []).map((r) => ({ id: String(r.id), year: Number(r.year), archiveReviewedUpTo: String(r.archive_reviewed_up_to ?? ""), lastAuditedSessionDate: String(r.last_audited_session_date ?? ""), notes: String(r.notes ?? "") }));
      setProgress(p.length ? p : years.map((year) => ({ id: "", year, archiveReviewedUpTo: "", lastAuditedSessionDate: "", notes: "" })));
      setSessions((sRes.data ?? []) as SessionLite[]);
      setSongs((soRes.data ?? []) as SongLite[]);
    };
    load();
  }, []);

  const songsByYear = useMemo(() => years.reduce<Record<number, SongLite[]>>((acc, year) => {
    const sessionIds = sessions.filter((s) => s.date?.startsWith(String(year))).map((s) => s.id);
    acc[year] = songs.filter((song) => song.session_id && sessionIds.includes(String(song.session_id)));
    return acc;
  }, {} as Record<number, SongLite[]>), [sessions, songs]);

  const sessionsByYear = useMemo(() => years.reduce<Record<number, SessionLite[]>>((acc, year) => { acc[year] = sessions.filter((s) => s.date?.startsWith(String(year))); return acc; }, {} as Record<number, SessionLite[]>), [sessions]);

  const upsertYear = async (year: number, key: keyof YearProgress, value: string) => {
    setProgress((rows) => rows.map((r) => (r.year === year ? { ...r, [key]: value } : r)));
    const row = progress.find((r) => r.year === year);
    const payload: Record<string, string | number | null> = {
      year,
      archive_reviewed_up_to: key === "archiveReviewedUpTo" ? value : row?.archiveReviewedUpTo || null,
      last_audited_session_date: key === "lastAuditedSessionDate" ? value : row?.lastAuditedSessionDate || null,
      notes: key === "notes" ? value : row?.notes || null,
    };
    if (row?.id) {
      const { error } = await supabase.from("archive_progress").update(payload).eq("id", row.id);
      if (error) {
        logSupabaseError("Failed to update archive_progress", error);
        setErrorMsg(supabaseUserMessage("Could not save archive progress", error));
      }
    }
    else {
      const { data, error } = await supabase.from("archive_progress").insert(payload).select("*").single();
      if (error) {
        logSupabaseError("Failed to create archive_progress", error);
        setErrorMsg(supabaseUserMessage("Could not save archive progress", error));
        return;
      }
      if (data) setProgress((rows) => rows.map((r) => (r.year === year ? { ...r, id: String(data.id) } : r)));
    }
  };

  return (
    <div>
      <PageHeader title="Archive Progress" subtitle="Track catalogue reconstruction by year and date range." />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}

      <SectionCard title="What Archive Reviewed Means">
        <p>Archive Reviewed means you have checked this session for the key admin/evidence items you currently know about.</p>
        <p className="helper" style={{ marginTop: ".5rem" }}>Reviewed does not mean complete. Missing evidence can still remain after review. Use Evidence Strength to show how strong the evidence currently is.</p>
      </SectionCard>

      <div className="grid cards">
        {years.map((year) => {
          const sRows = sessionsByYear[year] || [];
          const soRows = songsByYear[year] || [];
          const missingBounce = soRows.filter((s) => !s.bounce_link).length;
          const missingLyrics = soRows.filter((s) => !s.lyrics_link).length;
          const disputed = soRows.filter((s) => s.status === "Disputed").length;
          const completeEvidence = soRows.filter((s) => s.bounce_link && s.lyrics_link).length;
          const completion = soRows.length ? Math.round((completeEvidence / soRows.length) * 100) : 0;
          const p = progress.find((x) => x.year === year) || { id: "", year, archiveReviewedUpTo: "", lastAuditedSessionDate: "", notes: "" };
          return (
            <SectionCard key={year} actions={<button className="button" onClick={() => { setActiveYear(year); window.setTimeout(() => { progressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); reviewedUpToInputRef.current?.focus(); }, 30); }}>Edit Progress</button>}>
              <div className="rowActions" style={{ justifyContent: "space-between" }}><h2>{year}</h2>{year === activeYear ? <StatusBadge label="Started" /> : null}</div>
              <p className="helper">Last audited: {p.lastAuditedSessionDate || "Not set"}</p>
              <div style={{ marginTop: ".5rem" }}>Total sessions: {sRows.length}</div>
              <div>Total songs: {soRows.length}</div>
              <div>Missing bounce: {missingBounce}</div>
              <div>Missing lyrics: {missingLyrics}</div>
              <div>Disputed songs: {disputed}</div>
              <div style={{ marginTop: ".6rem" }}><div className="rowActions" style={{ justifyContent: "space-between" }}><span>Completion</span><strong>{completion}%</strong></div><div className="progressBar"><span style={{ width: `${completion}%` }} /></div></div>
            </SectionCard>
          );
        })}
      </div>
      <div ref={progressSectionRef}>
      <SectionCard title={`Manual Progress Tracking (${activeYear})`}>
        <div className="kv">
          <dt>Archive reviewed up to</dt><dd><input ref={reviewedUpToInputRef} type="date" value={progress.find((r)=>r.year===activeYear)?.archiveReviewedUpTo || ""} onChange={(e)=>upsertYear(activeYear, "archiveReviewedUpTo", e.target.value)} placeholder="YYYY-MM-DD" /></dd>
          <dt>Last audited session date</dt><dd><input type="date" value={progress.find((r)=>r.year===activeYear)?.lastAuditedSessionDate || ""} onChange={(e)=>upsertYear(activeYear, "lastAuditedSessionDate", e.target.value)} placeholder="YYYY-MM-DD" /></dd>
          <dt>Notes for this year</dt><dd><textarea value={progress.find((r)=>r.year===activeYear)?.notes || ""} onChange={(e)=>upsertYear(activeYear, "notes", e.target.value)} placeholder="Backfill notes" /></dd>
        </div>
        <div className="rowActions" style={{ marginTop: ".8rem" }}><Link className="button primary" href="/sessions">Quick Resume</Link></div>
      </SectionCard>
      </div>
    </div>
  );
}
