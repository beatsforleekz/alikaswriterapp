"use client";

import { useEffect, useState } from "react";
import { ActionItem } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { supabase } from "@/lib/supabase";
import { mapAction } from "@/lib/mappers";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

export default function ActionsPage() {
  const [rows, setRows] = useState<ActionItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [sortBy, setSortBy] = useState<"az" | "za" | "date" | "recent" | "added">("date");

  const load = async () => {
    const { data, error } = await supabase.from("action_items").select("*").order("due_date", { ascending: true });
    if (error) {
      logSupabaseError("Failed to load actions", error);
      setErrorMsg(supabaseUserMessage("Could not load actions", error));
      return;
    }
    setRows((data ?? []).map((r) => mapAction(r as Record<string, unknown>)));
  };
  useEffect(() => { load(); }, []);

  const addRow = async () => {
    setErrorMsg("");
    const { data, error } = await supabase.from("action_items").insert({ due_date: "", priority: "Medium", task: "", status: "Open" }).select("*").single();
    if (error) {
      logSupabaseError("Failed to create action", error);
      setErrorMsg(supabaseUserMessage("Could not create action", error));
      return;
    }
    if (data) { setRows((r) => [...r, mapAction(data as Record<string, unknown>)]); setEditingId(String(data.id)); }
  };
  const update = async (id: string, key: keyof ActionItem, value: string) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    const colMap: Record<string, string> = { dueDate: "due_date", priority: "priority", sessionId: "session_id", songId: "song_id", task: "task", status: "status", notes: "notes" };
    const { error } = await supabase.from("action_items").update({ [colMap[key]]: (key === "sessionId" || key === "songId") && !value ? null : value }).eq("id", id);
    if (error) {
      logSupabaseError("Failed to update action", error);
      setErrorMsg(supabaseUserMessage("Could not update action", error));
    }
  };
  const del = async (id: string) => { if (!window.confirm("Delete this action item?")) return; const { error } = await supabase.from("action_items").delete().eq("id", id); if (error) { logSupabaseError("Failed to delete action", error); setErrorMsg(supabaseUserMessage("Could not delete action", error)); return; } setRows((r) => r.filter((x) => x.id !== id)); };
  const markDone = async (id: string) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status: "Done" } : x)));
    const { error } = await supabase.from("action_items").update({ status: "Done" }).eq("id", id);
    if (error) {
      logSupabaseError("Failed to mark action done", error);
      setErrorMsg(supabaseUserMessage("Could not mark action done", error));
      return;
    }
  };
  const activeRows = rows.filter((r) => r.status !== "Done");
  const doneRows = rows.filter((r) => r.status === "Done");
  const sortActions = (items: ActionItem[]) => {
    const next = [...items];
    if (sortBy === "az") next.sort((a, b) => a.task.localeCompare(b.task, undefined, { sensitivity: "base" }));
    else if (sortBy === "za") next.sort((a, b) => b.task.localeCompare(a.task, undefined, { sensitivity: "base" }));
    else if (sortBy === "date") next.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    else if (sortBy === "added") next.sort((a, b) => a.id.localeCompare(b.id));
    else next.sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""));
    return next;
  };
  const sortedActiveRows = sortActions(activeRows);
  const sortedDoneRows = sortActions(doneRows);

  return (
    <div>
      <PageHeader title="Actions" subtitle="Keep follow-ups visible and time-bound." actions={<button className="button primary" onClick={addRow}>Add Action</button>} />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}
      <div className="rowActions compact" style={{ marginBottom: ".6rem" }}>
        <label className="helper">Sort</label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "az" | "za" | "date" | "recent" | "added")} style={{ maxWidth: 200 }}>
          <option value="az">A-Z</option>
          <option value="za">Z-A</option>
          <option value="date">Date (Oldest)</option>
          <option value="recent">Most Recent</option>
          <option value="added">Date Added</option>
        </select>
      </div>
      <SectionCard title="Active Actions">
        {activeRows.length === 0 ? <EmptyState title="No active action items" hint="Great, nothing currently action-needed." action={<button className="button primary" onClick={addRow}>Add Action</button>} /> : (
          <>
          <div className="tableWrap desktopOnly"><table><thead><tr><th>Due Date</th><th>Priority</th><th>Session ID</th><th>Song ID</th><th>Task</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead><tbody>{sortedActiveRows.map((a)=><tr key={a.id}><td>{editingId===a.id ? <input type="date" value={a.dueDate} onChange={(e)=>update(a.id,"dueDate",e.target.value)} /> : (a.dueDate || <span className="helper">Add date</span>)}</td><td>{editingId===a.id ? <select value={a.priority} onChange={(e)=>update(a.id,"priority",e.target.value)}><option>Low</option><option>Medium</option><option>High</option></select> : a.priority}</td><td>{editingId===a.id ? <input value={a.sessionId || ""} onChange={(e)=>update(a.id,"sessionId",e.target.value)} /> : (a.sessionId || <span className="helper">Optional</span>)}</td><td>{editingId===a.id ? <input value={a.songId || ""} onChange={(e)=>update(a.id,"songId",e.target.value)} /> : (a.songId || <span className="helper">Optional</span>)}</td><td>{editingId===a.id ? <input value={a.task} onChange={(e)=>update(a.id,"task",e.target.value)} /> : (a.task || <span className="helper">Add task</span>)}</td><td>{editingId===a.id ? <select value={a.status} onChange={(e)=>update(a.id,"status",e.target.value)}><option>Open</option><option>In Progress</option><option>Done</option></select> : a.status}</td><td>{editingId===a.id ? <input value={a.notes || ""} onChange={(e)=>update(a.id,"notes",e.target.value)} /> : (a.notes || <span className="helper">Optional</span>)}</td><td className="rowActions"><button className="button" onClick={()=>setEditingId(editingId===a.id ? null : a.id)}>{editingId===a.id ? "Save" : "Edit"}</button><button className="button primary" onClick={()=>markDone(a.id)}>Mark Done</button><button className="button" onClick={()=>del(a.id)}>Delete</button></td></tr>)}</tbody></table></div>
          <div className="mobileOnly mobileCardList">{sortedActiveRows.map((a)=><div key={`mobile-action-${a.id}`} className="mobileDataCard"><h4>{a.task || "Untitled Action"}</h4><p className="helper">{a.dueDate || "No date"} · {a.priority}</p><div className="rowActions compact" style={{ marginTop: ".45rem" }}><span className="statusBadge">{a.status}</span><button className="button compact" onClick={()=>markDone(a.id)}>Mark Done</button><button className="button compact" onClick={()=>setEditingId(editingId===a.id ? null : a.id)}>{editingId===a.id ? "Save" : "Edit"}</button><button className="button compact" onClick={()=>del(a.id)}>Delete</button></div></div>)}</div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Done Actions">
        {doneRows.length === 0 ? <p className="helper">No completed actions yet.</p> : (
          <div className="tableWrap"><table><thead><tr><th>Due Date</th><th>Priority</th><th>Task</th><th>Status</th><th>Actions</th></tr></thead><tbody>{sortedDoneRows.map((a)=><tr key={a.id}><td>{a.dueDate || <span className="helper">No date</span>}</td><td>{a.priority}</td><td style={{ textDecoration: "line-through", color: "var(--muted)" }}>{a.task || <span className="helper">Add task</span>}</td><td>{a.status}</td><td className="rowActions"><button className="button" onClick={()=>update(a.id,"status","Open")}>Reopen</button><button className="button" onClick={()=>del(a.id)}>Delete</button></td></tr>)}</tbody></table></div>
        )}
      </SectionCard>
    </div>
  );
}
