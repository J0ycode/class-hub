"use client";

import { useState } from "react";

type State = { kind: "idle" | "checking" | "updating" | "latest" | "error"; text?: string };

/**
 * "Check for updates" for the installed app (and the browser).
 * Compares the version this page was built from with the live deployment and,
 * if newer, activates the new service worker, clears old caches and reloads in
 * place: no reinstall, no second home-screen shortcut.
 */
export default function UpdateButton({ version }: { version: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function check() {
    setState({ kind: "checking" });
    try {
      // Ask the browser to fetch a fresh service worker too.
      const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      await reg?.update().catch(() => undefined);

      const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const { version: live } = (await res.json()) as { version: string };

      const swWaiting = Boolean(reg?.waiting);
      if (live === version && !swWaiting) {
        setState({ kind: "latest", text: `You’re up to date ✓ (version ${version})` });
        return;
      }

      setState({ kind: "updating", text: "Updating to the latest version…" });
      if (reg?.waiting) {
        reg.waiting.postMessage("SKIP_WAITING");
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
          window.setTimeout(resolve, 3000);
        });
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      window.location.reload();
    } catch {
      setState({ kind: "error", text: "Couldn’t check for updates. Check your connection." });
    }
  }

  const busy = state.kind === "checking" || state.kind === "updating";

  return (
    <>
      <button type="button" className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={check} disabled={busy}>
        <span style={{ marginRight: 7 }} aria-hidden="true">
          ↻
        </span>
        {state.kind === "checking" ? "Checking…" : state.kind === "updating" ? "Updating…" : "Check for updates"}
      </button>
      {state.text ? (
        <p className={`install-hint update-${state.kind}`} role="status" aria-live="polite">
          {state.text}
        </p>
      ) : null}
    </>
  );
}
