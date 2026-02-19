import { DocumentResolver, StrategyDetectionResult } from "./documentResolver";
import { prefetchPdfPage } from "./pdfRender";
import { prefetchBinChunk } from "./binPdf";

type ImageCacheEntry = {
  lastAccess: number;
  promise: Promise<void>;
};

type IdleHandle =
  | {
      kind: "idle";
      id: number;
    }
  | {
      kind: "timeout";
      id: number;
    };

type PrefetchTask = {
  key: string;
  priority: number;
  run: () => Promise<void>;
};

type PrefetchOptions = {
  pages: number[];
  currentPage: number;
  resolver: DocumentResolver;
  detectionResult: StrategyDetectionResult | null;
  enablePdfPrefetch: boolean;
};

const MAX_IMAGE_CACHE_ENTRIES = 48;
const imageCache = new Map<string, ImageCacheEntry>();

function now(): number {
  return Date.now();
}

function evictImageCacheIfNeeded(): void {
  while (imageCache.size > MAX_IMAGE_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestAccess = Number.POSITIVE_INFINITY;

    imageCache.forEach((entry, key) => {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    });

    if (!oldestKey) {
      break;
    }

    imageCache.delete(oldestKey);
  }
}

function prefetchImage(url: string): Promise<void> {
  const cached = imageCache.get(url);
  if (cached) {
    cached.lastAccess = now();
    return cached.promise;
  }

  const image = new Image();
  image.decoding = "async";
  const promise = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to prefetch image: ${url}`));
  })
    .catch(() => undefined)
    .finally(() => {
      const entry = imageCache.get(url);
      if (entry) {
        entry.lastAccess = now();
      }
      evictImageCacheIfNeeded();
    });

  image.src = url;
  imageCache.set(url, { lastAccess: now(), promise });
  evictImageCacheIfNeeded();
  return promise;
}

function scheduleIdleTask(callback: () => void): IdleHandle {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 280 });
    return { kind: "idle", id };
  }

  const id = window.setTimeout(callback, 60);
  return { kind: "timeout", id };
}

function cancelIdleTask(handle: IdleHandle | null): void {
  if (!handle) {
    return;
  }

  if (handle.kind === "idle" && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(handle.id);
    return;
  }

  window.clearTimeout(handle.id);
}

function buildTasks(options: PrefetchOptions): PrefetchTask[] {
  const {
    pages,
    currentPage,
    resolver,
    detectionResult,
    enablePdfPrefetch
  } = options;
  const tasks: PrefetchTask[] = [];
  const seen = new Set<string>();

  pages.forEach((page) => {
    const distance = Math.abs(page - currentPage);
    const priorityBase = distance * 10;
    const assets = resolver.resolvePageAssets(page, { detected: detectionResult });

    const thumbKey = `thumb:${assets.thumbUrl}`;
    if (!seen.has(thumbKey)) {
      seen.add(thumbKey);
      tasks.push({
        key: thumbKey,
        priority: priorityBase + 1,
        run: () => prefetchImage(assets.thumbUrl)
      });
    }

    const imageKey = `image:${assets.imageUrl}`;
    if (!seen.has(imageKey)) {
      seen.add(imageKey);
      tasks.push({
        key: imageKey,
        priority: priorityBase + 2,
        run: () => prefetchImage(assets.imageUrl)
      });
    }

    if (!enablePdfPrefetch || detectionResult === null) {
      return;
    }

    if (detectionResult.pdfStrategy === "single") {
      const pdfKey = `pdf:${detectionResult.singlePdfUrl}:page:${page}`;
      if (!seen.has(pdfKey)) {
        seen.add(pdfKey);
        tasks.push({
          key: pdfKey,
          priority: priorityBase + 3,
          run: () => prefetchPdfPage(detectionResult.singlePdfUrl, page)
        });
      }
      return;
    }

    if (detectionResult.pdfStrategy === "perPage" && assets.pdfUrl) {
      const binUrl = assets.binUrl;
      const pdfKey = `bin:${binUrl}`;
      if (!seen.has(pdfKey)) {
        seen.add(pdfKey);
        tasks.push({
          key: pdfKey,
          priority: priorityBase + 3,
          run: () => prefetchBinChunk(binUrl)
        });
      }
    }
  });

  tasks.sort((a, b) => a.priority - b.priority);
  return tasks;
}

export function schedulePrefetchBatch(options: PrefetchOptions): () => void {
  const tasks = buildTasks(options);
  let taskIndex = 0;
  let cancelled = false;
  let idleHandle: IdleHandle | null = null;

  const runNextTask = () => {
    if (cancelled || taskIndex >= tasks.length) {
      return;
    }

    const task = tasks[taskIndex];
    taskIndex += 1;

    void task
      .run()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          idleHandle = scheduleIdleTask(runNextTask);
        }
      });
  };

  idleHandle = scheduleIdleTask(runNextTask);

  return () => {
    cancelled = true;
    cancelIdleTask(idleHandle);
  };
}
