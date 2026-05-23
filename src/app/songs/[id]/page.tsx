"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { mapSong } from "@/lib/mappers";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { logSupabaseError, supabaseUserMessage } from "@/lib/supabaseError";

export default function SongDetail() {
  const params = useParams<{ id: string }>();
  const [song, setSong] = useState<ReturnType<typeof mapSong> | null>(null);
  const [sessionRef, setSessionRef] = useState<{ id: string; title: string; date: string } | null>(null);
  const [assets, setAssets] = useState<Array<{ id: string; type: string; url?: string | null }>>([]);
  const [splits, setSplits] = useState<Array<{ id: string; percentage?: number | null; role?: string | null; writer_name: string }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: songData, error: songErr } = await supabase.from("song_works").select("*").eq("id", params.id).single();
      if (songErr || !songData) {
        logSupabaseError("Failed to load song detail library view", songErr);
        setError(supabaseUserMessage("Could not load song/work", songErr));
        return;
      }
      const mapped = mapSong(songData as Record<string, unknown>);
      setSong(mapped);

      if (mapped.sessionId) {
        const { data: sData } = await supabase.from("sessions").select("id,title,date").eq("id", mapped.sessionId).single();
        if (sData) setSessionRef({ id: String(sData.id), title: String(sData.title ?? ""), date: String(sData.date ?? "") });
      }

      const { data: aData } = await supabase.from("asset_links").select("id,type,url").eq("song_id", params.id);
      setAssets((aData ?? []) as Array<{ id: string; type: string; url?: string | null }>);

      const { data: splitRows, error: splitErr } = await supabase
        .from("song_writer_splits")
        .select("id,percentage,role,writers(name)")
        .eq("song_id", params.id);
      if (splitErr) {
        logSupabaseError("Failed to load song writer splits", splitErr);
        setError(supabaseUserMessage("Could not load writer splits", splitErr));
      } else {
        setSplits(
          (splitRows ?? []).map((row) => {
            const r = row as { id: string; percentage?: number | null; role?: string | null; writers?: { name?: string } | null };
            return { id: String(r.id), percentage: r.percentage ?? null, role: r.role ?? null, writer_name: String(r.writers?.name ?? "Unknown") };
          }),
        );
      }
    };
    load();
  }, [params.id]);

  if (!song) return <div className="helper">Song not found.</div>;

  return (
    <div>
      <PageHeader title={song.title || "Untitled Song"} subtitle="Library view. Manage this song from its Session workspace." actions={sessionRef ? <Link className="button primary" href={`/sessions/${sessionRef.id}`}>Open Session Workspace</Link> : undefined} />
      {error ? <p className="helper" style={{ color: "#8a3d3d", marginBottom: ".7rem" }}>{error}</p> : null}

      <SectionCard title="Overview">
        <div className="kv">
          <dt>Status</dt><dd><StatusBadge label={song.status} /></dd>
          <dt>Session</dt><dd>{sessionRef ? <Link href={`/sessions/${sessionRef.id}`}>{sessionRef.date} - {sessionRef.title || "Untitled Session"}</Link> : <span className="helper">Unlinked session</span>}</dd>
          <dt>Notes</dt><dd>{song.notes || <span className="helper">No notes</span>}</dd>
        </div>
      </SectionCard>

      <SectionCard title="Evidence">
        {assets.length === 0 ? <p className="helper">No evidence linked.</p> : (
          <div className="tableWrap"><table><thead><tr><th>Type</th><th>Link</th></tr></thead><tbody>{assets.map((a)=><tr key={a.id}><td>{a.type === "bounce" ? "Bounce" : a.type}</td><td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">Open link</a> : <span className="helper">No URL</span>}</td></tr>)}</tbody></table></div>
        )}
      </SectionCard>

      <SectionCard title="Writers / Splits">
        {splits.length === 0 ? <p className="helper">No writer split rows yet.</p> : (
          <div className="tableWrap"><table><thead><tr><th>Writer</th><th>Role</th><th>Split %</th></tr></thead><tbody>{splits.map((split)=><tr key={split.id}><td>{split.writer_name}</td><td>{split.role || <span className="helper">No role</span>}</td><td>{split.percentage ?? <span className="helper">auto</span>}</td></tr>)}</tbody></table></div>
        )}
      </SectionCard>
    </div>
  );
}
