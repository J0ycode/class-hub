"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { TeacherNote } from "@/lib/db";
import { timeAgo } from "@/lib/format";

const MODULES = [1, 2, 3, 4];
const MAX_MB = 25;

function fmtSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function UploadForm({ subjectId, moduleNo }: { subjectId: string; moduleNo: number }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setMsg({ kind: "error", text: "Choose a PDF file first." });
    if (file.size > MAX_MB * 1024 * 1024) return setMsg({ kind: "error", text: `PDF must be ${MAX_MB} MB or smaller.` });

    const body = new FormData();
    body.set("subjectId", subjectId);
    body.set("module", String(moduleNo));
    body.set("title", title);
    body.set("file", file);

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/teacher-notes", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      setMsg({ kind: "ok", text: "Uploaded." });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={upload}>
      <input
        className="input"
        placeholder="Title (optional, defaults to file name)"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        aria-label={`Title for module ${moduleNo} upload`}
      />
      <input ref={fileRef} className="input file-input" type="file" accept="application/pdf,.pdf" aria-label={`PDF for module ${moduleNo}`} />
      <button className="btn primary sm" type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload PDF"}
      </button>
      {msg ? <div className={`tiny upload-msg ${msg.kind}`}>{msg.text}</div> : null}
    </form>
  );
}

export default function TeacherMaterials({
  subjectId,
  notes,
  canManage,
}: {
  subjectId: string;
  notes: TeacherNote[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(note: TeacherNote) {
    if (!window.confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    setDeleting(note.id);
    try {
      const res = await fetch(`/api/teacher-notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? "Could not delete.");
      }
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  // Module 0 is the General folder (lab manuals, syllabus); shown only when it has files.
  const sections = notes.some((n) => n.module === 0) ? [...MODULES, 0] : MODULES;

  return (
    <>
      {sections.map((m, i) => {
        const items = notes.filter((n) => n.module === m);
        return (
          <details key={m} className="module" open={i === 0}>
            <summary>
              <div className="mod-num" aria-hidden="true">
                {m === 0 ? "G" : m}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="mod-name">{m === 0 ? "General" : `Module ${m}`}</div>
                <div className="mod-sub">
                  {items.length === 0 ? "No teacher notes yet" : `${items.length} ${items.length === 1 ? "note" : "notes"}`}
                </div>
              </div>
              <div className="mod-right">
                <span className="caret">▾</span>
              </div>
            </summary>

            {items.map((n, idx) => (
              <div key={n.id} className="note-row">
                <span className="note-idx">{String(idx + 1).padStart(2, "0")}</span>
                <a className="note-title" href={`/api/teacher-notes/${n.id}`} target="_blank" rel="noreferrer">
                  {n.title}
                  <span className="tiny" style={{ display: "block", marginTop: 2 }}>
                    {fmtSize(n.size)} · by @{n.uploadedBy} · {timeAgo(n.uploadedAt)}
                  </span>
                </a>
                <span className="pdf-badge">PDF</span>
                {canManage ? (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => remove(n)}
                    disabled={deleting === n.id}
                    aria-label={`Delete ${n.title}`}
                    title="Delete"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h16" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M6 7l1 13h10l1-13" />
                      <path d="M9 7V4h6v3" />
                    </svg>
                  </button>
                ) : null}
              </div>
            ))}

            {items.length === 0 && !canManage ? <div className="note-row tiny">Your teacher hasn’t added notes here yet.</div> : null}
            {canManage && m > 0 ? <UploadForm subjectId={subjectId} moduleNo={m} /> : null}
          </details>
        );
      })}
    </>
  );
}
