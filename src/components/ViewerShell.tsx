import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Toolbar } from "./Toolbar";
import {
  MIN_SPREAD_VIEWPORT_WIDTH,
  useViewerStore,
} from "../store/viewerStore";
import {
  createDocumentResolver,
  detectPdfStrategy,
  StrategyDetectionResult,
} from "../lib/documentResolver";
import { canGoNext, canGoPrevious } from "../lib/viewerPagination";
import { ViewerDocumentConfig } from "../types/viewerDocument";
import { SpreadView } from "./SpreadView";
import { InteractiveViewport } from "./InteractiveViewport";
import { PageScrubber } from "./PageScrubber";
import { AppButton } from "./AppButton";

type DetectionState = "idle" | "loading" | "ready" | "error";

type ViewerShellProps = {
  documentConfig: ViewerDocumentConfig;
};

export function ViewerShell({ documentConfig }: ViewerShellProps) {
  const {
    currentPage,
    totalPages,
    mode,
    zoom,
    panX,
    panY,
    isInteracting,
    goNext,
    goPrevious,
    setTotalPages,
    setCurrentPage,
    setMode,
    setZoom,
    setPan,
    setIsInteracting,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useViewerStore();

  const resolver = useMemo(
    () => createDocumentResolver(documentConfig),
    [documentConfig.baseUrl, documentConfig.name]
  );
  const [canUseSpreadMode, setCanUseSpreadMode] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.innerWidth >= MIN_SPREAD_VIEWPORT_WIDTH;
  });
  const [detectionState, setDetectionState] = useState<DetectionState>("idle");
  const [detectionResult, setDetectionResult] =
    useState<StrategyDetectionResult | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const effectiveMode = canUseSpreadMode ? mode : "single";

  const runDetection = useCallback(async () => {
    setDetectionState("loading");
    setDetectionError(null);
    setDetectionResult(null);

    try {
      const result = await detectPdfStrategy(documentConfig);
      setDetectionResult(result);
      setDetectionState("ready");
      console.info("[viewer] strategy detected", result);
    } catch (error) {
      setDetectionState("error");
      setDetectionError(
        error instanceof Error ? error.message : "Unknown detection error.",
      );
    }
  }, [
    documentConfig.baseUrl,
    documentConfig.name,
    documentConfig.paddingDigits,
    documentConfig.pdfStrategy
  ]);

  useEffect(() => {
    void runDetection();
  }, [runDetection]);

  useEffect(() => {
    setTotalPages(documentConfig.totalPages);
  }, [documentConfig.totalPages, setTotalPages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setCanUseSpreadMode(window.innerWidth >= MIN_SPREAD_VIEWPORT_WIDTH);
    };

    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!canUseSpreadMode && mode === "spread") {
      setMode("single");
      resetZoom();
    }
  }, [canUseSpreadMode, mode, resetZoom, setMode]);

  const handleModeChange = useCallback(
    (nextMode: "single" | "spread") => {
      if (nextMode === "spread" && !canUseSpreadMode) {
        return;
      }

      setMode(nextMode);
    },
    [canUseSpreadMode, setMode],
  );

  const handleNext = useCallback(() => {
    if (!canUseSpreadMode && mode === "spread") {
      setMode("single");
      setCurrentPage(Math.min(currentPage + 1, totalPages));
      return;
    }

    goNext();
  }, [canUseSpreadMode, mode, setMode, setCurrentPage, currentPage, totalPages, goNext]);

  const handlePrevious = useCallback(() => {
    if (!canUseSpreadMode && mode === "spread") {
      setMode("single");
      setCurrentPage(Math.max(currentPage - 1, 1));
      return;
    }

    goPrevious();
  }, [canUseSpreadMode, mode, setMode, setCurrentPage, currentPage, goPrevious]);

  const handleJumpToPage = useCallback(
    (page: number) => {
      if (!canUseSpreadMode && mode === "spread") {
        setMode("single");
      }

      setCurrentPage(page);
    },
    [canUseSpreadMode, mode, setMode, setCurrentPage],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
          event.preventDefault();
          handleNext();
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          handlePrevious();
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomIn();
          break;
        case "-":
        case "_":
          event.preventDefault();
          zoomOut();
          break;
        case "0":
          event.preventDefault();
          resetZoom();
          break;
        case "Home":
          event.preventDefault();
          handleJumpToPage(1);
          break;
        case "End":
          event.preventDefault();
          handleJumpToPage(totalPages);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleJumpToPage, handleNext, handlePrevious, zoomIn, zoomOut, resetZoom, totalPages]);

  const strategyLabel =
    detectionResult?.pdfStrategy === "perPage"
      ? `perPage (${detectionResult.paddingDigits}-digit padding)`
      : detectionResult?.pdfStrategy === "single"
        ? "single PDF"
        : detectionResult?.pdfStrategy === "imageOnly"
          ? "image-only fallback"
          : "detecting";

  const canPrev = canGoPrevious(currentPage, effectiveMode, totalPages);
  const canNext = canGoNext(currentPage, effectiveMode, totalPages);
  const statusClass = "mt-3 text-center text-xs font-semibold text-[#b8d1e0]";
  const statusErrorClass = "text-[#ff9a9a]";

  return (
    <main className="relative min-h-[100dvh] overflow-hidden px-3 pb-6 pt-3">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(42,123,158,0.32),transparent_45%),radial-gradient(circle_at_85%_70%,rgba(16,121,133,0.26),transparent_42%),linear-gradient(180deg,#020d14_0%,#041824_34%,#083042_68%,#0b3d4d_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[1300px] flex-col">
        <header className="mb-3 flex items-center justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9bb8c8]">
          <span>{documentConfig.title}</span>
          <span>
            {effectiveMode === "spread" ? "Spread" : "Single"} | {strategyLabel}
          </span>
        </header>

        <Toolbar
          currentPage={currentPage}
          totalPages={totalPages}
          mode={effectiveMode}
          canUseSpreadMode={canUseSpreadMode}
          zoom={zoom}
          canGoPrevious={canPrev}
          canGoNext={canNext}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onModeChange={handleModeChange}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetZoom={resetZoom}
          onJumpToPage={handleJumpToPage}
        />

        <motion.section
          key={`${effectiveMode}-${currentPage}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative mt-3 flex flex-1 items-center justify-center"
        >
          <AppButton
            type="button"
            disabled={!canPrev}
            onClick={handlePrevious}
            className="absolute left-2 z-20 h-12 w-8 rounded-full border-white/25 bg-[#6d8a9b80] px-0 text-lg font-black text-white max-[900px]:left-0 max-[900px]:h-10"
            title="Previous"
          >
            ❮
          </AppButton>

          <div className="w-full max-w-[980px] max-[900px]:px-1">
            <InteractiveViewport
              zoom={zoom}
              panX={panX}
              panY={panY}
              isInteracting={isInteracting}
              setZoom={setZoom}
              setPan={setPan}
              setIsInteracting={setIsInteracting}
              onSwipeNext={handleNext}
              onSwipePrevious={handlePrevious}
            >
              <SpreadView
                mode={effectiveMode}
                currentPage={currentPage}
                totalPages={totalPages}
                zoom={zoom}
                isInteracting={isInteracting}
                resolver={resolver}
                detectionResult={detectionResult}
              />
            </InteractiveViewport>
          </div>

          <AppButton
            type="button"
            disabled={!canNext}
            onClick={handleNext}
            className="absolute right-2 z-20 h-12 w-8 rounded-full border-white/25 bg-[#6d8a9b80] px-0 text-lg font-black text-white max-[900px]:right-0 max-[900px]:h-10"
            title="Next"
          >
            ❯
          </AppButton>
        </motion.section>

        <PageScrubber
          currentPage={currentPage}
          totalPages={totalPages}
          onSelectPage={handleJumpToPage}
        />

        <div className="mx-auto mt-2 text-center text-[11px] text-[#9cb6c5]">
          <p>
            <strong>Shortcuts:</strong> ←/→ navigate, +/- zoom, 0 fit, Home/End
            jump.
          </p>
          <p>{documentConfig.subtitle}</p>
        </div>

        {detectionState === "loading" && (
          <p className={statusClass}>Detecting PDF strategy...</p>
        )}

        {detectionState === "error" && (
          <p className={`${statusClass} ${statusErrorClass}`}>
            Detection failed: {detectionError}
          </p>
        )}

        {detectionResult?.pdfStrategy === "imageOnly" && (
          <p className={`${statusClass} ${statusErrorClass}`}>
            {detectionResult.reason}
          </p>
        )}

        <div className="mt-2 text-center">
          <AppButton type="button" onClick={() => void runDetection()}>
            Retry Detection
          </AppButton>
        </div>
      </div>
    </main>
  );
}
