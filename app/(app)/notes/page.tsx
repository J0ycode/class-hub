import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { notesLibrary } from "@/lib/notes";
import SubjectSticker from "@/components/SubjectSticker";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  await requireUser();
  const cat = getCatalogue();
  const library = notesLibrary(cat);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Library</div>
          <h1>E-learning materials</h1>
          <p className="sub">
            {cat.notes.length} notes across {library.length} subjects. Pick a subject to open its modules.
          </p>
        </div>
      </div>

      {library.length === 0 && <div className="empty">No notes downloaded yet.</div>}

      <div className="subject-grid">
        {library.map((s) => {
          const moduleCount = s.modules.filter((m) => !m.pyq).length;
          return (
            <Link key={s.id} href={`/notes/${s.id}`} className="card subject-card notes-card">
              <div className="subject-top">
                <SubjectSticker name={s.name} code={s.code} />
                {s.code ? <span className="chip">{s.code}</span> : null}
              </div>
              <div className="subject-name" style={{ marginTop: 14 }}>
                {s.name}
              </div>
              <div className="subject-meta">
                {moduleCount} {moduleCount === 1 ? "module" : "modules"} · {s.noteCount} notes
              </div>
              <div className="notes-card-foot">
                {s.hasPyq ? <span className="chip gold">Includes PYQ</span> : <span />}
                <span className="notes-open">Open →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
