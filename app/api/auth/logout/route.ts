import { NextResponse } from "next/server";
import { clearUserSession } from "@/lib/db";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";

export async function POST() {
  const user = await getSessionUser();
  if (user) await clearUserSession(user.id);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
