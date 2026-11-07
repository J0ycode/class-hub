import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProgress } from "@/lib/db";
import { allVideos, getCatalogue } from "@/lib/catalogue";
import { fmtDuration, fmtHours, subjectStats, timeAgo } from "@/lib/format";
import { dailyQuote, greeting, studyStreak } from "@/lib/study";
import SubjectSticker from "@/components/SubjectSticker";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const cat = getCatalogue();
  const progress = await getProgress(user.id);
  const flat = allVideos(cat);

  let done = 0;
  let inProgress = 0;
  let watchedSeconds = 0;

  for (const { video } of flat) {
    const p = progress[video.id];
    if (!p) continue;
    if (p.completed) done++;
    else if (p.percent > 0) inProgress++;
    watchedSeconds += Math.min(p.watched || 0, video.duration || p.duration || 0);
  }

  const overall = cat.totalVideos ? Math.round(((done + inProgress * 0.5) / cat.totalVideos) * 100) : 0;

  const continueItems = flat
    .filter(({ video }) => {
      const p = progress[video.id];
      return p && !p.completed && p.percent > 0 && p.percent < 100;
    })
    .sort((a, b) => (progress[b.video.id]?.updatedAt ?? 0) - (progress[a.video.id]?.updatedAt ?? 0))
    .slice(0, 6);

  const recentDone = flat
    .filter(({ video }) => progress[video.id]?.completed)
    .sort((a, b) => (progress[b.video.id]?.updatedAt ?? 0) - (progress[a.video.id]?.updatedAt ?? 0))
    .slice(0, 5);

  const firstName = user.displayName.split(" ")[0];
  const quote = dailyQuote();
  const { streak, studiedToday } = studyStreak(progress);
  const resume = continueItems[0];

  const ringRadius = 60;
  const ringLength = 2 * Math.PI * ringRadius;

  return (
    <>
      <section className="card desk">
        <div>
          <div className="eyebrow">{greeting()}</div>
          <h1>
            Welcome back, <em>{firstName}</em>
          </h1>
          <p className="sub">
            {done === 0 && inProgress === 0
              ? `${cat.totalVideos} classes across ${cat.subjects.length} subjects are ready for you. Pick one and settle in.`
              : `${cat.totalVideos - done} classes to go, and ${fmtHours(watchedSeconds)} already behind you. Keep the momentum.`}
          </p>
          <blockquote className="quote">
            “{quote.text}”<cite>— {quote.by}</cite>
          </blockquote>
          <div className="desk-actions">
            {resume ? (
              <Link className="btn primary" href={`/watch/${resume.video.id}`}>
                ▶ Resume {resume.video.label}
              </Link>
            ) : (
              <Link className="btn primary" href="/subjects">
                Start studying →
              </Link>
            )}
            <Link className="btn" href="/notes">
              Open notes
            </Link>
          </div>
        </div>

        <div className="ring" role="img" aria-label={`Course progress ${overall} percent`}>
          <svg viewBox="0 0 148 148" aria-hidden="true">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8e9bff" />
                <stop offset="100%" stopColor="#f3b76a" />
              </linearGradient>
            </defs>
            <circle className="track" cx="74" cy="74" r={ringRadius} fill="none" strokeWidth="10" />
            <circle
              className="value"
              cx="74"
              cy="74"
              r={ringRadius}
              fill="none"
              strokeWidth="10"
              strokeDasharray={ringLength}
              strokeDashoffset={ringLength * (1 - overall / 100)}
            />
          </svg>
          <div className="ring-label">
            <strong>{overall}%</strong>
            <span>Course</span>
          </div>
        </div>
      </section>

      <div className="grid stats">
        <div className="card">
          <div className="stat-label">Classes completed</div>
          <div className="stat-value">
            {done}
            <span style={{ fontSize: 15, color: "var(--muted-2)", fontWeight: 600 }}> / {cat.totalVideos}</span>
          </div>
          <div className="stat-note">{inProgress} in progress</div>
        </div>
        <div className="card">
          <div className="stat-label">Watch time</div>
          <div className="stat-value">{fmtHours(watchedSeconds)}</div>
          <div className="stat-note">of {fmtHours(cat.totalSeconds)} total</div>
        </div>
        <div className="card">
          <div className="stat-label">Study streak</div>
          <div className="stat-value streak">
            <span className="flame" aria-hidden="true">🔥</span>
            {streak}
            <span style={{ fontSize: 15, color: "var(--muted-2)", fontWeight: 600 }}>{streak === 1 ? " day" : " days"}</span>
          </div>
          <div className="stat-note">
            {studiedToday
              ? "You studied today. Lovely work."
              : streak > 0
                ? "Watch a class today to keep it alive."
                : "Watch one class to start a streak."}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">E-learning notes</div>
          <div className="stat-value">{cat.notes.length}</div>
          <div className="stat-note">
            <Link href="/notes" style={{ color: "var(--accent)" }}>
              Open library →
            </Link>
          </div>
        </div>
      </div>

      {continueItems.length > 0 && (
        <>
          <div className="section-head">
            <h2>Continue watching</h2>
            <Link href="/progress">All activity →</Link>
          </div>
          <div className="continue-grid">
            {continueItems.map(({ video, module, subject }) => {
              const p = progress[video.id];
              return (
                <Link key={video.id} href={`/watch/${video.id}`} className="card continue-card">
                  <div className="cc-head">
                    <span className="chip accent">{video.label}</span>
                    <span className="tiny">{fmtDuration(video.duration)}</span>
                  </div>
                  <div className="cc-title">{video.title}</div>
                  <div className="cc-sub">
                    {subject.name} · {module.name}
                  </div>
                  <div className="bar-row" style={{ marginTop: 0 }}>
                    <div className="bar">
                      <span style={{ width: `${p.percent}%` }} />
                    </div>
                    <span className="bar-pct">{p.percent}%</span>
                  </div>
                  <div className="tiny" style={{ marginTop: 8 }}>
                    Resume at {fmtDuration(p.position)} · {timeAgo(p.updatedAt)}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="section-head">
        <h2>Your subjects</h2>
        <Link href="/progress">Progress report →</Link>
      </div>

      <div className="subject-grid">
        {cat.subjects.map((s) => {
          const st = subjectStats(s, progress);
          return (
            <Link key={s.id} href={`/subjects/${s.id}`} className="card subject-card">
              <div className="subject-top">
                <SubjectSticker name={s.name} code={s.code} />
                <div className="subject-text">
                  <div className="subject-name">{s.name}</div>
                  <div className="subject-meta">
                    {s.modules.length} modules · {s.videoCount} videos · {fmtHours(s.totalSeconds)}
                  </div>
                </div>
                {s.code ? <span className="chip">{s.code}</span> : null}
              </div>
              <div className="bar-row">
                <div className="bar">
                  <span style={{ width: `${st.percent}%` }} />
                </div>
                <span className="bar-pct">{st.percent}%</span>
              </div>
              <div className="tiny" style={{ marginTop: 8 }}>
                {st.done} completed · {st.started} in progress
              </div>
            </Link>
          );
        })}
      </div>

      {recentDone.length > 0 && (
        <>
          <div className="section-head">
            <h2>Recently finished</h2>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {recentDone.map(({ video, subject }) => (
              <Link key={video.id} href={`/watch/${video.id}`} className="note-row">
                <span className="chip good">✓</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {video.title}
                </span>
                <span className="tiny">{subject.name}</span>
                <span className="tiny">{timeAgo(progress[video.id].updatedAt)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
