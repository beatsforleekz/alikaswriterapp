import { ReactNode } from "react";

export default function SectionCard({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="sectionCard">
      {title || actions ? (
        <div className="sectionCardHead">
          {title ? <h2>{title}</h2> : <span />}
          {actions ? <div className="rowActions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
