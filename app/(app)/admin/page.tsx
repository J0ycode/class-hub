import { requireAdmin } from "@/lib/auth";
import { getProgress, listUsers } from "@/lib/db";
import { allVideos, getCatalogue } from "@/lib/catalogue";
import AdminPanel, { type AdminUserRow } from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();
  const cat = getCatalogue();
  const flat = allVideos(cat);

  const users = await listUsers();
  const rows: AdminUserRow[] = await Promise.all(
    users.map(async (u) => {
      const progress = await getProgress(u.id);
      let done = 0;
      let watchedSeconds = 0;
      for (const { video } of flat) {
        const p = progress[video.id];
        if (!p) continue;
        if (p.completed) done++;
        watchedSeconds += Math.min(p.watched || 0, video.duration || p.duration || 0);
      }
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt ?? null,
        online: !!u.sessionId,
        done,
        watchedSeconds,
      };
    }),
  );

  rows.sort((a, b) => {
    if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
    return a.username.localeCompare(b.username);
  });

  const online = rows.filter((r) => r.online).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>User accounts</h1>
          <p className="sub">
            {rows.length} {rows.length === 1 ? "account" : "accounts"} · {online} signed in right now · one device per account
          </p>
        </div>
      </div>

      <div className="grid stats" style={{ marginBottom: 22 }}>
        <div className="card">
          <div className="stat-label">Accounts</div>
          <div className="stat-value">{rows.length}</div>
          <div className="stat-note">{rows.filter((r) => r.role === "admin").length} admin</div>
        </div>
        <div className="card">
          <div className="stat-label">Signed in</div>
          <div className="stat-value">{online}</div>
          <div className="stat-note">active devices</div>
        </div>
        <div className="card">
          <div className="stat-label">Total watch time</div>
          <div className="stat-value">
            {Math.round(rows.reduce((n, r) => n + r.watchedSeconds, 0) / 3600)}
            <span style={{ fontSize: 15, color: "var(--muted-2)", fontWeight: 600 }}> h</span>
          </div>
          <div className="stat-note">across all accounts</div>
        </div>
        <div className="card">
          <div className="stat-label">Library</div>
          <div className="stat-value">{cat.totalVideos}</div>
          <div className="stat-note">{cat.notes.length} notes available</div>
        </div>
      </div>

      <AdminPanel users={rows} videoCount={cat.totalVideos} currentUserId={admin.id} />
    </>
  );
}
