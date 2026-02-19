import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Toolbar } from "./Toolbar";
import { useViewerStore } from "../store/viewerStore";
import { documentConfig } from "../data/documentConfig";
import {
  createDocumentResolver,
  detectPdfStrategy,
  StrategyDetectionResult,
} from "../lib/documentResolver";
import { canGoNext, canGoPrevious } from "../lib/viewerPagination";
import { SpreadView } from "./SpreadView";
import { InteractiveViewport } from "./InteractiveViewport";
import { PageScrubber } from "./PageScrubber";
import { AppButton } from "./AppButton";

type DetectionState = "idle" | "loading" | "ready" | "error";

export function ViewerShell() {
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
    setCurrentPage,
    setMode,
    setZoom,
    setPan,
    setIsInteracting,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useViewerStore();

  const resolver = useMemo(() => createDocumentResolver(documentConfig), []);
  const [detectionState, setDetectionState] = useState<DetectionState>("idle");
  const [detectionResult, setDetectionResult] =
    useState<StrategyDetectionResult | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  const runDetection = useCallback(async () => {
    setDetectionState("loading");
    setDetectionError(null);

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
  }, []);

  useEffect(() => {
    void runDetection();
  }, [runDetection]);

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
          goNext();
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          goPrevious();
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
          setCurrentPage(1);
          break;
        case "End":
          event.preventDefault();
          setCurrentPage(totalPages);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goNext, goPrevious, zoomIn, zoomOut, resetZoom, setCurrentPage, totalPages]);

  const strategyLabel =
    detectionResult?.pdfStrategy === "perPage"
      ? `perPage (${detectionResult.paddingDigits}-digit padding)`
      : detectionResult?.pdfStrategy === "single"
        ? "single PDF"
        : detectionResult?.pdfStrategy === "imageOnly"
          ? "image-only fallback"
          : "detecting";

  const canPrev = canGoPrevious(currentPage, mode, totalPages);
  const canNext = canGoNext(currentPage, mode, totalPages);
  const statusClass = "mt-3 text-center text-xs font-semibold text-[#b8d1e0]";
  const statusErrorClass = "text-[#ff9a9a]";

  return (
    <main className="relative min-h-screen overflow-hidden px-3 pb-6 pt-3">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(42,123,158,0.32),transparent_45%),radial-gradient(circle_at_85%_70%,rgba(16,121,133,0.26),transparent_42%),linear-gradient(180deg,#020d14_0%,#041824_34%,#083042_68%,#0b3d4d_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1300px] flex-col">
        <header className="mb-3 flex items-center justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9bb8c8]">
          <span>{documentConfig.title}</span>
          <span>
            {mode === "spread" ? "Spread" : "Single"} | {strategyLabel}
          </span>
        </header>

        <Toolbar
          currentPage={currentPage}
          totalPages={totalPages}
          mode={mode}
          zoom={zoom}
          canGoPrevious={canPrev}
          canGoNext={canNext}
          onPrevious={goPrevious}
          onNext={goNext}
          onModeChange={setMode}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetZoom={resetZoom}
          onJumpToPage={setCurrentPage}
        />

        <motion.section
          key={`${mode}-${currentPage}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative mt-3 flex flex-1 items-center justify-center"
        >
          <AppButton
            type="button"
            disabled={!canPrev}
            onClick={goPrevious}
            className="absolute left-2 z-20 h-12 w-8 rounded-full border-white/25 bg-[#6d8a9b80] px-0 text-lg font-black text-white max-[900px]:left-0 max-[900px]:h-10"
            title="Previous"
          >
            ❮
          </AppButton>

          <div className="w-full max-w-[980px]">
            <InteractiveViewport
              zoom={zoom}
              panX={panX}
              panY={panY}
              isInteracting={isInteracting}
              setZoom={setZoom}
              setPan={setPan}
              setIsInteracting={setIsInteracting}
            >
              <SpreadView
                mode={mode}
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
            onClick={goNext}
            className="absolute right-2 z-20 h-12 w-8 rounded-full border-white/25 bg-[#6d8a9b80] px-0 text-lg font-black text-white max-[900px]:right-0 max-[900px]:h-10"
            title="Next"
          >
            ❯
          </AppButton>
        </motion.section>

        <PageScrubber
          currentPage={currentPage}
          totalPages={totalPages}
          onSelectPage={setCurrentPage}
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
