import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCatalogue, findVideo } from "@/lib/catalogue";
import { markComplete, recordProgress } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { videoId?: string; position?: number; duration?: number; completed?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const videoId = String(body.videoId ?? "");
  const found = findVideo(getCatalogue(), videoId);
  if (!found) return NextResponse.json({ error: "Unknown video." }, { status: 404 });

  const realDuration = found.video.duration || 0;
  const duration = Math.min(Math.max(Number(body.duration) || realDuration, 0), Math.max(realDuration, 1) * 3);

  if (body.completed) {
    const entry = await markComplete(user.id, videoId, realDuration || duration);
    return NextResponse.json({ ok: true, ...entry });
  }

  const position = Number(body.position);
  if (!Number.isFinite(position) || position < 0) {
    return NextResponse.json({ error: "Invalid position." }, { status: 400 });
  }

  const entry = await recordProgress(user.id, videoId, position, duration || realDuration);
  return NextResponse.json({ ok: true, ...entry });
}
