import { installWebBridge } from "./services/webBridge";

// Install the web bridge BEFORE any other imports that might touch window.bergamot
installWebBridge();

import React from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "@douyinfe/semi-ui";
import en_US from "@douyinfe/semi-ui/lib/es/locale/source/en_US";
import App from "./App";
import { initializeThemeRuntime, restoreThemeSnapshot } from "./theme/runtime";

// Styles
import "./styles/global.scss";
import "./styles/layout.scss";

restoreThemeSnapshot();
void initializeThemeRuntime();

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <LocaleProvider locale={en_US}>
      <App />
    </LocaleProvider>
  </React.StrictMode>
);
