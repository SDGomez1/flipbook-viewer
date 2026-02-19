import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import {
  DocumentResolver,
  ResolvedPageAssets,
  StrategyDetectionResult
} from "../lib/documentResolver";
import {
  getSpreadPages,
  normalizeSpreadAnchor
} from "../lib/viewerPagination";
import { schedulePrefetchBatch } from "../lib/prefetchManager";
import { ViewerMode } from "../types/viewerMode";
import { PageView } from "./PageView";

type SpreadViewProps = {
  mode: ViewerMode;
  currentPage: number;
  totalPages: number;
  zoom: number;
  isInteracting: boolean;
  resolver: DocumentResolver;
  detectionResult: StrategyDetectionResult | null;
};

export type PdfRenderTarget = {
  kind: "url";
  pdfUrl: string;
  pageNumberInDocument: number;
} | {
  kind: "bin";
  binUrl: string;
  binIndex: number;
  page: number;
  fallbackPdfUrl: string | null;
};

type VirtualItem =
  | {
      key: string;
      kind: "single";
      isCurrent: boolean;
      page: number;
    }
  | {
      key: string;
      kind: "spread";
      isCurrent: boolean;
      anchor: number;
      leftPage: number | null;
      rightPage: number | null;
    };

function getWindowItems(
  mode: ViewerMode,
  currentPage: number,
  totalPages: number
): VirtualItem[] {
  if (mode === "single") {
    const pages = [currentPage - 1, currentPage, currentPage + 1].filter(
      (page) => page >= 1 && page <= totalPages
    );

    return pages.map((page) => ({
      key: `single-${page}`,
      kind: "single",
      page,
      isCurrent: page === currentPage
    }));
  }

  const anchor = normalizeSpreadAnchor(currentPage, totalPages);
  const candidateAnchors = [anchor - 2, anchor, anchor + 2];
  const anchors = Array.from(
    new Set(candidateAnchors.map((value) => normalizeSpreadAnchor(value, totalPages)))
  ).sort((a, b) => a - b);

  return anchors.map((anchorPage) => {
    const pages = getSpreadPages(anchorPage, totalPages);
    return {
      key: `spread-${anchorPage}`,
      kind: "spread" as const,
      anchor: anchorPage,
      leftPage: pages.leftPage,
      rightPage: pages.rightPage,
      isCurrent: anchorPage === anchor
    };
  });
}

function resolveAssets(
  page: number | null,
  resolver: DocumentResolver,
  detectionResult: StrategyDetectionResult | null
): ResolvedPageAssets | null {
  if (page === null) {
    return null;
  }

  return resolver.resolvePageAssets(page, { detected: detectionResult });
}

function resolvePdfTarget(
  page: number | null,
  assets: ResolvedPageAssets | null,
  detectionResult: StrategyDetectionResult | null
): PdfRenderTarget | null {
  if (page === null || assets === null || detectionResult === null) {
    return null;
  }

  if (detectionResult.pdfStrategy === "single") {
    return {
      kind: "url",
      pdfUrl: detectionResult.singlePdfUrl,
      pageNumberInDocument: page
    };
  }

  if (detectionResult.pdfStrategy === "perPage") {
    return {
      kind: "bin",
      binUrl: assets.binUrl,
      binIndex: assets.binIndex,
      page,
      fallbackPdfUrl: assets.pdfUrl
    };
  }

  return null;
}

export function SpreadView({
  mode,
  currentPage,
  totalPages,
  zoom,
  isInteracting,
  resolver,
  detectionResult
}: SpreadViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const previousPageRef = useRef(currentPage);
  const navigationDirectionRef = useRef(1);

  if (currentPage !== previousPageRef.current) {
    navigationDirectionRef.current =
      currentPage > previousPageRef.current ? 1 : -1;
    previousPageRef.current = currentPage;
  }

  const navigationDirection = navigationDirectionRef.current;

  const items = useMemo(
    () => getWindowItems(mode, currentPage, totalPages),
    [mode, currentPage, totalPages]
  );

  useEffect(() => {
    const pagesToPrefetch = items.flatMap((item) => {
      if (item.kind === "single") {
        return item.isCurrent ? [] : [item.page];
      }

      if (item.isCurrent) {
        return [];
      }

      return [item.leftPage, item.rightPage].filter(
        (value): value is number => value !== null
      );
    });

    const uniquePages = Array.from(new Set(pagesToPrefetch));
    if (uniquePages.length === 0) {
      return;
    }

    const isFinePointer = window.matchMedia("(pointer:fine)").matches;
    const shouldPrefetchPdf = Boolean(
      detectionResult &&
        detectionResult.pdfStrategy !== "imageOnly" &&
        !isInteracting &&
        zoom >= 1.2 &&
        isFinePointer
    );

    return schedulePrefetchBatch({
      pages: uniquePages,
      currentPage,
      resolver,
      detectionResult,
      enablePdfPrefetch: shouldPrefetchPdf
    });
  }, [items, resolver, detectionResult, currentPage, zoom, isInteracting]);

  return (
    <section
      className="relative min-h-[760px] p-0 [perspective:1800px] max-[900px]:min-h-[620px] max-[640px]:min-h-[520px]"
      data-mode={mode}
    >
      {items.map((item) => {
        const transformOrigin =
          navigationDirection > 0 ? "left center" : "right center";
        const restingTransform = shouldReduceMotion
          ? "none"
          : `rotateY(${navigationDirection * -7}deg) translateX(${navigationDirection * 24}px) scale(0.985)`;
        const activeTransform = shouldReduceMotion
          ? "none"
          : "rotateY(0deg) translateX(0px) scale(1)";

        return (
          <div
            className={`absolute inset-0 ${item.isCurrent ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
            key={item.key}
            style={{
              transform: item.isCurrent ? activeTransform : restingTransform,
              transformOrigin,
              transformStyle: "preserve-3d",
              transition: shouldReduceMotion
                ? "opacity 120ms linear"
                : "opacity 220ms ease-out, transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
          >
            {item.kind === "single" ? (
              <div className="grid h-full justify-center [grid-template-columns:minmax(0,760px)]">
                {(() => {
                  const assets = resolveAssets(item.page, resolver, detectionResult);
                  return (
                    <PageView
                      page={item.page}
                      assets={assets}
                      pdfTarget={resolvePdfTarget(item.page, assets, detectionResult)}
                      zoom={zoom}
                      isInteracting={isInteracting}
                      isCurrent={item.isCurrent}
                    />
                  );
                })()}
              </div>
            ) : (
              <div className="grid h-full grid-cols-2 gap-6 max-[900px]:grid-cols-1">
                {(() => {
                  const leftAssets = resolveAssets(
                    item.leftPage,
                    resolver,
                    detectionResult
                  );
                  const rightAssets = resolveAssets(
                    item.rightPage,
                    resolver,
                    detectionResult
                  );

                  return (
                    <>
                      <PageView
                        page={item.leftPage}
                        assets={leftAssets}
                        pdfTarget={resolvePdfTarget(
                          item.leftPage,
                          leftAssets,
                          detectionResult
                        )}
                        zoom={zoom}
                        isInteracting={isInteracting}
                        isCurrent={item.isCurrent}
                      />
                      <PageView
                        page={item.rightPage}
                        assets={rightAssets}
                        pdfTarget={resolvePdfTarget(
                          item.rightPage,
                          rightAssets,
                          detectionResult
                        )}
                        zoom={zoom}
                        isInteracting={isInteracting}
                        isCurrent={item.isCurrent}
                      />
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
