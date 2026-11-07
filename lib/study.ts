import type { ProgressEntry } from "./types";

// Students are in India; the server runs in UTC, so dates use IST explicitly.
const TZ = "Asia/Kolkata";

function dayKey(ts: number): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ts));
}

export function greeting(now = Date.now()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date(now)));
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Late-night session";
}

const QUOTES: { text: string; by: string }[] = [
  { text: "The expert in anything was once a beginner.", by: "Helen Hayes" },
  { text: "Small steps every day add up to big results.", by: "Unknown" },
  { text: "Learning never exhausts the mind.", by: "Leonardo da Vinci" },
  { text: "It always seems impossible until it's done.", by: "Nelson Mandela" },
  { text: "Focus on progress, not perfection.", by: "Unknown" },
  { text: "The beautiful thing about learning is that nobody can take it away from you.", by: "B.B. King" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", by: "Robert Collier" },
  { text: "Don't watch the clock; do what it does. Keep going.", by: "Sam Levenson" },
  { text: "An investment in knowledge pays the best interest.", by: "Benjamin Franklin" },
  { text: "You don't have to be great to start, but you have to start to be great.", by: "Zig Ziglar" },
  { text: "Discipline is choosing between what you want now and what you want most.", by: "Abraham Lincoln" },
  { text: "One class at a time. That's how mountains get climbed.", by: "Class Hub" },
];

/** Same quote all day for everyone, a new one each day. */
export function dailyQuote(now = Date.now()) {
  const [y, m, d] = dayKey(now).split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return QUOTES[dayNumber % QUOTES.length];
}

/**
 * Consecutive IST days with any watch activity, ending today. If nothing was
 * watched yet today, the streak still counts from yesterday so it isn't lost
 * before the student sits down.
 */
export function studyStreak(progress: Record<string, ProgressEntry>, now = Date.now()) {
  const days = new Set(Object.values(progress).map((p) => dayKey(p.updatedAt)));
  const studiedToday = days.has(dayKey(now));

  let streak = 0;
  let cursor = studiedToday ? now : now - 86_400_000;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor -= 86_400_000;
  }
  return { streak, studiedToday };
}
