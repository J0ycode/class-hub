"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MarkComplete({
  videoId,
  duration,
  completed,
}: {
  videoId: string;
  duration: number;
  completed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function mark() {
    setBusy(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, duration, position: duration, completed: true }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (completed) return <span className="chip good">✓ Completed</span>;

  return (
    <button className="btn ghost" onClick={mark} disabled={busy}>
      {busy ? "Saving…" : "Mark as watched"}
    </button>
  );
}
