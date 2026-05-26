type SplitRow = {
  id: string;
  song_id: string;
  song_title: string;
  writer_name: string;
  role?: string | null;
  percentage?: number | null;
};

type AddModel = {
  songId: string;
  writerName: string;
  splitPct: string;
  setSongId: (v: string) => void;
  setWriterName: (v: string) => void;
  setSplitPct: (v: string) => void;
  onAdd: () => void;
  writerOptions: string[];
  songOptions?: Array<{ id: string; title: string }>;
};

export default function WriterSplitPanel({
  rows,
  addModel,
  onEdit,
  onDelete,
}: {
  rows: SplitRow[];
  addModel?: AddModel;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const totalsBySong = rows.reduce<Record<string, number>>((acc, row) => {
    const pct = row.percentage ?? 0;
    acc[row.song_id] = (acc[row.song_id] ?? 0) + pct;
    return acc;
  }, {});

  return (
    <div>
      {addModel ? (
        <div className="rowActions compact" style={{ marginBottom: ".55rem" }}>
          <select value={addModel.songId} onChange={(e) => addModel.setSongId(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">Select song</option>
            {(addModel.songOptions?.length ? addModel.songOptions : Object.entries(rows.reduce<Record<string, string>>((acc, r) => { acc[r.song_id] = r.song_title; return acc; }, {})).map(([id, title]) => ({ id, title }))).map(({ id, title }) => (
              <option key={id} value={id}>{title || "Untitled"}</option>
            ))}
          </select>
          <input list="writer-shared-dir" value={addModel.writerName} onChange={(e) => addModel.setWriterName(e.target.value)} placeholder="Writer name" style={{ minWidth: 180 }} />
          <input value={addModel.splitPct} onChange={(e) => addModel.setSplitPct(e.target.value)} placeholder="Split %" style={{ maxWidth: 100 }} />
          <button className="button primary compact" onClick={addModel.onAdd}>Add Writer/Split</button>
          <datalist id="writer-shared-dir">{addModel.writerOptions.map((name) => <option key={name} value={name} />)}</datalist>
        </div>
      ) : null}

      {rows.length === 0 ? <p className="helper">No writer split rows yet.</p> : (
        <>
          <div className="rowActions compact" style={{ marginBottom: ".45rem", flexWrap: "wrap" }}>
            {Object.entries(totalsBySong).map(([songId, total]) => (
              <span key={songId} className={`statusBadge ${Math.round(total) === 100 ? "sage" : "amber"}`}>{rows.find((r) => r.song_id === songId)?.song_title || "Song"}: {total.toFixed(2)}%</span>
            ))}
          </div>
          <div className="tableWrap desktopOnly">
            <table>
              <thead><tr><th>Song</th><th>Writer</th><th>Role</th><th>Split</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.song_title || "Untitled"}</td>
                    <td>{row.writer_name}</td>
                    <td>{row.role || <span className="helper">No role</span>}</td>
                    <td>{row.percentage ?? <span className="helper">auto</span>}</td>
                    <td>
                      <div className="rowActions compact">
                        {onEdit ? <button className="button compact" onClick={() => onEdit(row.id)}>Edit</button> : null}
                        {onDelete ? <button className="button compact" onClick={() => onDelete(row.id)}>Delete</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobileOnly mobileCardList">
            {rows.map((row) => (
              <div key={`mobile-split-${row.id}`} className="mobileDataCard">
                <h4>{row.song_title || "Untitled"}</h4>
                <p className="helper">{row.writer_name} · {row.role || "No role"} · {row.percentage ?? "auto"}%</p>
                <div className="rowActions compact" style={{ marginTop: ".4rem" }}>
                  {onEdit ? <button className="button compact" onClick={() => onEdit(row.id)}>Edit</button> : null}
                  {onDelete ? <button className="button compact" onClick={() => onDelete(row.id)}>Delete</button> : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
