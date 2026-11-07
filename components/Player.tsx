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

function clock(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

const ICON: Record<string, string> = {
  play: "M8 5v14l11-7z",
  pause: "M7 5h4v14H7zM13 5h4v14h-4z",
  back: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
  fwd: "M13 7l5 5-5 5M6 7l5 5-5 5",
  vol: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  mute: "M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6",
  full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  exit: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  replay: "M4 12a8 8 0 1 0 3-6.2M4 4v5h5",
};

function Svg({ name, filled = false }: { name: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON[name]} />
    </svg>
  );
}

export default function Player({ videoId, yt, startAt, duration, initialPercent }: Props) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const holder = useRef<HTMLDivElement | null>(null);
  const player = useRef<any>(null);
  const lastSent = useRef(0);
  const [percent, setPercent] = useState(initialPercent);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");

  // Custom-control state (YouTube's own controls are disabled).
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFull, setIsFull] = useState(false);

  const send = useCallback(
    (position: number, totalSec: number, keepalive = false) => {
      if (!Number.isFinite(position) || position <= 0) return;
      const body = JSON.stringify({ videoId, position, duration: totalSec || duration });
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
    let progressTimer: number | undefined;
    let uiTimer: number | undefined;

    loadYouTubeApi().then(() => {
      if (disposed || !holder.current || !window.YT?.Player) return;

      player.current = new window.YT.Player(holder.current, {
        videoId: yt,
        // Privacy-enhanced host; YouTube's own UI is hidden and covered by our shield.
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          controls: 0, // no YouTube control bar (hides its logo / "Watch on YouTube")
          disablekb: 1, // our page handles keys
          fs: 0, // no YouTube fullscreen button; we fullscreen our own wrapper
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3, // no annotations/cards
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: any) => {
            setStatus("ready");
            const t = e.target.getDuration() || duration;
            setTotal(t);
            if (startAt > 20 && startAt < t - 30) {
              e.target.seekTo(startAt, true);
              setCurrent(startAt);
            }
          },
          onStateChange: (e: any) => {
            const YT = window.YT;
            if (!YT) return;
            if (e.data === YT.PlayerState.PLAYING) {
              setStatus("ready");
              setPlaying(true);
              setEnded(false);
              setStarted(true);
            }
            if (e.data === YT.PlayerState.PAUSED) {
              setPlaying(false);
              const t = e.target.getCurrentTime();
              const d = e.target.getDuration();
              send(t, d);
              lastSent.current = Date.now();
            }
            if (e.data === YT.PlayerState.ENDED) {
              setPlaying(false);
              setEnded(true);
              send(e.target.getDuration(), e.target.getDuration());
            }
          },
        },
      });

      progressTimer = window.setInterval(() => {
        const p = player.current;
        if (!p?.getCurrentTime) return;
        if (p.getPlayerState?.() !== 1) return;
        const t = p.getCurrentTime();
        const d = p.getDuration() || duration;
        if (Date.now() - lastSent.current > 12000) {
          lastSent.current = Date.now();
          send(t, d);
        }
        if (d > 0) setPercent(Math.min(100, Math.round((t / d) * 100)));
      }, 5000);

      uiTimer = window.setInterval(() => {
        const p = player.current;
        if (!p?.getCurrentTime) return;
        setCurrent(p.getCurrentTime());
        const d = p.getDuration?.();
        if (d) setTotal(d);
      }, 500);
    });

    const onHide = () => {
      const p = player.current;
      if (!p?.getCurrentTime) return;
      const t = p.getCurrentTime();
      const d = p.getDuration() || duration;
      if (t > 0) send(t, d, true);
    };
    const onFull = () => setIsFull(document.fullscreenElement === wrap.current);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("fullscreenchange", onFull);

    return () => {
      disposed = true;
      if (progressTimer) window.clearInterval(progressTimer);
      if (uiTimer) window.clearInterval(uiTimer);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("fullscreenchange", onFull);
      try {
        player.current?.destroy?.();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt]);

  const ready = status !== "loading";

  function toggle() {
    const p = player.current;
    if (!p?.playVideo) return;
    if (ended) {
      p.seekTo(0, true);
      p.playVideo();
      return;
    }
    if (playing) p.pauseVideo();
    else p.playVideo();
  }

  function seekTo(sec: number) {
    const p = player.current;
    if (!p?.seekTo) return;
    const t = Math.max(0, Math.min(sec, (total || duration) - 1));
    p.seekTo(t, true);
    setCurrent(t);
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    player.current?.setPlaybackRate?.(next);
    setRate(next);
  }

  function toggleMute() {
    const p = player.current;
    if (!p?.mute) return;
    if (muted) p.unMute();
    else p.mute();
    setMuted(!muted);
  }

  function toggleFull() {
    const el = wrap.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowLeft" || e.key === "j") seekTo(current - 10);
    else if (e.key === "ArrowRight" || e.key === "l") seekTo(current + 10);
    else if (e.key === "m") toggleMute();
    else if (e.key === "f") toggleFull();
  }

  const shown = total || duration;
  const pct = shown > 0 ? Math.min(100, (current / shown) * 100) : 0;

  return (
    <>
      <div
        ref={wrap}
        className={`player-wrap secure${isFull ? " is-full" : ""}`}
        tabIndex={0}
        onKeyDown={onKey}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Video player"
      >
        <div className="player-ratio">
          <div ref={holder} />
          {/* Shield: blocks every click into YouTube's UI (title, logo, share, "watch on YouTube", suggestions). */}
          <button
            type="button"
            className={`player-shield ${!started || ended ? "idle" : !playing ? "paused" : ""}`}
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            disabled={!ready}
          >
            {!playing ? (
              <span className="shield-center">
                <span className="big-play">
                  <Svg name={ended ? "replay" : "play"} filled={!ended} />
                </span>
                <span className="shield-label">{ended ? "Watch again" : started ? "Paused" : "Play class"}</span>
              </span>
            ) : null}
          </button>
        </div>

        <div className="pc-bar">
          <input
            className="pc-seek"
            type="range"
            min={0}
            max={Math.max(1, Math.floor(shown))}
            step={1}
            value={Math.floor(current)}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Seek"
            style={{ ["--pct" as string]: `${pct}%` }}
            disabled={!ready}
          />
          <div className="pc-row">
            <button type="button" className="pc-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"} disabled={!ready}>
              <Svg name={playing ? "pause" : "play"} filled />
            </button>
            <button type="button" className="pc-btn" onClick={() => seekTo(current - 10)} aria-label="Back 10 seconds" disabled={!ready}>
              <Svg name="back" />
            </button>
            <button type="button" className="pc-btn" onClick={() => seekTo(current + 10)} aria-label="Forward 10 seconds" disabled={!ready}>
              <Svg name="fwd" />
            </button>
            <span className="pc-time">
              {clock(current)} / {clock(shown)}
            </span>
            <span className="pc-spacer" />
            <button type="button" className="pc-btn pc-speed" onClick={cycleSpeed} aria-label={`Speed ${rate}x`} disabled={!ready}>
              {rate}×
            </button>
            <button type="button" className="pc-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} disabled={!ready}>
              <Svg name={muted ? "mute" : "vol"} />
            </button>
            <button type="button" className="pc-btn" onClick={toggleFull} aria-label={isFull ? "Exit fullscreen" : "Fullscreen"} disabled={!ready}>
              <Svg name={isFull ? "exit" : "full"} />
            </button>
          </div>
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
