import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";
import type { MessageFeedback } from "@/types/chat";
import { Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useCallback, useState } from "react";

interface FeedbackFormProps {
  messageId: string;
  currentFeedback?: MessageFeedback;
}

/**
 * INTENTIONAL UX ISSUE: Uses single-line input instead of textarea,
 * making it difficult to enter long feedback text.
 * This is a known issue for candidates to identify.
 */
export function FeedbackForm({
  messageId,
  currentFeedback,
}: FeedbackFormProps) {
  const [showInput, setShowInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedRating, setSelectedRating] = useState<MessageFeedback>(
    currentFeedback ?? null,
  );
  const setMessageFeedback = useChatStore((s) => s.setMessageFeedback);

  const handleQuickFeedback = useCallback(
    (rating: MessageFeedback) => {
      setSelectedRating(rating);
      setMessageFeedback(messageId, rating);
    },
    [messageId, setMessageFeedback],
  );

  const handleShowInput = useCallback((rating: MessageFeedback) => {
    setSelectedRating(rating);
    setShowInput(true);
  }, []);

  const handleSubmitWithText = useCallback(() => {
    if (selectedRating) {
      setMessageFeedback(messageId, selectedRating, feedbackText || undefined);
      setShowInput(false);
      setFeedbackText("");
    }
  }, [messageId, selectedRating, feedbackText, setMessageFeedback]);

  const handleClose = useCallback(() => {
    setShowInput(false);
    setFeedbackText("");
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitWithText();
    }
  };

  if (currentFeedback && !showInput) {
    return (
      <div className="flex items-center gap-1 mt-2">
        <span className="text-xs text-muted-foreground">Feedback:</span>
        {currentFeedback === "positive" ? (
          <ThumbsUp className="h-3 w-3 text-green-500" />
        ) : (
          <ThumbsDown className="h-3 w-3 text-red-500" />
        )}
      </div>
    );
  }

  if (showInput) {
    return (
      <div className="mt-2 p-2 bg-muted/30 rounded-lg max-w-56">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {selectedRating === "positive" ? (
              <ThumbsUp className="h-3 w-3 text-green-500" />
            ) : (
              <ThumbsDown className="h-3 w-3 text-red-500" />
            )}
            <span>Add feedback</span>
          </div>
          <button
            onClick={handleClose}
            className="rounded p-0.5 hover:bg-accent"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="flex gap-1">
          {/* INTENTIONAL BUG: Single-line input instead of textarea */}
          <input
            type="text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What could be better?"
            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={handleSubmitWithText}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex gap-1 mt-1">
          <button
            onClick={() => setSelectedRating("positive")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 rounded-md p-1 text-xs transition-colors",
              selectedRating === "positive"
                ? "bg-green-500/20 text-green-600"
                : "hover:bg-accent",
            )}
          >
            <ThumbsUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => setSelectedRating("negative")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 rounded-md p-1 text-xs transition-colors",
              selectedRating === "negative"
                ? "bg-red-500/20 text-red-600"
                : "hover:bg-accent",
            )}
          >
            <ThumbsDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-2">
      <button
        onClick={() => handleQuickFeedback("positive")}
        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-green-500 transition-colors"
        title="Good response"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => handleQuickFeedback("negative")}
        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-500 transition-colors"
        title="Bad response"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => handleShowInput("positive")}
        className="ml-1 text-xs text-muted-foreground hover:text-sidebar-foreground transition-colors"
      >
        Add comment...
      </button>
    </div>
  );
}
