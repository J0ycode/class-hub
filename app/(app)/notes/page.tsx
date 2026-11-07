import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  await requireUser();
  const cat = getCatalogue();

  const grouped = cat.subjects
    .map((s) => ({
      subject: s,
      modules: s.modules
        .map((m) => ({
          module: m,
          notes: cat.notes.filter((n) => n.subjectId === s.id && n.moduleId === m.id).sort((a, b) => a.order - b.order),
        }))
        .filter((m) => m.notes.length > 0),
    }))
    .filter((s) => s.modules.length > 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Library</div>
          <h1>E-learning materials</h1>
          <p className="sub">{cat.notes.length} notes, saved offline and viewable here.</p>
        </div>
      </div>

      {grouped.length === 0 && <div className="empty">No notes downloaded yet.</div>}

      {grouped.map(({ subject, modules }) => (
        <div key={subject.id} style={{ marginBottom: 26 }}>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>{subject.name}</h2>
            <Link href={`/subjects/${subject.id}`} className="tiny" style={{ color: "var(--accent)" }}>
              View classes →
            </Link>
          </div>
          {modules.map(({ module, notes }) => (
            <details key={module.id} className="module" open>
              <summary>
                <div>
                  <div className="mod-name">{module.name}</div>
                  <div className="mod-sub">{notes.length} notes</div>
                </div>
                <div className="mod-right">
                  <span className="caret">▾</span>
                </div>
              </summary>
              {notes.map((n) => (
                <a key={n.id} className="note-row" href={`/api/materials/${n.id}`} target="_blank" rel="noreferrer">
                  <span className="pdf-badge">PDF</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{n.title}</span>
                  <span className="tiny">open ↗</span>
                </a>
              ))}
            </details>
          ))}
        </div>
      ))}
    </>
  );
}
