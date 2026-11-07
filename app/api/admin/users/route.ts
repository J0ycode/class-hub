import { NextResponse } from "next/server";
import { createUser, findUserByName, listUsers, type UserRole } from "@/lib/db";
import { getApiUser } from "@/lib/auth";

export const runtime = "nodejs";

function forbidden(user: { role: string } | null) {
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return null;
}

export async function GET() {
  const admin = await getApiUser();
  const denied = forbidden(admin);
  if (denied) return denied;

  const users = await listUsers();
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt ?? null,
      online: !!u.sessionId,
      sessionStartedAt: u.sessionStartedAt ?? null,
      sessionUserAgent: u.sessionUserAgent ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const admin = await getApiUser();
  const denied = forbidden(admin);
  if (denied) return denied;

  let body: { username?: string; displayName?: string; password?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const displayName = (body.displayName ?? "").trim() || username;
  const password = body.password ?? "";
  const role: UserRole = body.role === "admin" ? "admin" : "user";

  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json(
      { error: "Username: 3–32 letters, numbers, dot, dash or underscore." },
      { status: 400 },
    );
  }
  if (await findUserByName(username)) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const user = await createUser({ username, displayName, password, role });
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
}
