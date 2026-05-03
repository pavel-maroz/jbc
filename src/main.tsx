import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App";

if (import.meta.env.DEV) {
  // Dynamic import keeps dev-only mock controls out of the production bundle.
  void import("./dev/mockControls");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
