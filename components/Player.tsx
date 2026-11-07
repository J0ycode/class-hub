"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  videoId: string;
  yt: string;
  startAt: number;
  duration: number;
  initialPercent: number;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export default function Player({ videoId, yt, startAt, duration, initialPercent }: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const player = useRef<any>(null);
  const lastSent = useRef(0);
  const [percent, setPercent] = useState(initialPercent);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");

  const send = useCallback(
    (position: number, total: number, keepalive = false) => {
      if (!Number.isFinite(position) || position <= 0) return;
      const body = JSON.stringify({ videoId, position, duration: total || duration });
      try {
        if (keepalive && navigator.sendBeacon) {
          navigator.sendBeacon("/api/progress", new Blob([body], { type: "application/json" }));
        } else {
          fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive,
          })
            .then((r) => {
              if (!r.ok) throw new Error(String(r.status));
              return r.json();
            })
            .then((data) => {
              if (typeof data?.percent === "number") setPercent(data.percent);
              setStatus("saved");
              window.setTimeout(() => setStatus((s) => (s === "saved" ? "ready" : s)), 1600);
            })
            .catch(() => setStatus("error"));
        }
      } catch {
        setStatus("error");
      }
    },
    [videoId, duration],
  );

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;

    loadYouTubeApi().then(() => {
      if (disposed || !holder.current || !window.YT?.Player) return;

      player.current = new window.YT.Player(holder.current, {
        videoId: yt,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: any) => {
            setStatus("ready");
            const total = e.target.getDuration() || duration;
            if (startAt > 20 && startAt < total - 30) {
              e.target.seekTo(startAt, true);
            }
          },
          onStateChange: (e: any) => {
            const YT = window.YT;
            if (!YT) return;
            if (e.data === YT.PlayerState.PLAYING) setStatus("ready");
            if (e.data === YT.PlayerState.PAUSED) {
              const t = e.target.getCurrentTime();
              const d = e.target.getDuration();
              send(t, d);
              lastSent.current = Date.now();
            }
            if (e.data === YT.PlayerState.ENDED) {
              send(e.target.getDuration(), e.target.getDuration());
            }
          },
        },
      });

      timer = window.setInterval(() => {
        const p = player.current;
        if (!p?.getCurrentTime) return;
        const state = p.getPlayerState?.();
        if (state !== 1) return;
        const t = p.getCurrentTime();
        const d = p.getDuration() || duration;
        if (Date.now() - lastSent.current > 12000) {
          lastSent.current = Date.now();
          send(t, d);
        }
        if (d > 0) setPercent(Math.min(100, Math.round((t / d) * 100)));
      }, 5000);
    });

    const onHide = () => {
      const p = player.current;
      if (!p?.getCurrentTime) return;
      const t = p.getCurrentTime();
      const d = p.getDuration() || duration;
      if (t > 0) send(t, d, true);
    };
    window.addEventListener("pagehide", onHide);

    return () => {
      disposed = true;
      if (timer) window.clearInterval(timer);
      window.removeEventListener("pagehide", onHide);
      try {
        player.current?.destroy?.();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt]);

  return (
    <>
      <div className="player-wrap">
        <div className="player-ratio">
          <div ref={holder} />
        </div>
      </div>
      <div className="row-between" style={{ marginTop: 12 }}>
        <div className="tiny">
          {status === "loading" && "Loading player…"}
          {status === "ready" && `Saved automatically · ${percent}% watched`}
          {status === "saving" && "Saving…"}
          {status === "saved" && `Progress saved · ${percent}%`}
          {status === "error" && "Could not save progress — check your connection"}
        </div>
        <div className="bar" style={{ width: 140 }}>
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
    </>
  );
}
