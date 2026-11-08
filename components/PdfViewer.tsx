"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

// PDF.js is served from public/pdfjs rather than bundled: phones cannot show
// PDFs inside a page natively (Android downloads them, iPhone shows page one).
const BASE = "/pdfjs/";
const ZOOMS = [1, 1.25, 1.5, 2, 2.5, 3];

type PageSize = { width: number; height: number };

function PdfPage({
  pdf,
  pageNumber,
  width,
  estimate,
  onVisible,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  estimate: PageSize;
  onVisible: (n: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [size, setSize] = useState<PageSize>(estimate);
  const [failed, setFailed] = useState(false);

  // Render only pages near the screen, and drop far ones, so long scans don't exhaust phone memory.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const nearby = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "1500px 0px" });
    const current = new IntersectionObserver(([e]) => e.isIntersecting && onVisible(pageNumber), { rootMargin: "-45% 0px -45% 0px" });
    nearby.observe(el);
    current.observe(el);
    return () => {
      nearby.disconnect();
      current.disconnect();
    };
  }, [pageNumber, onVisible]);

  useEffect(() => {
    const node = canvas.current;
    if (!near || !node || width <= 0) {
      if (node) node.width = node.height = 0;
      return;
    }

    let cancelled = false;
    let task: { promise: Promise<void>; cancel: () => void } | null = null;
    let page: PDFPageProxy | null = null;

    pdf
      .getPage(pageNumber)
      .then((p) => {
        if (cancelled) return;
        page = p;
        const base = p.getViewport({ scale: 1 });
        const scale = width / base.width;
        const viewport = p.getViewport({ scale: scale * Math.min(window.devicePixelRatio || 1, 2) });
        setSize({ width: base.width, height: base.height });
        node.width = Math.floor(viewport.width);
        node.height = Math.floor(viewport.height);
        task = p.render({ canvas: node, viewport });
        return task.promise;
      })
      .catch((err: { name?: string }) => {
        if (!cancelled && err?.name !== "RenderingCancelledException") setFailed(true);
      });

    return () => {
      cancelled = true;
      task?.cancel();
      page?.cleanup();
    };
  }, [near, pdf, pageNumber, width]);

  return (
    <div
      ref={box}
      className="pdf-page"
      data-page={pageNumber}
      style={{ width, height: Math.round((width * size.height) / size.width) }}
    >
      {failed ? <div className="pdf-page-msg">Couldn’t draw page {pageNumber}.</div> : <canvas ref={canvas} aria-label={`Page ${pageNumber}`} />}
    </div>
  );
}

export default function PdfViewer({ url, title, fallback }: { url: string; title: string; fallback: string }) {
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [first, setFirst] = useState<PageSize>({ width: 595, height: 842 });
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [stageWidth, setStageWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let task: { promise: Promise<PDFDocumentProxy>; destroy: () => Promise<void>; onProgress: unknown } | null = null;

    (async () => {
      try {
        const lib = await import(/* webpackIgnore: true */ `${BASE}pdf.min.mjs`);
        lib.GlobalWorkerOptions.workerSrc = `${BASE}pdf.worker.min.mjs`;
        task = lib.getDocument({
          url,
          standardFontDataUrl: `${BASE}standard_fonts/`,
          wasmUrl: `${BASE}wasm/`,
          disableRange: true, // our PDF routes stream the whole file
        });
        task!.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (!cancelled && total > 0) setProgress(Math.min(99, Math.round((loaded / total) * 100)));
        };
        const doc = await task!.promise;
        const page = await doc.getPage(1);
        const v = page.getViewport({ scale: 1 });
        if (cancelled) return;
        setFirst({ width: v.width, height: v.height });
        setPdf(doc);
      } catch {
        if (!cancelled) setError("This PDF couldn’t be opened. Check your connection and try again.");
      }
    })();

    return () => {
      cancelled = true;
      task?.destroy().catch(() => undefined);
    };
  }, [url]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setStageWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdf]);

  const pageWidth = Math.min(stageWidth, 920) * zoom;
  const pages = useMemo(() => Array.from({ length: pdf?.numPages ?? 0 }, (_, i) => i + 1), [pdf]);
  const zoomIndex = ZOOMS.indexOf(zoom);

  function back() {
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  }

  function goTo(n: number) {
    const target = stage.current?.querySelector(`[data-page="${Math.max(1, Math.min(n, pages.length))}"]`);
    target?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <button type="button" className="pc-btn pdf-back" onClick={back} aria-label="Back">
          ←
        </button>
        <div className="pdf-title" title={title}>
          {title}
        </div>
        {pdf ? (
          <div className="pdf-controls">
            <button type="button" className="pc-btn" onClick={() => goTo(current - 1)} disabled={current <= 1} aria-label="Previous page">
              ‹
            </button>
            <span className="pdf-count">
              {current} / {pages.length}
            </span>
            <button type="button" className="pc-btn" onClick={() => goTo(current + 1)} disabled={current >= pages.length} aria-label="Next page">
              ›
            </button>
            <button type="button" className="pc-btn" onClick={() => setZoom(ZOOMS[zoomIndex - 1])} disabled={zoomIndex <= 0} aria-label="Zoom out">
              −
            </button>
            <button type="button" className="pc-btn" onClick={() => setZoom(ZOOMS[zoomIndex + 1])} disabled={zoomIndex >= ZOOMS.length - 1} aria-label="Zoom in">
              +
            </button>
          </div>
        ) : null}
      </div>

      <div ref={stage} className="pdf-stage">
        {error ? <div className="empty">{error}</div> : null}
        {!pdf && !error ? (
          <div className="pdf-loading" role="status">
            Opening PDF… {progress > 0 ? `${progress}%` : ""}
            <div className="bar" style={{ width: 200, marginTop: 12 }}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
        {pdf && stageWidth > 0
          ? pages.map((n) => <PdfPage key={n} pdf={pdf} pageNumber={n} width={pageWidth} estimate={first} onVisible={setCurrent} />)
          : null}
      </div>
    </div>
  );
}
