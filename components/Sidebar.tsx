"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import InstallButton from "@/components/InstallButton";

type Props = {
  displayName: string;
  username: string;
  initials: string;
  role: "admin" | "user";
};

// 24px line icons, stroked with currentColor so they follow the link colour.
const ICON_PATHS: Record<string, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"],
  book: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"],
  notes: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5", "M9 13h6", "M9 17h4"],
  chart: ["M3 3v18h18", "M7 15l4-4 3 3 5-6"],
  shield: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

type NavLink = { href: string; label: string; short: string; icon: string };

const studyLinks: NavLink[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: "home" },
  { href: "/subjects", label: "Subjects", short: "Subjects", icon: "book" },
  { href: "/notes", label: "Notes", short: "Notes", icon: "notes" },
  { href: "/progress", label: "Progress", short: "Progress", icon: "chart" },
];

const adminLink: NavLink = { href: "/admin", label: "Admin", short: "Admin", icon: "shield" };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function Sidebar({ displayName, username, initials, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the mobile account menu on navigation, outside tap, or Escape.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const renderLink = (l: NavLink) => {
    const active = isActive(pathname, l.href);
    return (
      <Link key={l.href} href={l.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
        <span className="ico">
          <Icon name={l.icon} />
        </span>
        {l.label}
      </Link>
    );
  };

  const tabLinks = role === "admin" ? [...studyLinks, adminLink] : studyLinks;

  return (
    <>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Class Hub home">
          <div className="brand-mark photo">
            <Image src="/icons/icon-192.png" alt="" width={38} height={38} priority />
          </div>
          <div>
            <div className="brand-name">Class Hub</div>
            <div className="brand-sub">S3 Earth CSE</div>
          </div>
        </Link>

        <nav className="nav" aria-label="Main">
          <div className="nav-group">
            <div className="nav-label">Study</div>
            {studyLinks.map(renderLink)}
          </div>
          {role === "admin" ? (
            <div className="nav-group">
              <div className="nav-label">Manage</div>
              {renderLink(adminLink)}
            </div>
          ) : null}
        </nav>

        <div className="sidebar-foot" ref={menuRef}>
          {/* Desktop: account card. Mobile: avatar button that opens the account menu. */}
          <button
            type="button"
            className="account-trigger"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="avatar">{initials}</span>
          </button>

          <div className={`account${menuOpen ? " open" : ""}`}>
            <div className="user-chip">
              <div className="avatar">{initials}</div>
              <div className="user-meta">
                <div className="user-name">{displayName}</div>
                <div className="user-role">
                  @{username}
                  {role === "admin" ? <span className="role-pill">Admin</span> : null}
                </div>
              </div>
              <button type="button" className="icon-btn" onClick={logout} disabled={busy} aria-label="Sign out" title="Sign out">
                <Icon name="logout" />
              </button>
            </div>
            <InstallButton />
            <button type="button" className="btn ghost signout-full" onClick={logout} disabled={busy}>
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar (hidden on desktop). Kept outside the sidebar so
          its fixed positioning isn't trapped by the sidebar's backdrop-filter. */}
      <nav className="tabbar" aria-label="Main">
        {tabLinks.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link key={l.href} href={l.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <Icon name={l.icon} />
              <span>{l.short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
