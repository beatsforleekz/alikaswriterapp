import { ReactNode } from "react";

export default function StatCard({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <article className="statCard">
      <p className="statLabel">{label}</p>
      <p className="statValue">{value}</p>
      {note ? <p className="helper">{note}</p> : null}
    </article>
  );
}
