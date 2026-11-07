import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const projectRoot = path.resolve(appRoot, "..");

const videosCsv = path.join(projectRoot, "ones_all_videos.csv");
const manifestCsv = path.join(projectRoot, "ones_materials_manifest.csv");
const materialsRoot = path.join(projectRoot, "ones_materials");
const outFile = path.join(appRoot, "data", "catalogue.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); field = ""; if (row.some(Boolean)) rows.push(row); row = []; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); if (row.some(Boolean)) rows.push(row); }
  const header = rows.shift().map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function subjectCode(name) {
  const m = name.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : "";
}

function subjectShort(name) {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function moduleLabel(chapter) {
  const m = chapter.match(/^\s*(MODULE\s*\d+)/i);
  if (m) return m[1].replace(/\s+/g, " ").toUpperCase();
  return chapter.replace(/\s+/g, " ").trim();
}

function lessonLabel(title) {
  const t = title.replace(/\s+/g, " ").trim();
  const pq = /^\[PQ\]\s*-\s*/i.test(t);
  const ssqs = /^SSQS\s*-\s*/i.test(t);
  const m = t.match(/\bS\s*(\d+)\b/i);
  const prefix = pq ? "PQ " : ssqs ? "SSQS " : "";
  if (m) return `${prefix}S${m[1].padStart(2, "0")}`;
  return prefix ? prefix.trim() : t.slice(0, 24);
}

const videoRows = parseCsv(fs.readFileSync(videosCsv, "utf8"));

// ---- build subjects tree -------------------------------------------------
const subjects = new Map();

for (const r of videoRows) {
  if (!r.subject_id || !r.youtube_id) continue;
  const sid = r.subject_id;
  if (!subjects.has(sid)) {
    subjects.set(sid, {
      id: sid,
      name: subjectShort(r.subject),
      code: subjectCode(r.subject),
      fullName: r.subject,
      course: r.course,
      modules: new Map(),
    });
  }
  const subject = subjects.get(sid);
  const mid = r.chapter_id;
  if (!subject.modules.has(mid)) {
    subject.modules.set(mid, {
      id: mid,
      name: moduleLabel(r.chapter),
      fullName: r.chapter.replace(/\s+/g, " ").trim(),
      videos: [],
    });
  }
  subject.modules.get(mid).videos.push({
    id: String(r.platform_video_id),
    title: r.video_title.replace(/\s+/g, " ").trim(),
    label: lessonLabel(r.video_title),
    yt: r.youtube_id,
    duration: Number(r.duration_s) || 0,
    order: Number(r.video_order) || 0,
  });
}

const subjectList = [...subjects.values()]
  .map((s) => {
    const modules = [...s.modules.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    modules.forEach((m) => m.videos.sort((a, b) => a.order - b.order));
    const videos = modules.flatMap((m) => m.videos);
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      fullName: s.fullName,
      course: s.course,
      modules,
      videoCount: videos.length,
      totalSeconds: videos.reduce((n, v) => n + v.duration, 0),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// ---- notes ---------------------------------------------------------------
const notes = [];
if (fs.existsSync(manifestCsv)) {
  const noteRows = parseCsv(fs.readFileSync(manifestCsv, "utf8"));
  for (const r of noteRows) {
    if (!r.file || !fs.existsSync(r.file)) continue;
    let rel = path.relative(materialsRoot, r.file);
    if (rel.startsWith("..")) rel = "";
    notes.push({
      id: `${r.chapter_id}-${r.order || "0"}`,
      subjectName: String(r.subject || "").trim(),
      chapterName: String(r.chapter || "").trim(),
      title: String(r.title || "").trim(),
      order: Number(r.order) || 0,
      file: rel.replace(/\\/g, "/"),
      sourceUrl: String(r.source_url || ""),
    });
  }
}

// link notes to subjects/modules by matching names
const byFullSubject = new Map(subjectList.map((s) => [s.fullName.toUpperCase(), s]));
for (const n of notes) {
  const subj = byFullSubject.get(n.subjectName.toUpperCase());
  n.subjectId = subj ? subj.id : "";
  n.moduleId = "";
  if (subj) {
    const mod = subj.modules.find((m) => m.fullName.toUpperCase() === n.chapterName.toUpperCase());
    n.moduleId = mod ? mod.id : "";
  }
}

const catalogue = {
  generatedAt: new Date().toISOString(),
  courses: [...new Set(subjectList.map((s) => s.course))],
  totalVideos: subjectList.reduce((n, s) => n + s.videoCount, 0),
  totalSeconds: subjectList.reduce((n, s) => n + s.totalSeconds, 0),
  subjects: subjectList,
  notes,
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(catalogue, null, 1), "utf8");

console.log(`catalogue: ${catalogue.totalVideos} videos, ${subjectList.length} subjects, ${notes.length} notes`);
console.log(`written -> ${outFile}`);
