# Changelog

## 2026-02-28 (Mobile Responsiveness + Gesture Fixes)
- Made viewer mode responsive to viewport width:
  - added `MIN_SPREAD_VIEWPORT_WIDTH` guard (`900px`),
  - default mode now initializes to `1P` on narrow screens,
  - auto-forces back to `1P` (and resets zoom) when viewport becomes too narrow for `2P`.
- Disabled `2P` mode selection in `Toolbar` when width is below the spread threshold, including a disabled-state hint title.
- Added mobile swipe navigation in `InteractiveViewport` when zoom is at fit level (`zoom <= 1`):
  - swipe left -> next page,
  - swipe right -> previous page.
- Improved touch interaction handling to keep pinch/drag stable with explicit `touch-action: none` in the interactive viewport.
- Updated stage/page sizing for better mobile fill behavior:
  - moved spread/page containers from hardcoded min-heights to responsive viewport-based height clamps,
  - removed fixed page min-heights so pages can fill available stage space more naturally on small screens.
- Updated app shell and base styles to use dynamic viewport units (`100dvh`) to improve sizing on mobile browser UI chrome changes.
- Fixed pan-time image flicker in `PageView` by making image loading state depend on stable asset URLs (not recreated object references) and caching already-loaded image URLs so the low-res/current image remains visible while full-res resolves.
- Verified with `npm run build` (successful production build).

## 2026-02-28 (Runtime Remote Assets)
- Added runtime document configuration overrides via URL query params so the viewer can load assets from external hosts (for example AWS/S3) without code edits.
- Added parsing and validation helpers in `src/data/documentConfig.ts` for:
  - `baseUrl` (alias: `assetsBaseUrl`)
  - `name` (alias: `documentName`)
  - `totalPages` (alias: `pages`)
  - optional metadata: `id`/`documentId`, `title`, `subtitle`
  - optional PDF hints: `pdfStrategy` (`auto`/`perPage`/`single`) and `paddingDigits` (`2`/`3`)
- Updated the default subtitle to document the runtime query-param flow for remote assets.
- Kept backward compatibility by exporting `documentConfig` as the resolved runtime config object.
- Verified with `npm run build` (successful production build).

## 2026-02-18
- Initialized the project from scratch with React + TypeScript + Vite.
- Added a viewer-oriented app shell with Zustand state and Framer Motion transition scaffolding.
- Added PDF.js worker initialization and base styling.
- Added npm scripts for `dev`, `build`, and `preview`.
- Dependency installation could not be completed in this environment due npm registry DNS resolution failures (`EAI_AGAIN`).

## 2026-02-18 (Phase 2)
- Added typed document configuration with optional PDF strategy and padding hints.
- Implemented resolver utilities for thumbnail, JPG, per-page PDF, single-PDF, and BIN URL mapping.
- Implemented runtime PDF strategy detection with fallback order: per-page 2-digit -> per-page 3-digit -> single PDF -> image-only mode.
- Wired detection into `ViewerShell` with status feedback, retry action, and resolved URL preview for the active page.
- Added Vite client type declarations (`src/vite-env.d.ts`) so worker URL imports type-check correctly.
- Verified the project with `npm run build` (successful production build).

## 2026-02-18 (Phase 3)
- Added mode-aware pagination helpers for single-page and spread navigation, including cover handling and spread anchors.
- Updated viewer state navigation to step correctly by mode and normalize page anchors when switching modes.
- Implemented `SpreadView` with strict virtualization window rendering only previous/current/next item.
- Implemented `PageView` progressive image pipeline (thumbnail first, then full JPG) with failure fallback.
- Added neighbor image prefetching for virtualized items to keep next/previous navigation responsive.
- Updated UI styling for a page/sheet presentation and verified with `npm run build`.

## 2026-02-18 (Phase 4)
- Added zoom/pan/interaction fields to the global viewer store (`panX`, `panY`, `isInteracting`) with setter actions.
- Implemented `InteractiveViewport` using `@use-gesture/react` for drag-to-pan, pinch-to-zoom, and Ctrl/Cmd+wheel zoom.
- Wired the transform viewport into `ViewerShell` so visible content uses CSS transforms during active interaction.
- Added interaction-specific viewport styles (`touch-action: none`, overflow clipping, transform optimization).
- Verified behavior compiles and bundles successfully with `npm run build`.

## 2026-02-18 (Phase 5)
- Added a shared PDF document loader cache in `src/lib/pdfRender.ts` to reuse loaded PDF.js documents across renders.
- Extended spread/page wiring to compute per-page PDF render targets for both per-page and single-PDF strategies.
- Implemented high-zoom PDF canvas overlay in `PageView` with gating conditions:
  - only for current visible pages,
  - only when zoom is above HD threshold,
  - suppressed during active interaction.
- Added cancellable PDF render tasks on page/zoom/interaction changes to prevent stale renders.
- Added HD overlay/badge styling and graceful fallback when PDF rendering fails while JPG remains visible.
- Verified production build remains successful with `npm run build`.

## 2026-02-18 (Phase 6)
- Added `src/lib/prefetchManager.ts` with idle-time task scheduling (`requestIdleCallback` fallback), cancellation support, and prioritized prefetch queues.
- Implemented bounded in-memory image prefetch tracking with LRU-style eviction to avoid unbounded growth.
- Upgraded PDF document caching in `src/lib/pdfRender.ts` to track recency and evict older entries from a bounded cache.
- Added optional PDF page prefetch helper (`prefetchPdfPage`) so neighbor PDF data can warm in the background.
- Replaced direct neighbor image prefetch in `SpreadView` with cancellable batch prefetching for thumbnails/JPGs, plus conditional PDF prefetch when interaction is idle and zoom suggests likely HD usage.
- Kept prefetch batches cancel-safe on navigation changes by returning and invoking cleanup callbacks in `useEffect`.
- Verified production build remains successful with `npm run build`.

## 2026-02-18 (Phase 7)
- Migrated the viewer styling system to Tailwind CSS v4.
- Added Tailwind v4 tooling dependencies (`tailwindcss`, `@tailwindcss/vite`) and enabled the Tailwind Vite plugin.
- Replaced legacy CSS class-based component styling with Tailwind utility classes in `ViewerShell`, `Toolbar`, `InteractiveViewport`, `SpreadView`, and `PageView`.
- Simplified `src/styles.css` to Tailwind import + base document styles + the `reveal-full` keyframe used for image swap animation.
- Added jump-to-page support in the toolbar with validated/clamped input and submit action.
- Added keyboard shortcuts in `ViewerShell` (`ArrowLeft/ArrowRight`, `+/-`, `0`, `Home/End`) with input-focus guards.
- Added `PageScrubber` thumbnail rail for quick navigation with a virtualized page window and first/last jump shortcuts.
- Added `setCurrentPage` action in the viewer store so toolbar, scrubber, and keyboard navigation share consistent mode-aware page normalization.
- Verified the migration with `npm run build` (successful production build).
- Refactored repeated Tailwind button classes into a shared `AppButton` component and reused it across `Toolbar` and `ViewerShell` to reduce style duplication.

## 2026-02-18 (Phase 8)
- Added page-turn transition behavior in `SpreadView` using directional 3D transform + opacity motion while keeping the virtualization window mounted.
- Added navigation direction tracking in `SpreadView` so forward/backward navigation flips in opposite directions.
- Added reduced-motion support via `useReducedMotion()` to switch transitions to short opacity-only fades when motion reduction is enabled.
- Preserved virtualization safety by animating frame state changes (`current`/`non-current`) instead of unmounting mid-transition.
- Updated viewer status copy to reflect Phase 8 transition support.
- Verified with `npm run build` (successful production build).

## 2026-02-18 (Phase 9)
- Added BIN PDF utilities in `src/lib/binPdf.ts` with:
  - BIN chunk fetch caching and LRU eviction,
  - runtime BIN format detection heuristics (`singlePdf`, `concatenatedPdf`, `unknown`),
  - per-page BIN-to-PDF resolution and fallback-safe prefetch.
- Extended `pdfRender` with in-memory PDF loading (`getPdfDocumentFromBytes`) so decoded BIN payloads can render via PDF.js without requiring separate URL requests.
- Updated `SpreadView` PDF targets to route per-page strategy through BIN metadata (`binUrl`, `binIndex`, `page`) with per-page URL fallback preserved.
- Updated `PageView` HD overlay rendering to attempt BIN-sourced PDF documents first and automatically fallback to per-page PDF URLs when BIN is undecodable.
- Updated prefetch scheduling (`prefetchManager`) to warm BIN chunks for per-page strategy, reducing request fanout for nearby page ranges.
- Updated viewer status copy to reflect Phase 9 BIN optimization.
- Aligned document runtime config to the real dataset in `public/assets/docs` (`flipbook`, 112 pages, per-page strategy, 2-digit padding baseline).
- Verified with `npm run build` (successful production build).

## 2026-02-18 (UI Restyle)
- Reworked the viewer shell layout to a dark stage composition inspired by the provided reference:
  - compact floating top control bar,
  - centered framed page stage,
  - side navigation chevrons,
  - minimal bottom scrubber line with page bubble.
- Restyled `Toolbar` into a compact, magazine-viewer style control strip with integrated page input, navigation, zoom, and mode toggle.
- Replaced the thumbnail scrubber rail with a continuous slider scrubber (`PageScrubber`) for cleaner, reference-style navigation.
- Updated `PageView` presentation to emphasize the framed cover look (bold outer frame, darker inner viewport, reduced metadata noise).
- Updated global base styling in `src/styles.css` to use a dark radial/linear stage background and dedicated slider thumb/track styles.
- Verified with `npm run build` (successful production build).

## 2026-02-18 (HD Text Quality)
- Updated `PageView` PDF HD render scaling to track high zoom levels instead of capping too early, improving text sharpness at maximum zoom.
- Added adaptive canvas pixel budgeting (32MP cap) so high-quality renders stay stable and avoid oversized canvas failures.
- Enabled high-quality canvas smoothing flags during PDF rendering for cleaner downsampling on dense displays.
- Verified with `npm run build` (successful production build).
