import { ReactNode } from "react";

export default function FilterBar({ children }: { children: ReactNode }) {
  return <div className="filterBar">{children}</div>;
}
