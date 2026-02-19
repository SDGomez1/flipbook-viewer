import { ViewerMode } from "../types/viewerMode";

type SpreadPages = {
  leftPage: number | null;
  rightPage: number | null;
};

function clampSinglePage(page: number, totalPages: number): number {
  return Math.min(Math.max(page, 1), totalPages);
}

export function getLastSpreadAnchor(totalPages: number): number {
  if (totalPages <= 1) {
    return 1;
  }

  return totalPages % 2 === 0 ? totalPages : totalPages - 1;
}

export function normalizeSpreadAnchor(page: number, totalPages: number): number {
  if (page <= 1 || totalPages <= 1) {
    return 1;
  }

  const lastAnchor = getLastSpreadAnchor(totalPages);
  let normalized = Math.min(Math.max(page, 2), lastAnchor);

  if (normalized % 2 !== 0) {
    normalized -= 1;
  }

  return Math.max(normalized, 2);
}

export function normalizePageForMode(
  page: number,
  mode: ViewerMode,
  totalPages: number
): number {
  if (mode === "single") {
    return clampSinglePage(page, totalPages);
  }

  return normalizeSpreadAnchor(page, totalPages);
}

export function getSpreadPages(
  anchorPage: number,
  totalPages: number
): SpreadPages {
  const anchor = normalizeSpreadAnchor(anchorPage, totalPages);

  if (anchor === 1) {
    return {
      leftPage: null,
      rightPage: totalPages >= 1 ? 1 : null
    };
  }

  return {
    leftPage: anchor <= totalPages ? anchor : null,
    rightPage: anchor + 1 <= totalPages ? anchor + 1 : null
  };
}

export function getNextPage(
  page: number,
  mode: ViewerMode,
  totalPages: number
): number {
  if (mode === "single") {
    return clampSinglePage(page + 1, totalPages);
  }

  const anchor = normalizeSpreadAnchor(page, totalPages);
  const lastAnchor = getLastSpreadAnchor(totalPages);

  if (anchor === 1) {
    return totalPages > 1 ? 2 : 1;
  }

  return Math.min(anchor + 2, lastAnchor);
}

export function getPreviousPage(
  page: number,
  mode: ViewerMode,
  totalPages: number
): number {
  if (mode === "single") {
    return clampSinglePage(page - 1, totalPages);
  }

  const anchor = normalizeSpreadAnchor(page, totalPages);

  if (anchor <= 1) {
    return 1;
  }

  if (anchor === 2) {
    return 1;
  }

  return anchor - 2;
}

export function canGoNext(
  page: number,
  mode: ViewerMode,
  totalPages: number
): boolean {
  if (mode === "single") {
    return page < totalPages;
  }

  return normalizeSpreadAnchor(page, totalPages) < getLastSpreadAnchor(totalPages);
}

export function canGoPrevious(
  page: number,
  mode: ViewerMode,
  totalPages: number
): boolean {
  if (mode === "single") {
    return page > 1;
  }

  return normalizeSpreadAnchor(page, totalPages) > 1;
}
