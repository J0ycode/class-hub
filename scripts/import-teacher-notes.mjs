/*
 * One-off import of the "S3 CS" folder into Teacher materials.
 *
 * Uploads each PDF to private Vercel Blob (teacher/<id>.pdf) and writes
 * data/teacher-seed.json, which the server imports into its database once
 * (see ensureTeacherSeeded in lib/db.ts). Safe to re-run: files already in
 * Blob are skipped and ids are derived from the file path.
 *
 * Needs BLOB_READ_WRITE_TOKEN in .env.local. module 0 = "General" folder.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { head, put } from "@vercel/blob";

const root = process.cwd();
const sourceDir = path.join(root, "S3 CS");
const seedFile = path.join(root, "data", "teacher-seed.json");

const SUBJECT = { dsa: "20", deld: "88", economics: "7", maths: "89", oop: "19", toc: "90" };

const FILES = [
  ["DATA STRUCTURES & ALGORITHMS/DSA MOD 1.pdf", SUBJECT.dsa, 1, "DSA Module 1"],
  ["DATA STRUCTURES & ALGORITHMS/DSA MOD 2.pdf", SUBJECT.dsa, 2, "DSA Module 2"],
  ["DATA STRUCTURES & ALGORITHMS/Ds mod 3.pdf", SUBJECT.dsa, 3, "DSA Module 3"],
  ["DATA STRUCTURES & ALGORITHMS/DS mod 4.pdf", SUBJECT.dsa, 4, "DSA Module 4"],
  ["DS LAB/DSLabManual (1).pdf", SUBJECT.dsa, 0, "Data Structures Lab Manual"],

  ["DIGITAL ELECTRONICS & LOGIC DESIGN/DELD MODULE 1.pdf", SUBJECT.deld, 1, "DELD Module 1"],
  ["DIGITAL ELECTRONICS & LOGIC DESIGN/DELD Module 2.pdf", SUBJECT.deld, 2, "DELD Module 2"],
  ["DIGITAL ELECTRONICS & LOGIC DESIGN/Module  3 DELD_notes.pdf", SUBJECT.deld, 3, "DELD Module 3 Notes"],
  ["DIGITAL ELECTRONICS & LOGIC DESIGN/MODULE 4 DELD Notes.pdf", SUBJECT.deld, 4, "DELD Module 4 Notes"],
  ["DIGITAL ELECTRONICS & LOGIC DESIGN/DELD Module 4FSM and verilog.pdf", SUBJECT.deld, 4, "DELD Module 4: FSM and Verilog"],
  ["DELD LAB/DIGITAL LAB MANUAL S3.pdf", SUBJECT.deld, 0, "Digital Lab Manual"],

  ["ECONOMICS FOR ENGINEERS/Module 1.pdf", SUBJECT.economics, 1, "Economics Module 1"],
  ["ECONOMICS FOR ENGINEERS/Elasticity of demand theory and problems.pdf", SUBJECT.economics, 1, "Elasticity of Demand: Theory and Problems"],
  ["ECONOMICS FOR ENGINEERS/Module 2 .pdf", SUBJECT.economics, 2, "Economics Module 2"],
  ["ECONOMICS FOR ENGINEERS/Module 2 problems .pdf", SUBJECT.economics, 2, "Economics Module 2 Problems"],
  ["ECONOMICS FOR ENGINEERS/Break even analysis notes.pdf", SUBJECT.economics, 2, "Break-even Analysis Notes"],
  ["ECONOMICS FOR ENGINEERS/Module 3.pdf", SUBJECT.economics, 3, "Economics Module 3"],
  ["ECONOMICS FOR ENGINEERS/Module 4.pdf", SUBJECT.economics, 4, "Economics Module 4"],

  ["MATHEMATICS FOR COMPUTER & INFORMATION SCIENCE - 3/Syllabus.pdf", SUBJECT.maths, 0, "Syllabus"],

  ["OBJECT ORIENTED PROGRAMMING/M1-OOP.pdf", SUBJECT.oop, 1, "OOP Module 1"],
  ["OBJECT ORIENTED PROGRAMMING/M2-OOP.pdf", SUBJECT.oop, 2, "OOP Module 2"],
  ["OBJECT ORIENTED PROGRAMMING/M3-OOP.pdf", SUBJECT.oop, 3, "OOP Module 3"],
  ["OBJECT ORIENTED PROGRAMMING/M4-OOP.pdf", SUBJECT.oop, 4, "OOP Module 4"],

  ["TOC/TOC Module 1.pdf", SUBJECT.toc, 1, "TOC Module 1"],
  ["TOC/TOC-Module2.pdf", SUBJECT.toc, 2, "TOC Module 2"],
  ["TOC/TOC_Module3.pdf", SUBJECT.toc, 3, "TOC Module 3"],
  ["TOC/TOC_Module4_Part1.pdf", SUBJECT.toc, 4, "TOC Module 4 Part 1"],
  ["TOC/TOC_Module4Part2.pdf", SUBJECT.toc, 4, "TOC Module 4 Part 2"],
];

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split(/\r?\n/) : []) {
  const match = line.match(/^\s*BLOB_READ_WRITE_TOKEN\s*=\s*(.+?)\s*$/);
  if (match) process.env.BLOB_READ_WRITE_TOKEN = match[1].replace(/^["']|["']$/g, "");
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Missing BLOB_READ_WRITE_TOKEN in .env.local.");
  process.exit(1);
}

// Every PDF in the folder must be mapped, and every mapping must exist.
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [path.relative(sourceDir, full).split(path.sep).join("/")];
  });
}
const onDisk = new Set(walk(sourceDir));
const mapped = new Set(FILES.map(([file]) => file));
const unmapped = [...onDisk].filter((f) => !mapped.has(f));
const missing = [...mapped].filter((f) => !onDisk.has(f));
if (unmapped.length || missing.length) {
  console.error("Folder and mapping differ.", { unmapped, missing });
  process.exit(1);
}

async function exists(pathname) {
  try {
    await head(pathname);
    return true;
  } catch {
    return false;
  }
}

const baseTime = Date.UTC(2026, 10, 8);
const seed = [];
let uploaded = 0;
let skipped = 0;

for (const [index, [file, subjectId, module, title]] of FILES.entries()) {
  const id = crypto.createHash("sha256").update(`s3cs:${file}`).digest("hex").slice(0, 24);
  const body = fs.readFileSync(path.join(sourceDir, file));
  if (body.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`Not a PDF: ${file}`);

  const pathname = `teacher/${id}.pdf`;
  if (await exists(pathname)) {
    skipped++;
  } else {
    await put(pathname, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/pdf",
      multipart: body.length > 4 * 1024 * 1024,
    });
    uploaded++;
    console.log(`  ${index + 1}/${FILES.length} ${title}`);
  }

  seed.push({ id, subjectId, module, title, size: body.length, uploadedBy: "admin", uploadedAt: baseTime + index * 1000 });
}

fs.writeFileSync(seedFile, JSON.stringify(seed, null, 1) + "\n");
console.log(`\nUploaded: ${uploaded}   Already there: ${skipped}   Seed rows: ${seed.length}`);
