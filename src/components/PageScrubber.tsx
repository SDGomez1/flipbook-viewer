import { useMemo } from "react";

type PageScrubberProps = {
  currentPage: number;
  totalPages: number;
  onSelectPage: (page: number) => void;
};

export function PageScrubber({
  currentPage,
  totalPages,
  onSelectPage,
}: PageScrubberProps) {
  const progress = useMemo(() => {
    if (totalPages <= 1) {
      return 0;
    }

    return ((currentPage - 1) / (totalPages - 1)) * 100;
  }, [currentPage, totalPages]);

  return (
    <section className="mt-4 w-full px-2">
      <div className="relative mx-auto w-full max-w-[760px]">
        <div
          className="pointer-events-none absolute -top-8 z-10 -translate-x-1/2 rounded-full border border-white/20 bg-[#42657ad9] px-3 py-1 text-xs font-semibold text-[#e3eff7] shadow-[0_6px_20px_rgba(0,0,0,0.4)]"
          style={{ left: `${progress}%` }}
        >
          {currentPage}
        </div>

        <input
          type="range"
          min={1}
          max={totalPages}
          value={currentPage}
          onChange={(event) => onSelectPage(Number(event.target.value))}
          className="page-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-white/18"
          aria-label="Page scrubber"
        />

        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-[#bdd2df]">
          <span>1</span>
          <span>
            {currentPage} / {totalPages}
          </span>
          <span>{totalPages}</span>
        </div>
      </div>
    </section>
  );
}
