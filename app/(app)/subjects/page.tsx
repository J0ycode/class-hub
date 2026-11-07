import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProgress } from "@/lib/db";
import { getCatalogue } from "@/lib/catalogue";
import { fmtHours, subjectStats } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const user = await requireUser();
  const cat = getCatalogue();
  const progress = await getProgress(user.id);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Library</div>
          <h1>Subjects</h1>
          <p className="sub">
            {cat.subjects.length} subjects · {cat.totalVideos} classes · {fmtHours(cat.totalSeconds)} of video
          </p>
        </div>
      </div>

      <div className="subject-grid">
        {cat.subjects.map((s) => {
          const st = subjectStats(s, progress);
          return (
            <Link key={s.id} href={`/subjects/${s.id}`} className="card subject-card">
              <div className="subject-top">
                <div>
                  <div className="subject-name">{s.name}</div>
                  <div className="subject-meta">
                    {s.modules.map((m) => m.name).join(" · ")}
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
                {st.done} of {s.videoCount} completed · {fmtHours(st.watchedSeconds)} watched
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
