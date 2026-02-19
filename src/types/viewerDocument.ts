export type PdfStrategy = "auto" | "perPage" | "single";

export type ViewerDocumentConfig = {
  id: string;
  title: string;
  subtitle: string;
  baseUrl: string;
  name: string;
  totalPages: number;
  pdfStrategy?: PdfStrategy;
  paddingDigits?: 2 | 3;
};
