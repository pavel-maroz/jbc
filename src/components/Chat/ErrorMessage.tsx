import type { ErrorMessage as ErrorMessageType } from "@/types/chat";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorMessageActions {
  onRetry?: () => void;
  onCancel?: () => void;
  retryLabel?: string;
  cancelLabel?: string;
}

interface ErrorMessageProps {
  /** Chat-history error message. `message.message` becomes the description. */
  message?: ErrorMessageType;
  /** Title above the description. Defaults to "Error". */
  title?: string;
  /** Description text. Overrides `message.message` when both are provided. */
  description?: string;
  /** Optional inline actions rendered below the description. */
  actions?: ErrorMessageActions;
}

/**
 * INTENTIONAL UX ISSUE: Error messages are displayed with technical details
 * instead of user-friendly messages. This is a known issue for candidates to identify.
 */
export function ErrorMessage({
  message,
  title,
  description,
  actions,
}: ErrorMessageProps) {
  const resolvedTitle = title ?? "Error";
  const resolvedDescription = description ?? message?.message ?? "";

  const hasRetry = !!actions?.onRetry;
  const hasCancel = !!actions?.onCancel;
  const hasActions = hasRetry || hasCancel;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
      role="alert"
    >
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-red-500 mb-1">{resolvedTitle}</p>
        {resolvedDescription && (
          <p className="text-sm text-red-400/90 break-words">
            {resolvedDescription}
          </p>
        )}
        {hasActions && (
          <div className="mt-2 flex items-center gap-2">
            {hasRetry && (
              <button
                type="button"
                onClick={actions!.onRetry}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md",
                  "bg-red-500/20 text-red-400 hover:bg-red-500/30",
                  "transition-colors",
                )}
              >
                {actions?.retryLabel ?? "Retry"}
              </button>
            )}
            {hasCancel && (
              <button
                type="button"
                onClick={actions!.onCancel}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md",
                  "border border-red-500/20 text-red-400 hover:bg-red-500/10",
                  "transition-colors",
                )}
              >
                {actions?.cancelLabel ?? "Cancel"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
