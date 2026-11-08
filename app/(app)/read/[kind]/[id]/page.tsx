import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { findTeacherNote } from "@/lib/db";
import PdfViewer from "@/components/PdfViewer";

export const dynamic = "force-dynamic";

/** Opens any PDF inside the site: /read/notes/<id> or /read/teacher/<id>. */
export default async function ReadPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  await requireUser();
  const { kind, id } = await params;

  if (kind === "notes") {
    const note = getCatalogue().notes.find((n) => n.id === id);
    if (!note) notFound();
    return <PdfViewer url={`/api/materials/${note.id}`} title={note.title} fallback="/notes" />;
  }

  if (kind === "teacher") {
    const note = await findTeacherNote(id);
    if (!note) notFound();
    return <PdfViewer url={`/api/teacher-notes/${note.id}`} title={note.title} fallback={`/notes/${note.subjectId}?tab=teacher`} />;
  }

  notFound();
}
