"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mapSession } from "@/lib/mappers";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";
import { Session } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";

type ImportPreviewRow = { id: string; title: string; date: string; dateTimeText: string; location: string; notes: string; attendees: string[]; source: "calendar_import"; calendar_event_id?: string; isDuplicate: boolean };
const unfoldIcs = (text: string) => text.replace(/\r\n/g, "\n").split("\n").reduce<string[]>((a,l)=>{ if ((l.startsWith(" ")||l.startsWith("\t"))&&a.length) a[a.length-1]+=l.trimStart(); else a.push(l); return a; }, []);
const normalizeText = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
const similarTitle = (a: string,b: string) => { const x=normalizeText(a), y=normalizeText(b); return x===y||x.includes(y)||y.includes(x); };
function parseIcsDate(value: string) { if (!value) return { date:"", text:"" }; if (/^\d{8}$/.test(value)) { const d=`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`; return { date:d, text:d }; } const raw=value.endsWith("Z")?value.slice(0,-1):value; const date=`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`; return { date, text:`${date} ${raw.slice(9,11)||"00"}:${raw.slice(11,13)||"00"}` }; }
function parseIcs(text: string, existing: Session[]) { const lines=unfoldIcs(text); const out: ImportPreviewRow[]=[]; let inEvent=false,title="",location="",notes="",dtStart="",uid="",attendees:string[]=[]; const flush=()=>{ if(!title&&!dtStart&&!location&&!notes) return; const d=parseIcsDate(dtStart); out.push({id:crypto.randomUUID(),title,date:d.date,dateTimeText:d.text,location,notes,attendees,source:"calendar_import",calendar_event_id:uid,isDuplicate:existing.some((s)=>s.date===d.date&&similarTitle(s.title||"",title||""))});}; for(const line of lines){ if(line==="BEGIN:VEVENT"){inEvent=true;title="";location="";notes="";dtStart="";uid="";attendees=[];continue;} if(line==="END:VEVENT"){inEvent=false;flush();continue;} if(!inEvent) continue; const idx=line.indexOf(":"); if(idx<0) continue; const key=line.slice(0,idx).split(";")[0]; const value=line.slice(idx+1).replace(/\\n/g," ").trim(); if(key==="SUMMARY") title=value; if(key==="DTSTART") dtStart=value; if(key==="LOCATION") location=value; if(key==="DESCRIPTION") notes=value; if(key==="UID") uid=value; if(key==="ATTENDEE") attendees.push(value.replace(/^mailto:/i,"")); } return out; }

export default function SessionsPage() {
  const [rows, setRows] = useState<Session[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<string>>(new Set());
  const [importMessage, setImportMessage] = useState("");
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [error, setError] = useState("");
  const initialized = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase.from("sessions").select("*").order("date", { ascending: false });
    if (error) {
      logSupabaseError("Failed to load sessions", error);
      setError(supabaseUserMessage("Could not load sessions", error));
      return;
    }
    setRows((data ?? []).map((r) => mapSession(r as Record<string, unknown>)));
  };
  useEffect(() => { load(); }, []);

  const update = async (id: string, key: keyof Session, value: string | boolean) => {
    setError("");
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    const colMap: Record<string, string> = { archive_reviewed: "archive_reviewed", evidence_strength: "evidence_strength", date: "date", title: "title", location: "location", source: "source" };
    const { error } = await supabase.from("sessions").update({ [colMap[key]]: value }).eq("id", id);
    if (error) {
      logSupabaseError("Failed to update session", error);
      setError(supabaseUserMessage("Could not update session", error));
    }
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete this session?")) return;
    setError("");
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) {
      logSupabaseError("Failed to delete session", error);
      setError(supabaseUserMessage("Could not delete session", error));
      return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const parsed = parseIcs(await file.text(), rows); setPreviewRows(parsed); setSelectedPreviewIds(new Set(parsed.map((p) => p.id))); setShowImportPreview(true); setImportMessage(parsed.length ? "" : "No events found in this .ics file.");
  };

  const importSelected = async () => {
    const selected = previewRows.filter((row) => selectedPreviewIds.has(row.id));
    if (!selected.length) return;
    const { error } = await supabase.from("sessions").insert(selected.map((row) => ({ date: row.date, title: row.title, location: row.location, source: "calendar_import", calendar_event_id: row.calendar_event_id, archive_reviewed: false, archive_review_notes: row.notes })));
    if (error) {
      logSupabaseError("Failed to import sessions", error);
      setError(supabaseUserMessage("Could not import selected events", error));
      return;
    }
    setImportMessage(`${selected.length} events imported.`); setShowImportPreview(false); await load();
  };

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (!initialized.current && qs.get("new") === "1") { initialized.current = true; window.location.href = "/sessions/new"; }
    if (qs.get("import") === "1") fileInputRef.current?.click();
  }, []);

  return <div><PageHeader title="Sessions" subtitle="Sessions can start as calendar records. Open a session to add songs, writers, assets, and follow-ups." actions={<><button className="button" onClick={() => fileInputRef.current?.click()}>Import Calendar (.ics)</button><Link className="button primary" href="/sessions/new">Add Session</Link></>} />
    <input ref={fileInputRef} type="file" accept=".ics,text/calendar" onChange={onFileChange} style={{ display: "none" }} />
    {showImportPreview ? <SectionCard title="Import Preview" actions={<><button className="button compact" onClick={() => setSelectedPreviewIds(new Set(previewRows.map((r) => r.id)))}>Select All</button><button className="button compact" onClick={() => setSelectedPreviewIds(new Set())}>Deselect All</button><button className="button primary compact" onClick={importSelected}>Import Selected</button></>}><div className="tableWrap"><table><thead><tr><th>Select</th><th>Event title</th><th>Date/time</th><th>Location</th><th>Description/notes</th><th>Attendees</th><th>Source</th><th>Duplicate warning</th></tr></thead><tbody>{previewRows.map((row)=><tr key={row.id}><td><input type="checkbox" checked={selectedPreviewIds.has(row.id)} onChange={() => { const next = new Set(selectedPreviewIds); next.has(row.id)?next.delete(row.id):next.add(row.id); setSelectedPreviewIds(next);} } /></td><td>{row.title || <span className="helper">Untitled</span>}</td><td>{row.dateTimeText}</td><td>{row.location || <span className="helper">No location</span>}</td><td>{row.notes || <span className="helper">No notes</span>}</td><td>{row.attendees.length ? row.attendees.join(", ") : <span className="helper">No attendees</span>}</td><td>{row.source}</td><td>{row.isDuplicate ? <span className="helper">Possible duplicate</span> : "-"}</td></tr>)}</tbody></table></div></SectionCard> : null}
    {error ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{error}</p> : null}
    {importMessage ? <p className="helper" style={{ marginBottom: ".7rem" }}>{importMessage}</p> : null}
    <SectionCard><p className="helper" style={{ marginBottom: ".6rem" }}>Archive Reviewed means you have checked this session for the key admin/evidence items you currently know about.</p>{rows.length===0 ? <EmptyState title="No sessions yet" hint="Import a calendar file or add sessions manually." action={<><button className="button" onClick={() => fileInputRef.current?.click()}>Import Calendar</button><Link className="button primary" href="/sessions/new">Add Session</Link></>} /> : <div className="tableWrap"><table><thead><tr><th>Date</th><th>Title</th><th>Location</th><th>Source</th><th>Archive Reviewed</th><th>Evidence Strength</th><th>Actions</th></tr></thead><tbody>{rows.map((se)=><tr key={se.id}><td>{editingId===se.id ? <input type="date" value={se.date} onChange={(e)=>update(se.id,"date",e.target.value)} /> : (se.date || <span className="helper">Add date</span>)}</td><td>{editingId===se.id ? <input value={se.title} onChange={(e)=>update(se.id,"title",e.target.value)} /> : <Link href={`/sessions/${se.id}`}>{se.title || "Untitled Session"}</Link>}</td><td>{editingId===se.id ? <input value={se.location} onChange={(e)=>update(se.id,"location",e.target.value)} /> : (se.location || <span className="helper">Add location</span>)}</td><td>{editingId===se.id ? <select value={se.source} onChange={(e)=>update(se.id,"source",e.target.value)}><option value="manual">manual</option><option value="calendar">calendar</option><option value="calendar_import">calendar_import</option></select> : se.source}</td><td>{editingId===se.id ? <input type="checkbox" checked={Boolean(se.archive_reviewed)} onChange={(e)=>update(se.id,"archive_reviewed",e.target.checked)} /> : (se.archive_reviewed ? "Yes" : <span className="helper">No</span>)}</td><td>{editingId===se.id ? <select value={se.evidence_strength || ""} onChange={(e)=>update(se.id,"evidence_strength",e.target.value)}><option value="">-</option><option value="Weak">Weak</option><option value="Partial">Partial</option><option value="Strong">Strong</option><option value="Complete">Complete</option></select> : (se.evidence_strength ? <StatusBadge label={se.evidence_strength} /> : <span className="helper">Not set</span>)}</td><td><div className="rowActions compact"><Link className="button compact" href={`/sessions/${se.id}`}>View</Link><button className="button compact" onClick={()=>setEditingId(editingId===se.id ? null : se.id)}>{editingId===se.id ? "Save" : "Edit"}</button><button className="button compact" onClick={()=>del(se.id)}>Delete</button></div></td></tr>)}</tbody></table></div>}</SectionCard></div>;
}
