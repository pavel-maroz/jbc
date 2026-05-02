import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAutoScrollOptions {
  threshold?: number;
  smooth?: boolean;
}

export interface UseAutoScrollReturn {
  containerRef: React.MutableRefObject<HTMLElement | null>;
  setContainer: (element: HTMLElement | null) => void;
  hasUnseenMessages: boolean;
  scrollToBottom: () => void;
  onContentAdded: () => void;
  onUserMessageSent: () => void;
}

const DEFAULT_THRESHOLD = 100;
const DEFAULT_SMOOTH = true;

export function useAutoScroll(
  options: UseAutoScrollOptions = {},
): UseAutoScrollReturn {
  const { threshold = DEFAULT_THRESHOLD, smooth = DEFAULT_SMOOTH } = options;

  const containerRef = useRef<HTMLElement | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const isPinnedRef = useRef(true);

  const [hasUnseenMessages, setHasUnseenMessages] = useState(false);
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(
    null,
  );

  const setContainer = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;
    setContainerElement(element);
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    isProgrammaticScrollRef.current = true;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });

    isPinnedRef.current = true;
    setHasUnseenMessages(false);

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 150);
  }, [smooth]);

  /**
   * INTENTIONAL BUG: Always scroll to bottom on new content,
   * ignoring whether user has scrolled up (isPinned state).
   * This is a known UX issue for candidates to identify.
   */
  const onContentAdded = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const onUserMessageSent = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    const container = containerElement;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isAtBottom = distanceFromBottom < threshold;

      if (isAtBottom) {
        isPinnedRef.current = true;
        setHasUnseenMessages(false);
      } else {
        isPinnedRef.current = false;
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerElement, threshold]);

  return {
    containerRef,
    setContainer,
    hasUnseenMessages,
    scrollToBottom,
    onContentAdded,
    onUserMessageSent,
  };
}
