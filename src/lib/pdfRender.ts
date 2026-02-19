import { getDocument } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfCacheEntry = {
  lastAccess: number;
  promise: Promise<PDFDocumentProxy>;
};

const MAX_PDF_DOCUMENT_CACHE = 8;
const documentCache = new Map<string, PdfCacheEntry>();

function now(): number {
  return Date.now();
}

function evictPdfCacheIfNeeded(): void {
  while (documentCache.size > MAX_PDF_DOCUMENT_CACHE) {
    let oldestKey: string | null = null;
    let oldestAccess = Number.POSITIVE_INFINITY;

    documentCache.forEach((entry, key) => {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    });

    if (!oldestKey) {
      break;
    }

    documentCache.delete(oldestKey);
  }
}

async function getCachedPdfDocument(
  cacheKey: string,
  load: () => Promise<PDFDocumentProxy>
): Promise<PDFDocumentProxy> {
  const cachedEntry = documentCache.get(cacheKey);
  const currentTime = now();
  if (cachedEntry) {
    cachedEntry.lastAccess = currentTime;
    return cachedEntry.promise;
  }

  const promise = load().catch((error) => {
    documentCache.delete(cacheKey);
    throw error;
  });

  documentCache.set(cacheKey, { lastAccess: currentTime, promise });
  evictPdfCacheIfNeeded();
  return promise;
}

export async function getPdfDocument(url: string): Promise<PDFDocumentProxy> {
  return getCachedPdfDocument(`url:${url}`, () => getDocument(url).promise);
}

export async function getPdfDocumentFromBytes(
  cacheKey: string,
  bytes: ArrayBuffer
): Promise<PDFDocumentProxy> {
  const byteKey = `bytes:${cacheKey}`;
  return getCachedPdfDocument(byteKey, () =>
    getDocument({ data: new Uint8Array(bytes) }).promise
  );
}

export async function prefetchPdfPage(
  url: string,
  pageNumber: number
): Promise<void> {
  try {
    const document = await getPdfDocument(url);
    await document.getPage(pageNumber);
    const cached = documentCache.get(`url:${url}`);
    if (cached) {
      cached.lastAccess = now();
    }
  } catch {
    // Image-first rendering remains usable even when PDF prefetch fails.
  }
}
