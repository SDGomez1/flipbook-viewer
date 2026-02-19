import { ViewerMode } from "../types/viewerMode";
import { FormEvent, useEffect, useState } from "react";
import { AppButton } from "./AppButton";

type ToolbarProps = {
  currentPage: number;
  totalPages: number;
  mode: ViewerMode;
  zoom: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onModeChange: (mode: ViewerMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onJumpToPage: (page: number) => void;
};

export function Toolbar({
  currentPage,
  totalPages,
  mode,
  zoom,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onModeChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onJumpToPage,
}: ToolbarProps) {
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handleJumpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number.parseInt(pageInput, 10);

    if (Number.isNaN(parsed)) {
      setPageInput(String(currentPage));
      return;
    }

    const clamped = Math.min(Math.max(parsed, 1), totalPages);
    onJumpToPage(clamped);
    setPageInput(String(clamped));
  };

  return (
    <section className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-lg border border-[#8db0c640] bg-[#3a5f75e6] px-2 py-1.5 shadow-[0_10px_26px_rgba(0,0,0,0.35)] backdrop-blur-[10px]">
      <div className="flex items-center gap-1">
        <AppButton
          type="button"
          onClick={() => onModeChange("single")}
          active={mode === "single"}
          title="Single page mode"
          className="px-2"
        >
          1P
        </AppButton>
        <AppButton
          type="button"
          onClick={() => onModeChange("spread")}
          active={mode === "spread"}
          title="Spread mode"
          className="px-2"
        >
          2P
        </AppButton>
      </div>

      <div className="mx-1 h-5 w-px bg-white/20" />

      <div className="flex items-center gap-1">
        <AppButton
          type="button"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          title="Previous page"
          className="px-2"
        >
          ◀
        </AppButton>
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-1">
          <input
            id="page-jump"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            className="w-12 rounded-sm border border-white/30 bg-[#f7fbff] px-1 py-[0.2rem] text-center text-xs font-bold text-[#173546] outline-none focus:border-[#1f5a82]"
            aria-label="Jump to page"
          />
          <span className="text-xs font-semibold text-[#d7e7f2]">/ {totalPages}</span>
          <AppButton type="submit" className="px-2">
            Go
          </AppButton>
        </form>
        <AppButton
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          title="Next page"
          className="px-2"
        >
          ▶
        </AppButton>
      </div>

      <div className="mx-1 h-5 w-px bg-white/20" />

      <div className="flex items-center gap-1">
        <AppButton type="button" onClick={onZoomOut} title="Zoom out" className="px-2">
          -
        </AppButton>
        <span className="min-w-[52px] text-center text-xs font-semibold text-[#edf6fb]">
          {Math.round(zoom * 100)}%
        </span>
        <AppButton type="button" onClick={onZoomIn} title="Zoom in" className="px-2">
          +
        </AppButton>
        <AppButton type="button" onClick={onResetZoom} title="Fit to screen" className="px-2">
          Fit
        </AppButton>
      </div>
    </section>
  );
}
