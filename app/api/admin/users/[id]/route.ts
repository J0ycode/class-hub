import { NextResponse } from "next/server";
import {
  clearUserSession,
  countAdmins,
  deleteUser,
  findUserById,
  MAX_DEVICE_LIMIT,
  setUserDeviceLimit,
  setUserRole,
  updateUserPassword,
  type UserRole,
} from "@/lib/db";
import { getApiUser } from "@/lib/auth";

export const runtime = "nodejs";

function forbidden(user: { role: string } | null) {
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getApiUser();
  const denied = forbidden(admin);
  if (denied) return denied;

  const { id } = await ctx.params;
  const target = await findUserById(id);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  let body: { action?: string; password?: string; role?: string; limit?: number | string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action === "resetPassword") {
    const password = body.password ?? "";
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    await updateUserPassword(id, password);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "signOut") {
    await clearUserSession(id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "deviceLimit") {
    // null resets to the role default; otherwise a whole number 1–MAX_DEVICE_LIMIT.
    const raw = body.limit;
    const limit = raw === null || raw === undefined || raw === "" ? null : Number(raw);
    if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > MAX_DEVICE_LIMIT)) {
      return NextResponse.json({ error: `Device limit must be 1–${MAX_DEVICE_LIMIT}.` }, { status: 400 });
    }
    await setUserDeviceLimit(id, limit);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "role") {
    const role: UserRole = body.role === "admin" ? "admin" : "user";
    if (target.role === "admin" && role !== "admin" && (await countAdmins()) <= 1) {
      return NextResponse.json({ error: "There must be at least one admin." }, { status: 400 });
    }
    if (id === admin!.id && role !== "admin") {
      return NextResponse.json({ error: "You cannot remove your own admin role." }, { status: 400 });
    }
    await setUserRole(id, role);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getApiUser();
  const denied = forbidden(admin);
  if (denied) return denied;

  const { id } = await ctx.params;
  if (id === admin!.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const target = await findUserById(id);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role === "admin" && (await countAdmins()) <= 1) {
    return NextResponse.json({ error: "There must be at least one admin." }, { status: 400 });
  }

  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
