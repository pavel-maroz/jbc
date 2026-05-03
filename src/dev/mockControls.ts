import { mockControls } from "@/services/mock-backend";

/**
 * Dev-only side-effect module: imported once from main.tsx under
 * `if (import.meta.env.DEV)`. It exposes mockControls on window.mock so the
 * sandbox can deterministically trigger the failed-callout, retry and
 * recovery flows from DevTools without rebuilding.
 *
 * This file is excluded from production by the conditional dynamic import
 * in main.tsx and never reaches the production bundle.
 */

declare global {
  interface Window {
    mock?: typeof mockControls;
  }
}

window.mock = mockControls;

console.info(
  "%c[mock] dev controls installed",
  "color: #8aa; font-weight: bold;",
  "\n  window.mock.setErrorRate(rate)  override random error rate (0..1, or null to reset)",
  "\n  window.mock.forceFailNext(n)    fail the next N shouldError() checks",
  "\n  window.mock.reset()             back to defaults",
  "\n  window.mock.getErrorRate()      current effective rate",
);
