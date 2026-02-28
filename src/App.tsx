import { ViewerShell } from "./components/ViewerShell";
import { defaultDocumentConfig } from "./data/documentConfig";
import { ViewerDocumentConfig } from "./types/viewerDocument";

type AppProps = {
  documentConfig?: ViewerDocumentConfig;
};

export default function App({ documentConfig = defaultDocumentConfig }: AppProps) {
  return <ViewerShell documentConfig={documentConfig} />;
}
