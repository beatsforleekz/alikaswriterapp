import { ReactNode } from "react";

export default function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="emptyState">
      <p className="emptyTitle">{title}</p>
      {hint ? <p className="helper">{hint}</p> : null}
      {action ? <div className="rowActions">{action}</div> : null}
    </div>
  );
}
