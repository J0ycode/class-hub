import type { ProgressEntry, Subject } from "./types";

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function fmtHours(seconds: number): string {
  const h = seconds / 3600;
  if (h < 1) return `${Math.round(seconds / 60)} min`;
  return `${h.toFixed(1)} h`;
}

export function subjectStats(subject: Subject, progress: Record<string, ProgressEntry>) {
  let done = 0;
  let started = 0;
  let watchedSeconds = 0;
  for (const m of subject.modules) {
    for (const v of m.videos) {
      const p = progress[v.id];
      if (!p) continue;
      if (p.completed) done++;
      else if (p.percent > 0) started++;
      watchedSeconds += Math.min(p.watched || 0, v.duration || p.duration || 0);
    }
  }
  const percent = subject.videoCount ? Math.round(((done + started * 0.5) / subject.videoCount) * 100) : 0;
  const donePercent = subject.videoCount ? Math.round((done / subject.videoCount) * 100) : 0;
  return { done, started, watchedSeconds, percent, donePercent };
}

export function moduleStats(subject: Subject, moduleId: string, progress: Record<string, ProgressEntry>) {
  const mod = subject.modules.find((m) => m.id === moduleId);
  if (!mod) return { done: 0, total: 0, percent: 0 };
  let done = 0;
  let partial = 0;
  for (const v of mod.videos) {
    const p = progress[v.id];
    if (p?.completed) done++;
    else if (p && p.percent > 0) partial++;
  }
  const total = mod.videos.length;
  const percent = total ? Math.round(((done + partial * 0.5) / total) * 100) : 0;
  return { done, total, percent };
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(ts).toLocaleDateString();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
