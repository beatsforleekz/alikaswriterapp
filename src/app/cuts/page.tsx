"use client";

import { useEffect, useState } from "react";
import { CutRecord } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { supabase } from "@/lib/supabase";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

const mapCut = (r: Record<string, unknown>): CutRecord => ({
  id: String(r.id ?? ""),
  songId: String(r.song_id ?? ""),
  artist: r.artist ? String(r.artist) : undefined,
  releaseTitle: r.release_title ? String(r.release_title) : undefined,
  releaseDate: r.release_date ? String(r.release_date) : undefined,
});

export default function CutsPage() {
  const [rows, setRows] = useState<CutRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("cut_records").select("*").order("created_at", { ascending: false });
    if (error) {
      logSupabaseError("Failed to load cuts", error);
      setErrorMsg(supabaseUserMessage("Could not load cut records", error));
      return;
    }
    setRows((data ?? []).map((r) => mapCut(r as Record<string, unknown>)));
  };
  useEffect(() => { load(); }, []);

  const addRow = async () => {
    setErrorMsg("");
    const { data, error } = await supabase.from("cut_records").insert({ song_id: null }).select("*").single();
    if (error) {
      logSupabaseError("Failed to create cut", error);
      setErrorMsg(supabaseUserMessage("Could not create cut record", error));
      return;
    }
    if (data) { setRows((r) => [mapCut(data as Record<string, unknown>), ...r]); setEditingId(String(data.id)); }
  };
  const update = async (id: string, key: keyof CutRecord, value: string) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    const colMap: Record<string, string> = { songId: "song_id", artist: "artist", releaseTitle: "release_title", releaseDate: "release_date" };
    const { error } = await supabase.from("cut_records").update({ [colMap[key]]: key === "songId" && !value ? null : value }).eq("id", id);
    if (error) {
      logSupabaseError("Failed to update cut", error);
      setErrorMsg(supabaseUserMessage("Could not update cut record", error));
    }
  };
  const del = async (id: string) => { if (!window.confirm("Delete this cut record?")) return; const { error } = await supabase.from("cut_records").delete().eq("id", id); if (error) { logSupabaseError("Failed to delete cut", error); setErrorMsg(supabaseUserMessage("Could not delete cut record", error)); return; } setRows((r) => r.filter((x) => x.id !== id)); };

  return (
    <div>
      <PageHeader title="Cuts" subtitle="Commercial release tracking with understated, auditable detail." actions={<button className="button primary" onClick={addRow}>Add Cut Record</button>} />
      {errorMsg ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{errorMsg}</p> : null}
      <SectionCard>
        {rows.length===0 ? <EmptyState title="No cut records yet" hint="Add a cut once a song is commercially active." action={<button className="button primary" onClick={addRow}>Add Cut Record</button>} /> : (
          <div className="tableWrap"><table><thead><tr><th>Song ID</th><th>Artist</th><th>Release Title</th><th>Release Date</th><th>Actions</th></tr></thead><tbody>{rows.map((c)=><tr key={c.id}><td>{editingId===c.id ? <input value={c.songId} onChange={(e)=>update(c.id,"songId",e.target.value)} /> : (c.songId || <span className="helper">Link song</span>)}</td><td>{editingId===c.id ? <input value={c.artist || ""} onChange={(e)=>update(c.id,"artist",e.target.value)} /> : (c.artist || <span className="helper">Add artist</span>)}</td><td>{editingId===c.id ? <input value={c.releaseTitle || ""} onChange={(e)=>update(c.id,"releaseTitle",e.target.value)} /> : (c.releaseTitle || <span className="helper">Add release</span>)}</td><td>{editingId===c.id ? <input type="date" value={c.releaseDate || ""} onChange={(e)=>update(c.id,"releaseDate",e.target.value)} /> : (c.releaseDate || <span className="helper">Add date</span>)}</td><td className="rowActions"><button className="button" onClick={()=>setEditingId(editingId===c.id ? null : c.id)}>{editingId===c.id ? "Save" : "Edit"}</button><button className="button" onClick={()=>del(c.id)}>Delete</button></td></tr>)}</tbody></table></div>
        )}
      </SectionCard>
    </div>
  );
}
