import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";
import { addTeacherNote, canManageMaterials, type TeacherNote } from "@/lib/db";
import { removeTeacherFile, saveTeacherFile } from "@/lib/teacherFiles";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;
const MODULE_COUNT = 4;

export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!canManageMaterials(user)) {
    return NextResponse.json({ error: "Only moderators and admins can upload." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const subjectId = String(form.get("subjectId") ?? "");
  const moduleNo = Number(form.get("module"));
  const file = form.get("file");

  if (!getCatalogue().subjects.some((s) => s.id === subjectId)) {
    return NextResponse.json({ error: "Unknown subject." }, { status: 400 });
  }
  if (!Number.isInteger(moduleNo) || moduleNo < 1 || moduleNo > MODULE_COUNT) {
    return NextResponse.json({ error: `Module must be 1–${MODULE_COUNT}.` }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a PDF file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "PDF must be 25 MB or smaller." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Trust the file signature, not the name or the browser's content type.
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "That file is not a PDF." }, { status: 415 });
  }

  const fallbackTitle = file.name.replace(/\.pdf$/i, "");
  const title =
    (String(form.get("title") ?? "").trim() || fallbackTitle).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120) ||
    "Untitled notes";

  const note: TeacherNote = {
    id: crypto.randomBytes(12).toString("hex"),
    subjectId,
    module: moduleNo,
    title,
    size: bytes.length,
    uploadedBy: user.username,
    uploadedAt: Date.now(),
  };

  try {
    await saveTeacherFile(note.id, bytes);
    await addTeacherNote(note);
  } catch (err) {
    console.error("[teacher-notes] upload failed", err);
    await removeTeacherFile(note.id).catch(() => undefined);
    return NextResponse.json({ error: "Upload failed. Check the server logs for details." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, note });
}
