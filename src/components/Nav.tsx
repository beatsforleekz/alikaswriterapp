"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/", "Dashboard"],
  ["/archive-progress", "Archive Review"],
  ["/sessions", "Sessions"],
  ["/songs", "Songs / Works"],
  ["/cuts", "Cuts"],
  ["/playlists", "Playlists"],
  ["/exports", "Exports"],
  ["/actions", "Actions"],
  ["/help", "Help"],
] as const;

export default function Nav() {
  const pathname = usePathname();
  if (pathname.startsWith("/pitch/")) return null;
  return (
    <aside className="sidebar">
      <div className="brandWrap">
        <p className="brandScript">Alika</p>
        <p className="brandMain">Alika&apos;s Writing App</p>
      </div>
      <nav className="sideNav">
        {links.map(([href, label]) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`sideLink ${active ? "active" : ""}`}>
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
