"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  ["/", "Dashboard"],
  ["/archive-progress", "Archive Review"],
  ["/sessions", "Sessions"],
  ["/songs", "Songs / Works"],
  ["/cuts", "Cuts"],
  ["/playlists", "Playlists"],
  ["/exports", "Exports"],
  ["/actions", "Actions"],
  ["/progress-hub", "Progress Hub"],
  ["/settings", "Settings"],
  ["/help", "Help"],
] as const;

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (pathname.startsWith("/pitch/") || pathname.startsWith("/login")) return null;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <aside className="sidebar">
      <div className="brandWrap navTopBar">
        <div>
          <p className="brandScript">Alika</p>
          <p className="brandMain">Alika&apos;s Writing App</p>
        </div>
        <button
          type="button"
          className="navToggle"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          ☰
        </button>
      </div>
      <nav className={`sideNav ${mobileOpen ? "open" : "collapsed"}`}>
        {links.map(([href, label]) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`sideLink ${active ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div style={{ marginTop: "1rem" }}>
        <button type="button" className="button compact" onClick={logout}>Lock App</button>
      </div>
    </aside>
  );
}
