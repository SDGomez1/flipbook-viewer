import { useEffect, useMemo, useRef, useState } from "react";
import { ResolvedPageAssets } from "../lib/documentResolver";
import { resolvePdfFromBin } from "../lib/binPdf";
import { getPdfDocument, getPdfDocumentFromBytes } from "../lib/pdfRender";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfRenderTarget } from "./SpreadView";

type PageViewProps = {
  page: number | null;
  assets: ResolvedPageAssets | null;
  pdfTarget: PdfRenderTarget | null;
  zoom: number;
  isInteracting: boolean;
  isCurrent: boolean;
};

const HD_ZOOM_THRESHOLD = 1.6;
const MAX_HD_MULTIPLIER = 6;
const MAX_CANVAS_PIXELS = 32_000_000;

function loadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Image failed to load: ${url}`));
    image.src = url;
  });
}

export function PageView({
  page,
  assets,
  pdfTarget,
  zoom,
  isInteracting,
  isCurrent,
}: PageViewProps) {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [fullFailed, setFullFailed] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const imageWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const shouldRenderPdf = useMemo(
    () =>
      Boolean(
        page !== null &&
        isCurrent &&
        pdfTarget !== null &&
        zoom >= HD_ZOOM_THRESHOLD &&
        !isInteracting,
      ),
    [page, isCurrent, pdfTarget, zoom, isInteracting],
  );

  useEffect(() => {
    if (!assets || page === null) {
      return;
    }

    let cancelled = false;

    setThumbLoaded(false);
    setFullLoaded(false);
    setThumbFailed(false);
    setFullFailed(false);
    setPdfReady(false);
    setPdfError(false);

    void loadImage(assets.thumbUrl)
      .then(() => {
        if (!cancelled) {
          setThumbLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThumbFailed(true);
        }
      });

    void loadImage(assets.imageUrl)
      .then(() => {
        if (!cancelled) {
          setFullLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFullFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assets, page]);

  useEffect(() => {
    if (!shouldRenderPdf || page === null || pdfTarget === null) {
      setPdfReady(false);
      setPdfError(false);
      return;
    }

    const canvas = canvasRef.current;
    const imageWrap = imageWrapRef.current;

    if (!canvas || !imageWrap) {
      return;
    }

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null =
      null;

    setPdfError(false);
    setPdfReady(false);

    const render = async () => {
      try {
        let pdfDocument: PDFDocumentProxy;
        let pageNumberInDocument = 1;

        if (pdfTarget.kind === "url") {
          pdfDocument = await getPdfDocument(pdfTarget.pdfUrl);
          pageNumberInDocument = pdfTarget.pageNumberInDocument;
        } else {
          const binResolution = await resolvePdfFromBin(
            pdfTarget.binUrl,
            pdfTarget.page,
            pdfTarget.binIndex,
          );

          if (binResolution) {
            pdfDocument = await getPdfDocumentFromBytes(
              binResolution.cacheKey,
              binResolution.bytes,
            );
            pageNumberInDocument = binResolution.pageNumberInDocument;
          } else if (pdfTarget.fallbackPdfUrl) {
            pdfDocument = await getPdfDocument(pdfTarget.fallbackPdfUrl);
            pageNumberInDocument = 1;
          } else {
            throw new Error(
              "No decodable PDF source from BIN and no fallback PDF URL.",
            );
          }
        }

        if (cancelled) {
          return;
        }

        const safePageNumber = Math.min(
          Math.max(1, pageNumberInDocument),
          pdfDocument.numPages,
        );
        const pdfPage = await pdfDocument.getPage(safePageNumber);
        if (cancelled) {
          return;
        }

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const wrapWidth = imageWrap.clientWidth;
        const wrapHeight = imageWrap.clientHeight;

        if (wrapWidth <= 0 || wrapHeight <= 0) {
          return;
        }

        const fitScale = Math.min(
          wrapWidth / baseViewport.width,
          wrapHeight / baseViewport.height,
        );
        const qualityBoost = Math.min(Math.max(zoom * 1.12, 1), MAX_HD_MULTIPLIER);
        const pixelRatio = window.devicePixelRatio || 1;
        let renderScale = fitScale * qualityBoost * pixelRatio;

        let viewport = pdfPage.getViewport({ scale: renderScale });
        const viewportPixels = viewport.width * viewport.height;
        if (viewportPixels > MAX_CANVAS_PIXELS) {
          const scaleDown = Math.sqrt(MAX_CANVAS_PIXELS / viewportPixels);
          renderScale *= scaleDown;
          viewport = pdfPage.getViewport({ scale: renderScale });
        }
        const displayWidth = baseViewport.width * fitScale;
        const displayHeight = baseViewport.height * fitScale;

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("2D canvas context is unavailable.");
        }
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        renderTask = pdfPage.render({
          canvasContext: context,
          viewport,
        });

        await renderTask.promise;
        if (!cancelled) {
          setPdfReady(true);
        }
      } catch (error) {
        const canceledError =
          error instanceof Error &&
          error.name === "RenderingCancelledException";
        if (!cancelled && !canceledError) {
          setPdfError(true);
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [shouldRenderPdf, page, pdfTarget, zoom]);

  const cardClass = `relative mx-auto flex min-h-[760px] w-full flex-col rounded-sm bg-[#f3c942] p-4 shadow-[0_28px_60px_rgba(0,0,0,0.55)] max-[900px]:min-h-[620px] max-[640px]:min-h-[520px] ${
    isCurrent ? "ring-1 ring-white/35" : "opacity-90"
  }`;

  if (page === null || assets === null) {
    return (
      <article
        className="mx-auto flex min-h-[760px] w-full flex-col rounded-sm border border-dashed border-white/30 bg-[#1c3342aa] max-[900px]:min-h-[620px] max-[640px]:min-h-[520px]"
        aria-hidden="true"
      >
        <div className="m-auto text-xs uppercase tracking-[0.08em] text-[#b8d0dd]">
          Blank side
        </div>
      </article>
    );
  }

  const hasFailed = thumbFailed && fullFailed;
  const showThumb = thumbLoaded && !fullLoaded;
  const showFull = fullLoaded;

  return (
    <article className={cardClass}>
      <div
        className="relative flex-1 overflow-hidden rounded-[2px] border border-[#5d4d1a] bg-[#101a22]"
        ref={imageWrapRef}
      >
        {showThumb && (
          <img
            src={assets.thumbUrl}
            alt={`Thumbnail page ${page}`}
            loading={isCurrent ? "eager" : "lazy"}
            className="block h-full w-full object-contain saturate-[1.02] contrast-[0.98]"
            draggable={false}
          />
        )}
        {showFull && (
          <img
            src={assets.imageUrl}
            alt={`Page ${page}`}
            loading={isCurrent ? "eager" : "lazy"}
            className="block h-full w-full animate-[reveal-full_180ms_ease-out] object-contain touch-none"
            draggable={false}
          />
        )}
        {shouldRenderPdf && (
          <div
            className="pointer-events-none absolute inset-0 grid place-items-center"
            aria-hidden="true"
          >
            <canvas
              ref={canvasRef}
              className={`rounded-[2px] shadow-[0_0_0_1px_rgba(16,38,56,0.08)] transition-opacity duration-150 ease-out ${
                pdfReady ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        )}
        {!showThumb && !showFull && !hasFailed && (
          <div className="absolute inset-0 grid place-items-center text-[0.92rem] font-semibold text-[#3f6178]">
            Loading page {page}...
          </div>
        )}
        {hasFailed && (
          <div className="absolute inset-0 grid place-items-center text-[0.92rem] font-semibold text-[#a62e2e]">
            Failed to load page {page}
          </div>
        )}
        {pdfError && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-[#982a2af0] px-2 py-0.5 text-[0.67rem] font-bold uppercase tracking-[0.08em] text-[#fff5f5]">
            HD render unavailable
          </div>
        )}
        {pdfReady && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-[#1c5d34eb] px-2 py-0.5 text-[0.67rem] font-bold uppercase tracking-[0.08em] text-[#f7fff9]">
            HD
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between px-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1f3443]">
        <span>Page {page}</span>
        <span>{showFull ? "HD Image" : showThumb ? "Thumb" : "Pending"}</span>
      </div>
    </article>
  );
}
