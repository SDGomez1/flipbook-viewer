import { ViewerDocumentConfig } from "../types/viewerDocument";

export const documentConfig: ViewerDocumentConfig = {
  id: "flipbook-docs",
  title: "Flipbook Viewer",
  subtitle: "Runtime assets loaded from /public/assets/docs",
  baseUrl: "/assets/docs",
  name: "flipbook",
  totalPages: 112,
  pdfStrategy: "perPage",
  paddingDigits: 2
};
