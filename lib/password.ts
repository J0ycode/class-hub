import crypto from "node:crypto";

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password.normalize("NFKC"), salt, KEYLEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== KEYLEN) return false;
  const actual = crypto.scryptSync(password.normalize("NFKC"), salt, KEYLEN);
  return crypto.timingSafeEqual(expected, actual);
}

export function newUserId(): string {
  return crypto.randomBytes(9).toString("hex");
}
