import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { canManageMaterials, listTeacherNotes } from "@/lib/db";
import { notesLibrary } from "@/lib/notes";
import SubjectSticker from "@/components/SubjectSticker";
import TeacherMaterials from "@/components/TeacherMaterials";

export const dynamic = "force-dynamic";

export default async function SubjectNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "teacher" ? "teacher" : "elearning";

  const cat = getCatalogue();
  const subject = notesLibrary(cat).find((s) => s.id === id);
  if (!subject) notFound();

  const hasClasses = cat.subjects.some((s) => s.id === subject.id && s.videoCount > 0);
  const teacherNotes = await listTeacherNotes(subject.id);
  const canManage = canManageMaterials(user);

  return (
    <>
      <Link href="/notes" className="crumb">
        ← All subjects
      </Link>

      <div className="page-head">
        <div>
          <SubjectSticker name={subject.name} code={subject.code} size="lg" />
          <div className="eyebrow">Notes{subject.code ? ` · ${subject.code}` : ""}</div>
          <h1>{subject.name}</h1>
          <p className="sub">
            {tab === "teacher"
              ? `Notes shared by your teachers, organised by module.${canManage ? " You can upload PDFs to any module." : ""}`
              : `${subject.noteCount} notes in ${subject.modules.length} ${subject.modules.length === 1 ? "section" : "sections"}. Tap a note to open the PDF.`}
          </p>
        </div>
        {hasClasses ? (
          <Link className="btn" href={`/subjects/${subject.id}`}>
            View classes →
          </Link>
        ) : null}
      </div>

      <nav className="tabs" aria-label="Notes type">
        <Link
          href={`/notes/${subject.id}`}
          className={tab === "elearning" ? "on" : ""}
          aria-current={tab === "elearning" ? "page" : undefined}
        >
          E-learning materials <span className="tab-count">{subject.noteCount}</span>
        </Link>
        <Link
          href={`/notes/${subject.id}?tab=teacher`}
          className={tab === "teacher" ? "on" : ""}
          aria-current={tab === "teacher" ? "page" : undefined}
        >
          Teacher materials <span className="tab-count">{teacherNotes.length}</span>
        </Link>
      </nav>

      {tab === "teacher" ? (
        <TeacherMaterials subjectId={subject.id} notes={teacherNotes} canManage={canManage} />
      ) : (
        subject.modules.map((m, i) => (
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
        ))
      )}
    </>
  );
}
