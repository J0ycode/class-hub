import fs from "node:fs";
import path from "node:path";
import type { Catalogue } from "./types";

let cached: Catalogue | null = null;

export function getCatalogue(): Catalogue {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "catalogue.json");
  const raw = fs.readFileSync(file, "utf8");
  cached = JSON.parse(raw) as Catalogue;
  return cached;
}

export function allVideos(cat: Catalogue) {
  const out = [];
  for (const subject of cat.subjects) {
    for (const module of subject.modules) {
      for (const video of module.videos) {
        out.push({ video, module, subject });
      }
    }
  }
  return out;
}

export function findVideo(cat: Catalogue, id: string) {
  for (const subject of cat.subjects) {
    for (const module of subject.modules) {
      const idx = module.videos.findIndex((v) => v.id === id);
      if (idx >= 0) {
        return {
          subject,
          module,
          video: module.videos[idx],
          prev: module.videos[idx - 1] ?? null,
          next: module.videos[idx + 1] ?? null,
          index: idx,
        };
      }
    }
  }
  return null;
}

export function notesForModule(cat: Catalogue, subjectId: string, moduleId: string) {
  return cat.notes
    .filter((n) => n.subjectId === subjectId && n.moduleId === moduleId)
    .sort((a, b) => a.order - b.order);
}
