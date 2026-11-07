import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { notesLibrary } from "@/lib/notes";

export const dynamic = "force-dynamic";

export default async function SubjectNotesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const cat = getCatalogue();
  const subject = notesLibrary(cat).find((s) => s.id === id);
  if (!subject) notFound();

  const hasClasses = cat.subjects.some((s) => s.id === subject.id && s.videoCount > 0);

  return (
    <>
      <Link href="/notes" className="crumb">
        ← All subjects
      </Link>

      <div className="page-head">
        <div>
          <div className="eyebrow">Notes{subject.code ? ` · ${subject.code}` : ""}</div>
          <h1>{subject.name}</h1>
          <p className="sub">
            {subject.noteCount} notes in {subject.modules.length} {subject.modules.length === 1 ? "section" : "sections"}. Tap a
            note to open the PDF.
          </p>
        </div>
        {hasClasses ? (
          <Link className="btn" href={`/subjects/${subject.id}`}>
            View classes →
          </Link>
        ) : null}
      </div>

      {subject.modules.map((m, i) => (
        <details key={m.id} className="module" open={i === 0}>
          <summary>
            <div className="mod-num" aria-hidden="true">
              {m.pyq ? "Q" : (m.name.match(/\d+/)?.[0] ?? i + 1)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="mod-name">{m.pyq ? "Previous year questions" : m.name}</div>
              <div className="mod-sub">
                {m.pyq ? `${m.name} · ` : ""}
                {m.notes.length} {m.notes.length === 1 ? "note" : "notes"}
              </div>
            </div>
            <div className="mod-right">
              <span className="caret">▾</span>
            </div>
          </summary>
          {m.notes.map((n, idx) => (
            <a key={n.id} className="note-row" href={`/api/materials/${n.id}`} target="_blank" rel="noreferrer">
              <span className="note-idx">{String(idx + 1).padStart(2, "0")}</span>
              <span className="note-title">{n.title}</span>
              <span className="pdf-badge">PDF</span>
            </a>
          ))}
        </details>
      ))}
    </>
  );
}
