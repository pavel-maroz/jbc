import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App";

if (import.meta.env.DEV) {
  // Dynamic imports keep dev-only controls out of the production bundle.
  void import("./dev/mockControls");
  void import("./dev/storeControls");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
