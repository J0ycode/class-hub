import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProgress } from "@/lib/db";
import { allVideos, getCatalogue } from "@/lib/catalogue";
import { fmtDuration, fmtHours, subjectStats, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireUser();
  const cat = getCatalogue();
  const progress = await getProgress(user.id);
  const flat = allVideos(cat);

  const recent = flat
    .filter(({ video }) => progress[video.id])
    .sort((a, b) => (progress[b.video.id]?.updatedAt ?? 0) - (progress[a.video.id]?.updatedAt ?? 0))
    .slice(0, 25);

  const totalWatched = flat.reduce((acc, { video }) => {
    const p = progress[video.id];
    return acc + (p ? Math.min(p.watched || 0, video.duration || p.duration || 0) : 0);
  }, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Report</div>
          <h1>Your progress</h1>
          <p className="sub">
            {fmtHours(totalWatched)} watched across {cat.totalVideos} classes.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 26 }}>
        <div className="note-row" style={{ borderTop: 0, fontWeight: 600, color: "var(--muted-2)", fontSize: 12 }}>
          <span style={{ flex: 1 }}>SUBJECT</span>
          <span style={{ width: 90, textAlign: "right" }}>DONE</span>
          <span style={{ width: 90, textAlign: "right" }}>WATCHED</span>
          <span style={{ width: 160 }}>PROGRESS</span>
        </div>
        {cat.subjects.map((s) => {
          const st = subjectStats(s, progress);
          return (
            <Link key={s.id} href={`/subjects/${s.id}`} className="note-row">
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.name}
              </span>
              <span style={{ width: 90, textAlign: "right" }} className="tiny">
                {st.done}/{s.videoCount}
              </span>
              <span style={{ width: 90, textAlign: "right" }} className="tiny">
                {fmtHours(st.watchedSeconds)}
              </span>
              <span style={{ width: 160, display: "flex", alignItems: "center", gap: 8 }}>
                <span className="bar" style={{ flex: 1 }}>
                  <span style={{ width: `${st.percent}%` }} />
                </span>
                <span className="tiny" style={{ width: 34, textAlign: "right" }}>
                  {st.percent}%
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="section-head">
        <h2 style={{ margin: 0 }}>Recent activity</h2>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {recent.length === 0 && <div className="empty">Nothing watched yet — open a subject to begin.</div>}
        {recent.map(({ video, subject, module }) => {
          const p = progress[video.id];
          return (
            <Link key={video.id} href={`/watch/${video.id}`} className="note-row">
              <span className="chip" style={{ minWidth: 52, textAlign: "center" }}>
                {video.label}
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {video.title}
              </span>
              <span className="tiny" style={{ width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {subject.name}
              </span>
              <span className="tiny" style={{ width: 70, textAlign: "right" }}>
                {p.completed ? "done" : `${p.percent}%`}
              </span>
              <span className="tiny" style={{ width: 90, textAlign: "right" }}>
                {timeAgo(p.updatedAt)}
              </span>
              <span className="tiny" style={{ width: 60, textAlign: "right" }}>
                {fmtDuration(p.watched)}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
