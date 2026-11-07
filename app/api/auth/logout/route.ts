import { NextResponse } from "next/server";
import { endUserSession } from "@/lib/db";
import { clearSessionCookie, getSessionState } from "@/lib/auth";

export async function POST() {
  // Ends only this device's session; an admin's other devices stay signed in.
  const { user, sessionId } = await getSessionState();
  if (user && sessionId) await endUserSession(user.id, sessionId);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
