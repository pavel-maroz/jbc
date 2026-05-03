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

  const [rollbackOpen, setRollbackOpen] = useState(false);

  const isOperationActive = currentOperation !== null;

  return (
    <div className="group/user relative">
      <div className="border border-border bg-sidebar-accent rounded-lg px-3 py-1.5">
        <span className="text-sm text-sidebar-foreground whitespace-pre-wrap">
          {message.content}
        </span>
      </div>

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
    </div>
  );
}
