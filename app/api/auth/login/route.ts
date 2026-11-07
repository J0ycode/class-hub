import { NextResponse } from "next/server";
import {
  clearFailedLogins,
  failedLoginCount,
  findUserByName,
  recordFailedLogin,
  setUserSession,
} from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { newSessionId, setSessionCookie } from "@/lib/auth";

const MAX_PER_IP = 8;
const MAX_PER_USERNAME = 20;

// Verified against when the username does not exist, so the response time does
// not reveal which usernames are real.
const DUMMY_HASH = hashPassword("class-hub-dummy-password");

function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}

const tooMany = () =>
  NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });

export async function POST(req: Request) {
  const ipKey = `ip:${clientKey(req)}`;
  if ((await failedLoginCount(ipKey)) >= MAX_PER_IP) return tooMany();

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }

  const userKey = `user:${username.toLowerCase()}`;
  if ((await failedLoginCount(userKey)) >= MAX_PER_USERNAME) return tooMany();

  const user = await findUserByName(username);
  const passwordOk = verifyPassword(password, user ? user.hash : DUMMY_HASH);
  const ok = Boolean(user) && passwordOk;

  if (!ok) {
    await Promise.all([recordFailedLogin(ipKey), recordFailedLogin(userKey)]);
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }

  await Promise.all([clearFailedLogins(ipKey), clearFailedLogins(userKey)]);

  // One device per account: this replaces any session already open elsewhere.
  const sessionId = newSessionId();
  await setUserSession(user!.id, sessionId, req.headers.get("user-agent"));

  // Vercel always serves over https; a local `next start` over http must not
  // set a Secure cookie or the browser will drop it.
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const secure =
    proto === "https" || (proto ? false : new URL(req.url).protocol === "https:");
  await setSessionCookie(user!.id, sessionId, secure);

  return NextResponse.json({ ok: true, role: user!.role });
}
