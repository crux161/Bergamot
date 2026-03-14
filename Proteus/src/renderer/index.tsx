import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Styles
import "./styles/global.scss";
import "./styles/layout.scss";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
