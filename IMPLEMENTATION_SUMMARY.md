# Implementation Plan: Modern Hybrid PDF Book Viewer (React + Vite) — FlowPaper-Style Assets

This plan defines requirements, architecture, and step-by-step phases to build a high-performance, React-based “hybrid” book viewer that loads **thumbnails/JPGs instantly** and upgrades to **PDF-quality rendering** at higher zoom using **PDF.js in a worker**, with **prefetching** and **tight virtualization**.

---

## 1) Goals and Non-Goals

### 1.1 Goals

- Instant page display using thumbnails, then full JPG.
- High-quality zoom using PDF rendering (canvas) when zoom passes a threshold.
- Smooth pan/zoom interaction (no UI blocking).
- Book (spread) mode and single-page mode.
- Fast navigation (buttons, keyboard, scrubber).
- Works with your asset naming and chunking scheme.

### 1.2 Non-Goals (initial release)

- Authoring/annotations.
- Arbitrary PDF upload and server-side conversion.
- Full-text selection layer (search/highlight can come later).

### 1.3 Acceptance Criteria

- Navigation shows a thumbnail within ~200ms on typical networks (assuming cached or nearby assets).
- Zoom/pan remain responsive (PDF renders are deferred/cancellable).
- Only a small number of pages/spreads exist in the DOM at once.
- If PDF rendering fails, the JPG fallback still provides a usable reader.

---

## 2) Asset Contract (Your Exact Structure)

### 2.1 Images (increment by 1, no padding)

- Full page image: {name}.pdf\_{page}.jpg
- Thumbnail image: {name}.pdf\_{page}\_thumb.jpg
- The {page} portion is a natural integer sequence: 1, 2, 3, …

### 2.2 Per-page PDF fragments (1 page per PDF, padded page number)

- Fragment: {name}\_{pagePadded}.pdf
- Each fragment contains exactly 1 PDF page.
- Padding rule:
  - Uses 2 digits when page numbers are below 100 (e.g., 01…99).
  - Uses 3 digits when the document exceeds 99 pages (e.g., 001…120).
- Requirement: the viewer must not hardcode padding; it must be derived from configuration or detected at runtime.

### 2.3 Single PDF (special case)

- When only one PDF is generated: {name}.pdf
- Requirement: viewer must support both strategies:
  - single-PDF strategy
  - per-page-PDF strategy

### 2.4 BIN files (PDF data, grouped by tens)

- BIN filename: {name}.pdf\_{binIndex}.bin
- binIndex increments by 10 starting at 10: 10, 20, 30, …
- Mapping to pages:
  - Pages 1–10 map to binIndex 10
  - Pages 11–20 map to binIndex 20
  - Formula: binIndex = ceil(page / 10) × 10
- Important note:
  - BIN contains PDF data. Use BIN only if you intend to parse or feed it to PDF.js as binary PDF data.
  - Initial release can ignore BIN if per-page PDFs are available, but the plan includes a later phase to leverage BIN if needed.

---

## 3) Required Metadata (Avoid Guessing Total Pages)

### 3.1 Hard Requirement: Total Page Count

To avoid probing hundreds of URLs, require one of:

- a manifest JSON served alongside assets, or
- totalPages provided by your application backend, or
- totalPages embedded in the app configuration for the document.

### 3.2 Recommended Manifest Fields

- name
- baseUrl
- totalPages
- pdfStrategy (optional; can be auto-detected)
- paddingDigits (optional; can be auto-detected as 2 or 3)
- page pixel size or aspect ratio (if known; improves fit calculations)

---

## 4) Technical Architecture (High Level)

### 4.1 Rendering Layers per Page

1. Thumbnail (fastest): shown immediately (optionally blurred).
2. Full JPG: replaces thumb once decoded.
3. PDF canvas overlay: rendered when zoom is high enough and interaction has settled.

### 4.2 Interaction Model (Key to Performance)

- During active pinch/wheel zoom and panning:
  - Apply CSS transforms to the visible content for immediate response.
  - Do not continuously re-render PDF canvases.
- After interaction ends (debounced):
  - Render a high-DPI PDF canvas for the current page(s).
- Always cancel any in-flight PDF render when page/zoom changes.

### 4.3 Virtualization Window

- Keep DOM limited to:
  - current spread (or page)
  - previous neighbor
  - next neighbor
- Prefetch assets for neighbors; do not mount large runs of pages.

---

## 5) Project Setup Requirements

### 5.1 Environment

- React + TypeScript + Vite
- PDF.js (pdfjs-dist) with a properly configured worker bundled with Vite (avoid CDN worker URLs to prevent version/CSP issues)

### 5.2 Dependencies (minimum)

- Zustand: global viewer state
- PDF.js: PDF rendering
- Framer Motion: page flip / transitions
- Use-Gesture: pinch/drag/wheel gesture handling
- Icon library (optional)

---

## 6) Runtime Strategy Detection (PDF Mode + Padding)

### 6.1 Detect PDF Strategy

On document load, decide:

- If per-page PDFs exist: use per-page strategy.
- Else: use single PDF strategy.

Operational approach:

- Attempt to fetch the first per-page PDF fragment with 2-digit padding (…\_01.pdf).
- If not found, attempt 3-digit padding (…\_001.pdf).
- If neither exists, fallback to single PDF file (… .pdf).

Decision output:

- pdfStrategy = perPage or single
- paddingDigits = 2 or 3 (only relevant for perPage)

### 6.2 Failure Handling

- If strategy detection fails (network errors), show a meaningful error state with retry.
- If images load but PDF doesn’t, continue in image-only mode.

---

## 7) State Model (Viewer Store Requirements)

### 7.1 Core State

- current page anchor (1-based)
- totalPages
- mode: single or spread
- zoom factor
- pan offset (x, y) and whether user is currently interacting
- derived: current spread pages (left/right) given anchor page and mode

### 7.2 Spread Rules (Book Mode)

Recommended convention:

- Page 1 is a cover displayed alone on the right side.
- Subsequent spreads pair (2,3), (4,5), …

Navigation:

- In spread mode: next/prev moves by 2 pages, but must clamp to valid ranges.
- Always compute left/right pages from the anchor to avoid off-by-one and end-of-book issues.

---

## 8) Layout & Fit-to-Viewport Requirements

### 8.1 Fit Calculation

Compute a base scale that fits content inside the viewport considering:

- padding
- gap between left/right pages (spread mode)
- page aspect ratio (from manifest or inferred from first loaded image)

### 8.2 Responsive Behavior

- Recompute layout scale on container resize (ResizeObserver).
- Preserve user zoom when resizing if you want “stable zoom”, or reset to fit if you want “fit on resize”; choose one and document it.

---

## 9) Prefetching and Caching Requirements

### 9.1 Prefetch Policy

When the current page/spread changes:

- Prefetch thumbnails for next/previous neighbor
- Prefetch full JPGs for next/previous neighbor
- Optionally prefetch PDFs only when zoom is above a threshold or when on desktop with strong bandwidth

### 9.2 Cache Policy

- Keep a small in-memory cache of:
  - decoded images (or at least “already fetched” URLs)
  - PDF documents/fragments (if per-page) for current ± neighbors
- Avoid unbounded growth (LRU eviction by page distance/time).

### 9.3 Idle-Time Scheduling

- Use idle time to prefetch so navigation remains snappy without blocking interaction.
- Ensure prefetch work is cancel-safe when the user jumps far via scrubber.

---

## 10) PDF Rendering Requirements (Single vs Per-Page)

### 10.1 Per-Page PDF Strategy

- For page N, load {name}\_{padded(N)}.pdf
- Render the first (and only) page in that PDF fragment to a canvas

### 10.2 Single PDF Strategy

- Load {name}.pdf once
- Render page N to a canvas

### 10.3 Render Scale and Quality

- Render at zoom × devicePixelRatio, with an upper clamp to prevent giant canvases.
- Only re-render when:
  - zoom changes meaningfully AND
  - interaction has ended (debounced), OR
  - the page changed.

### 10.4 Cancellation Requirement

- Any in-flight render must be cancelled when:
  - user navigates to a different page/spread
  - zoom changes during an active interaction
  - component unmounts due to virtualization

---

## 11) Components and Responsibilities (No Code, Just Contracts)

### 11.1 ViewerShell

- Loads document configuration/manifest
- Runs strategy detection
- Initializes store with totalPages and strategy
- Provides layout container and overall event handling (keyboard, focus)

### 11.2 SpreadView (or PageViewport)

- Computes which pages are visible (left/right)
- Applies virtualization window (prev/current/next)
- Owns the transform container that applies zoom/pan CSS transforms

### 11.3 PageView (the Hybrid Page)

Inputs:

- page number (or null for blank side)
- URLs: thumb, image, pdf fragment (or single pdf reference)
- zoom + interaction state (to decide PDF overlay)
  Responsibilities:
- thumb → image swap without flicker
- display image-only fallback if PDF overlay is unavailable
- request PDF render only when enabled, and cancel when disabled

### 11.4 Controls

- toolbar: navigation, zoom controls, mode toggle
- scrubber: thumbnails for quick jump (virtualized list if large)
- page input: jump to page with validation/clamping

---

## 12) Gestures and Input Requirements

### 12.1 Desktop

- wheel zoom (optionally require Ctrl/Cmd to avoid page scroll conflicts)
- drag-to-pan when zoom > 1
- keyboard: arrows for nav, +/- for zoom, 0 for reset/fit

### 12.2 Mobile

- pinch-to-zoom
- pan with one finger
- double-tap to zoom (optional)

### 12.3 Interaction State

- Maintain an “isInteracting” flag while gestures are active.
- PDF rendering is suppressed while isInteracting is true.

---

## 13) Page Flip / Transition Requirements

### 13.1 Animation

- Use GPU-friendly transforms
- Keep the animated region small (wrap the spread)
- Do not unmount pages mid-flip (coordinate virtualization with animation lifecycle)

### 13.2 Accessibility

- Respect reduced-motion preference:
  - replace flips with fades or instant transitions when reduced motion is enabled

---

## 14) BIN Utilization (Optional Later Phase)

Because BIN contains PDF data and is chunked by tens, it can be leveraged for:

- reducing request count (one BIN fetch covers 10 pages of PDF data)
- offline-ish caching (store a few BIN chunks in memory)

Requirements to use BIN:

- Determine BIN format:
  - Is it raw PDF bytes, concatenated PDFs, or a custom container?
- Implement a decoder that can extract the correct page PDF bytes for a given page number.
- Feed extracted bytes to PDF.js as binary PDF data.

Recommended milestone gating:

- Ship v1 using JPG + per-page PDFs (simpler).
- Add BIN optimization only after stable v1 performance.

---

## 15) Error Handling and Observability

### 15.1 Per-Asset Failure

- Thumb fails: fallback to loading full JPG
- JPG fails: show placeholder + retry control; allow navigation to proceed
- PDF fails: keep JPG visible; optionally show “HD unavailable” indicator

### 15.2 Global Failure

- Manifest/config missing: show clear configuration error
- totalPages missing: block viewer and request required metadata

### 15.3 Metrics (recommended)

- time to first thumb
- time to full image
- time to HD canvas after zoom settle
- rate of PDF render cancellations (helps tune debounce)

---

## 16) Security and Hosting Requirements

- Ensure PDF.js worker file is served with correct MIME type.
- If assets are cross-origin:
  - enable CORS for JPG/PDF/BIN
  - ensure CSP allows worker and fetches
- Prefer same-origin hosting for simplest deployment.

---

## 17) Step-by-Step Implementation Phases

### Phase 1 — Document Contract and App Skeleton

- Define how totalPages and baseUrl/name are provided (manifest or backend).
- Create ViewerShell with routing to a document by id/name.
- Set up PDF.js worker bundling.

Deliverable:

- App loads and shows a basic viewer frame with doc metadata loaded.

### Phase 2 — Resolver + Strategy Detection

- Implement URL generation for:
  - thumb
  - JPG
  - per-page PDF (2/3 digit padding)
  - single PDF
  - BIN (page-to-bin mapping)
- Implement runtime detection:
  - per-page 2-digit → per-page 3-digit → single PDF fallback

Deliverable:

- Console/log confirms correct strategy and padding selection for multiple docs.

### Phase 3 — Image-First Page Rendering

- Implement PageView that loads thumb then JPG.
- Add virtualization window (prev/current/next spread).

Deliverable:

- Smooth browsing through pages with minimal DOM and fast image swaps.

### Phase 4 — Zoom/Pan Interaction

- Implement CSS transform-based zoom/pan container.
- Add gesture handling (desktop and mobile).
- Track isInteracting.

Deliverable:

- Zoom/pan feels immediate; content remains stable and responsive.

### Phase 5 — PDF Overlay Rendering (Hybrid Upgrade)

- Render PDF canvas overlay when zoom exceeds threshold and interaction settles.
- Support both strategies:
  - per-page fragments (1 page each)
  - single PDF (render page N)
- Add cancellation for in-flight renders.

Deliverable:

- At high zoom, text/lines become crisp; no stutter while zooming.

### Phase 6 — Prefetching and Caching

- Add idle-time prefetch for neighbor thumbs/JPGs.
- Add optional PDF prefetch when user is likely to zoom (heuristic).
- Add cache limits.

Deliverable:

- Next/prev navigation is consistently fast; memory stays bounded.

### Phase 7 — UI Controls + Scrubber

- Toolbar: navigation, zoom, mode toggle, page input
- Scrubber: thumbnail rail for rapid jumps (virtualize if needed)
- Keyboard shortcuts

Deliverable:

- Fully usable reader with both navigation paradigms.

### Phase 8 — Page Flip Animations (Optional)

- Add flip/fade transitions
- Ensure compatibility with virtualization and reduced-motion

Deliverable:

- Polished page turn experience without performance regressions.

### Phase 9 — BIN Optimization (Optional)

- Identify BIN format and extraction rules
- Use BIN to reduce requests and accelerate PDF availability
- Add caching by BIN chunk

Deliverable:

- Improved loading efficiency for large documents (if BIN format is usable).

---

## 18) Final Checklist (Definition of Done)

- totalPages is provided reliably (manifest/backend) for every document.
- Correct handling of:
  - JPG page numbering (incremental, no padding)
  - per-page PDF numbering with 2 or 3 digit padding
  - single PDF fallback
  - BIN mapping by tens (even if unused initially)
- Hybrid rendering works:
  - thumb → JPG always
  - PDF overlay only after zoom settles
  - cancellation works and prevents outdated renders
- Virtualization window in place (bounded DOM).
- Prefetching improves navigation without blocking input.
- Degrades gracefully (image-only mode) if PDF layer fails.

---
