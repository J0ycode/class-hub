"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import InstallButton from "@/components/InstallButton";

type Props = {
  displayName: string;
  username: string;
  initials: string;
  role: "admin" | "user";
};

const links = [
  { href: "/", label: "Dashboard", icon: "◧" },
  { href: "/subjects", label: "Subjects", icon: "▦" },
  { href: "/notes", label: "Notes", icon: "▤" },
  { href: "/progress", label: "Progress", icon: "◎" },
];

const adminLink = { href: "/admin", label: "Admin", icon: "⚙" };

export default function Sidebar({ displayName, username, initials, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark photo">
          <Image src="/icons/icon-192.png" alt="" width={34} height={34} priority />
        </div>
        <div>
          <div className="brand-name">Class Hub</div>
          <div className="brand-sub">S3 Earth CSE</div>
        </div>
      </div>

      <nav className="nav">
        {[...links, ...(role === "admin" ? [adminLink] : [])].map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={active ? "active" : ""}>
              <span className="ico">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="user-name">{displayName}</div>
            <div className="user-role">@{username}</div>
          </div>
        </div>
        <InstallButton />
        <button className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={logout} disabled={busy}>
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
