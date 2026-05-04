import { useCallback, useRef, useState } from "react";

export interface UseAutoGrowTextareaOptions {
  minLines: number;
  maxLines: number;
}

export interface UseAutoGrowTextareaReturn {
  /** Callback ref to attach to the textarea. */
  ref: (el: HTMLTextAreaElement | null) => void;
  /** Live element reference for callers that need focus/selection. */
  element: React.MutableRefObject<HTMLTextAreaElement | null>;
  onInput: () => void;
  minHeight: number;
  maxHeight: number;
  reset: () => void;
}

const DEFAULT_LINE_HEIGHT = 20;

/**
 * Lock a textarea to a [minLines, maxLines] viewport while letting it
 * grow with its content. Uses a callback ref so the live `line-height`
 * and vertical padding are measured the moment the element actually
 * mounts — which matters for callers that mount the textarea
 * conditionally (e.g. an edit-mode toggle).
 *
 * Usage:
 *   const { ref, onInput, minHeight, reset, element } =
 *     useAutoGrowTextarea({ minLines: 2, maxLines: 8 });
 *   <textarea ref={ref} onInput={onInput} style={{ minHeight }} />
 *
 * Call `reset()` after a programmatic clear (e.g. after submit) to
 * collapse the element back to `minHeight` instead of leaving it
 * stretched to the previous content's height.
 */
export function useAutoGrowTextarea({
  minLines,
  maxLines,
}: UseAutoGrowTextareaOptions): UseAutoGrowTextareaReturn {
  const element = useRef<HTMLTextAreaElement | null>(null);
  const [metrics, setMetrics] = useState({
    lineHeight: DEFAULT_LINE_HEIGHT,
    padding: 0,
  });

  const ref = useCallback((el: HTMLTextAreaElement | null) => {
    element.current = el;
    if (!el) return;
    const computed = window.getComputedStyle(el);
    const lh = parseFloat(computed.lineHeight) || DEFAULT_LINE_HEIGHT;
    const pt = parseFloat(computed.paddingTop) || 0;
    const pb = parseFloat(computed.paddingBottom) || 0;
    setMetrics((prev) =>
      prev.lineHeight === lh && prev.padding === pt + pb
        ? prev
        : { lineHeight: lh, padding: pt + pb },
    );
  }, []);

  const minHeight = minLines * metrics.lineHeight + metrics.padding;
  const maxHeight = maxLines * metrics.lineHeight + metrics.padding;

  const onInput = useCallback(() => {
    const el = element.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [maxHeight]);

  const reset = useCallback(() => {
    const el = element.current;
    if (!el) return;
    el.style.height = "auto";
  }, []);

  return { ref, element, onInput, minHeight, maxHeight, reset };
}
