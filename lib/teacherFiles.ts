import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { del, get, put } from "@vercel/blob";

/*
 * Bytes for teacher-uploaded PDFs.
 * Hosted: private Vercel Blob at teacher/<id>.pdf (needs BLOB_READ_WRITE_TOKEN).
 * Local:  data/teacher/<id>.pdf
 */

const localDir = path.join(process.cwd(), "data", "teacher");

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function blobPath(id: string) {
  return `teacher/${id}.pdf`;
}

function localPath(id: string) {
  // ids are generated server-side as hex; still refuse anything else.
  if (!/^[a-f0-9]{8,64}$/.test(id)) throw new Error("Invalid file id.");
  return path.join(localDir, `${id}.pdf`);
}

export async function saveTeacherFile(id: string, bytes: Buffer): Promise<void> {
  if (blobEnabled()) {
    await put(blobPath(id), bytes, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/pdf",
      multipart: bytes.length > 4 * 1024 * 1024,
    });
    return;
  }
  if (process.env.VERCEL) {
    throw new Error("Uploads need Vercel Blob: set BLOB_READ_WRITE_TOKEN.");
  }
  fs.mkdirSync(localDir, { recursive: true });
  fs.writeFileSync(localPath(id), bytes);
}

/** Returns a web stream and size, or null when the file is missing. */
export async function openTeacherFile(id: string): Promise<{ stream: ReadableStream; size: number } | null> {
  if (blobEnabled()) {
    try {
      const result = await get(blobPath(id), { access: "private" });
      if (!result || result.statusCode !== 200) return null;
      return { stream: result.stream, size: result.blob.size };
    } catch {
      return null;
    }
  }
  const file = localPath(id);
  if (!fs.existsSync(file)) return null;
  const size = fs.statSync(file).size;
  return { stream: Readable.toWeb(fs.createReadStream(file)) as unknown as ReadableStream, size };
}

export async function removeTeacherFile(id: string): Promise<void> {
  if (blobEnabled()) {
    try {
      await del(blobPath(id));
    } catch {
      /* already gone */
    }
    return;
  }
  const file = localPath(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
