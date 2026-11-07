import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getSessionUser } from "@/lib/auth";
import { getCatalogue } from "@/lib/catalogue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Streaming a PDF from Blob storage can take a while on a slow connection.
export const maxDuration = 60;

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await ctx.params;
  const cat = getCatalogue();
  const note = cat.notes.find((n) => n.id === id);
  if (!note) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const safeName = note.title.replace(/[^\w\-. ]+/g, "_").slice(0, 80) || "notes";
  const baseHeaders = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${safeName}.pdf"`,
    "Cache-Control": "private, max-age=3600",
  };

  // Hosted mode: private Vercel Blob, streamed only after the session check above.
  if (blobEnabled()) {
    try {
      const result = await get(`notes/${note.id}.pdf`, { access: "private" });
      if (!result || result.statusCode !== 200) {
        return NextResponse.json({ error: "Note has not been uploaded yet." }, { status: 404 });
      }
      return new Response(result.stream, {
        headers: { ...baseHeaders, "Content-Length": String(result.blob.size) },
      });
    } catch {
      return NextResponse.json({ error: "Note has not been uploaded yet." }, { status: 404 });
    }
  }

  // Local mode: stream straight from ../ones_materials.
  if (!note.file) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const root = path.resolve(process.cwd(), "..", "ones_materials");
  const abs = path.resolve(root, note.file);
  if (!abs.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!fs.existsSync(abs)) return NextResponse.json({ error: "File missing on disk." }, { status: 404 });

  const stat = fs.statSync(abs);
  const stream = fs.createReadStream(abs);

  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: { ...baseHeaders, "Content-Length": String(stat.size) },
  });
}
