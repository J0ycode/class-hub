import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProgress } from "@/lib/db";
import { findVideo, getCatalogue, notesForModule } from "@/lib/catalogue";
import { fmtDuration } from "@/lib/format";
import Player from "@/components/Player";
import MarkComplete from "@/components/MarkComplete";

export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: { params: Promise<{ vid: string }> }) {
  const user = await requireUser();
  const { vid } = await params;
  const cat = getCatalogue();
  const found = findVideo(cat, vid);
  if (!found) notFound();

  const { subject, module, video, prev, next } = found;
  const progress = await getProgress(user.id);
  const p = progress[video.id];
  const notes = notesForModule(cat, subject.id, module.id);

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        <Link href={`/subjects/${subject.id}`} style={{ color: "inherit" }}>
          {subject.name}
        </Link>{" "}
        / {module.name}
      </div>

      <div className="watch-grid">
        <div>
          <Player
            videoId={video.id}
            yt={video.yt}
            startAt={p && !p.completed ? p.position : 0}
            duration={video.duration}
            initialPercent={p?.percent ?? 0}
          />

          <h1 className="watch-title">
            <span className="chip accent" style={{ marginRight: 10, verticalAlign: "middle" }}>
              {video.label}
            </span>
            {video.title}
          </h1>
          <div className="watch-sub">
            {fmtDuration(video.duration)} · {subject.name}
            {p ? ` · ${p.percent}% watched${p.completed ? " (completed)" : ""}` : " · not started"}
          </div>

          <div className="nav-btns">
            {prev ? (
              <Link className="btn ghost" href={`/watch/${prev.id}`}>
                ← {prev.label}
              </Link>
            ) : (
              <span />
            )}
            <MarkComplete videoId={video.id} duration={video.duration} completed={!!p?.completed} />
            {next ? (
              <Link className="btn primary" href={`/watch/${next.id}`}>
                Next: {next.label} →
              </Link>
            ) : null}
          </div>

          {notes.length > 0 && (
            <div className="card" style={{ marginTop: 24, padding: 0 }}>
              <div style={{ padding: "14px 16px" }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>
                  E-learning materials
                </div>
                <div className="tiny">Notes for {module.name}</div>
              </div>
              {notes.map((n) => (
                <Link key={n.id} className="note-row" href={`/read/notes/${n.id}`} prefetch={false}>
                  <span className="pdf-badge">PDF</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{n.title}</span>
                  <span className="tiny">open</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="side-panel">
          <h3>Up next in {module.name}</h3>
          <div className="playlist">
            {module.videos.map((v) => {
              const vp = progress[v.id];
              return (
                <Link key={v.id} href={`/watch/${v.id}`} className={v.id === video.id ? "current" : ""}>
                  <span className="pl-label">{v.label}</span>
                  <span className="pl-title">{v.title}</span>
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    {vp?.completed ? <span className="pl-dot" /> : null}
                    <span className="tiny">{fmtDuration(v.duration)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
