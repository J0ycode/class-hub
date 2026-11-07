import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProgress } from "@/lib/db";
import { getCatalogue, notesForModule } from "@/lib/catalogue";
import { fmtDuration, fmtHours, moduleStats, subjectStats } from "@/lib/format";

export const dynamic = "force-dynamic";

type Filter = "all" | "unwatched" | "progress" | "done";

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { filter: rawFilter } = await searchParams;
  const filter: Filter = (["all", "unwatched", "progress", "done"].includes(rawFilter ?? "")
    ? rawFilter
    : "all") as Filter;

  const cat = getCatalogue();
  const subject = cat.subjects.find((s) => s.id === id);
  if (!subject) notFound();

  const progress = await getProgress(user.id);
  const st = subjectStats(subject, progress);

  function visible(videoId: string) {
    const p = progress[videoId];
    if (filter === "all") return true;
    if (filter === "unwatched") return !p || p.percent === 0;
    if (filter === "progress") return !!p && p.percent > 0 && !p.completed;
    if (filter === "done") return !!p?.completed;
    return true;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link href="/subjects" style={{ color: "inherit" }}>
              Subjects
            </Link>{" "}
            / {subject.course}
          </div>
          <h1>{subject.name}</h1>
          <p className="sub">
            {subject.code ? `${subject.code} · ` : ""}
            {subject.modules.length} modules · {subject.videoCount} videos · {fmtHours(subject.totalSeconds)}
          </p>
        </div>
        <div style={{ minWidth: 220 }}>
          <div className="row-between tiny" style={{ marginBottom: 6 }}>
            <span>Progress</span>
            <span>{st.percent}%</span>
          </div>
          <div className="bar">
            <span style={{ width: `${st.percent}%` }} />
          </div>
          <div className="tiny" style={{ marginTop: 6 }}>
            {st.done} done · {st.started} in progress · {fmtHours(st.watchedSeconds)} watched
          </div>
        </div>
      </div>

      <div className="filters">
        {(
          [
            ["all", "All classes"],
            ["unwatched", "Not started"],
            ["progress", "In progress"],
            ["done", "Completed"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <Link
            key={key}
            href={key === "all" ? `/subjects/${subject.id}` : `/subjects/${subject.id}?filter=${key}`}
            className={`filter ${filter === key ? "on" : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {subject.modules.map((m) => {
        const videos = m.videos.filter((v) => visible(v.id));
        if (videos.length === 0) return null;
        const ms = moduleStats(subject, m.id, progress);
        const notes = notesForModule(cat, subject.id, m.id);

        return (
          <details key={m.id} className="module" open={filter !== "all" || m === subject.modules[0]}>
            <summary>
              <div>
                <div className="mod-name">{m.name}</div>
                <div className="mod-sub">
                  {ms.total} videos · {ms.done} completed{notes.length ? ` · ${notes.length} notes` : ""}
                </div>
              </div>
              <div className="mod-right">
                <div className="bar" style={{ width: 90 }}>
                  <span style={{ width: `${ms.percent}%` }} />
                </div>
                <span className="mini">{ms.percent}%</span>
                <span className="caret">▾</span>
              </div>
            </summary>

            {videos.map((v) => {
              const p = progress[v.id];
              const pct = p?.percent ?? 0;
              return (
                <Link key={v.id} href={`/watch/${v.id}`} className="video-row">
                  <span className="v-label">{v.label}</span>
                  <span className="v-main">
                    <span className="v-title" style={{ display: "block" }}>
                      {v.title}
                    </span>
                    <span className="v-meta">
                      <span>{fmtDuration(v.duration)}</span>
                      {p?.completed ? <span style={{ color: "var(--good)" }}>✓ Completed</span> : null}
                      {!p?.completed && pct > 0 ? <span style={{ color: "var(--gold)" }}>{pct}% watched</span> : null}
                    </span>
                  </span>
                  <span className="v-right">
                    <span className="bar v-bar">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className="mini" style={{ width: 12, textAlign: "right" }}>
                      {p?.completed ? "✓" : ""}
                    </span>
                  </span>
                </Link>
              );
            })}

            {notes.length > 0 && (
              <div style={{ padding: "10px 18px 14px", borderTop: "1px solid var(--line-soft)", background: "rgba(255,255,255,0.015)" }}>
                <div className="tiny" style={{ marginBottom: 6 }}>
                  E-LEARNING MATERIALS
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {notes.map((n) => (
                    <a key={n.id} className="chip" href={`/api/materials/${n.id}`} target="_blank" rel="noreferrer">
                      ▤ {n.title.replace(/\s*-\s*M\d+\s*$/i, "")}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </details>
        );
      })}

      {subject.modules.every((m) => m.videos.filter((v) => visible(v.id)).length === 0) && (
        <div className="empty">No classes match this filter.</div>
      )}
    </>
  );
}
