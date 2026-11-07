"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * "Add to home screen" helper.
 * Chrome/Edge/Android fire `beforeinstallprompt` and get a real prompt;
 * iOS Safari has no prompt, so we show the Share-sheet steps instead.
 */
export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setInstalled(isStandalone());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setHint(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!promptEvent) {
      const ios = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
      setHint(
        ios
          ? "Tap Share, then “Add to Home Screen”."
          : "Open your browser menu and choose “Install app” (or “Add to Home screen”).",
      );
      return;
    }
    setHint(null);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  return (
    <>
      <button className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={install}>
        <span style={{ marginRight: 7 }}>⤓</span>
        Install app
      </button>
      {hint ? <p className="install-hint">{hint}</p> : null}
    </>
  );
}
