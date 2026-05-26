import Link from "next/link";

export type ReadinessItem = {
  id: string;
  title: string;
  type: "song" | "session";
  status: "Ready to Pitch" | "Needs Bounce" | "Needs Lyrics" | "Needs Writers/Splits" | "Needs Follow-up";
  href: string;
  context?: string;
};

export default function ReadinessPipeline({ items, title = "Readiness Pipeline" }: { items: ReadinessItem[]; title?: string }) {
  if (!items.length) return <p className="helper">No readiness items yet.</p>;
  return (
    <div>
      <h3 style={{ color: "var(--text)", fontSize: ".95rem", marginBottom: ".55rem" }}>{title}</h3>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Item</th><th>Type</th><th>Status</th><th>Context</th><th>Action</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.title || "Untitled"}</td>
                <td>{item.type}</td>
                <td><span className={`statusBadge ${item.status === "Ready to Pitch" ? "sage" : item.status === "Needs Follow-up" ? "amber" : "rose"}`}>{item.status}</span></td>
                <td>{item.context || <span className="helper">-</span>}</td>
                <td><Link className="button compact" href={item.href}>Fix</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
