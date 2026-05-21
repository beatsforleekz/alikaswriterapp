import { ReactNode } from "react";

export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="pageHeader">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="subtle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="rowActions">{actions}</div> : null}
    </div>
  );
}
