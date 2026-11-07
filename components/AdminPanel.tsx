"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtHours, timeAgo } from "@/lib/format";

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  createdAt: number;
  lastLoginAt: number | null;
  online: boolean;
  done: number;
  watchedSeconds: number;
};

type Msg = { kind: "ok" | "error"; text: string } | null;

export default function AdminPanel({
  users,
  videoCount,
  currentUserId,
}: {
  users: AdminUserRow[];
  videoCount: number;
  currentUserId: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ displayName: "", username: "", password: "", role: "user" });

  async function request(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await request("/api/admin/users", "POST", form);
      setMsg({ kind: "ok", text: `Account "${form.username}" created.` });
      setForm({ displayName: "", username: "", password: "", role: "user" });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMsg(null);
    try {
      await request(`/api/admin/users/${id}`, "PATCH", { action, ...extra });
      setMsg({ kind: "ok", text: "Updated." });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(user: AdminUserRow) {
    const password = window.prompt(`New password for "${user.username}" (min 8 characters):`);
    if (!password) return;
    if (password.length < 8) {
      setMsg({ kind: "error", text: "Password must be at least 8 characters." });
      return;
    }
    await act(user.id, "resetPassword", { password });
  }

  async function removeUser(user: AdminUserRow) {
    if (!window.confirm(`Delete "${user.username}"? Their watch progress will be lost.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await request(`/api/admin/users/${user.id}`, "DELETE");
      setMsg({ kind: "ok", text: `Deleted "${user.username}".` });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ marginBottom: 4 }}>Add a user</h2>
        <p className="tiny" style={{ marginTop: 0, marginBottom: 16 }}>
          Give someone their own login. Each user account can be signed in on one device at a time; admins on up to three.
        </p>
        <form onSubmit={createUser} className="admin-form">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="new-name">Name</label>
            <input
              id="new-name"
              className="input"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="Arhith"
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="new-username">Username</label>
            <input
              id="new-username"
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="arhith"
              required
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="new-password">Password</label>
            <input
              id="new-password"
              className="input"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="at least 8 characters"
              minLength={8}
              required
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="new-role">Role</label>
            <select
              id="new-role"
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Working…" : "Add user"}
          </button>
        </form>
        {msg ? <div className={msg.kind === "error" ? "error" : "notice"} style={{ marginTop: 14, marginBottom: 0 }}>{msg.text}</div> : null}
      </div>

      <div className="admin-table">
        <div className="admin-head">
          <span>Account</span>
          <span>Status</span>
          <span>Watched</span>
          <span>Last login</span>
          <span style={{ textAlign: "right" }}>Actions</span>
        </div>
        {users.map((u) => {
          const self = u.id === currentUserId;
          return (
            <div key={u.id} className="admin-row">
              <div style={{ minWidth: 0 }}>
                <div className="row-between" style={{ justifyContent: "flex-start", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName}</span>
                  {u.role === "admin" ? <span className="chip gold">admin</span> : null}
                  {self ? <span className="chip">you</span> : null}
                </div>
                <div className="tiny">@{u.username} · joined {timeAgo(u.createdAt)}</div>
              </div>

              <div>
                {u.online ? <span className="chip good">signed in</span> : <span className="chip">offline</span>}
              </div>

              <div className="tiny">
                {u.done}/{videoCount} classes
                <div style={{ marginTop: 2 }}>{fmtHours(u.watchedSeconds)} watched</div>
              </div>

              <div className="tiny">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "never"}</div>

              <div className="admin-actions">
                {u.online ? (
                  <button className="btn sm ghost" disabled={busy} onClick={() => act(u.id, "signOut")}>
                    Sign out device
                  </button>
                ) : null}
                <button className="btn sm ghost" disabled={busy} onClick={() => resetPassword(u)}>
                  Reset password
                </button>
                {!self ? (
                  <button
                    className="btn sm ghost"
                    disabled={busy}
                    onClick={() => act(u.id, "role", { role: u.role === "admin" ? "user" : "admin" })}
                  >
                    {u.role === "admin" ? "Make user" : "Make admin"}
                  </button>
                ) : null}
                {!self ? (
                  <button className="btn sm danger" disabled={busy} onClick={() => removeUser(u)}>
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
