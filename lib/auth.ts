import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById, type User } from "./db";

const COOKIE = "ch_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): Buffer {
  // Hosted deploys must not write to disk: use a stable env secret instead.
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) {
    if (configured.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
    return crypto.createHash("sha256").update(configured).digest();
  }
  if (process.env.VERCEL) {
    throw new Error("Set SESSION_SECRET (32+ random characters) for hosted deployments.");
  }

  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "secret.key");
  try {
    return Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
  } catch {
    const key = crypto.randomBytes(32);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, key.toString("hex"), { encoding: "utf8", mode: 0o600 });
    return key;
  }
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export type TokenPayload = { userId: string; sessionId: string };

export function newSessionId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function createToken(userId: string, sessionId: string): string {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${sessionId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, sessionId, expiresRaw, signature] = parts;
  const payload = `${userId}.${sessionId}.${expiresRaw}`;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expiresRaw) < Date.now()) return null;
  return { userId, sessionId };
}

/**
 * Resolves the session and tells us whether it was superseded by a login
 * elsewhere. A user has exactly one active session: signing in on another
 * device replaces the stored session id, and every older cookie stops matching.
 */
export async function getSessionState(): Promise<{ user: User | null; kicked: boolean }> {
  const store = await cookies();
  const payload = verifyToken(store.get(COOKIE)?.value);
  if (!payload) return { user: null, kicked: false };

  const user = await findUserById(payload.userId);
  if (!user) return { user: null, kicked: false };
  if (!user.sessionId || user.sessionId !== payload.sessionId) {
    return { user: null, kicked: true };
  }
  return { user, kicked: false };
}

export async function getSessionUser(): Promise<User | null> {
  return (await getSessionState()).user;
}

/** For API routes: returns the user or null; never redirects. */
export async function getApiUser(): Promise<User | null> {
  return getSessionUser();
}

export async function requireUser(): Promise<User> {
  const { user, kicked } = await getSessionState();
  if (!user) redirect(kicked ? "/login?kicked=1" : "/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function setSessionCookie(userId: string, sessionId: string, secure = process.env.NODE_ENV === "production") {
  const store = await cookies();
  store.set(COOKIE, createToken(userId, sessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
