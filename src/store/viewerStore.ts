import { create } from "zustand";
import {
  getNextPage,
  getPreviousPage,
  normalizePageForMode
} from "../lib/viewerPagination";
import { ViewerMode } from "../types/viewerMode";

type ViewerState = {
  currentPage: number;
  totalPages: number;
  mode: ViewerMode;
  zoom: number;
  panX: number;
  panY: number;
  isInteracting: boolean;
  goNext: () => void;
  goPrevious: () => void;
  setTotalPages: (totalPages: number) => void;
  setCurrentPage: (page: number) => void;
  setMode: (mode: ViewerMode) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setIsInteracting: (isInteracting: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;
const PAN_ROUNDING = 10;
export const MIN_SPREAD_VIEWPORT_WIDTH = 900;

function getInitialMode(): ViewerMode {
  if (typeof window === "undefined") {
    return "spread";
  }

  return window.innerWidth >= MIN_SPREAD_VIEWPORT_WIDTH ? "spread" : "single";
}

function clampZoom(zoom: number): number {
  return Math.min(Math.max(Number(zoom.toFixed(2)), MIN_ZOOM), MAX_ZOOM);
}

function roundPan(value: number): number {
  return Math.round(value * PAN_ROUNDING) / PAN_ROUNDING;
}

function normalizeTotalPages(totalPages: number): number {
  if (!Number.isFinite(totalPages)) {
    return 1;
  }

  return Math.max(1, Math.floor(totalPages));
}

export const useViewerStore = create<ViewerState>((set) => ({
  currentPage: 1,
  totalPages: 1,
  mode: getInitialMode(),
  zoom: 1,
  panX: 0,
  panY: 0,
  isInteracting: false,
  goNext: () =>
    set((state) => {
      const nextPage = getNextPage(
        state.currentPage,
        state.mode,
        state.totalPages
      );

      return { currentPage: nextPage };
    }),
  goPrevious: () =>
    set((state) => {
      const previousPage = getPreviousPage(
        state.currentPage,
        state.mode,
        state.totalPages
      );

      return { currentPage: previousPage };
    }),
  setTotalPages: (totalPages) =>
    set((state) => {
      const nextTotalPages = normalizeTotalPages(totalPages);

      return {
        totalPages: nextTotalPages,
        currentPage: normalizePageForMode(
          state.currentPage,
          state.mode,
          nextTotalPages
        )
      };
    }),
  setCurrentPage: (page) =>
    set((state) => ({
      currentPage: normalizePageForMode(page, state.mode, state.totalPages),
    })),
  setMode: (mode) =>
    set((state) => ({
      mode,
      currentPage: normalizePageForMode(state.currentPage, mode, state.totalPages)
    })),
  setZoom: (zoom) =>
    set(() => {
      const nextZoom = clampZoom(zoom);

      return {
        zoom: nextZoom,
        ...(nextZoom === 1 ? { panX: 0, panY: 0 } : {})
      };
    }),
  setPan: (x, y) =>
    set((state) => {
      if (state.zoom <= 1) {
        return {
          panX: 0,
          panY: 0
        };
      }

      return {
        panX: roundPan(x),
        panY: roundPan(y)
      };
    }),
  setIsInteracting: (isInteracting) => set({ isInteracting }),
  zoomIn: () =>
    set((state) => ({
      zoom: clampZoom(state.zoom + ZOOM_STEP)
    })),
  zoomOut: () =>
    set((state) => {
      const nextZoom = clampZoom(state.zoom - ZOOM_STEP);
      return {
        zoom: nextZoom,
        ...(nextZoom === 1 ? { panX: 0, panY: 0 } : {})
      };
    }),
  resetZoom: () => set({ zoom: 1, panX: 0, panY: 0 })
}));
