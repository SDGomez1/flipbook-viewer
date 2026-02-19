import { ViewerDocumentConfig } from "../types/viewerDocument";

type FetchLike = typeof fetch;

export type StrategyDetectionResult =
  | {
      pdfStrategy: "perPage";
      paddingDigits: 2 | 3;
      probeUrl: string;
    }
  | {
      pdfStrategy: "single";
      singlePdfUrl: string;
    }
  | {
      pdfStrategy: "imageOnly";
      reason: string;
    };

export type ResolvedPageAssets = {
  thumbUrl: string;
  imageUrl: string;
  pdfUrl: string | null;
  singlePdfUrl: string;
  binUrl: string;
  binIndex: number;
};

export type DocumentResolver = {
  getThumbUrl: (page: number) => string;
  getImageUrl: (page: number) => string;
  getPerPagePdfUrl: (page: number, digits: 2 | 3) => string;
  getBinIndexForPage: (page: number) => number;
  getBinUrlForPage: (page: number) => string;
  singlePdfUrl: string;
  resolvePageAssets: (
    page: number,
    options: ResolvePageOptions
  ) => ResolvedPageAssets;
};

type ResolvePageOptions = {
  detected: StrategyDetectionResult | null;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function padPage(page: number, digits: 2 | 3): string {
  return String(page).padStart(digits, "0");
}

function getPreferredPaddingOrder(
  config: ViewerDocumentConfig
): Array<2 | 3> {
  if (config.paddingDigits) {
    return config.paddingDigits === 2 ? [2, 3] : [3, 2];
  }

  return [2, 3];
}

async function probeUrlExists(url: string, fetchImpl: FetchLike): Promise<boolean> {
  try {
    const headResponse = await fetchImpl(url, { method: "HEAD" });

    if (headResponse.ok) {
      return true;
    }

    if (headResponse.status !== 405 && headResponse.status !== 501) {
      return false;
    }
  } catch {
    // Continue with a minimal GET probe when HEAD fails due CORS or server policy.
  }

  try {
    const getResponse = await fetchImpl(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" }
    });
    return getResponse.ok || getResponse.status === 206;
  } catch {
    return false;
  }
}

export function createDocumentResolver(config: ViewerDocumentConfig): DocumentResolver {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const singlePdfUrl = `${baseUrl}/${config.name}.pdf`;

  function getThumbUrl(page: number): string {
    return `${baseUrl}/${config.name}.pdf_${page}_thumb.jpg`;
  }

  function getImageUrl(page: number): string {
    return `${baseUrl}/${config.name}.pdf_${page}.jpg`;
  }

  function getPerPagePdfUrl(page: number, digits: 2 | 3): string {
    return `${baseUrl}/${config.name}_${padPage(page, digits)}.pdf`;
  }

  function getBinIndexForPage(page: number): number {
    return Math.ceil(page / 10) * 10;
  }

  function getBinUrlForPage(page: number): string {
    return `${baseUrl}/${config.name}.pdf_${getBinIndexForPage(page)}.bin`;
  }

  function resolvePageAssets(
    page: number,
    options: ResolvePageOptions
  ): ResolvedPageAssets {
    const detected = options.detected;
    const pdfUrl =
      detected?.pdfStrategy === "perPage"
        ? getPerPagePdfUrl(page, detected.paddingDigits)
        : detected?.pdfStrategy === "single"
          ? singlePdfUrl
          : null;

    return {
      thumbUrl: getThumbUrl(page),
      imageUrl: getImageUrl(page),
      pdfUrl,
      singlePdfUrl,
      binUrl: getBinUrlForPage(page),
      binIndex: getBinIndexForPage(page)
    };
  }

  return {
    getThumbUrl,
    getImageUrl,
    getPerPagePdfUrl,
    getBinIndexForPage,
    getBinUrlForPage,
    singlePdfUrl,
    resolvePageAssets
  };
}

export async function detectPdfStrategy(
  config: ViewerDocumentConfig,
  fetchImpl: FetchLike = fetch
): Promise<StrategyDetectionResult> {
  const resolver = createDocumentResolver(config);

  if (config.pdfStrategy === "single") {
    return {
      pdfStrategy: "single",
      singlePdfUrl: resolver.singlePdfUrl
    };
  }

  if (config.pdfStrategy === "perPage" && config.paddingDigits) {
    const url = resolver.getPerPagePdfUrl(1, config.paddingDigits);
    const exists = await probeUrlExists(url, fetchImpl);

    if (exists) {
      return {
        pdfStrategy: "perPage",
        paddingDigits: config.paddingDigits,
        probeUrl: url
      };
    }
  }

  const paddingOrder = getPreferredPaddingOrder(config);
  for (const digits of paddingOrder) {
    const url = resolver.getPerPagePdfUrl(1, digits);
    const exists = await probeUrlExists(url, fetchImpl);

    if (exists) {
      return {
        pdfStrategy: "perPage",
        paddingDigits: digits,
        probeUrl: url
      };
    }
  }

  const singleExists = await probeUrlExists(resolver.singlePdfUrl, fetchImpl);
  if (singleExists) {
    return {
      pdfStrategy: "single",
      singlePdfUrl: resolver.singlePdfUrl
    };
  }

  return {
    pdfStrategy: "imageOnly",
    reason: "No per-page or single PDF endpoint was detected."
  };
}
