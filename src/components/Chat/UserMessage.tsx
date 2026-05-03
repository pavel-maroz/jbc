import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";
import type { UserMessage as UserMessageType } from "@/types/chat";
import { ConfirmPopover } from "./ConfirmPopover";

interface UserMessageProps {
  message: UserMessageType;
}

export function UserMessage({ message }: UserMessageProps) {
  const currentOperation = useChatStore((s) => s.currentOperation);
  const startRollback = useChatStore((s) => s.startRollback);
  const mutedFromMessageId = useChatStore((s) => s.mutedFromMessageId);

  const [rollbackOpen, setRollbackOpen] = useState(false);

  const isOperationActive = currentOperation !== null;
  // Hide the Rollback action on the message that already IS the mute
  // boundary: rolling back to it again is a no-op (the formula in
  // runRollbackOperation would set mutedFromMessageId to the same id),
  // but it would still spin up a service round-trip and a confirm step.
  // Other muted messages keep the button so partial de-muting still
  // works (rollback to a deeper muted message lifts the boundary down).
  const isMuteBoundary = message.id === mutedFromMessageId;

  return (
    <div className="group/user relative">
      <div className="border border-border bg-sidebar-accent rounded-lg px-3 py-1.5">
        <span className="text-sm text-sidebar-foreground whitespace-pre-wrap">
          {message.content}
        </span>
      </div>

      {!isMuteBoundary && (
        <div
          className={cn(
            "absolute -top-3 right-2 flex items-center gap-1",
            "opacity-0 group-hover/user:opacity-100",
            "transition-opacity",
            rollbackOpen && "opacity-100",
          )}
        >
          <ConfirmPopover
            open={rollbackOpen}
            onOpenChange={setRollbackOpen}
            description="Roll back this and later changes?"
            confirmLabel="Roll back"
            destructive
            onConfirm={() => {
              void startRollback(message.id);
            }}
            trigger={
              <button
                type="button"
                disabled={isOperationActive}
                aria-label="Roll back to this message"
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs",
                  "border border-border bg-background text-muted-foreground",
                  "shadow-sm",
                  "hover:bg-muted/40 hover:text-foreground",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-muted-foreground",
                  "transition-colors",
                )}
              >
                <RotateCcw className="h-3 w-3" />
                Rollback
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
