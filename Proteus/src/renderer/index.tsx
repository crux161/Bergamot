import React from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "@douyinfe/semi-ui";
import en_US from "@douyinfe/semi-ui/lib/es/locale/source/en_US";
import App from "./App";

// Styles
import "./styles/global.scss";
import "./styles/layout.scss";

// ── Synchronous theme restore (FOUC prevention) ──
// 1. Restore base theme class (dark/light) on html+body
const savedBaseTheme = localStorage.getItem("bergamot_base_theme") || "dark";
document.documentElement.classList.add(`theme-${savedBaseTheme}`);
document.body.classList.add(`theme-${savedBaseTheme}`);

// 2. Read cached BD theme CSS from localStorage and inject before React renders.
const savedThemeCss = localStorage.getItem("bergamot_theme_css");
if (savedThemeCss) {
  const style = document.createElement("style");
  style.id = "bergamot-custom-theme";
  style.textContent = savedThemeCss;
  document.head.appendChild(style);
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <LocaleProvider locale={en_US}>
      <App />
    </LocaleProvider>
  </React.StrictMode>
);
