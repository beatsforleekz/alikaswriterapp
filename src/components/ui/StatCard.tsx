import { ReactNode } from "react";

type Tone = "neutral" | "danger" | "amber" | "success";

export default function StatCard({ label, value, note, tone = "neutral", href }: { label: string; value: ReactNode; note?: string; tone?: Tone; href?: string }) {
  const card = (
    <article className={`statCard ${tone} ${href ? "clickable" : ""}`}>
      <p className="statLabel">{label}</p>
      <p className="statValue">{value}</p>
      {note ? <p className="helper">{note}</p> : null}
    </article>
  );
  if (!href) return card;
  return <a href={href}>{card}</a>;
}
