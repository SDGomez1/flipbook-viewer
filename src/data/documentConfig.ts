import { ViewerDocumentConfig } from "../types/viewerDocument";

export const defaultDocumentConfig: ViewerDocumentConfig = {
  id: "flipbook-docs",
  title: "Flipbook Viewer",
  subtitle:
    "Example configuration for local development.",
  baseUrl: "/assets/docs",
  name: "flipbook",
  totalPages: 112,
  pdfStrategy: "perPage",
  paddingDigits: 2
};
