import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { hashPassword, newUserId } from "./password";
import type { ProgressEntry } from "./types";

export type UserRole = "admin" | "moderator" | "user";

/** Coerces any stored or submitted value to a valid role (unknown -> "user"). */
export function parseRole(value: unknown): UserRole {
  return value === "admin" || value === "moderator" ? value : "user";
}

/** Admins and moderators may upload and remove teacher materials. */
export function canManageMaterials(user: { role: UserRole }): boolean {
  return user.role === "admin" || user.role === "moderator";
}

/** A PDF uploaded by a moderator/admin into a subject's module folder. */
export type TeacherNote = {
  id: string;
  subjectId: string;
  module: number; // 1-4
  title: string;
  size: number;
  uploadedBy: string; // username
  uploadedAt: number;
};

export type User = {
  id: string;
  username: string;
  displayName: string;
  hash: string;
  role: UserRole;
  createdAt: number;
  lastLoginAt?: number | null;
  sessionId?: string | null;
  sessionStartedAt?: number | null;
  sessionUserAgent?: string | null;
  /** Every device currently signed in, oldest first. */
  sessionIds?: string[] | null;
  /** Per-user device limit set by an admin; null uses the role default. */
  maxSessions?: number | null;
};

type Store = {
  users: User[];
  progress: Record<string, Record<string, ProgressEntry>>;
  teacherNotes: TeacherNote[];
};

const dataDir = path.join(process.cwd(), "data");
const storeFile = path.join(dataDir, "store.json");

// The account created on a fresh install. Only used when no users exist yet.
// Credentials come from the environment so they never live in source control.
function seedAdminCredentials(): { username: string; password: string } {
  const username = process.env.SEED_ADMIN_USERNAME?.trim() || "admin";
  const configured = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (configured.length >= 8) return { username, password: configured };

  if (process.env.VERCEL) {
    throw new Error("Set SEED_ADMIN_PASSWORD (8+ characters) to create the first admin account.");
  }

  // Local first run without a configured password: generate one and show it once.
  const password = crypto.randomBytes(12).toString("base64url");
  console.warn(
    `\n[class-hub] Created admin account -> username: ${username}  password: ${password}\n` +
      "[class-hub] Write this down and change it from the Admin panel.\n",
  );
  return { username, password };
}

/* ------------------------------------------------------------------ *
 * Backend selection
 *
 * Local (default)  -> data/store.json, used when running with start.bat
 * Vercel/hosted    -> Upstash Redis, enabled by setting either
 *                     UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN
 * ------------------------------------------------------------------ */

function redisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
}

function redisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
}

export function usingRemoteStore(): boolean {
  return Boolean(redisUrl() && redisToken());
}

async function redis<T = unknown>(command: (string | number)[]): Promise<T> {
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) throw new Error("Redis is not configured.");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  const data = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? `Redis error (${res.status})`);
  return data.result as T;
}

function requireBackend() {
  if (process.env.VERCEL && !usingRemoteStore()) {
    throw new Error(
      "Hosted deployment needs a database: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }
}

/* ------------------------------------------------------------------ *
 * Local JSON store
 * ------------------------------------------------------------------ */

function emptyStore(): Store {
  return { users: [], progress: {}, teacherNotes: [] };
}

function seedAdminUser(): User {
  const seed = seedAdminCredentials();
  return {
    id: newUserId(),
    username: seed.username,
    displayName: seed.username,
    hash: hashPassword(seed.password),
    role: "admin",
    createdAt: Date.now(),
    lastLoginAt: null,
    sessionId: null,
    sessionStartedAt: null,
    sessionUserAgent: null,
  };
}

function normalizeUser(raw: Partial<User>): User {
  return {
    id: String(raw.id ?? newUserId()),
    username: String(raw.username ?? ""),
    displayName: String(raw.displayName ?? raw.username ?? ""),
    hash: String(raw.hash ?? ""),
    role: parseRole(raw.role),
    createdAt: Number(raw.createdAt) || Date.now(),
    lastLoginAt: raw.lastLoginAt ?? null,
    sessionId: raw.sessionId ?? null,
    sessionStartedAt: raw.sessionStartedAt ?? null,
    sessionUserAgent: raw.sessionUserAgent ?? null,
    // `adminSessionIds` is the field name used before per-user limits existed.
    sessionIds: Array.isArray(raw.sessionIds)
      ? raw.sessionIds.map(String)
      : Array.isArray((raw as { adminSessionIds?: unknown }).adminSessionIds)
        ? ((raw as { adminSessionIds: unknown[] }).adminSessionIds).map(String)
        : null,
    maxSessions: clampLimit(raw.maxSessions),
  };
}

function readLocalStore(): Store {
  let parsed: Partial<Store> | null = null;
  try {
    parsed = JSON.parse(fs.readFileSync(storeFile, "utf8")) as Partial<Store>;
  } catch {
    parsed = null;
  }

  // No file yet (first run) — create it with the seeded admin account.
  if (!parsed) {
    const fresh = emptyStore();
    fresh.users.push(seedAdminUser());
    writeLocalStore(fresh);
    return fresh;
  }

  const store: Store = {
    users: Array.isArray(parsed.users) ? parsed.users.map((u) => normalizeUser(u)) : [],
    progress: parsed.progress && typeof parsed.progress === "object" ? parsed.progress : {},
    teacherNotes: Array.isArray(parsed.teacherNotes) ? parsed.teacherNotes : [],
  };

  if (store.users.length === 0) {
    store.users.push(seedAdminUser());
    writeLocalStore(store);
  } else if (!store.users.some((u) => u.role === "admin")) {
    store.users[0].role = "admin";
    writeLocalStore(store);
  }

  return store;
}

function writeLocalStore(store: Store) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = storeFile + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 1), "utf8");
  fs.renameSync(tmp, storeFile);
}

/* ------------------------------------------------------------------ *
 * Redis store
 *
 * ch:users        hash  userId   -> User JSON
 * ch:usernames    hash  username -> userId
 * ch:progress:<>  hash  videoId  -> ProgressEntry JSON
 * ch:seeded       flag  first-run marker
 * ------------------------------------------------------------------ */

const K_USERS = "ch:users";
const K_USERNAMES = "ch:usernames";
const K_SEEDED = "ch:seeded";
let remoteSeeded = false;

function progressKey(userId: string) {
  return `ch:progress:${userId}`;
}

async function ensureRemoteSeeded(): Promise<void> {
  // Seeding happens once per database; after that, skip the round trip.
  if (remoteSeeded) return;
  if (await redis<string | null>(["GET", K_SEEDED])) {
    remoteSeeded = true;
    return;
  }

  // Build the admin before claiming the flag: if credentials are missing this
  // throws and the flag stays unset, so seeding is retried once they are set.
  const admin = seedAdminUser();
  const claimed = await redis<string | null>(["SET", K_SEEDED, "1", "NX"]);
  if (claimed === "OK") {
    await redis(["HSET", K_USERS, admin.id, JSON.stringify(admin)]);
    await redis(["HSET", K_USERNAMES, admin.username.toLowerCase(), admin.id]);
  }
  remoteSeeded = true;
}

async function remoteListUsers(): Promise<User[]> {
  await ensureRemoteSeeded();
  const flat = await redis<string[]>(["HGETALL", K_USERS]);
  // Upstash returns a flat [field, value, field, value, ...] array.
  const users: User[] = [];
  for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) {
    try {
      users.push(normalizeUser(JSON.parse(flat[i + 1]) as Partial<User>));
    } catch {
      /* skip malformed rows */
    }
  }
  return users;
}

async function remoteFindUserById(id: string): Promise<User | undefined> {
  await ensureRemoteSeeded();
  const raw = await redis<string | null>(["HGET", K_USERS, id]);
  if (!raw) return undefined;
  try {
    return normalizeUser(JSON.parse(raw) as Partial<User>);
  } catch {
    return undefined;
  }
}

async function remoteFindUserByName(username: string): Promise<User | undefined> {
  await ensureRemoteSeeded();
  const id = await redis<string | null>(["HGET", K_USERNAMES, username.trim().toLowerCase()]);
  if (!id) return undefined;
  return remoteFindUserById(id);
}

async function remoteSaveUser(user: User): Promise<void> {
  await redis(["HSET", K_USERS, user.id, JSON.stringify(user)]);
  await redis(["HSET", K_USERNAMES, user.username.toLowerCase(), user.id]);
}

/* ------------------------------------------------------------------ *
 * Public API — all async, whichever backend is active
 * ------------------------------------------------------------------ */

export async function listUsers(): Promise<User[]> {
  requireBackend();
  return usingRemoteStore() ? remoteListUsers() : readLocalStore().users;
}

export async function findUserByName(username: string): Promise<User | undefined> {
  requireBackend();
  if (usingRemoteStore()) return remoteFindUserByName(username);
  const wanted = username.trim().toLowerCase();
  return readLocalStore().users.find((u) => u.username.toLowerCase() === wanted);
}

export async function findUserById(id: string): Promise<User | undefined> {
  requireBackend();
  if (usingRemoteStore()) return remoteFindUserById(id);
  return readLocalStore().users.find((u) => u.id === id);
}

export async function createUser(input: {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
}): Promise<User> {
  requireBackend();
  const user: User = {
    id: newUserId(),
    username: input.username.trim(),
    displayName: input.displayName.trim() || input.username.trim(),
    hash: hashPassword(input.password),
    role: input.role,
    createdAt: Date.now(),
    lastLoginAt: null,
    sessionId: null,
    sessionStartedAt: null,
    sessionUserAgent: null,
  };

  if (usingRemoteStore()) {
    await ensureRemoteSeeded();
    await remoteSaveUser(user);
    return user;
  }

  const store = readLocalStore();
  store.users.push(user);
  writeLocalStore(store);
  return user;
}

/** Loads one user, applies `change`, and saves it, on whichever backend is active. */
async function mutateUser(userId: string, change: (user: User) => void): Promise<boolean> {
  requireBackend();
  if (usingRemoteStore()) {
    const user = await remoteFindUserById(userId);
    if (!user) return false;
    change(user);
    await remoteSaveUser(user);
    return true;
  }

  const store = readLocalStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) return false;
  change(user);
  writeLocalStore(store);
  return true;
}

function signOutEverywhere(user: User) {
  user.sessionId = null;
  user.sessionStartedAt = null;
  user.sessionUserAgent = null;
  user.sessionIds = null;
}

export async function updateUserPassword(userId: string, password: string): Promise<boolean> {
  return mutateUser(userId, (user) => {
    user.hash = hashPassword(password);
    // force a fresh sign-in everywhere after a password reset
    signOutEverywhere(user);
  });
}

export async function setUserRole(userId: string, role: UserRole): Promise<boolean> {
  return mutateUser(userId, (user) => {
    user.role = role;
    // The role default may be lower now (admin 3 -> user 1): drop the oldest devices.
    trimSessions(user);
  });
}

export async function countAdmins(): Promise<number> {
  return (await listUsers()).filter((u) => u.role === "admin").length;
}

export async function deleteUser(userId: string): Promise<boolean> {
  requireBackend();
  if (usingRemoteStore()) {
    const user = await remoteFindUserById(userId);
    if (!user) return false;
    await redis(["HDEL", K_USERS, userId]);
    await redis(["HDEL", K_USERNAMES, user.username.toLowerCase()]);
    await redis(["DEL", progressKey(userId)]);
    return true;
  }

  const store = readLocalStore();
  const idx = store.users.findIndex((u) => u.id === userId);
  if (idx < 0) return false;
  store.users.splice(idx, 1);
  delete store.progress[userId];
  writeLocalStore(store);
  return true;
}

/* Device limits: a sign-in beyond the limit signs out the oldest device
 * (first in, first out). Admins can set a per-user limit; otherwise users get
 * one device and admins three. */
export const DEFAULT_USER_DEVICES = 1;
export const DEFAULT_ADMIN_DEVICES = 3;
export const MAX_DEVICE_LIMIT = 10;

function clampLimit(value: unknown): number | null {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isInteger(n) || n < 1) return null;
  return Math.min(n, MAX_DEVICE_LIMIT);
}

/** How many devices this account may be signed in on at once. */
export function deviceLimit(user: User): number {
  return user.maxSessions ?? (user.role === "admin" ? DEFAULT_ADMIN_DEVICES : DEFAULT_USER_DEVICES);
}

function currentSessions(user: User): string[] {
  return user.sessionIds ?? (user.sessionId ? [user.sessionId] : []);
}

/** Number of devices currently signed in. */
export function activeDeviceCount(user: User): number {
  return currentSessions(user).length;
}

/** Drops the oldest sessions until the account is within its limit. */
function trimSessions(user: User) {
  const kept = currentSessions(user).slice(-deviceLimit(user));
  if (kept.length === 0) return signOutEverywhere(user);
  user.sessionIds = kept;
  if (!user.sessionId || !kept.includes(user.sessionId)) user.sessionId = kept[kept.length - 1];
}

/** Sets a per-user device limit (1–10), or null to use the role default. */
export async function setUserDeviceLimit(userId: string, limit: number | null): Promise<boolean> {
  return mutateUser(userId, (user) => {
    user.maxSessions = clampLimit(limit);
    trimSessions(user);
  });
}

/** True when `sessionId` is a live session for this user. */
export function hasActiveSession(user: User, sessionId: string): boolean {
  return currentSessions(user).includes(sessionId);
}

/** Records a sign-in, signing out the oldest device if the limit is exceeded. */
export async function setUserSession(userId: string, sessionId: string, userAgent?: string | null) {
  await mutateUser(userId, (user) => {
    user.sessionIds = [...currentSessions(user), sessionId].slice(-deviceLimit(user));
    user.sessionId = sessionId;
    user.sessionStartedAt = Date.now();
    user.lastLoginAt = Date.now();
    user.sessionUserAgent = userAgent ? userAgent.slice(0, 160) : null;
  });
}

/** Signs the account out on every device. */
export async function clearUserSession(userId: string) {
  await mutateUser(userId, signOutEverywhere);
}

/** Ends one device's session (logout). The account's other devices stay signed in. */
export async function endUserSession(userId: string, sessionId: string) {
  await mutateUser(userId, (user) => {
    const remaining = currentSessions(user).filter((id) => id !== sessionId);
    if (remaining.length === 0) return signOutEverywhere(user);
    user.sessionIds = remaining;
    if (user.sessionId === sessionId) user.sessionId = remaining[remaining.length - 1];
  });
}

export async function getProgress(userId: string): Promise<Record<string, ProgressEntry>> {
  requireBackend();
  if (usingRemoteStore()) {
    const flat = await redis<string[]>(["HGETALL", progressKey(userId)]);
    const progress: Record<string, ProgressEntry> = {};
    for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) {
      try {
        progress[flat[i]] = JSON.parse(flat[i + 1]) as ProgressEntry;
      } catch {
        /* skip malformed rows */
      }
    }
    return progress;
  }
  return readLocalStore().progress[userId] ?? {};
}

function buildProgressEntry(
  prev: ProgressEntry | undefined,
  position: number,
  duration: number,
): ProgressEntry {
  const safeDuration = Math.max(0, Math.round(duration) || prev?.duration || 0);
  const safePosition = Math.max(0, Math.round(position) || 0);
  const watched = Math.max(prev?.watched ?? 0, safePosition);
  const percent =
    safeDuration > 0
      ? Math.min(100, Math.round((watched / safeDuration) * 100))
      : prev?.percent ?? 0;

  return {
    position: safePosition,
    watched,
    duration: safeDuration,
    percent,
    completed: percent >= 90 || (prev?.completed ?? false),
    updatedAt: Date.now(),
  };
}

export async function recordProgress(
  userId: string,
  videoId: string,
  position: number,
  duration: number,
): Promise<ProgressEntry> {
  requireBackend();
  if (usingRemoteStore()) {
    const raw = await redis<string | null>(["HGET", progressKey(userId), videoId]);
    let prev: ProgressEntry | undefined;
    if (raw) {
      try {
        prev = JSON.parse(raw) as ProgressEntry;
      } catch {
        prev = undefined;
      }
    }
    const entry = buildProgressEntry(prev, position, duration);
    await redis(["HSET", progressKey(userId), videoId, JSON.stringify(entry)]);
    return entry;
  }

  const store = readLocalStore();
  store.progress[userId] ??= {};
  const map = store.progress[userId];
  const entry = buildProgressEntry(map[videoId], position, duration);
  map[videoId] = entry;
  writeLocalStore(store);
  return entry;
}

export async function markComplete(
  userId: string,
  videoId: string,
  duration: number,
): Promise<ProgressEntry> {
  requireBackend();
  if (usingRemoteStore()) {
    const raw = await redis<string | null>(["HGET", progressKey(userId), videoId]);
    let prev: ProgressEntry | undefined;
    if (raw) {
      try {
        prev = JSON.parse(raw) as ProgressEntry;
      } catch {
        prev = undefined;
      }
    }
    const d = Math.max(0, Math.round(duration) || prev?.duration || 0);
    const entry: ProgressEntry = {
      position: d,
      watched: d || prev?.watched || 0,
      duration: d,
      percent: 100,
      completed: true,
      updatedAt: Date.now(),
    };
    await redis(["HSET", progressKey(userId), videoId, JSON.stringify(entry)]);
    return entry;
  }

  const store = readLocalStore();
  store.progress[userId] ??= {};
  const map = store.progress[userId];
  const prev = map[videoId];
  const d = Math.max(0, Math.round(duration) || prev?.duration || 0);
  const entry: ProgressEntry = {
    position: d,
    watched: d || prev?.watched || 0,
    duration: d,
    percent: 100,
    completed: true,
    updatedAt: Date.now(),
  };
  map[videoId] = entry;
  writeLocalStore(store);
  return entry;
}

/* ------------------------------------------------------------------ *
 * Failed-login throttling
 *
 * Hosted: Redis counters (ch:login:<key>), shared by every instance.
 * Local:  in-memory map, pruned as entries expire.
 * ------------------------------------------------------------------ */

const LOGIN_WINDOW_SECONDS = 5 * 60;
const localAttempts = new Map<string, { count: number; until: number }>();

function pruneLocalAttempts(now: number) {
  for (const [k, v] of localAttempts) if (v.until <= now) localAttempts.delete(k);
}

export async function failedLoginCount(key: string): Promise<number> {
  if (usingRemoteStore()) {
    return Number(await redis<string | null>(["GET", `ch:login:${key}`])) || 0;
  }
  const now = Date.now();
  pruneLocalAttempts(now);
  return localAttempts.get(key)?.count ?? 0;
}

export async function recordFailedLogin(key: string): Promise<void> {
  if (usingRemoteStore()) {
    const count = await redis<number>(["INCR", `ch:login:${key}`]);
    if (count === 1) await redis(["EXPIRE", `ch:login:${key}`, LOGIN_WINDOW_SECONDS]);
    return;
  }
  const now = Date.now();
  const rec = localAttempts.get(key);
  const count = rec && rec.until > now ? rec.count + 1 : 1;
  localAttempts.set(key, { count, until: now + LOGIN_WINDOW_SECONDS * 1000 });
}

export async function clearFailedLogins(key: string): Promise<void> {
  if (usingRemoteStore()) {
    await redis(["DEL", `ch:login:${key}`]);
    return;
  }
  localAttempts.delete(key);
}

/* ------------------------------------------------------------------ *
 * Teacher materials (metadata only; the PDF bytes live in lib/teacherFiles)
 *
 * Hosted: ch:teacher hash  noteId -> TeacherNote JSON
 * Local:  store.json "teacherNotes" array
 * ------------------------------------------------------------------ */

const K_TEACHER = "ch:teacher";

export async function listTeacherNotes(subjectId?: string): Promise<TeacherNote[]> {
  requireBackend();
  let notes: TeacherNote[];
  if (usingRemoteStore()) {
    const flat = await redis<string[]>(["HGETALL", K_TEACHER]);
    notes = [];
    for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) {
      try {
        notes.push(JSON.parse(flat[i + 1]) as TeacherNote);
      } catch {
        /* skip malformed rows */
      }
    }
  } else {
    notes = readLocalStore().teacherNotes;
  }
  return notes
    .filter((n) => !subjectId || n.subjectId === subjectId)
    .sort((a, b) => a.module - b.module || a.uploadedAt - b.uploadedAt);
}

export async function findTeacherNote(id: string): Promise<TeacherNote | undefined> {
  requireBackend();
  if (usingRemoteStore()) {
    const raw = await redis<string | null>(["HGET", K_TEACHER, id]);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as TeacherNote;
    } catch {
      return undefined;
    }
  }
  return readLocalStore().teacherNotes.find((n) => n.id === id);
}

export async function addTeacherNote(note: TeacherNote): Promise<void> {
  requireBackend();
  if (usingRemoteStore()) {
    await redis(["HSET", K_TEACHER, note.id, JSON.stringify(note)]);
    return;
  }
  const store = readLocalStore();
  store.teacherNotes.push(note);
  writeLocalStore(store);
}

export async function deleteTeacherNote(id: string): Promise<boolean> {
  requireBackend();
  if (usingRemoteStore()) {
    return (await redis<number>(["HDEL", K_TEACHER, id])) > 0;
  }
  const store = readLocalStore();
  const before = store.teacherNotes.length;
  store.teacherNotes = store.teacherNotes.filter((n) => n.id !== id);
  if (store.teacherNotes.length === before) return false;
  writeLocalStore(store);
  return true;
}
