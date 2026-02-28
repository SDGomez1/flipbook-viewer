import { PdfStrategy, ViewerDocumentConfig } from "../types/viewerDocument";

export const defaultDocumentConfig: ViewerDocumentConfig = {
  id: "flipbook-docs",
  title: "Flipbook Viewer",
  subtitle:
    "Use query params (?baseUrl=...&name=...&totalPages=...) to load remote assets.",
  baseUrl: "/assets/docs",
  name: "flipbook",
  totalPages: 112,
  pdfStrategy: "perPage",
  paddingDigits: 2
};

const VALID_STRATEGIES: ReadonlySet<PdfStrategy> = new Set([
  "auto",
  "perPage",
  "single"
]);

function readParam(params: URLSearchParams, keys: string[]): string | null {
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

function parsePositiveInt(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function parsePaddingDigits(value: string | null): 2 | 3 | null {
  if (value === "2") {
    return 2;
  }

  if (value === "3") {
    return 3;
  }

  return null;
}

function parsePdfStrategy(value: string | null): PdfStrategy | null {
  if (value === null || !VALID_STRATEGIES.has(value as PdfStrategy)) {
    return null;
  }

  return value as PdfStrategy;
}

export function resolveDocumentConfigFromSearch(
  search: string,
  fallback: ViewerDocumentConfig = defaultDocumentConfig
): ViewerDocumentConfig {
  const params = new URLSearchParams(search);
  const baseUrl = readParam(params, ["baseUrl", "assetsBaseUrl"]) ?? fallback.baseUrl;
  const name = readParam(params, ["name", "documentName"]) ?? fallback.name;
  const totalPages =
    parsePositiveInt(readParam(params, ["totalPages", "pages"])) ??
    fallback.totalPages;
  const title = readParam(params, ["title"]) ?? fallback.title;
  const subtitle = readParam(params, ["subtitle"]) ?? fallback.subtitle;
  const id = readParam(params, ["id", "documentId"]) ?? fallback.id;
  const pdfStrategy =
    parsePdfStrategy(readParam(params, ["pdfStrategy"])) ?? fallback.pdfStrategy;
  const paddingDigits =
    parsePaddingDigits(readParam(params, ["paddingDigits"])) ??
    fallback.paddingDigits;

  return {
    ...fallback,
    id,
    title,
    subtitle,
    baseUrl,
    name,
    totalPages,
    pdfStrategy,
    paddingDigits
  };
}

export function getRuntimeDocumentConfig(): ViewerDocumentConfig {
  if (typeof window === "undefined") {
    return defaultDocumentConfig;
  }

  return resolveDocumentConfigFromSearch(window.location.search);
}

export const runtimeDocumentConfig = getRuntimeDocumentConfig();
export const documentConfig = runtimeDocumentConfig;
