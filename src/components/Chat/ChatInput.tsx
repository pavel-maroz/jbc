import { cn } from "@/lib/utils";
import { Send, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

const MIN_LINES = 2;
const MAX_LINES = 8;

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  isAgentWorking?: boolean;
  onInterrupt?: () => void;
  placeholder?: string;
}

export function ChatInput({
  onSubmit,
  disabled = false,
  isAgentWorking = false,
  onInterrupt,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [metrics, setMetrics] = useState({ lineHeight: 20, padding: 8 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      const computed = window.getComputedStyle(textareaRef.current);
      const lh = parseFloat(computed.lineHeight) || 20;
      const pt = parseFloat(computed.paddingTop) || 0;
      const pb = parseFloat(computed.paddingBottom) || 0;
      setMetrics({ lineHeight: lh, padding: pt + pb });
    }
  }, []);

  const minHeight = MIN_LINES * metrics.lineHeight + metrics.padding;
  const maxHeight = MAX_LINES * metrics.lineHeight + metrics.padding;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isAgentWorking) return;

    onSubmit(trimmed);
    setValue("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, isAgentWorking, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [maxHeight]);

  const canSend = !disabled && !isAgentWorking && value.trim().length > 0;
  const canInterrupt = isAgentWorking && onInterrupt;

  const effectivePlaceholder = placeholder;

  return (
    <div className="mb-3 mx-3 relative">
      <div className="flex flex-col border border-input-border bg-secondary rounded-lg focus-within:border-input-border-focus transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={effectivePlaceholder}
          style={{ minHeight }}
          disabled={disabled}
          className={cn(
            "w-full resize-none bg-transparent px-2 pt-2 pb-2",
            "text-sm placeholder:text-muted-foreground leading-5 text-foreground",
            "focus:outline-none",
          )}
        />
        <div className="flex items-center justify-end px-2 pb-2 gap-2">
          {canInterrupt ? (
            <button
              onClick={onInterrupt}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm",
                "bg-red-500/20 text-red-400 hover:bg-red-500/30",
                "transition-colors",
              )}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop
            </button>
          ) : (
            /**
             * INTENTIONAL BUG: No hover state on send button.
             * This is a known issue for candidates to identify.
             */
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm",
                "bg-primary text-primary-foreground",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors",
              )}
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
