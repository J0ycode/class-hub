/**
 * Uploads every PDF note into private Vercel Blob storage.
 *
 *   npm run upload:notes          upload anything not uploaded yet
 *   npm run upload:notes -- --force   re-upload everything
 *
 * Needs BLOB_READ_WRITE_TOKEN in .env.local (or the environment).
 * Successful uploads are remembered in data/blob-uploaded.json so re-runs
 * only send new files.
 */
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

const root = process.cwd();
const catalogueFile = path.join(root, "data", "catalogue.json");
const ledgerFile = path.join(root, "data", "blob-uploaded.json");
const materialsDir = path.resolve(root, "..", "ones_materials");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error(
    "\nMissing BLOB_READ_WRITE_TOKEN.\n" +
      "Create a Vercel Blob store, copy the token into .env.local, then run this again.\n",
  );
  process.exit(1);
}

const force = process.argv.includes("--force");
const catalogue = JSON.parse(fs.readFileSync(catalogueFile, "utf8"));
const notes = catalogue.notes ?? [];

let done = JSON.parse(fs.existsSync(ledgerFile) ? fs.readFileSync(ledgerFile, "utf8") : "{}");
const pending = notes.filter((note) => force || !done[note.id]);

if (pending.length === 0) {
  console.log(`All ${notes.length} notes are already uploaded. Use --force to re-upload.`);
  process.exit(0);
}

console.log(`Uploading ${pending.length} of ${notes.length} notes to private Blob storage...\n`);

let uploaded = 0;
let failed = 0;
let bytes = 0;
const failures = [];

function saveLedger() {
  fs.writeFileSync(ledgerFile, JSON.stringify(done, null, 1), "utf8");
}

async function uploadOne(note) {
  const abs = path.join(materialsDir, note.file ?? "");
  if (!note.file || !fs.existsSync(abs)) {
    failed++;
    failures.push(`${note.id}: file missing on disk`);
    return;
  }

  const body = fs.readFileSync(abs);
  await put(`notes/${note.id}.pdf`, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/pdf",
    multipart: body.length > 4 * 1024 * 1024,
  });

  bytes += body.length;
  uploaded++;
  done[note.id] = true;
  if (uploaded % 10 === 0) saveLedger();
  if (uploaded % 10 === 0 || uploaded === pending.length) {
    console.log(`  uploaded ${uploaded}/${pending.length} (${(bytes / 1024 / 1024).toFixed(0)} MB)`);
  }
}

const CONCURRENCY = 4;
let cursor = 0;

async function worker() {
  while (cursor < pending.length) {
    const note = pending[cursor++];
    try {
      await uploadOne(note);
    } catch (err) {
      failed++;
      failures.push(`${note.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
saveLedger();

console.log(`\nUploaded: ${uploaded}   Failed: ${failed}   Total sent: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
if (failures.length) {
  console.log("\nFailures:");
  for (const line of failures.slice(0, 20)) console.log("  " + line);
  console.log("\nRe-run the command to retry only the failed ones.");
  process.exit(1);
}
