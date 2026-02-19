type BinChunkCacheEntry = {
  lastAccess: number;
  promise: Promise<ArrayBuffer>;
};

type ParsedBinChunk =
  | {
      kind: "singlePdf";
    }
  | {
      kind: "concatenatedPdf";
      segments: Array<{
        start: number;
        end: number;
      }>;
    }
  | {
      kind: "unknown";
      reason: string;
    };

type ParsedBinCacheEntry = {
  lastAccess: number;
  parsed: ParsedBinChunk;
};

export type BinPdfResolution =
  | {
      cacheKey: string;
      bytes: ArrayBuffer;
      pageNumberInDocument: number;
      source: "singlePdfBin";
    }
  | {
      cacheKey: string;
      bytes: ArrayBuffer;
      pageNumberInDocument: 1;
      source: "concatenatedPdfBin";
    };

const MAX_BIN_CHUNK_CACHE = 8;
const MAX_PARSED_BIN_CACHE = 12;

const binChunkCache = new Map<string, BinChunkCacheEntry>();
const parsedBinCache = new Map<string, ParsedBinCacheEntry>();

const PDF_SIGNATURE = "%PDF-";
const PDF_SIGNATURE_BYTES = new TextEncoder().encode(PDF_SIGNATURE);

function now(): number {
  return Date.now();
}

function evictLruEntry<T extends { lastAccess: number }>(
  map: Map<string, T>,
  maxEntries: number
): void {
  while (map.size > maxEntries) {
    let oldestKey: string | null = null;
    let oldestAccess = Number.POSITIVE_INFINITY;

    map.forEach((entry, key) => {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    });

    if (!oldestKey) {
      break;
    }

    map.delete(oldestKey);
  }
}

function findSignatureIndices(
  bytes: Uint8Array,
  signature: Uint8Array
): number[] {
  const indices: number[] = [];
  if (signature.length === 0 || bytes.length < signature.length) {
    return indices;
  }

  for (let i = 0; i <= bytes.length - signature.length; i += 1) {
    let match = true;
    for (let j = 0; j < signature.length; j += 1) {
      if (bytes[i + j] !== signature[j]) {
        match = false;
        break;
      }
    }

    if (match) {
      indices.push(i);
    }
  }

  return indices;
}

async function fetchBinChunk(url: string): Promise<ArrayBuffer> {
  const cached = binChunkCache.get(url);
  if (cached) {
    cached.lastAccess = now();
    return cached.promise;
  }

  const responsePromise = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`BIN fetch failed (${response.status}) for ${url}`);
      }
      return response.arrayBuffer();
    })
    .catch((error) => {
      binChunkCache.delete(url);
      throw error;
    });

  binChunkCache.set(url, {
    lastAccess: now(),
    promise: responsePromise
  });
  evictLruEntry(binChunkCache, MAX_BIN_CHUNK_CACHE);
  return responsePromise;
}

async function parseBinChunk(url: string): Promise<ParsedBinChunk> {
  const parsedEntry = parsedBinCache.get(url);
  if (parsedEntry) {
    parsedEntry.lastAccess = now();
    return parsedEntry.parsed;
  }

  const buffer = await fetchBinChunk(url);
  const bytes = new Uint8Array(buffer);
  const pdfStarts = findSignatureIndices(bytes, PDF_SIGNATURE_BYTES);

  let parsed: ParsedBinChunk;
  if (pdfStarts.length === 0) {
    parsed = {
      kind: "unknown",
      reason: "No %PDF signature found in BIN payload."
    };
  } else if (pdfStarts.length === 1) {
    parsed = { kind: "singlePdf" };
  } else {
    const segments = pdfStarts.map((start, index) => ({
      start,
      end: pdfStarts[index + 1] ?? buffer.byteLength
    }));
    parsed = {
      kind: "concatenatedPdf",
      segments
    };
  }

  parsedBinCache.set(url, {
    lastAccess: now(),
    parsed
  });
  evictLruEntry(parsedBinCache, MAX_PARSED_BIN_CACHE);

  return parsed;
}

function getPageOffsetInBin(page: number, binIndex: number): number {
  const startPage = binIndex - 9;
  return page - startPage + 1;
}

export async function resolvePdfFromBin(
  binUrl: string,
  page: number,
  binIndex: number
): Promise<BinPdfResolution | null> {
  const pageOffset = getPageOffsetInBin(page, binIndex);
  if (pageOffset < 1 || pageOffset > 10) {
    return null;
  }

  const [buffer, parsed] = await Promise.all([fetchBinChunk(binUrl), parseBinChunk(binUrl)]);

  if (parsed.kind === "singlePdf") {
    return {
      cacheKey: `bin:${binUrl}:single`,
      bytes: buffer,
      pageNumberInDocument: pageOffset,
      source: "singlePdfBin"
    };
  }

  if (parsed.kind === "concatenatedPdf") {
    const segment = parsed.segments[pageOffset - 1];
    if (!segment) {
      return null;
    }

    return {
      cacheKey: `bin:${binUrl}:segment:${pageOffset}`,
      bytes: buffer.slice(segment.start, segment.end),
      pageNumberInDocument: 1,
      source: "concatenatedPdfBin"
    };
  }

  return null;
}

export async function prefetchBinChunk(binUrl: string): Promise<void> {
  try {
    await Promise.all([fetchBinChunk(binUrl), parseBinChunk(binUrl)]);
  } catch {
    // BIN prefetch is opportunistic; failures should not block image/PDF fallback.
  }
}
