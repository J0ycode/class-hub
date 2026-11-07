import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { canManageMaterials, deleteTeacherNote, findTeacherNote } from "@/lib/db";
import { openTeacherFile, removeTeacherFile } from "@/lib/teacherFiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await ctx.params;
  const note = await findTeacherNote(id);
  if (!note) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const file = await openTeacherFile(note.id);
  if (!file) return NextResponse.json({ error: "File missing." }, { status: 404 });

  const safeName = note.title.replace(/[^\w\-. ]+/g, "_").slice(0, 80) || "notes";
  return new Response(file.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}.pdf"`,
      "Content-Length": String(file.size),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!canManageMaterials(user)) {
    return NextResponse.json({ error: "Only moderators and admins can delete." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const note = await findTeacherNote(id);
  if (!note) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await deleteTeacherNote(note.id);
  await removeTeacherFile(note.id);
  return NextResponse.json({ ok: true });
}
