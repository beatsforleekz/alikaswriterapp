import { evidenceTypeLabel, summarizeMissingEvidence } from "@/lib/evidence";

type SongRef = { id: string; title?: string | null };
type AssetRef = { id: string; song_id: string; type: string; url?: string | null };

type AddModel = {
  songId: string;
  type: string;
  url: string;
  setSongId: (v: string) => void;
  setType: (v: string) => void;
  setUrl: (v: string) => void;
  onAdd: () => void;
};

export default function EvidenceHub({
  title = "Evidence Hub",
  songs,
  assets,
  addModel,
  onDelete,
  onEditType,
  onEditUrl,
}: {
  title?: string;
  songs: SongRef[];
  assets: AssetRef[];
  addModel?: AddModel;
  onDelete?: (id: string) => void;
  onEditType?: (id: string, nextType: string) => void;
  onEditUrl?: (id: string, nextUrl: string) => void;
}) {
  const bounces = assets.filter((a) => evidenceTypeLabel(a.type) === "Bounce");
  const lyrics = assets.filter((a) => evidenceTypeLabel(a.type) === "Lyrics");
  const otherEvidence = assets.filter((a) => {
    const label = evidenceTypeLabel(a.type);
    return label !== "Bounce" && label !== "Lyrics";
  });

  const renderAssetList = (sectionAssets: AssetRef[]) => {
    if (!sectionAssets.length) return <p className="helper">None yet.</p>;
    return (
      <>
        <div className="tableWrap desktopOnly">
          <table>
            <thead><tr><th>Song</th><th>Type</th><th>Link</th><th>Actions</th></tr></thead>
            <tbody>
              {sectionAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>{songs.find((s) => s.id === asset.song_id)?.title || "Untitled"}</td>
                  <td>{evidenceTypeLabel(asset.type)}</td>
                  <td>{asset.url ? <a href={asset.url} target="_blank" rel="noreferrer">Open</a> : <span className="helper">No link</span>}</td>
                  <td>
                    <div className="rowActions compact">
                      {onEditType ? <button className="button compact" onClick={() => { const next = window.prompt("Update evidence type", asset.type); if (next !== null) onEditType(asset.id, next); }}>Edit Type</button> : null}
                      {onEditUrl ? <button className="button compact" onClick={() => { const next = window.prompt("Update evidence link", asset.url || ""); if (next !== null) onEditUrl(asset.id, next); }}>Edit Link</button> : null}
                      {onDelete ? <button className="button compact" onClick={() => onDelete(asset.id)}>Delete</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const summary = summarizeMissingEvidence(
    songs.map((s) => ({ id: s.id, title: s.title || "" })),
    assets.map((a) => ({ id: a.id, song_id: a.song_id, type: a.type, url: a.url })),
  );

  return (
    <div>
      <div className="rowActions" style={{ justifyContent: "space-between", marginBottom: ".5rem" }}>
        <h3 style={{ color: "var(--text)", fontSize: ".95rem" }}>{title}</h3>
        <div className="rowActions compact">
          <span className={`statusBadge ${summary.missingBounce > 0 ? "amber" : "sage"}`}>{summary.total - summary.missingBounce}/{summary.total} Bounce</span>
          <span className={`statusBadge ${summary.missingLyrics > 0 ? "amber" : "sage"}`}>{summary.total - summary.missingLyrics}/{summary.total} Lyrics</span>
        </div>
      </div>

      {addModel ? (
        <div className="rowActions compact" style={{ marginBottom: ".55rem" }}>
          <select value={addModel.songId} onChange={(e) => addModel.setSongId(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">Select song</option>
            {songs.map((song) => <option key={song.id} value={song.id}>{song.title || "Untitled"}</option>)}
          </select>
          <select value={addModel.type} onChange={(e) => addModel.setType(e.target.value)} style={{ minWidth: 160 }}>
            <option value="bounce">Bounce</option><option value="lyrics">Lyrics</option><option value="acapella">Acapella</option>
            <option value="voice_note">Voice Note</option><option value="apple_note">Apple Note</option><option value="google_doc">Google Doc</option><option value="dropbox">Dropbox</option>
            <option value="message_evidence">Email/Pitch Trail</option><option value="screenshots">Screenshots</option><option value="other">Other</option>
          </select>
          <input value={addModel.url} onChange={(e) => addModel.setUrl(e.target.value)} placeholder="https://..." style={{ minWidth: 220 }} />
          <button className="button primary compact" onClick={addModel.onAdd}>Add Evidence</button>
        </div>
      ) : null}

      {assets.length === 0 ? <p className="helper">No evidence linked yet.</p> : (
        <div className="grid" style={{ gap: ".65rem" }}>
          <div>
            <h4 style={{ marginBottom: ".35rem" }}>Bounces</h4>
            {renderAssetList(bounces)}
          </div>
          <div>
            <h4 style={{ marginBottom: ".35rem" }}>Lyrics</h4>
            {renderAssetList(lyrics)}
          </div>
          <div>
            <h4 style={{ marginBottom: ".35rem" }}>Other Evidence</h4>
            {renderAssetList(otherEvidence)}
          </div>
        </div>
      )}
    </div>
  );
}
